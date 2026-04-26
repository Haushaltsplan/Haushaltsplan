import {
  COACH_MAX_IMAGES_PER_MESSAGE,
  resolveCoachProvider,
  runCoachCompletion,
  type CoachMessage,
} from '@/lib/ki-coach-backend'

/** Wie viele Motive gleichzeitig (API + UI). */
export const NATUR_MAX_FOTOS = Math.min(4, COACH_MAX_IMAGES_PER_MESSAGE)

export type NaturBildTeil = {
  buffer: Buffer
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

/** Gemini `responseSchema` (OpenAPI-ähnlich) */
const NATUR_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    kategorie: {
      type: 'STRING',
      description:
        'Genau eine Kategorie: tier, pflanze, pilz, kein_lebewesen (z. B. Stein, Objekt), unklar (nicht erkennbar). Muss **zur** anatomie_zuerst passen (Fisch, Vogel, Nager → immer `tier` — niemals `pilz`).',
    },
    anatomie_zuerst: {
      type: 'STRING',
      description:
        'Obligatorisch VOR jeder Artbennenung, 2–4 Sätze: nur was **sichtbar** ist. Prüfe zuerst **Domäne**: Flossen, Kiemen, Schuppen, schlanker Fischkörper, Augen-Seitstellung → wahrscheinlich Fisch = `tier` (Fischart); Lamellen, Stiel, Hut, Röhren → eher `pilz`; Blätter, Blüte, Nadel, Stamm → eher `pflanze`. Wenn dazu passend die Domäne unsicher: `unklar` + niedrige sicherheit_prozent. Keine Arten- oder Pilznamen in diesem Feld.',
    },
    deutsche_bezeichnung: {
      type: 'STRING',
      description:
        'Nur **nach** anatomie_zuerst: gebräuchlicher Name (z. B. Eiche, Bitterling, Birkenpilz). Darf kein reiner **Pilzname** sein, wenn anatomie zuvor Fisch/tier; darf kein Trivialname Fisch, wenn sichtbar Pilz-Substrat.',
    },
    wissenschaftlicher_name: {
      type: 'STRING',
      nullable: true,
      description: 'Latinisiertes Art-Epitheton mit Gattung, falls sinnvoll; sonst null.',
    },
    kurztext: {
      type: 'STRING',
      description: '2–5 Sätze: was es voraussichtlich ist, woran man es erkennt; sachlich und verständlich.',
    },
    merkmale_im_bild: {
      type: 'STRING',
      description: 'Stichpunkte oder kurzer Text: was im Foto sichtbar ist (Blätter, Hut, Fell, Größe schätzbar, …).',
    },
    verwechslungsgefahr: {
      type: 'STRING',
      nullable: true,
      description: 'Mit wem es verwechselt werden könnte; null wenn gering/unbekannt.',
    },
    vertrauen: {
      type: 'STRING',
      description: 'Eine von: hoch, mittel, niedrig — stimmig mit sicherheit_prozent (hoch eher 70–100, mittel 35–69, niedrig 0–34).',
    },
    sicherheit_prozent: {
      type: 'INTEGER',
      description:
        'Ganze Zahl 0–100: subjektive, ehrliche Einschätzung, mit wie viel Prozent Wahrscheinlichkeit der genannte Befund **allein von diesem Foto** zutrifft. Bei schlechtem Bildausschnitt niedriger wählen.',
    },
    sicherheitshinweis: {
      type: 'STRING',
      description:
        'Kurzer Hinweis: z. B. bei Pilzen/Pflanzen nie blind verzehren; bei Tieren keine medizinische Diagnose. Immer neutral formulieren.',
    },
  },
  required: [
    'kategorie',
    'anatomie_zuerst',
    'deutsche_bezeichnung',
    'kurztext',
    'merkmale_im_bild',
    'vertrauen',
    'sicherheit_prozent',
    'sicherheitshinweis',
  ],
}

function parseVisionJson(reply: string): unknown {
  const t = reply.trim()
  try {
    return JSON.parse(t) as unknown
  } catch {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1)) as unknown
      } catch {
        return null
      }
    }
    return null
  }
}

const KATEGORIEN = new Set(['tier', 'pflanze', 'pilz', 'kein_lebewesen', 'unklar'])
const VERTRAUEN = new Set(['hoch', 'mittel', 'niedrig'])

export type NaturKategorieId = 'tier' | 'pflanze' | 'pilz' | 'kein_lebewesen' | 'unklar'
export type NaturVertrauenId = 'hoch' | 'mittel' | 'niedrig'

export type NaturBestimmungErgebnis = {
  kategorie: NaturKategorieId
  /** Sichtform zuerst (Domäne), ohne Spekulation */
  anatomie_zuerst: string
  deutsche_bezeichnung: string
  wissenschaftlicher_name: string | null
  kurztext: string
  merkmale_im_bild: string
  verwechslungsgefahr: string | null
  vertrauen: NaturVertrauenId
  /** 0–100, ehrliche Einschätzung nur aus dem Foto */
  sicherheit_prozent: number
  sicherheitshinweis: string
}

function normalisiereKategorie(raw: unknown): NaturKategorieId {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (KATEGORIEN.has(s)) return s as NaturKategorieId
  return 'unklar'
}

function normalisiereVertrauen(raw: unknown): NaturVertrauenId {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (VERTRAUEN.has(s)) return s as NaturVertrauenId
  return 'mittel'
}

const VERTRAUEN_FALLBACK_PROZENT: Record<NaturVertrauenId, number> = {
  hoch: 75,
  mittel: 50,
  niedrig: 25,
}

function normalisiereSicherheitProzent(
  raw: unknown,
  vertrauen: NaturVertrauenId,
): number {
  let n: number
  if (typeof raw === 'number' && Number.isFinite(raw)) n = Math.round(raw)
  else if (typeof raw === 'string' && raw.trim() !== '') {
    const p = Number.parseFloat(raw.replace(',', '.'))
    n = Number.isFinite(p) ? Math.round(p) : VERTRAUEN_FALLBACK_PROZENT[vertrauen]
  } else n = VERTRAUEN_FALLBACK_PROZENT[vertrauen]
  if (n < 0) return 0
  if (n > 100) return 100
  return n
}

function mappeErgebnis(raw: unknown): NaturBestimmungErgebnis | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const anatomie =
    typeof o.anatomie_zuerst === 'string' ? o.anatomie_zuerst.trim() : ''
  const deutsche =
    typeof o.deutsche_bezeichnung === 'string' ? o.deutsche_bezeichnung.trim() : ''
  const kurz = typeof o.kurztext === 'string' ? o.kurztext.trim() : ''
  const merkmale = typeof o.merkmale_im_bild === 'string' ? o.merkmale_im_bild.trim() : ''
  const sicher = typeof o.sicherheitshinweis === 'string' ? o.sicherheitshinweis.trim() : ''
  if (!anatomie || !deutsche || !kurz || !merkmale || !sicher) return null

  const vLevel = normalisiereVertrauen(o.vertrauen)
  const prozent = normalisiereSicherheitProzent(o.sicherheit_prozent, vLevel)

  let wiss: string | null = null
  if (typeof o.wissenschaftlicher_name === 'string') {
    const w = o.wissenschaftlicher_name.trim()
    wiss = w || null
  }

  let verwechslung: string | null = null
  if (typeof o.verwechslungsgefahr === 'string') {
    const v = o.verwechslungsgefahr.trim()
    verwechslung = v || null
  }

  return plausibilityNachbearbeiten({
    kategorie: normalisiereKategorie(o.kategorie),
    anatomie_zuerst: anatomie.slice(0, 2500),
    deutsche_bezeichnung: deutsche.slice(0, 500),
    wissenschaftlicher_name: wiss,
    kurztext: kurz.slice(0, 4000),
    merkmale_im_bild: merkmale.slice(0, 2000),
    verwechslungsgefahr: verwechslung ? verwechslung.slice(0, 2000) : null,
    vertrauen: vLevel,
    sicherheit_prozent: prozent,
    sicherheitshinweis: sicher.slice(0, 2000),
  })
}

/** Grobe Plausibilität: sichtbar Fisch → nicht Pilz-Name; Pilz-Label bei offensichtlichem Fisch drosseln. */
function plausibilityNachbearbeiten(e: NaturBestimmungErgebnis): NaturBestimmungErgebnis {
  const blob = `${e.anatomie_zuerst}\n${e.merkmale_im_bild}\n${e.deutsche_bezeichnung}\n${e.kurztext}`.toLowerCase()
  const fischAnatomie =
    /\b(floss|flosse|fisch|kieme|gräte|bitterling|aale?|bartel|döbel|döbelförm|rotauge|karpfen|hecht|forelle|fischkörper|süßwass|teichfisch)\b|schuppe/i.test(
      blob,
    )
  const pilzMuster =
    /(?:^|\s)pilz|birkenpilz|steinpilz|röhren|lamell|hutfleisch|stiel|fruchtkörper|hut-?|porling|mycel|hexen-?röhrling|bovist|galler|schwamm/.test(
      e.deutsche_bezeichnung.toLowerCase() + e.kurztext.toLowerCase(),
    )
  const niedrig = (v: NaturVertrauenId): NaturVertrauenId =>
    v === 'hoch' ? 'mittel' : v === 'mittel' ? 'niedrig' : 'niedrig'

  if (e.kategorie === 'pilz' && fischAnatomie && (pilzMuster || /birken|steinpilz|porling/i.test(e.deutsche_bezeichnung))) {
    return {
      ...e,
      kategorie: fischAnatomie ? 'tier' : 'unklar',
      vertrauen: niedrig(e.vertrauen),
      sicherheit_prozent: Math.min(e.sicherheit_prozent, 35),
      verwechslungsgefahr: [
        e.verwechslungsgefahr,
        'Server-Hinweis: Anatomie wirkte eher wasserartig/tierisch als Pilz; Ergebnis wird vorsichtig eingestuft. Bitte ggf. klare Totale/Seite nutzen.',
      ]
        .filter(Boolean)
        .join(' ')
        .slice(0, 2000),
    }
  }
  if (e.kategorie === 'pilz' && fischAnatomie && !pilzMuster) {
    return {
      ...e,
      kategorie: 'tier',
      vertrauen: niedrig(e.vertrauen),
      sicherheit_prozent: Math.min(e.sicherheit_prozent, 45),
    }
  }
  return e
}

const SYSTEM = `Du bist ein sachkundiger, vorsichtiger Natur-Assistent (Zoologie, Botanik, Mykologie) — typischer Fokus **Mitteleuropa**.

**Kritischer Ablauf (Reihenfolge verbindlich):**
1. Fülle zuerst **\`anatomie_zuerst\`**: sichtbar nur Struktur (Flossen, Kiemen, Schuppen, Auge, Körper im Wasser → Fisch/„tier“; Huthaut, Röhren, Lamellen, Stiel, Waldboden-Substrat → „pilz“; Blatt/Blüte/Verzweigung Richtung Pflanze). **Nenne hier noch keinen wissenschaftlichen Artnamen** und keinen Trivialnamen, der die Domäne widerspricht.
2. **Dann** \`kategorie\` wählen: **Fische, Frösche, Echsen, Vögel, Säugetiere, Insekten in Wasser/auf Land = immer \`tier\`**. Niemals Fisch, Kröte, Ente, Libelle als \`pilz\` führen.
3. **Häufige Modellierfehler vermeiden:**
   - Wörter wie **Birke** allein, „**Birken**…“: kann Baum, Rinde oder **Birkenpilz** (Leccinum) meinen — **nur** als Pilz, wenn wirklich **Hut, Stiel, Röhren, Pilz-Fruchtkörper** sichtbar sind, nicht nur ein schlanker grauer Gegenstand im Wasser.
   - **Bitterling** = Kleinfisch (Tier), **Birkenpilz** = Speisepilz. Ein schlankes schimmerndes Wesen in Flüssen/Quellen** ohne** Pilzhut ist **kein** Birkenpilz. **Niemals** „Birkenpilz“ sagen, wenn sichtbar Fischmerkmale (Flossen, Längsprofil) vorliegen.
   - Wenn Foto widersprüchlich: \`kategorie\` = \`unklar\` und \`sicherheit_prozent\` ≤ 40, statt fachfremd zu erraten.
4. Wenn **mehrere** Bilder derselben Sitzung: behandle sie **gemeinsam**; Nutze Blickwinkel gegeneinander, nur was wiedererkennbar derselbe Organismus ist. Widerspruch zwischen Bildern → ehrlich niedrige \`sicherheit_prozent\`.

**Weitere Regeln:**
- Antwort **nur** JSON (kein Markdown draußen).
- \`sicherheit_prozent\` und \`vertrauen\` logisch stimmig (hoch nur bei klarer Domäne + passende sichtbare Merkmale).
- **Keine** Garantie für Essbarkeit: Pilze/Wildpflanzen in \`sicherheitshinweis\`.
- **Keine** Tierarzt-Diagnosen. Wissenschaftsname nur, wenn sinnvoll, sonst null.
- \`verwechslungsgefahr\` nur sachlich, sonst null.`

function userAnweisungFuerFotos(anzahl: number): string {
  if (anzahl <= 1) {
    return 'Analysiere das Bild. Zuerst anatomie_zuerst (nur sichtbar), dann JSON vollständig. sicherheit_prozent ehrlich.'
  }
  return `Analysiere **diese ${anzahl} Bilder** in einem Zug (gleiche Szene/Organismus). Nutz alle Blickwinkel. Zuerst anatomie_zuerst (gemeinsam), Domäne strikt, dann Kategorie. Keine widersprüchliche Pilz-Bezeichnung, wenn sichtbar Fisch/Wassertier. Dann vollständiges JSON.`
}

/**
 * Ein bis mehrere Fotos: Tier, Pflanze, Pilz (oder unklar).
 */
export async function bestimmeNaturAusFotos(
  teile: NaturBildTeil[],
): Promise<
  { ok: true; ergebnis: NaturBestimmungErgebnis } | { ok: false; status: number; error: string }
> {
  if (teile.length < 1 || teile.length > NATUR_MAX_FOTOS) {
    return { ok: false, status: 400, error: `Bitte 1–${NATUR_MAX_FOTOS} Fotos.` }
  }
  const resolved = resolveCoachProvider()
  if (!resolved) {
    return {
      ok: false,
      status: 501,
      error:
        'KI ist nicht konfiguriert: GEMINI_API_KEY oder OPENAI_API_KEY in .env.local (wie Finanz-Coach), Dev-Server neu starten.',
    }
  }

  const images = teile.map((t) => ({
    mimeType: t.mimeType,
    base64: t.buffer.toString('base64'),
  }))

  const userMessages: CoachMessage[] = [
    {
      role: 'user',
      content: userAnweisungFuerFotos(teile.length),
      images,
    },
  ]

  const ki = await runCoachCompletion(resolved.provider, resolved.apiKey, SYSTEM, userMessages, {
    temperature: 0.1,
    jsonResponse: { schema: NATUR_SCHEMA },
  })

  if (!ki.ok) {
    return { ok: false, status: ki.status, error: ki.hint || 'KI-Auswertung fehlgeschlagen.' }
  }

  const parsed = parseVisionJson(ki.reply)
  const ergebnis = mappeErgebnis(parsed)
  if (!ergebnis) {
    return { ok: false, status: 502, error: 'Ungültige KI-Antwort (kein brauchbares JSON).' }
  }

  return { ok: true, ergebnis }
}

/** Rückwärtskompatibel: ein Foto. */
export async function bestimmeNaturAusFoto(
  bytes: Buffer,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
) {
  return bestimmeNaturAusFotos([{ buffer: bytes, mimeType }])
}
