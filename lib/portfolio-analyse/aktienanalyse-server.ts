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
const MAX_KONTEXT_CHARS = 90_000

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

/** Kürzt riesige Export-Payloads für Free-Gemini (SEC/Earnings-Rohtexte). */
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
      qq.earningsCalls = kuerzeListe(qq.earningsCalls, 4, 1_200)
      qq.secBerichte = kuerzeListe(qq.secBerichte, 4, 1_200)
      qq.quartalsKiDiffs = kuerzeListe(qq.quartalsKiDiffs, 3, 800)
    }
    if (Array.isArray(t.news)) {
      t.news = (t.news as unknown[]).slice(0, 15)
    }
  }

  if (JSON.stringify(root).length > MAX_KONTEXT_CHARS) {
    delete root.fundamentaldatenRoh
  }
  if (JSON.stringify(root).length > MAX_KONTEXT_CHARS && root.tabs && typeof root.tabs === 'object') {
    const t = root.tabs as Record<string, unknown>
    delete t.news
    if (t.quartalszahlen && typeof t.quartalszahlen === 'object') {
      const qq = t.quartalszahlen as Record<string, unknown>
      qq.earningsCalls = kuerzeListe(qq.earningsCalls, 2, 600)
      qq.secBerichte = kuerzeListe(qq.secBerichte, 2, 600)
    }
  }

  return root
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
