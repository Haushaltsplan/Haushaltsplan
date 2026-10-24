/**
 * Englisches ~32-Sekunden-Script für loopbare Moat-Shorts — Free-Tier Gemini (wie Moat-KI, kein Billing).
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
import { sucheYoutubePhrasen } from '@/lib/youtube/youtube-keywords'
import { findeMoatShortLogo } from '@/lib/youtube/moat-short-logo-server'
import {
  beschreibungFuerUpload,
  kommentarFuerUpload,
  saubererLand,
  scriptLoopWarnungen,
  titelFuerUpload,
} from '@/lib/youtube/moat-short-script'
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
const MAX_WOERTER_GESAMT = 80

function verdictAusUrteil(urteil: MoatKiBewertung['urteil']): MoatShortVerdict {
  if (urteil === 'tief') return 'wide'
  if (urteil === 'moderat') return 'narrow'
  return 'none'
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
            land: { type: 'string' },
            metricId: { type: 'string', enum: hookIds },
          },
          required: ['angle', 'claim', 'loop', 'land', 'metricId'],
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
      comment: { type: 'string' },
    },
    required: ['hooks', 'business', 'pillarLines', 'crack', 'title', 'description', 'comment'],
  } as const
}

const SYSTEM = `You write voiceover scripts for "Moat Check", a YouTube Shorts series that judges one company's competitive moat in about 32 seconds.

Voice: a sharp, calm analyst talking to a smart friend. Plain spoken English. Short sentences. Concrete nouns. No hype.

YouTube replays the Short from frame one. The spoken script must still make sense when the last sentence is followed immediately by the first sentence. Read land + claim out loud as one thought. If that pair is a non sequitur, rewrite land.

## Each hook is a closed circle
Write THREE hooks. Each has four fields:

1. claim (8-12 words, on-screen headline): contains the chosen metric value exactly as written. ONE surprising claim. The number must mean something.
2. loop (4-8 words, spoken next): opens a gap that the single crack later fills. Same threat in all three hooks, three phrasings.
3. land (6-10 words, last spoken line): names the verdict in passing and ends on that same metric value. No "out of 10". No goodbye. After land, the picture cuts back to claim — so land must make the viewer want that number again.
4. metricId: the hook metric whose exact value appears in both claim and land.

Write land first for each hook, then write claim as the sentence that answers it.

Good pair (read as land → claim):
- land: "Wide moat. The proof is 51.3%."
- claim: "At 51.3% gross margin, ASML sells machines nobody else can build."
- land: "No real moat. 12.6% already said so."
- claim: "Everyone calls Costco a retailer. Its 12.6% margin says it sells memberships."
- land: "That's why banks still pay. 67.4%."
- claim: "Visa keeps 67.4% of every dollar as profit, and banks pay it gladly."

Bad land
- "Wide moat. 9 out of 10." (scoreboard, video is over)
- "Thanks for watching." / "Follow for more."
- "And that is the story of ASML." (period energy, no number)
- A land that does not contain the claim's metric value.

Good claims
- "Visa keeps 67.4% of every dollar as profit, and banks pay it gladly."
- "At 51.3% gross margin, ASML sells machines nobody else can build."
Bad claims
- "Is ASML the most important company in the world?" (question, no number)
- "Today we look at Visa's incredible moat." (announces instead of claiming)

Angles
- number_shock: the number is absurd for this industry, and you say why.
- contrast: expected story vs. the real one.
- stakes: what the world loses if this company vanishes, anchored by the number.

## Rest of the script
- business: 8-13 words, what they sell and to whom.
- pillarLines: one per pillar, 6-10 words, match the score (high = strength, low = weakness). At most TWO pillars get a metricId, and then the exact value is in the line. Otherwise metricId "none".
- crack: 10-15 words, ONE concrete threat. It must answer all three loop lines. No sign-off.

## Hard rules
- Use ONLY facts and numbers from the data provided. Never invent numbers, customers, market shares, years or events.
- Write numbers exactly as given (e.g. "28.4%", "2.1 pts", "0.4x").
- Never open a claim with a question, "Did you know", "In this video", "Let's talk about".
- Banned words: game-changer, revolutionary, insane, crazy, massive, juggernaut, powerhouse, unstoppable, secret.
- No buy/sell/hold advice, no price targets, no emojis, no hashtags in spoken text.
- Do not speak the score as "X out of 10". The stamp is visual.
- Whole spoken script stays under 80 words. One-liners. Cut "basically" and "essentially".

Also return
- title: 30-50 characters, ticker or company first, curiosity without ALL-CAPS or !!. If a YouTube search suggestion fits, prefer it. Examples: "ASML: why nobody can copy it" / "Visa's 67.4% problem".
- description: two short English sentences, verdict plus the hook number. We add the first search line, disclaimer and hashtags.
- comment: one pinned-comment question, 8-14 words, debatable, no subscribe/follow/like.

The input data is partly in German. Write everything in English.`

function baueUserPrompt(
  paket: FundamentaldatenPaket,
  moat: MoatKiBewertung,
  metriken: MoatShortMetrik[],
  suchphrasen: string[],
): string {
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
    suchphrasen.length
      ? `\nYouTube search suggestions (prefer one in the title if it fits): ${suchphrasen.join(' · ')}`
      : null,
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

  const suchphrasen = await sucheYoutubePhrasen(ticker, paket.firmenname)

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    SYSTEM,
    [{ role: 'user', content: baueUserPrompt(paket, moat, metriken, suchphrasen) }],
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

  const verdict = verdictAusUrteil(moat.urteil)
  const hookVarianten: MoatShortHookVariante[] = objekte(roh.hooks)
    .map((h) => {
      const metrikId = hookMetriken.some((m) => m.id === h.metricId) ? text(h.metricId) : hookMetriken[0]!.id
      const wert = (metriken.find((m) => m.id === metrikId) ?? hookMetriken[0]!).value
      return {
        winkel: text(h.angle),
        claim: text(h.claim),
        loop: text(h.loop),
        land: saubererLand(text(h.land), verdict, wert),
        metrikId,
      }
    })
    .filter((h) => h.claim)
  if (!hookVarianten.length) throw new Error('Script-KI lieferte keinen Hook — bitte erneut versuchen.')

  const zeilen = new Map(objekte(roh.pillarLines).map((r) => [text(r.id), r]))
  const scores = [moat.score, ...moat.pfeiler.map((p) => p.score)]

  // Bevorzugt die Variante, deren Kreis schließt: Claim + Landung tragen die Zahl, keine fremden Zahlen.
  const start =
    hookVarianten.find((h) => {
      const m = metriken.find((x) => x.id === h.metrikId)
      const gesprochen = `${h.claim} ${h.loop} ${h.land}`
      return (
        m &&
        h.claim.includes(m.value) &&
        h.land.includes(m.value) &&
        !fremdeZahlen(gesprochen, metriken, scores).length
      )
    }) ?? hookVarianten[0]!
  const startMetrik = metriken.find((m) => m.id === start.metrikId) ?? hookMetriken[0]!

  const logoUrl = await findeMoatShortLogo({
    ticker,
    firmenname: paket.firmenname,
    isin,
    website: paket.website,
    symbolYahoo: paket.symbolYahoo,
  })
  const props: MoatShortProps = {
    ticker,
    firmenname: paket.firmenname,
    logoUrl,
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
    closing: start.land,
    musicSrc: null,
    musicGain: 0.5,
    musicTrim: 0,
    sfx: true,
  }

  const warnungen: string[] = []
  warnungen.push(...scriptLoopWarnungen(props.hook, props.closing, props.metricValue))
  const gesprochen = [props.hook, props.hookLoop, props.business, ...props.pillars.map((p) => p.line), props.crack, props.closing]
  const fremd = fremdeZahlen(gesprochen.join(' '), metriken, scores)
  if (fremd.length) warnungen.push(`Zahlen ohne Quelle im Export: ${fremd.join(', ')} — bitte prüfen oder streichen.`)
  const gesamt = gesprochen.map(woerter).reduce((a, b) => a + b, 0)
  if (gesamt > MAX_WOERTER_GESAMT) warnungen.push(`${gesamt} Wörter — zu lang für einen Loop unter 30 Sekunden.`)
  if (zeilen.size < 4) warnungen.push('Nicht alle vier Pfeiler haben einen eigenen Satz bekommen.')
  if (!logoUrl) warnungen.push('Kein drucktaugliches Firmenlogo gefunden — die Business-Szene zeigt nur den Ticker.')

  return {
    props,
    metriken,
    hookVarianten,
    moat,
    moatAusCache,
    title: titelFuerUpload(text(roh.title), ticker, startMetrik.value),
    description: beschreibungFuerUpload(String(roh.description ?? ''), paket.firmenname, ticker, startMetrik.value),
    kommentar: kommentarFuerUpload(text(roh.comment), verdict, ticker),
    suchphrasen,
    warnungen,
  }
}
