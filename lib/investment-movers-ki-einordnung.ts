/**
 * Movers-KI in kleineren Gemini-/OpenAI-Anfragen mit Pause dazwischen (weniger Rate-Limits / Aussetzer).
 */

import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import { kiMoverEinordnungSystemPrompt } from '@/lib/investment-movers-begruendung'
import { resolveCoachProvider, runCoachCompletion } from '@/lib/ki-coach-backend'

export type InvestmentMoverKiZeile = {
  symbol: string
  name: string
  sektor: string | null
  branche: string | null
  /** z. B. S&P 500 stärkste/schwächste 10 — für den KI-Prompt */
  moverKontext: string
  aenderungProzent: number
  schlagzeilen: Array<{ titel: string; href: string }>
  zusammenfassungRoh: string | null
  meldungsAuszuege: string[]
  artikelKoerperTexte: string[]
}

/**
 * Gemini: Google Search Grounding für Movers (kosten-/latenzrelevanter).
 * Standard an; mit MOVER_KI_GOOGLE_SEARCH=0 aus.
 */
export function moverKiGoogleSearchGroundingAktiv(): boolean {
  const v = (process.env.MOVER_KI_GOOGLE_SEARCH ?? '1').trim().toLowerCase()
  if (v === '0' || v === 'false' || v === 'off' || v === 'nein') return false
  return true
}

/**
 * Max. Anzahl **Batches** je Movers-Bericht (S&P bzw. Nasdaq), die **mit** Google Grounding laufen.
 * Standard **1** (~MOVER_KI_BATCH_SIZE Ticker mit Live-Web pro Index).
 * **≤ 0** in der Env = keine Begrenzung (jedes Batch mit Grounding — stark beanspruchend fürs Kontingent).
 */
export function moverKiGoogleSearchGroundedBatchCap(): number | null {
  const raw = process.env.MOVER_KI_GOOGLE_SEARCH_MAX_BATCHES?.trim()
  if (!raw) return 1
  const n = Number(raw)
  if (!Number.isFinite(n)) return 1
  if (n <= 0) return null
  return Math.min(50, Math.floor(n))
}

function envPosInt(name: string, fallback: number, min: number, max: number): number {
  const n = Number(process.env[name])
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

export type MoverKiEinordnungEintrag = { kurzfassung: string }

function parseKiAntwortZuMap(roh: string): Record<string, MoverKiEinordnungEintrag> {
  let t = roh.trim()
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    const out: Record<string, MoverKiEinordnungEintrag> = {}
    for (const [k, v] of Object.entries(j ?? {})) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue
      const o = v as Record<string, unknown>
      const kurzfassung =
        (typeof o.kurzfassung === 'string' ? o.kurzfassung.trim() : '') ||
        (typeof o.summary === 'string' ? o.summary.trim() : '') ||
        (typeof o.reason === 'string' ? o.reason.trim() : '')
      if (!kurzfassung) continue
      out[k.toUpperCase()] = { kurzfassung }
    }
    return out
  } catch {
    return {}
  }
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Standard: **auto** — wenn `GEMINI_API_KEY` oder `OPENAI_API_KEY` gesetzt ist (Coach), wird die Einordnung per LLM formuliert.
 * Mit `MOVER_USE_KI=0` explizit aus; mit `MOVER_USE_KI=1` erzwingen (wie bei gesetztem Key).
 */
export function moverKiEinordnungIstAktiviert(): boolean {
  const v = (process.env.MOVER_USE_KI ?? '').trim().toLowerCase()
  if (v === '0' || v === 'false' || v === 'off' || v === 'nein') return false
  if (v === '1' || v === 'true' || v === 'on' || v === 'ja') return true
  return resolveCoachProvider() != null
}

/** Artikel-HTML-Fetch für Readability-Text (ohne KI). Standard an, mit MOVER_ARTIKEL_FETCH=0 abschaltbar. */
export function moverArtikeltextLadenAktiv(): boolean {
  const v = (process.env.MOVER_ARTIKEL_FETCH ?? '1').trim().toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'off' && v !== 'nein'
}

/** Mehrere kleine KI-Runden statt eines riesigen JSON-Prompts; zwischen den Runden Pause. */
export async function fuehreMoverKiEinordnungMitCooldown(
  zeilen: InvestmentMoverKiZeile[],
): Promise<Record<string, MoverKiEinordnungEintrag> | null> {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return null

  if (!moverKiEinordnungIstAktiviert() || zeilen.length === 0) return null
  const coach = resolveCoachProvider()
  if (!coach) return null

  const batchSize = envPosInt('MOVER_KI_BATCH_SIZE', 4, 2, 8)
  const pauseMsNormal = envPosInt('MOVER_KI_BATCH_PAUSE_MS', 3500, 800, 60_000)
  /** Nach Such-Grounding länger warten — RPM/Quota schonen (Free Tier). */
  const pauseMsAfterGrounding = envPosInt(
    'MOVER_KI_GOOGLE_SEARCH_PAUSE_MS',
    12_000,
    Math.max(2000, pauseMsNormal),
    180_000,
  )

  const merged: Record<string, MoverKiEinordnungEintrag> = {}

  const geminiGroundingMoeglich = coach.provider === 'gemini' && moverKiGoogleSearchGroundingAktiv()
  const groundedCap = moverKiGoogleSearchGroundedBatchCap()

  for (let i = 0; i < zeilen.length; i += batchSize) {
    const batchIndex = Math.floor(i / batchSize)
    const useGroundThisBatch =
      geminiGroundingMoeglich && (groundedCap == null || batchIndex < groundedCap)

    const slice = zeilen.slice(i, i + batchSize)
    const payload = {
      aktien: slice.map((z) => ({
        symbol: z.symbol,
        name: z.name,
        moverKontext: z.moverKontext,
        sektor: z.sektor,
        branche: z.branche,
        aenderungProzent: Math.round(z.aenderungProzent * 100) / 100,
        meldungen: z.schlagzeilen.map((s, j) => ({
          ueberschriftNurDisambiguation: s.titel,
          inhaltAuszugAusRss: z.meldungsAuszuege[j] ?? '',
          artikelFliesstextAusLink: z.artikelKoerperTexte[j] ?? '',
        })),
        zusammenfassungMehrererAuszuege: z.zusammenfassungRoh,
      })),
    }

    const userText = JSON.stringify(payload)
    const systemPrompt = kiMoverEinordnungSystemPrompt(useGroundThisBatch)
    const res = await runCoachCompletion(coach.provider, coach.apiKey, systemPrompt, [{ role: 'user', content: userText }], {
      temperature: useGroundThisBatch ? 0.35 : 0.32,
      geminiGoogleSearch: useGroundThisBatch,
    })

    if (res.ok) {
      const part = parseKiAntwortZuMap(res.reply)
      Object.assign(merged, part)
    }

    if (i + batchSize < zeilen.length) {
      await pause(useGroundThisBatch ? pauseMsAfterGrounding : pauseMsNormal)
    }
  }

  return Object.keys(merged).length > 0 ? merged : null
}
