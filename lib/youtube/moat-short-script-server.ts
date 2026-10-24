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
import type { MoatShortErgebnis, MoatShortHookVariante, MoatShortMetrik } from '@/lib/youtube/moat-short-types'
import { fremdeZahlen, metrikenAusPaket } from '@/lib/youtube/moat-short-zahlen'
import type { MoatShortProps, MoatShortVerdict } from '@/remotion/moat-short-types'

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

const KEINE_METRIK = 'none'
const MAX_WOERTER_GESAMT = 125

function verdictAusUrteil(urteil: MoatKiBewertung['urteil']): MoatShortVerdict {
  if (urteil === 'tief') return 'wide'
  if (urteil === 'moderat') return 'narrow'
  return 'none'
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

function baueSchema(hookIds: string[], alleIds: string[]) {
  return {
    type: 'object',
    properties: {
      hooks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            angle: { type: 'string', enum: ['number_shock', 'contrast', 'stakes'] },
            claim: { type: 'string' },
            loop: { type: 'string' },
            metricId: { type: 'string', enum: hookIds },
          },
          required: ['angle', 'claim', 'loop', 'metricId'],
        },
      },
      business: { type: 'string' },
      pillarLines: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', enum: Object.keys(PFEILER_LABEL) },
            line: { type: 'string' },
            metricId: { type: 'string', enum: [...alleIds, KEINE_METRIK] },
          },
          required: ['id', 'line', 'metricId'],
        },
      },
      crack: { type: 'string' },
      title: { type: 'string' },
      description: { type: 'string' },
    },
    required: ['hooks', 'business', 'pillarLines', 'crack', 'title', 'description'],
  } as const
}

const SYSTEM = `You write voiceover scripts for "Moat Check", a YouTube Shorts series that judges one company's competitive moat in about 45 seconds.

Voice: a sharp, calm analyst talking to a smart friend. Plain spoken English. Short sentences. Concrete nouns. No hype.

## The first two seconds decide everything
A viewer swipes away unless the opening creates a gap they need closed. Every hook has two parts:

1. claim (8-13 words, shown on screen as a headline): contains the chosen metric value exactly as written and makes ONE specific, surprising claim. The number must mean something: say what it implies, not just what it is.
2. loop (4-9 words, spoken right after): opens a question that only "the crack" later in the video answers. It must promise a payoff, e.g. "But one thing could still break it." / "Here is what nobody prices in." / "And that is exactly the problem."

Write THREE hooks with different angles:
- number_shock: the number itself is absurd for this industry, and you say why.
- contrast: the expected story vs. the real one ("Everyone thinks X. The 71.2% says Y.").
- stakes: what the world would lose if this company vanished tomorrow, anchored by the number.

Good claims
- "Visa keeps 67.4% of every dollar as profit, and banks pay it gladly."
- "At 51.3% gross margin, ASML sells machines nobody else can build."
- "Everyone calls Costco a retailer. Its 12.6% margin says it sells memberships."
Bad claims
- "Is ASML the most important company in the world?" (question, no number)
- "Today we look at Visa's incredible moat." (announces instead of claiming)
- "Visa has a gross margin of 80%." (number with no meaning)

## Rest of the script
- business: 10-16 words, what they sell and to whom.
- pillarLines: one per pillar, 7-12 words, must match the score (high = name the strength, low = name the weakness). Give at most TWO pillars a metricId when a number genuinely proves the point, and then put that exact value into the line. Otherwise metricId "none".
- crack: 12-18 words, the single most concrete threat from the scenarios. It must pay off the loop.

## Hard rules
- Use ONLY facts and numbers from the data provided. Never invent numbers, customers, market shares, years or events.
- Write numbers exactly as given (e.g. "28.4%", "2.1 pts", "0.4x").
- Never open a claim with a question, "Did you know", "In this video", "Let's talk about".
- Banned words: game-changer, revolutionary, insane, crazy, massive, juggernaut, powerhouse, unstoppable, secret.
- No buy/sell/hold advice, no price targets, no emojis, no hashtags in spoken text.

Also return
- title: max 60 characters, curiosity without clickbait caps, e.g. "Why nobody can copy ASML" or "Visa's 67.4% problem".
- description: 2 short sentences in English, then "Not investment advice.", then "#shorts #investing #stocks #moat".

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
    'Metrics (id: label = exact value). Hook metrics are marked [hook]:',
    ...metriken.map((m) => `- ${m.id}: ${m.label} = ${m.value}${m.hook ? ' [hook]' : ''}`),
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

function objekte(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object') : []
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

  const metriken = metrikenAusPaket(paket)
  const hookMetriken = metriken.filter((m) => m.hook)
  if (!hookMetriken.length) {
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
      jsonResponse: { schema: baueSchema(hookMetriken.map((m) => m.id), metriken.map((m) => m.id)) },
      maxOutputTokens: 6144,
      timeoutMs: 90_000,
      geminiTotalBudgetMs: 120_000,
    },
  )
  if (!result.ok) throw new Error(result.hint || 'Script-Generierung fehlgeschlagen')

  const roh = parseJson(result.reply)
  if (!roh) throw new Error('Script-KI lieferte kein gültiges JSON — bitte erneut versuchen.')

  const hookVarianten: MoatShortHookVariante[] = objekte(roh.hooks)
    .map((h) => ({
      winkel: text(h.angle),
      claim: text(h.claim),
      loop: text(h.loop),
      metrikId: hookMetriken.some((m) => m.id === h.metricId) ? text(h.metricId) : hookMetriken[0]!.id,
    }))
    .filter((h) => h.claim)
  if (!hookVarianten.length) throw new Error('Script-KI lieferte keinen Hook — bitte erneut versuchen.')

  const zeilen = new Map(objekte(roh.pillarLines).map((r) => [text(r.id), r]))
  const scores = [moat.score, ...moat.pfeiler.map((p) => p.score)]

  // Bevorzugt die erste Variante, deren Claim die Zahl wörtlich trägt und keine fremden Zahlen enthält.
  const start =
    hookVarianten.find((h) => {
      const m = metriken.find((x) => x.id === h.metrikId)
      return m && h.claim.includes(m.value) && !fremdeZahlen(`${h.claim} ${h.loop}`, metriken, scores).length
    }) ?? hookVarianten[0]!
  const startMetrik = metriken.find((m) => m.id === start.metrikId) ?? hookMetriken[0]!

  const verdict = verdictAusUrteil(moat.urteil)
  const props: MoatShortProps = {
    ticker,
    firmenname: paket.firmenname,
    logoUrl: logoUrlAusWebsite(paket.website),
    hook: start.claim,
    hookLoop: start.loop,
    metricValue: startMetrik.value,
    metricLabel: startMetrik.label,
    business: text(roh.business),
    pillars: moat.pfeiler.map((p) => {
      const z = zeilen.get(p.id)
      const stat = metriken.find((m) => m.id === z?.metricId)
      return {
        id: p.id,
        label: PFEILER_LABEL[p.id],
        score: p.score,
        line: text(z?.line) || `${PFEILER_LABEL[p.id]}: ${p.score} out of 10.`,
        stat: stat ? { value: stat.value, label: stat.label } : null,
      }
    }),
    crack: text(roh.crack),
    verdict,
    score: moat.score,
    closing: `${VERDICT_SATZ[verdict]} ${moat.score} out of 10.`,
    musicSrc: null,
    musicGain: 0.5,
    musicTrim: 0,
    sfx: true,
  }

  const warnungen: string[] = []
  if (!props.hook.includes(props.metricValue)) warnungen.push(`Der Hook nennt die Zahl ${props.metricValue} nicht wörtlich.`)
  const gesprochen = [props.hook, props.hookLoop, props.business, ...props.pillars.map((p) => p.line), props.crack, props.closing]
  const fremd = fremdeZahlen(gesprochen.join(' '), metriken, scores)
  if (fremd.length) warnungen.push(`Zahlen ohne Quelle im Export: ${fremd.join(', ')} — bitte prüfen oder streichen.`)
  const gesamt = gesprochen.map(woerter).reduce((a, b) => a + b, 0)
  if (gesamt > MAX_WOERTER_GESAMT) warnungen.push(`${gesamt} Wörter — das Video wird länger als 45 Sekunden.`)
  if (zeilen.size < 4) warnungen.push('Nicht alle vier Pfeiler haben einen eigenen Satz bekommen.')

  return {
    props,
    metriken,
    hookVarianten,
    moat,
    moatAusCache,
    title: text(roh.title).slice(0, 100),
    description: String(roh.description ?? '').trim(),
    warnungen,
  }
}
