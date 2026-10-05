/** Server: Gemini-Aktienanalyse + Persistenz. */

import 'server-only'

import {
  AKTIENANALYSE_JSON_SCHEMA,
  normalisiereAktienanalyseBericht,
  type AktienanalyseBericht,
  type AktienanalyseEintrag,
} from '@/lib/portfolio-analyse/aktienanalyse-prompt'
import {
  geminiFreeTierFlashModelKandidaten,
  resolveGeminiFreeTierProvider,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'
import { requireOwnerUserId } from '@/lib/request-owner'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const TABLE = 'portfolio_aktienanalyse'
const MAX_KONTEXT_CHARS = 140_000
const MAX_TRANSCRIPT_CHARS_PRO_QUARTAL = 18_000
const MAX_ZUSAMMENFASSUNG_CHARS = 6_000
const MAX_EARNINGS_QUARTALE = 6

/** Behält Fundamentaldaten + Earnings-Zusammenfassungen + Transkripte (gekürzt). */
export function kuerzeExportFuerAktienanalyse(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload
  let root: Record<string, unknown>
  try {
    root = structuredClone(payload) as Record<string, unknown>
  } catch {
    root = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>
  }

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

  // Rohpaket redundant zu tabs — weglassen spart Tokens
  delete root.fundamentaldatenRoh

  // Bei Überlänge: Transkripte weiter kürzen, Zusammenfassungen behalten
  if (JSON.stringify(root).length > MAX_KONTEXT_CHARS && root.tabs && typeof root.tabs === 'object') {
    const t = root.tabs as Record<string, unknown>
    const q = t.quartalszahlen
    if (q && typeof q === 'object') {
      const qq = q as Record<string, unknown>
      qq.earningsCalls = kompaktEarningsMitTranskript(qq.earningsCalls, {
        maxQuartale: 4,
        maxTranscript: 8_000,
      })
    }
    delete t.news
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
        let transcriptText =
          typeof z.transcriptText === 'string'
            ? z.transcriptText
            : typeof z.text === 'string'
              ? z.text
              : null
        if (transcriptText && transcriptText.length > maxT) {
          transcriptText = transcriptText.slice(0, maxT) + '\n\n[… Transkript gekürzt …]'
        }
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

function kompaktSecMitZusammenfassung(raw: unknown): unknown {
  if (!raw) return null
  const pakete = Array.isArray(raw) ? raw : [raw]
  return pakete.map((p) => {
    if (!p || typeof p !== 'object') return p
    const o = p as Record<string, unknown>
    const berichteRaw = Array.isArray(o.berichte) ? o.berichte : []
    const berichte = berichteRaw.slice(0, 8).map((b) => {
      if (!b || typeof b !== 'object') return b
      const z = b as Record<string, unknown>
      const zusammenfassung =
        typeof z.zusammenfassung === 'string'
          ? z.zusammenfassung.slice(0, MAX_ZUSAMMENFASSUNG_CHARS)
          : z.zusammenfassung ?? null
      let textAuszug =
        typeof z.textAuszug === 'string'
          ? z.textAuszug
          : typeof z.text === 'string'
            ? z.text
            : null
      if (textAuszug && textAuszug.length > 8_000) {
        textAuszug = textAuszug.slice(0, 8_000) + '…'
      }
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
  return {
    id: String(row.id),
    ticker: String(row.ticker ?? ''),
    titel: String(row.titel ?? ''),
    promptSnapshot: String(row.prompt_snapshot ?? ''),
    bericht: normalisiereAktienanalyseBericht(row.bericht_json),
    createdAt: String(row.created_at ?? ''),
  }
}

export async function ladeAktienanalyseEintraege(ticker: string): Promise<AktienanalyseEintrag[]> {
  if (!istKonfiguriert()) return []
  const { data, error } = await createSupabaseAdmin()
    .from(TABLE)
    .select('id, ticker, titel, prompt_snapshot, bericht_json, created_at')
    .eq('owner_user_id', requireOwnerUserId())
    .eq('ticker', ticker.trim().toUpperCase())
    .order('created_at', { ascending: false })
    .limit(40)
  if (error || !data) return []
  return data.map((r) => mapRow(r as Record<string, unknown>))
}

export async function speichereAktienanalyseEintrag(opts: {
  ticker: string
  titel: string
  promptSnapshot: string
  bericht: AktienanalyseBericht
}): Promise<AktienanalyseEintrag> {
  if (!istKonfiguriert()) throw new Error('Supabase nicht konfiguriert')
  const owner = requireOwnerUserId()
  const { data, error } = await createSupabaseAdmin()
    .from(TABLE)
    .insert({
      owner_user_id: owner,
      ticker: opts.ticker.trim().toUpperCase(),
      titel: opts.titel.slice(0, 200),
      prompt_snapshot: opts.promptSnapshot.slice(0, 20_000),
      bericht_json: opts.bericht,
    })
    .select('id, ticker, titel, prompt_snapshot, bericht_json, created_at')
    .single()
  if (error || !data) throw new Error(error?.message || 'Speichern fehlgeschlagen')
  return mapRow(data as Record<string, unknown>)
}

export async function generiereAktienanalyseBericht(opts: {
  ticker: string
  prompt: string
  exportPayload: unknown
}): Promise<AktienanalyseBericht> {
  const provider = resolveGeminiFreeTierProvider()
  if (!provider) {
    throw new Error('GEMINI_API_KEY_FREE fehlt — Aktienanalyse nutzt den Free-Key.')
  }

  const kontext = kuerzeExportFuerAktienanalyse(opts.exportPayload)
  const system =
    opts.prompt.trim().slice(0, 12_000) ||
    'Erstelle eine fundierte Aktienanalyse als JSON (titel + bloecke).'

  const userText = [
    `Ticker: ${opts.ticker.trim().toUpperCase()}`,
    '',
    'DATENKONTEXT (Export JSON, ggf. gekürzt):',
    JSON.stringify(kontext),
    '',
    'Erzeuge jetzt die Analyse als JSON mit titel und bloecke (text/chart).',
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
      temperature: 0.35,
      geminiModels: models,
      geminiForceFreeApiKey: true,
      jsonResponse: { schema: AKTIENANALYSE_JSON_SCHEMA },
      maxOutputTokens: 8192,
      thinkingMinimal: true,
      timeoutMs: 120_000,
      geminiTotalBudgetMs: 240_000,
      skipMessageTrim: true,
    },
  )

  if (!result.ok) {
    throw new Error(result.hint || 'KI-Analyse fehlgeschlagen')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(result.reply)
  } catch {
    const m = result.reply.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('KI lieferte kein gültiges JSON.')
    parsed = JSON.parse(m[0])
  }

  return normalisiereAktienanalyseBericht(parsed)
}
