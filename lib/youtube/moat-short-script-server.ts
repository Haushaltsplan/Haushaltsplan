/**
 * Englisches 45-Sekunden-Script für Moat-Shorts — Free-Tier Gemini (wie Moat-KI, kein Billing).
 */
import 'server-only'

import {
  geminiFreeTierFlashModelKandidaten,
  resolveGeminiFreeTierProvider,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { generiereMoatKiBewertung, ladeMoatKiCache } from '@/lib/portfolio-analyse/moat-ki-server'
import type { MoatKiBewertung, MoatPfeilerId } from '@/lib/portfolio-analyse/moat-ki-types'
import type { MoatShortErgebnis, MoatShortMetrik } from '@/lib/youtube/moat-short-types'
import type { MoatShortProps, MoatShortVerdict } from '@/remotion/moat-short-types'

const HOOK_METRIKEN: { id: string; label: string }[] = [
  { id: 'ltm_brutto', label: 'Gross margin' },
  { id: 'ltm_ebit', label: 'Operating margin' },
  { id: 'ltm_roic', label: 'Return on capital' },
  { id: 'roic_5y_avg', label: '5-year avg. ROIC' },
  { id: 'fcf_conversion', label: 'FCF conversion' },
  { id: 'nrr', label: 'Net revenue retention' },
  { id: 'rev_cagr_5y', label: 'Revenue growth, 5y CAGR' },
]

const PFEILER_LABEL: Record<MoatPfeilerId, string> = {
  preissetzungsmacht: 'Pricing power',
  replikationsbarriere: 'Hard to copy',
  wechselkosten: 'Switching costs',
  marktdichte: 'Market control',
}

const VERDICT_SATZ: Record<MoatShortVerdict, string> = {
  wide: 'Wide moat.',
  narrow: 'Narrow moat.',
  none: 'No real moat.',
}

const MAX_WOERTER_GESAMT = 125

function verdictAusUrteil(urteil: MoatKiBewertung['urteil']): MoatShortVerdict {
  if (urteil === 'tief') return 'wide'
  if (urteil === 'moderat') return 'narrow'
  return 'none'
}

function formatProzent(zahl: number): string {
  const gerundet = Math.abs(zahl) >= 100 ? Math.round(zahl) : Math.round(zahl * 10) / 10
  return `${gerundet}%`
}

export function hookMetrikenAusPaket(paket: FundamentaldatenPaket): MoatShortMetrik[] {
  const out: MoatShortMetrik[] = []
  for (const { id, label } of HOOK_METRIKEN) {
    const m = paket.keyMetrics.find((k) => k.id === id)
    if (m?.zahl == null || !Number.isFinite(m.zahl)) continue
    out.push({ id, label, value: formatProzent(m.zahl) })
  }
  return out
}

function logoUrlAusWebsite(website: string | null): string | null {
  if (!website?.trim()) return null
  try {
    const host = new URL(website.includes('://') ? website : `https://${website}`).hostname.replace(/^www\./, '')
    return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256` : null
  } catch {
    return null
  }
}

function woerter(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function baueSchema(metrikIds: string[]) {
  return {
    type: 'object',
    properties: {
      hook: { type: 'string' },
      hookMetricId: { type: 'string', enum: metrikIds },
      business: { type: 'string' },
      pillarLines: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: Object.keys(PFEILER_LABEL) },
            line: { type: 'string' },
          },
          required: ['id', 'line'],
        },
      },
      crack: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['hook', 'hookMetricId', 'business', 'pillarLines', 'crack', 'title', 'description'],
  } as const
}

const SYSTEM = `You write voiceover scripts for "Moat Check", a YouTube Shorts series that judges one company's competitive moat in about 45 seconds.

Voice: a sharp, calm analyst talking to a smart friend. Plain spoken English. Short sentences. Concrete nouns. No hype.

Hard rules
- Use ONLY facts from the data provided. Never invent numbers, customers, market shares or events.
- The hook must contain the chosen metric value exactly as written (e.g. "71.2%") and make one specific claim about why this company is hard to compete with (or why it is not).
- Never open with a question, "Did you know", "In this video", "Let's talk about", or the company name followed by "is a company".
- Banned words: game-changer, revolutionary, insane, crazy, massive, juggernaut, powerhouse, unstoppable, secret.
- No buy/sell/hold advice, no price targets, no emojis, no hashtags in the spoken text.
- Pillar lines must match the score: a high score explains the strength, a low score names the weakness. One sentence each.
- The crack: the single most concrete threat from the scenarios, said plainly.

Word limits (spoken)
- hook: 10-16 words
- business: 10-16 words, what they sell and to whom
- each pillar line: 7-12 words
- crack: 12-18 words

Good hooks
- "A 71.2% gross margin on chips means nobody else can make this machine."
- "Visa keeps 67.4% of revenue as profit because every bank already runs on it."
Bad hooks
- "Is ASML the most important company in the world?"
- "Today we look at the incredible moat of Visa."

Also return
- title: max 60 characters, no clickbait caps, format like "ASML's moat in 45 seconds" or a sharper variant.
- description: 2 short sentences in English plus the line "Not investment advice." Then "#shorts #investing #stocks #moat".

The input data is partly in German. Write everything in English.`

function baueUserPrompt(paket: FundamentaldatenPaket, moat: MoatKiBewertung, metriken: MoatShortMetrik[]): string {
  return [
    `Company: ${paket.firmenname} (${moat.ticker})`,
    paket.sektor ? `Sector: ${paket.sektor}` : null,
    paket.branche ? `Industry: ${paket.branche}` : null,
    '',
    `Business model (German): ${moat.geschaeftsmodell}`,
    paket.beschreibung ? `Description (German): ${paket.beschreibung.slice(0, 900)}` : null,
    '',
    `Moat verdict: ${VERDICT_SATZ[verdictAusUrteil(moat.urteil)]} Score ${moat.score}/10.`,
    'Pillars (score / reason / risk, German):',
    ...moat.pfeiler.map((p) => `- ${p.id} (${PFEILER_LABEL[p.id]}): ${p.score}/10 — ${p.begruendung} — Risk: ${p.risiko}`),
    '',
    'Destruction scenarios (German):',
    ...moat.zerstoerungsszenarien.map((s) => `- ${s}`),
    '',
    'Metrics available for the hook (pick one id, use the value exactly):',
    ...metriken.map((m) => `- ${m.id}: ${m.label} = ${m.value}`),
  ]
    .filter((z) => z != null)
    .join('\n')
}

function parseJson(reply: string): Record<string, unknown> | null {
  const t = reply.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const m = t.match(/\{[\s\S]*\}/)
  try {
    const j = JSON.parse(m ? m[0] : t) as unknown
    return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function text(v: unknown): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim()
}

export async function generiereMoatShort(opts: {
  paket: FundamentaldatenPaket
  isin: string | null
  moatNeu: boolean
}): Promise<MoatShortErgebnis> {
  const { paket, isin } = opts
  const ticker = (paket.symbolYahoo?.split('.')[0] || paket.ticker).trim().toUpperCase()

  let moat = opts.moatNeu ? null : await ladeMoatKiCache(ticker)
  const moatAusCache = moat != null
  if (!moat) moat = await generiereMoatKiBewertung(paket, isin)

  const metriken = hookMetrikenAusPaket(paket)
  if (!metriken.length) {
    throw new Error('Im Export fehlen Margen- und Rendite-Kennzahlen (z. B. Bruttomarge, ROIC) für die Hook-Zahl.')
  }

  const provider = resolveGeminiFreeTierProvider()
  if (!provider) throw new Error('GEMINI_API_KEY_FREE fehlt — das Script nutzt den Free-Key.')

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    SYSTEM,
    [{ role: 'user', content: baueUserPrompt(paket, moat, metriken) }],
    {
      geminiModels: geminiFreeTierFlashModelKandidaten(),
      geminiForceFreeApiKey: true,
      jsonResponse: { schema: baueSchema(metriken.map((m) => m.id)) },
      maxOutputTokens: 4096,
      timeoutMs: 90_000,
      geminiTotalBudgetMs: 120_000,
    },
  )
  if (!result.ok) throw new Error(result.hint || 'Script-Generierung fehlgeschlagen')

  const roh = parseJson(result.reply)
  if (!roh) throw new Error('Script-KI lieferte kein gültiges JSON — bitte erneut versuchen.')

  const metrik = metriken.find((m) => m.id === roh.hookMetricId) ?? metriken[0]!
  const zeilen = new Map<string, string>()
  if (Array.isArray(roh.pillarLines)) {
    for (const r of roh.pillarLines) {
      if (r && typeof r === 'object') zeilen.set(text((r as Record<string, unknown>).id), text((r as Record<string, unknown>).line))
    }
  }

  const verdict = verdictAusUrteil(moat.urteil)
  const props: MoatShortProps = {
    ticker,
    firmenname: paket.firmenname,
    logoUrl: logoUrlAusWebsite(paket.website),
    hook: text(roh.hook),
    metricValue: metrik.value,
    metricLabel: metrik.label,
    business: text(roh.business),
    pillars: moat.pfeiler.map((p) => ({
      id: p.id,
      label: PFEILER_LABEL[p.id],
      score: p.score,
      line: zeilen.get(p.id) || `${PFEILER_LABEL[p.id]}: ${p.score} out of 10.`,
    })),
    crack: text(roh.crack),
    verdict,
    score: moat.score,
    closing: `${VERDICT_SATZ[verdict]} ${moat.score} out of 10.`,
  }

  const warnungen: string[] = []
  if (!props.hook.includes(metrik.value)) warnungen.push(`Der Hook nennt die Zahl ${metrik.value} nicht wörtlich.`)
  const gesamt = [props.hook, props.business, ...props.pillars.map((p) => p.line), props.crack, props.closing]
    .map(woerter)
    .reduce((a, b) => a + b, 0)
  if (gesamt > MAX_WOERTER_GESAMT) warnungen.push(`${gesamt} Wörter — das Video wird länger als 45 Sekunden.`)
  if (zeilen.size < 4) warnungen.push('Nicht alle vier Pfeiler haben einen eigenen Satz bekommen.')

  return {
    props,
    metriken,
    moat,
    moatAusCache,
    title: text(roh.title).slice(0, 100),
    description: String(roh.description ?? '').trim(),
    warnungen,
  }
}
