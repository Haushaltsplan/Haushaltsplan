import type { CoachImagePart } from '@/lib/finance-coach-images'
import { geminiFreeTierFlashModelKandidaten } from '@/lib/ki-coach-backend'
import {
  applyMultipackGetraenkKorrektur,
  istLagerIrrelevantPfandOderLeergut,
  lagerArtikelSammelname,
} from '@/lib/lager-artikel-kanonisch'
import { LAGER_PRODUKT_KATEGORIEN, lagerKategorieFinal } from '@/lib/lager-produkt-kategorie'

export type Kassenzeile = {
  artikel: string
  menge: number
  einzelpreis?: number | null
  gesamtpreis?: number | null
  einheit?: string | null
  /** Warengruppe (siehe LAGER_PRODUKT_KATEGORIEN). */
  kategorie: string
}

type GeminiExtract = { positionen?: Kassenzeile[] }

const RECEIPT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    positionen: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          artikel: { type: 'STRING' },
          menge: { type: 'NUMBER' },
          einzelpreis: { type: 'NUMBER' },
          gesamtpreis: { type: 'NUMBER' },
          einheit: { type: 'STRING' },
          kategorie: { type: 'STRING', enum: [...LAGER_PRODUKT_KATEGORIEN] },
        },
        required: ['artikel', 'menge', 'kategorie'],
      },
    },
  },
  required: ['positionen'],
} as const

/**
 * Reihenfolge: Modell aus .env, dann Free-Tier-Flash-Modelle (Tageskontingent pro Modell).
 * @see https://ai.google.dev/gemini-api/docs/models
 */
function modellKandidaten(primaer: string): string[] {
  const chain = geminiFreeTierFlashModelKandidaten()
  const p = primaer.trim()
  if (!p) return chain
  const out = [p]
  for (const m of chain) {
    if (!out.includes(m)) out.push(m)
  }
  return out
}

/** HTTP-/Textfehler: nächstes Modell versuchen (Quota, Rate-Limit, unbekanntes Modell). */
function sollNaechstesGeminiModellVersuchen(res: Response, fehlerText: string): boolean {
  if (res.status === 404 || res.status === 429) return true
  const m = fehlerText.toLowerCase()
  if (m.includes('quota') || m.includes('free_tier')) return true
  if (m.includes('resource_exhausted')) return true
  if (m.includes('rate limit') || m.includes('rate-limit')) return true
  if (m.includes('exceeded your current quota')) return true
  if (m.includes('not found') && m.includes('model')) return true
  return false
}

function buildGeminiUrl(apiKey: string, modelId: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`
}

type GeminiGenResponse = {
  error?: { message?: string; code?: number }
  candidates?: Array<{
    finishReason?: string
    content?: { parts?: Array<{ text?: string }> }
  }>
  promptFeedback?: { blockReason?: string }
}

function extrahiereTextAusAntwort(raw: string): string {
  let data: GeminiGenResponse
  try {
    data = JSON.parse(raw) as GeminiGenResponse
  } catch {
    throw new Error('Ungültige Antwort von Gemini (kein JSON).')
  }
  if (data.error?.message) {
    throw new Error(`Gemini: ${data.error.message}`)
  }

  const block = data.promptFeedback?.blockReason
  const cand = data.candidates?.[0]
  const finish = cand?.finishReason
  const text = cand?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? ''

  if (!text) {
    const hinweis = [block, finish].filter(Boolean).join(' · ') || 'kein Text'
    throw new Error(`Keine nutzbare Modellantwort (${hinweis}).`)
  }
  return text
}

function parseMengeAusZeile(p: { menge?: unknown }): number {
  const v = p.menge
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') return Number(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number(v)
}

export async function extractKassenzettelPositionen(
  apiKey: string,
  model: string,
  images: CoachImagePart[],
  userHint?: string,
): Promise<Kassenzeile[]> {
  if (!images.length) throw new Error('Mindestens ein Belegbild nötig.')

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
  for (const im of images) {
    parts.push({ inlineData: { mimeType: im.mimeType, data: im.base64 } })
  }
  parts.push({
    text:
      (userHint?.trim() ? `${userHint.trim()}\n\n` : '') +
      'Du siehst einen deutschen Supermarkt-Kassenzettel. Extrahiere jede **gekaufte Ware** als eigene Position (kein reines Pfand/Leergut).\n\n' +
      'Feld **artikel** — Lager-Sammelbegriff (kurz, zum Haushaltslager passend):\n' +
      '- Immer der **Alltags-Warennamen**, **ohne** Marken, **ohne** Discounter-/Lieferanten-Kürzel am Anfang (z. B. kein „EHL“, „TK“).\n' +
      '- Sorten/Zucht/Verkaufsform weglassen: z. B. **Tomaten** statt „Rispen-Tomaten“ / „Cocktailtomaten“, **Möhren** statt „EHL Möhren“, **Gurken** statt „Salatgurken“.\n' +
      '- Gebinde-Größe **nicht** im Namen: z. B. Artikel **Club Mate**, Menge **0,5**, Einheit **Liter** — nicht „Club-Mate 0,5l“ als ein einziger Name.\n' +
      '- **Passierte Tomaten** o. Ä. bleibt eigenständig, wenn es keine Frischware ist.\n' +
      '- **Kein** Fleisch bei **Bier** o. ä.: z. B. „Hacklberger Urhell“ ist **Bier** (Warengruppe **Bier**), **nicht** Hackfleisch — Markenname im Artikel erlaubt.\n' +
      '- **Kasten / Multipack-Getränke** (Bier, Mate, Limo): Steht auf dem Bon z. B. **20x0,5l**, **20 x 0,5 l**, **24x0,33l** (Anzahl Flaschen × Volumen pro Flasche), dann **menge = erste Zahl** (z. B. **20**), **einheit = Stück** (so viele Flaschen), **gesamtpreis** = Zeilensumme für den ganzen Kasten. **Nicht** menge **0,5** und einheit **Liter** — das wäre nur eine Flasche statt 20×0,5 l.\n' +
      '- **Schmand**: Kürzel wie **B.L.Frisch.Sc**, **Frisch.Sc**, **Frisch Sc** auf EDEKA-Bons = **Schmand** (saure Sahne), **nicht** Frischkäse — Artikel **Schmand**, Kategorie **Milchprodukte**.\n' +
      '- **Glühwein**: Marken-/Sorten-Zeilen (Christkindl, Kunzmann, …) als **ein** Artikel **Glühwein** führen — **nicht** „Glühmost“ (Apfel/Punsch), der bleibt eigenständig.\n' +
      '- **Joghurt Gums** / Katjes / Fruchtgummi = **Süßigkeiten** (nicht Milchprodukte); echtes Joghurt = **Milchprodukte**.\n\n' +
      'Feld **kategorie** — für jede Position **genau eine** dieser Warengruppen (deutscher Name):\n' +
      `${LAGER_PRODUKT_KATEGORIEN.join(', ')}.\n` +
      '- Beispiele: Gurken/Tomaten → **Gemüse**; Bier/Pils/Urhell/Hacklberger → **Bier**; Wein/Glühwein/Sekt → **Wein & Sekt**; Cola/Mate/Saft/Wasser → **Getränke**; Toffifee/Schokolade → **Süßigkeiten**; Waschmittel → **Haushalt & Reinigung**; Hackfleisch/Wurst → **Fleisch & Wurst**.\n\n' +
      'WICHTIG — Mengen und Preise:\n' +
      '- menge: immer die **tatsächlich gekaufte Menge** (z. B. Stückzahl; bei Gewicht **das gewogene kg**, z. B. 0,487 oder 2,350 — niemals 1 nur weil „1 kg“ auf dem Etikett steht, wenn auf dem Bon z. B. „0,487 kg“ steht).\n' +
      '- Bei Gramm auf dem Bon: menge in **kg** umrechnen (350 g → 0,35).\n' +
      '- Bei **einzelnen** Flaschen/Dosen (eine Zeile, eine Flasche): menge und einheit **wahrheitsgemäß** (0,5 l → menge 0,5, einheit Liter).\n' +
      '- Bei **Kasten** (Nx…l siehe oben): immer **menge = N**, **einheit = Stück**.\n' +
      '- einzelpreis: der auf der Zeile erkennbare **Stück-** oder **Referenzpreis pro kg/l** (EUR), wenn gedruckt; sonst null.\n' +
      '- gesamtpreis: der **wirklich gezahlte Zeilenendbetrag** dieser Position (EUR), wie auf dem Bon nach Gewicht/Stück — also meist **nicht** nur der kg-Preis. Wenn die Zeile eine klare Summe zeigt, diese nehmen. Wenn nur kg-Preis und Gewicht da sind: gesamtpreis = null (reicht für Nachrechnung).\n' +
      '- einheit: z. B. „kg“, „g“, „ml“, „Liter“, „Stück“ — zur Menge passend.\n' +
      '- artikel: **normale deutsche Schreibweise** (z. B. „Currywürste“), nicht in VERSALIEN wie auf dem Bon.\n\n' +
      'Reine **Pfand-/Mehrweg-/Leergut-Zeilen** (nur Pfandbetrag, keine Ware) **weglassen** — nicht in positionen.\n' +
      'Nur gültiges JSON liefert das Schema.',
  })

  const structuredBody = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: RECEIPT_SCHEMA,
    },
  }

  const plainBody = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  }

  const simplestBody = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.1 },
  }

  async function doFetch(url: string, body: object) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const raw = await res.text()
    return { res, raw }
  }

  let lastErr = 'Unbekannter Fehler'
  for (const modelId of modellKandidaten(model)) {
    const url = buildGeminiUrl(apiKey, modelId)

    let { res, raw } = await doFetch(url, structuredBody)
    if (!res.ok && res.status === 400) {
      ;({ res, raw } = await doFetch(url, plainBody))
    }
    if (!res.ok && res.status === 400) {
      ;({ res, raw } = await doFetch(url, simplestBody))
    }

    if (!res.ok) {
      try {
        const j = JSON.parse(raw) as { error?: { message?: string } }
        if (j?.error?.message) lastErr = j.error.message
        else lastErr = raw.slice(0, 400)
      } catch {
        lastErr = raw.slice(0, 400)
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Gemini: ${lastErr}`)
      }
      if (sollNaechstesGeminiModellVersuchen(res, lastErr)) {
        continue
      }
      throw new Error(`Gemini (${modelId}): ${lastErr}`)
    }

    let text: string
    try {
      text = extrahiereTextAusAntwort(raw)
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
      continue
    }

    let parsed: GeminiExtract
    try {
      parsed = JSON.parse(text) as GeminiExtract
    } catch {
      const m = text.match(/\{[\s\S]*"positionen"[\s\S]*\}/)
      if (m) {
        try {
          parsed = JSON.parse(m[0]) as GeminiExtract
        } catch {
          lastErr = 'Modell lieferte kein gültiges JSON.'
          continue
        }
      } else {
        lastErr = 'Modell lieferte kein gültiges JSON.'
        continue
      }
    }

    const pos = Array.isArray(parsed.positionen) ? parsed.positionen : []
    const zeilen = pos
      .map((p) => {
        const roh0 = String(p.artikel ?? '').trim()
        if (istLagerIrrelevantPfandOderLeergut(roh0)) return null
        const pack = applyMultipackGetraenkKorrektur(roh0)
        const roh = pack?.roh ?? roh0
        const menge = pack?.menge ?? parseMengeAusZeile(p as { menge?: unknown })
        const einheit = pack?.einheit ?? (p.einheit != null ? String(p.einheit).trim() : null)
        const artikel = lagerArtikelSammelname(roh)
        const katRaw = (p as Record<string, unknown>).kategorie
        const kategorie = lagerKategorieFinal(typeof katRaw === 'string' ? katRaw : null, artikel)
        return {
          artikel,
          menge,
          einzelpreis: p.einzelpreis != null && Number.isFinite(Number(p.einzelpreis)) ? Number(p.einzelpreis) : null,
          gesamtpreis: p.gesamtpreis != null && Number.isFinite(Number(p.gesamtpreis)) ? Number(p.gesamtpreis) : null,
          einheit,
          kategorie,
        } as Kassenzeile
      })
      .filter((p): p is Kassenzeile => {
        if (p == null) return false
        return p.artikel.length > 0 && Number.isFinite(p.menge) && p.menge > 0
      })

    if (!zeilen.length) {
      lastErr = 'Modell lieferte keine gültigen Zeilen (Artikel + Menge > 0).'
      continue
    }
    return zeilen
  }

  throw new Error(
    `Gemini: ${lastErr} — Tipp: in .env.local z. B. GEMINI_MODEL=gemini-2.5-flash oder gemini-3-flash-preview setzen und Dev-Server neu starten.`,
  )
}
