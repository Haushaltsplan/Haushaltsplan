/** Server: Gemini-Aktienanalyse + Persistenz. */

import 'server-only'

import {
  AKTIENANALYSE_JSON_SCHEMA,
  normalisiereAktienanalyseBericht,
  type AktienanalyseBericht,
  type AktienanalyseEintrag,
} from '@/lib/portfolio-analyse/aktienanalyse-prompt'
import { baueAktienanalyseThumbnailSvg } from '@/lib/portfolio-analyse/aktienanalyse-thumbnail'
import {
  geminiFreeTierFlashModelKandidaten,
  resolveGeminiFreeTierProvider,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'
import { requireOwnerUserId } from '@/lib/request-owner'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const TABLE = 'portfolio_aktienanalyse'
/** Reichhaltiger Kontext ist gewollt — Tokens ok, Ergebnis muss kommen. */
const MAX_KONTEXT_CHARS = 160_000
const MAX_TRANSCRIPT_CHARS_PRO_QUARTAL = 18_000
const MAX_ZUSAMMENFASSUNG_CHARS = 6_000
const MAX_SEC_AUSZUG_CHARS = 8_000
const MAX_EARNINGS_QUARTALE = 6
const MAX_SEC_BERICHTE = 8

/** Behält Fundamentaldaten + Earnings-Zusammenfassungen + Transkripte (bei Überlänge gestuft kürzen). */
export function kuerzeExportFuerAktienanalyse(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload
  let root: Record<string, unknown>
  try {
    root = structuredClone(payload) as Record<string, unknown>
  } catch {
    root = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>
  }

  delete root.fundamentaldatenRoh

  const tabs = root.tabs
  if (tabs && typeof tabs === 'object') {
    const t = tabs as Record<string, unknown>
    const q = t.quartalszahlen
    if (q && typeof q === 'object') {
      const qq = q as Record<string, unknown>
      qq.earningsCalls = kompaktEarningsMitTranskript(qq.earningsCalls)
      qq.secBerichte = kompaktSecMitZusammenfassung(qq.secBerichte)
      qq.quartalsKiDiffs = kuerzeListe(qq.quartalsKiDiffs, 4, 1_500)
    }
    if (Array.isArray(t.news)) {
      t.news = (t.news as unknown[]).slice(0, 12).map((n) => {
        if (!n || typeof n !== 'object') return n
        const o = { ...(n as Record<string, unknown>) }
        delete o.raw
        if (typeof o.zusammenfassung === 'string' && o.zusammenfassung.length > 500) {
          o.zusammenfassung = o.zusammenfassung.slice(0, 500) + '…'
        }
        return o
      })
    }
  }

  // Nur bei Extrem-Überlänge: Transkripte kürzen, Summaries behalten
  if (JSON.stringify(root).length > MAX_KONTEXT_CHARS && root.tabs && typeof root.tabs === 'object') {
    const t = root.tabs as Record<string, unknown>
    const q = t.quartalszahlen
    if (q && typeof q === 'object') {
      const qq = q as Record<string, unknown>
      qq.earningsCalls = kompaktEarningsMitTranskript(qq.earningsCalls, {
        maxQuartale: 4,
        maxTranscript: 10_000,
      })
      qq.secBerichte = kompaktSecMitZusammenfassung(qq.secBerichte, { maxAuszug: 4_000 })
    }
  }

  return root
}

function kompaktEarningsMitTranskript(
  raw: unknown,
  opts?: { maxQuartale?: number; maxTranscript?: number },
): unknown {
  if (!raw) return null
  const maxQ = opts?.maxQuartale ?? MAX_EARNINGS_QUARTALE
  const maxT = opts?.maxTranscript ?? MAX_TRANSCRIPT_CHARS_PRO_QUARTAL

  const pakete = Array.isArray(raw) ? raw : [raw]
  return pakete
    .map((p) => {
      if (!p || typeof p !== 'object') return p
      const o = p as Record<string, unknown>
      const quartaleRaw = Array.isArray(o.quartale) ? o.quartale : []
      const quartale = quartaleRaw.slice(0, maxQ).map((q) => {
        if (!q || typeof q !== 'object') return q
        const z = q as Record<string, unknown>
        const zusammenfassung =
          typeof z.zusammenfassung === 'string'
            ? z.zusammenfassung.slice(0, MAX_ZUSAMMENFASSUNG_CHARS)
            : z.zusammenfassung ?? null
        let transcriptText: string | null =
          typeof z.transcriptText === 'string'
            ? z.transcriptText
            : typeof z.text === 'string'
              ? z.text
              : null
        if (transcriptText && maxT > 0 && transcriptText.length > maxT) {
          transcriptText = transcriptText.slice(0, maxT) + '\n\n[… Transkript gekürzt …]'
        }
        if (maxT <= 0) transcriptText = null
        return {
          id: z.id ?? null,
          label: z.label ?? z.titel ?? null,
          jahr: z.jahr ?? null,
          quartal: z.quartal ?? null,
          callDatum: z.callDatum ?? null,
          transcriptUrl: z.transcriptUrl ?? null,
          quelle: z.quelle ?? null,
          sentimentScore: z.sentimentScore ?? null,
          zusammenfassung,
          transcriptText,
          transcriptZeichen:
            z.transcriptZeichen ?? (typeof transcriptText === 'string' ? transcriptText.length : null),
        }
      })
      return {
        ticker: o.ticker ?? null,
        firmenname: o.firmenname ?? null,
        quelle: o.quelle ?? null,
        hinweis:
          o.hinweis ??
          'Zusammenfassungen + Transkripte (Transkripte ggf. gekürzt für Token-Limit).',
        quartale,
      }
    })
    .filter(Boolean)
}

function kompaktSecMitZusammenfassung(
  raw: unknown,
  opts?: { maxAuszug?: number },
): unknown {
  if (!raw) return null
  const maxAuszug = opts?.maxAuszug ?? MAX_SEC_AUSZUG_CHARS
  const pakete = Array.isArray(raw) ? raw : [raw]
  return pakete.map((p) => {
    if (!p || typeof p !== 'object') return p
    const o = p as Record<string, unknown>
    const berichteRaw = Array.isArray(o.berichte) ? o.berichte : []
    const berichte = berichteRaw.slice(0, MAX_SEC_BERICHTE).map((b) => {
      if (!b || typeof b !== 'object') return b
      const z = b as Record<string, unknown>
      const zusammenfassung =
        typeof z.zusammenfassung === 'string'
          ? z.zusammenfassung.slice(0, MAX_ZUSAMMENFASSUNG_CHARS)
          : z.zusammenfassung ?? null
      let textAuszug: string | null =
        typeof z.textAuszug === 'string'
          ? z.textAuszug
          : typeof z.text === 'string'
            ? z.text
            : null
      if (textAuszug && maxAuszug > 0 && textAuszug.length > maxAuszug) {
        textAuszug = textAuszug.slice(0, maxAuszug) + '…'
      }
      if (maxAuszug <= 0) textAuszug = null
      return {
        id: z.id ?? null,
        formular: z.formular ?? z.form ?? null,
        label: z.label ?? null,
        filingDatum: z.filingDatum ?? z.filingDate ?? null,
        accession: z.accession ?? null,
        zusammenfassung,
        textAuszug,
      }
    })
    return {
      ticker: o.ticker ?? null,
      hinweis: o.hinweis ?? 'SEC-KI-Zusammenfassungen (+ Textauszug falls vorhanden).',
      berichte,
    }
  })
}

function kuerzeListe(raw: unknown, maxItems: number, maxText: number): unknown {
  if (!Array.isArray(raw)) return raw
  return raw.slice(0, maxItems).map((item) => {
    if (!item || typeof item !== 'object') return item
    const o = { ...(item as Record<string, unknown>) }
    for (const key of Object.keys(o)) {
      if (typeof o[key] === 'string' && String(o[key]).length > maxText) {
        o[key] = String(o[key]).slice(0, maxText) + '…'
      }
    }
    return o
  })
}

function istKonfiguriert() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )
}

function mapRow(row: Record<string, unknown>): AktienanalyseEintrag {
  const bericht = normalisiereAktienanalyseBericht(row.bericht_json)
  const ticker = String(row.ticker ?? '')
  const createdAt = String(row.created_at ?? '')
  const stored = typeof row.thumbnail_svg === 'string' ? row.thumbnail_svg.trim() : ''
  const thumbnailSvg =
    stored ||
    baueAktienanalyseThumbnailSvg({
      ticker,
      titel: String(row.titel ?? bericht.titel),
      cover: bericht.cover,
      createdAt,
    })
  const kiModell =
    typeof row.ki_modell === 'string' && row.ki_modell.trim()
      ? row.ki_modell.trim().slice(0, 80)
      : null
  return {
    id: String(row.id),
    ticker,
    titel: String(row.titel ?? ''),
    promptSnapshot: String(row.prompt_snapshot ?? ''),
    bericht,
    thumbnailSvg,
    kiModell,
    createdAt,
  }
}

const SELECT_FULL =
  'id, ticker, titel, prompt_snapshot, bericht_json, thumbnail_svg, ki_modell, created_at'
const SELECT_MIT_THUMB =
  'id, ticker, titel, prompt_snapshot, bericht_json, thumbnail_svg, created_at'
const SELECT_BASIS = 'id, ticker, titel, prompt_snapshot, bericht_json, created_at'

export async function ladeAktienanalyseEintraege(ticker: string): Promise<AktienanalyseEintrag[]> {
  if (!istKonfiguriert()) return []
  const admin = createSupabaseAdmin()
  const owner = requireOwnerUserId()
  const t = ticker.trim().toUpperCase()

  const tries = [SELECT_FULL, SELECT_MIT_THUMB, SELECT_BASIS]
  for (const cols of tries) {
    const res = await admin
      .from(TABLE)
      .select(cols)
      .eq('owner_user_id', owner)
      .eq('ticker', t)
      .order('created_at', { ascending: false })
      .limit(40)
    if (!res.error && res.data) {
      return res.data.map((r) => mapRow(r as unknown as Record<string, unknown>))
    }
  }
  return []
}

export async function speichereAktienanalyseEintrag(opts: {
  ticker: string
  titel: string
  promptSnapshot: string
  bericht: AktienanalyseBericht
  kiModell?: string | null
}): Promise<AktienanalyseEintrag> {
  if (!istKonfiguriert()) throw new Error('Supabase nicht konfiguriert')
  const owner = requireOwnerUserId()
  const ticker = opts.ticker.trim().toUpperCase()
  const thumbnailSvg = baueAktienanalyseThumbnailSvg({
    ticker,
    titel: opts.titel,
    cover: opts.bericht.cover,
  })
  const kiModell = (opts.kiModell || '').trim().slice(0, 80) || null
  const admin = createSupabaseAdmin()
  const baseRow = {
    owner_user_id: owner,
    ticker,
    titel: opts.titel.slice(0, 200),
    prompt_snapshot: opts.promptSnapshot.slice(0, 20_000),
    bericht_json: opts.bericht,
  }

  const payloads: Record<string, unknown>[] = [
    { ...baseRow, thumbnail_svg: thumbnailSvg.slice(0, 40_000), ki_modell: kiModell },
    { ...baseRow, thumbnail_svg: thumbnailSvg.slice(0, 40_000) },
    { ...baseRow },
  ]
  const selects = [SELECT_FULL, SELECT_MIT_THUMB, SELECT_BASIS]

  let lastError = 'Speichern fehlgeschlagen'
  for (let i = 0; i < payloads.length; i++) {
    const res = await admin.from(TABLE).insert(payloads[i]!).select(selects[i]!).single()
    if (!res.error && res.data) {
      const row = res.data as unknown as Record<string, unknown>
      return mapRow({
        ...row,
        thumbnail_svg: row.thumbnail_svg ?? thumbnailSvg,
        ki_modell: row.ki_modell ?? kiModell,
      })
    }
    lastError = res.error?.message || lastError
  }
  throw new Error(lastError)
}

/** Robustes JSON-Parsing inkl. abgeschnittener Antworten. */
function parseAktienanalyseJson(reply: string): unknown | null {
  const cleaned = reply
    .replace(/^\uFEFF/, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  if (!cleaned) return null

  try {
    return JSON.parse(cleaned)
  } catch {
    /* weiter */
  }

  const start = cleaned.indexOf('{')
  if (start < 0) return null
  const end = cleaned.lastIndexOf('}')
  if (end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      /* truncated / broken */
    }
  }

  // Abgeschnittenes JSON: offene Strings/Klammern schließen
  const repariert = repariereAbgeschnittenesJson(cleaned.slice(start))
  if (repariert) {
    try {
      return JSON.parse(repariert)
    } catch {
      return null
    }
  }
  return null
}

function repariereAbgeschnittenesJson(fragment: string): string | null {
  if (!fragment.startsWith('{')) return null
  let s = fragment.trim()
  // Offenen String schließen
  let inString = false
  let escape = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
    } else if (ch === '"') {
      inString = true
    }
  }
  if (inString) s += '"'

  // Trailing Komma entfernen
  s = s.replace(/,\s*$/, '')

  let brace = 0
  let bracket = 0
  inString = false
  escape = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') brace++
    else if (ch === '}') brace--
    else if (ch === '[') bracket++
    else if (ch === ']') bracket--
  }
  while (bracket > 0) {
    s += ']'
    bracket--
  }
  while (brace > 0) {
    s += '}'
    brace--
  }
  return s
}

export async function generiereAktienanalyseBericht(opts: {
  ticker: string
  prompt: string
  exportPayload: unknown
}): Promise<{ bericht: AktienanalyseBericht; kiModell: string }> {
  const provider = resolveGeminiFreeTierProvider()
  if (!provider) {
    throw new Error('GEMINI_API_KEY_FREE fehlt — Aktienanalyse nutzt den Free-Key.')
  }

  const kontext = kuerzeExportFuerAktienanalyse(opts.exportPayload)
  const kontextJson = JSON.stringify(kontext)
  const system =
    opts.prompt.trim().slice(0, 12_000) ||
    'Erstelle eine fundierte Aktienanalyse als JSON (titel + bloecke).'

  const userText = [
    `Ticker: ${opts.ticker.trim().toUpperCase()}`,
    '',
    'DATENKONTEXT (Export JSON, ggf. leicht gekürzt):',
    kontextJson,
    '',
    'Antworte NUR mit gültigem, vollständigem JSON (titel, cover, bloecke). Keine Markdown-Fence. Nicht mittendrin abbrechen.',
  ].join('\n')

  const models = geminiFreeTierFlashModelKandidaten({
    primaryEnvKeys: ['AKTIENANALYSE_GEMINI_MODEL', 'FINANCE_COACH_GEMINI_MODEL', 'GEMINI_MODEL'],
  })

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    system,
    [{ role: 'user', content: userText }],
    {
      temperature: 0.25,
      geminiModels: models,
      geminiForceFreeApiKey: true,
      jsonResponse: { schema: AKTIENANALYSE_JSON_SCHEMA },
      // Genug Platz für lange Magazin-Analyse (vorher 8k → oft abgeschnitten)
      maxOutputTokens: 24_576,
      thinkingMinimal: true,
      timeoutMs: 180_000,
      geminiTotalBudgetMs: 300_000,
      skipMessageTrim: true,
    },
  )

  if (!result.ok) {
    throw new Error(result.hint || 'KI-Analyse fehlgeschlagen')
  }

  let parsed = parseAktienanalyseJson(result.reply)
  let usedModel = result.model || models[0] || 'gemini'

  // Günstiger Repair-Retry: nur die kaputte Antwort, KEIN Export-Kontext nochmal
  if (!parsed && result.reply.trim().length > 80) {
    console.warn(
      `[aktienanalyse] JSON kaputt (${result.reply.length} Zeichen) — Repair ohne Re-Export …`,
    )
    const repair = await runCoachCompletion(
      provider.provider,
      provider.apiKey,
      'Du reparierst kaputtes JSON. Gib NUR ein gültiges JSON-Objekt zurück mit den Feldern titel (string), cover (object: untertitel, stichwort, ton), bloecke (array). Kein Markdown, kein Kommentar.',
      [
        {
          role: 'user',
          content: [
            'Repariere die folgende Antwort zu gültigem JSON (Aktienanalyse-Schema).',
            'Wenn abgeschnitten: schließe Blöcke sinnvoll, erfinde keine neuen Fakten.',
            '',
            result.reply.slice(0, 60_000),
          ].join('\n'),
        },
      ],
      {
        temperature: 0.1,
        geminiModels: models,
        geminiForceFreeApiKey: true,
        jsonResponse: { schema: AKTIENANALYSE_JSON_SCHEMA },
        maxOutputTokens: 24_576,
        thinkingMinimal: true,
        timeoutMs: 120_000,
        geminiTotalBudgetMs: 180_000,
        skipMessageTrim: true,
      },
    )
    if (repair.ok) {
      parsed = parseAktienanalyseJson(repair.reply)
      if (repair.model) usedModel = repair.model
    }
  }

  if (!parsed) {
    const preview = result.reply.trim().slice(0, 120).replace(/\s+/g, ' ')
    throw new Error(
      preview
        ? `KI-Antwort war kein gültiges JSON (vermutlich abgeschnitten). Vorschau: „${preview}…“ — bitte erneut versuchen.`
        : 'KI lieferte eine leere Antwort. Bitte erneut versuchen.',
    )
  }

  return {
    bericht: normalisiereAktienanalyseBericht(parsed),
    kiModell: usedModel,
  }
}
