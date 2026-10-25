/**
 * KI-Moat-Check — Free-Tier Gemini only (kein Billing-Key).
 */
import 'server-only'

import { dateiCachePfad } from '@/lib/datei-cache-pfad'
import {
  geminiFreeTierFlashModelKandidaten,
  resolveGeminiFreeTierProvider,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'
import {
  baueMoatKiSystemPrompt,
  baueMoatKiUserPrompt,
  MOAT_KI_JSON_SCHEMA,
} from '@/lib/portfolio-analyse/moat-ki-prompt'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  MOAT_KAUF_MIN_PFEILER,
  MOAT_KAUF_MIN_SCORE,
  MOAT_KAUF_MIN_STARKE_PFEILER,
  MOAT_KAUF_STARKE_SCHWELLE,
  gesamtScoreAusPfeilern,
  type MoatKiBewertung,
  type MoatKiUrteil,
  type MoatPfeilerBewertung,
  type MoatPfeilerId,
} from '@/lib/portfolio-analyse/moat-ki-types'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { promises as fs } from 'fs'
import path from 'path'

const TABLE = 'portfolio_moat_ki' as const
const DATEIPFAD = dateiCachePfad('portfolio-moat-ki.json')

const PFEILER_IDS: MoatPfeilerId[] = [
  'preissetzungsmacht',
  'replikationsbarriere',
  'wechselkosten',
  'marktdichte',
]

type DateiCache = {
  version: 1
  byTicker: Record<string, MoatKiBewertung>
}

function tickerNorm(t: string): string {
  return t.trim().toUpperCase()
}

function istCloudOk(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )
}

let memory: DateiCache | null = null

async function leseDatei(): Promise<DateiCache> {
  if (memory) return memory
  try {
    const raw = await fs.readFile(DATEIPFAD, 'utf8')
    const j = JSON.parse(raw) as DateiCache
    if (j.version === 1 && j.byTicker) {
      memory = j
      return j
    }
  } catch {
    /* neu */
  }
  memory = { version: 1, byTicker: {} }
  return memory
}

async function schreibeDatei(data: DateiCache): Promise<void> {
  memory = data
  try {
    await fs.mkdir(path.dirname(DATEIPFAD), { recursive: true })
    await fs.writeFile(DATEIPFAD, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  } catch (e) {
    console.warn('[moat-ki] Datei-Cache schreiben:', e)
  }
}

function clampScore(n: unknown): number | null {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return null
  return Math.max(1, Math.min(10, Math.round(v)))
}

function parseJsonObject(reply: string): Record<string, unknown> | null {
  const t = reply.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    const j = JSON.parse(t) as unknown
    return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : null
  } catch {
    const m = t.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      const j = JSON.parse(m[0]!) as unknown
      return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
}

function urteilAusScore(score: number): MoatKiUrteil {
  if (score >= 8) return 'tief'
  if (score >= 6) return 'moderat'
  if (score >= 4) return 'schwach'
  return 'unklar'
}

function disziplinAusPfeilern(pfeiler: MoatPfeilerBewertung[]): {
  kaufwuerdig: boolean
  kaufHinweis: string
  score: number
} {
  const scores = pfeiler.map((p) => p.score)
  const score = gesamtScoreAusPfeilern(scores)
  const minOk = scores.every((s) => s >= MOAT_KAUF_MIN_PFEILER)
  const starke = scores.filter((s) => s >= MOAT_KAUF_STARKE_SCHWELLE).length
  const kaufwuerdig =
    score >= MOAT_KAUF_MIN_SCORE && minOk && starke >= MOAT_KAUF_MIN_STARKE_PFEILER

  if (kaufwuerdig) {
    const tief = score >= 8
    return {
      kaufwuerdig: true,
      kaufHinweis: tief
        ? `Tiefes Moat (Score ${score}/10) — für Quality-Kauf geeignet, sofern Bewertung passt.`
        : `Solides Moat (Score ${score}/10) — Quality-Kauf ok; CapEx/Investitionsphasen allein sind kein KO.`,
      score,
    }
  }
  const fehl: string[] = []
  if (score < MOAT_KAUF_MIN_SCORE) fehl.push(`Gesamt ${score} < ${MOAT_KAUF_MIN_SCORE}`)
  if (!minOk) fehl.push(`mindestens ein Pfeiler < ${MOAT_KAUF_MIN_PFEILER}`)
  if (starke < MOAT_KAUF_MIN_STARKE_PFEILER) {
    fehl.push(`nur ${starke} starke Pfeiler (≥${MOAT_KAUF_STARKE_SCHWELLE})`)
  }
  return {
    kaufwuerdig: false,
    kaufHinweis: `Kein Kauf für strengen Moat-Investor: ${fehl.join('; ')}.`,
    score,
  }
}

function normalisiereBewertung(
  roh: Record<string, unknown>,
  meta: { ticker: string; isin: string | null; firmenname: string; kiModell: string | null },
): MoatKiBewertung {
  const byId = new Map<string, MoatPfeilerBewertung>()
  const arr = Array.isArray(roh.pfeiler) ? roh.pfeiler : []
  for (const row of arr) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const id = String(r.id ?? '') as MoatPfeilerId
    if (!PFEILER_IDS.includes(id)) continue
    const score = clampScore(r.score)
    if (score == null) continue
    byId.set(id, {
      id,
      score,
      begruendung: String(r.begruendung ?? '').trim().slice(0, 400) || '–',
      risiko: String(r.risiko ?? '').trim().slice(0, 280) || '–',
    })
  }
  const pfeiler: MoatPfeilerBewertung[] = PFEILER_IDS.map(
    (id) =>
      byId.get(id) ?? {
        id,
        score: 4,
        begruendung: 'KI hat diesen Pfeiler nicht bewertet — skeptischer Default.',
        risiko: 'Unklare Datenlage.',
      },
  )

  const disziplin = disziplinAusPfeilern(pfeiler)
  const score = disziplin.score
  const kaufwuerdig = disziplin.kaufwuerdig && score >= MOAT_KAUF_MIN_SCORE

  let urteil = urteilAusScore(score)
  if (!kaufwuerdig && urteil === 'tief') urteil = 'moderat'

  const szenarien = Array.isArray(roh.zerstoerungsszenarien)
    ? roh.zerstoerungsszenarien
        .map((s) => String(s ?? '').trim())
        .filter(Boolean)
        .slice(0, 4)
    : []

  return {
    ticker: meta.ticker,
    isin: meta.isin,
    firmenname: meta.firmenname,
    geschaeftsmodell: String(roh.geschaeftsmodell ?? '').trim().slice(0, 500) || '–',
    pfeiler,
    score,
    urteil,
    kaufwuerdig,
    kaufHinweis: disziplin.kaufHinweis,
    zerstoerungsszenarien: szenarien.length
      ? szenarien
      : ['Disruptive Technologie oder Regulierung', 'Margenkompression durch Wettbewerb'],
    stand: new Date().toISOString(),
    kiModell: meta.kiModell,
  }
}

function kennzahlenKontextAusPaket(paket: FundamentaldatenPaket): string {
  const ids = [
    'ltm_brutto',
    'brutto_std_10y',
    'ltm_roic',
    'roic_5y_avg',
    'incremental_roic',
    'ltm_value_spread',
    'fcf_conversion',
    'nrr',
    'net_debt_ebitda',
    'aktien_verwaesserung',
  ]
  const zeilen: string[] = []
  for (const id of ids) {
    const m = paket.keyMetrics.find((k) => k.id === id)
    if (m?.wert && m.wert !== '–') zeilen.push(`${m.label}: ${m.wert}`)
  }
  const watch = paket.mantra?.sellTriggerWatch ?? []
  for (const w of watch) {
    zeilen.push(`Sell-Trigger ${w.id}: ${w.status} — ${w.begruendung}`)
  }
  if (paket.mantra?.ampel) {
    zeilen.push(`Mantra-Ampel: ${paket.mantra.ampel} (${paket.mantra.ampelScorePct ?? '–'} %)`)
  }
  return zeilen.slice(0, 24).join('\n') || '(keine Kennzahlen)'
}

/** Alte Caches an aktuelle Kaufschwellen anpassen (ohne neuen KI-Lauf). */
export function aktualisiereKaufdisziplin(b: MoatKiBewertung): MoatKiBewertung {
  const disziplin = disziplinAusPfeilern(b.pfeiler ?? [])
  const score = disziplin.score
  const kaufwuerdig = disziplin.kaufwuerdig && score >= MOAT_KAUF_MIN_SCORE
  let urteil = b.urteil
  if (!kaufwuerdig && urteil === 'tief') urteil = 'moderat'
  else if (kaufwuerdig && score >= 8) urteil = 'tief'
  else if (kaufwuerdig && score >= MOAT_KAUF_MIN_SCORE && urteil === 'schwach') urteil = 'moderat'
  return {
    ...b,
    score,
    kaufwuerdig,
    kaufHinweis: disziplin.kaufHinweis,
    urteil,
  }
}

export async function ladeMoatKiCache(ticker: string): Promise<MoatKiBewertung | null> {
  const t = tickerNorm(ticker)
  if (!t) return null

  if (istCloudOk()) {
    try {
      const { data, error } = await createSupabaseAdmin()
        .from(TABLE)
        .select('payload')
        .eq('ticker', t)
        .maybeSingle()
      if (!error && data?.payload && typeof data.payload === 'object') {
        return aktualisiereKaufdisziplin(data.payload as MoatKiBewertung)
      }
    } catch (e) {
      console.warn('[moat-ki] Cloud laden:', e)
    }
  }

  const datei = await leseDatei()
  const hit = datei.byTicker[t]
  return hit ? aktualisiereKaufdisziplin(hit) : null
}

export async function speichereMoatKiCache(bewertung: MoatKiBewertung): Promise<void> {
  const t = tickerNorm(bewertung.ticker)
  const datei = await leseDatei()
  datei.byTicker[t] = bewertung
  await schreibeDatei(datei)

  if (!istCloudOk()) return
  try {
    const { error } = await createSupabaseAdmin().from(TABLE).upsert(
      {
        ticker: t,
        isin: bewertung.isin,
        firmenname: bewertung.firmenname,
        payload: bewertung,
        ki_modell: bewertung.kiModell,
        aktualisiert_am: bewertung.stand,
      },
      { onConflict: 'ticker' },
    )
    if (error) console.warn('[moat-ki] Cloud speichern:', error.message)
  } catch (e) {
    console.warn('[moat-ki] Cloud speichern fehlgeschlagen:', e)
  }
}

export async function generiereMoatKiBewertung(
  paket: FundamentaldatenPaket,
  isin?: string | null,
): Promise<MoatKiBewertung> {
  const provider = resolveGeminiFreeTierProvider()
  if (!provider) {
    throw new Error('GEMINI_API_KEY_FREE fehlt — Moat-KI nutzt den Free-Key (kein Billing).')
  }

  const ticker = tickerNorm(paket.symbolYahoo?.split('.')[0] || paket.ticker)
  const system = baueMoatKiSystemPrompt()
  const user = baueMoatKiUserPrompt({
    ticker,
    firmenname: paket.firmenname,
    isin: isin ?? null,
    sektor: paket.sektor,
    branche: paket.branche,
    beschreibung: paket.beschreibung,
    kennzahlenKontext: kennzahlenKontextAusPaket(paket),
  })

  const models = geminiFreeTierFlashModelKandidaten({
    primaryEnvKeys: ['MOAT_KI_GEMINI_MODEL', 'FINANCE_COACH_GEMINI_MODEL', 'GEMINI_MODEL'],
  })

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    system,
    [{ role: 'user', content: user }],
    {
      temperature: 0.2,
      geminiModels: models,
      geminiForceFreeApiKey: true,
      jsonResponse: { schema: MOAT_KI_JSON_SCHEMA },
      maxOutputTokens: 4096,
      thinkingMinimal: true,
      timeoutMs: 90_000,
      geminiTotalBudgetMs: 120_000,
    },
  )

  if (!result.ok) {
    throw new Error(result.hint || 'Moat-KI fehlgeschlagen')
  }

  const parsed = parseJsonObject(result.reply)
  if (!parsed) {
    throw new Error('Moat-KI lieferte kein gültiges JSON — bitte erneut versuchen.')
  }

  const bewertung = normalisiereBewertung(parsed, {
    ticker,
    isin: isin?.trim().toUpperCase() || null,
    firmenname: paket.firmenname,
    kiModell: result.model || models[0] || null,
  })
  await speichereMoatKiCache(bewertung)
  return bewertung
}
