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
  istOffeneBruecke,
  ohneKiBindestrich,
  saubererLand,
  scriptLoopWarnungen,
  scriptTonWarnungen,
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
const MAX_WOERTER_GESAMT = 120

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

const SYSTEM = `You write the spoken voiceover for "Moat Check", a YouTube Short that judges one company's moat in about 32 seconds.

Persona: a grounded, sharp equity analyst talking to another investor over coffee. Complete sentences. Direct. Dry. Specific. You are not a presenter, not a marketer, and not a slogan writer.

## Voice
Every spoken line is a normal human sentence: subject, verb, and a finished thought. 10 to 18 words. A comma is fine. Two clauses in one breath are fine.

Good: "Mastercard prints a 58% margin without taking a dollar of credit risk."
Good: "They sell the lithography tools that print the smallest chips on earth."
Bad: "Mastercard prints cash." (slogan, no information)
Bad: "Look at the margins." / "The ones that print chips." / "Lock-in." (fragments)

Do not bark 3 to 6 word punches. If a line could be a billboard, rewrite it as something you would actually say across the table.

- Active voice. Concrete nouns. The number has to mean something.
- Metaphors stay ordinary: "global tollbooth", "only shop in town". Never "integrated settlement network".
- FORBIDDEN words: delve, game-changer, unbelievable, testament, revolutionizing, mind-blowing, pivotal, furthermore, consequently, moreover, therefore, thus, additionally, revolutionary, insane, crazy, massive, juggernaut, powerhouse, unstoppable, incredible, groundbreaking, synergy.
- Cut "basically", "essentially", "secret".
- NEVER use an em-dash, en-dash, or a hyphen with spaces around it. That is AI punctuation. Use a comma, or a second full sentence.

## Seamless loop (land + claim = ONE sentence)
YouTube restarts the Short on the first frame with zero gap. The last spoken line must be an unfinished bridge that feeds grammatically into the first sentence. Not a summary. Not a repeated phrase. Not a period.

Draft the pair as one spoken sentence, then split it.

Good pair (read land then claim out loud, no pause):
- land: "Banks can't leave and merchants can't opt out, which is why"
- claim: "Mastercard prints a 58% margin without taking credit risk."
- Heard loop: "...which is why Mastercard prints a 58% margin without taking credit risk."

- land: "There is simply no second shop that can print these chips, which is why"
- claim: "ASML prints a 51.3% margin selling machines nobody else can build."

Bad land
- "Wide moat. The proof is 51.3%." (standalone summary, repeats the number)
- "Wide moat. 9 out of 10."
- "Thanks for watching." / "And that is the story of ASML."
- Any land that contains the hook metric value
- Any land that ends with a period or a finished thought

Land rules
- 8-16 words, a real clause with a subject, NO metric value.
- End on "which is why" or "that's why". Never end with . ! ? and never with a dash.
- After land, speech restarts instantly on claim. Zero trailing silence.

Claim rules
- 12-18 words. One complete sentence. No dashes. No second slogan after a period.
- MUST start with the company name or ticker, then a verb. Never start with "At 51.3%" or a question.
- Contains the chosen metric value exactly as written.
- The number must mean something.

## Each hook
Write THREE hooks. Each has four fields:
1. claim, see above.
2. loop (10-16 words): a complete sentence spoken next. Opens a gap the single crack later fills. Same threat, three phrasings.
3. land, unfinished bridge into THAT claim. No number.
4. metricId, hook metric whose exact value appears in claim only.

Angles
- number_shock: the number is absurd for this industry, and you say why.
- contrast: expected story vs. the real one.
- stakes: what breaks if this company vanishes, anchored by the number.

## Rest of the script
- business: 12-18 words, one complete sentence, what they sell and to whom. A metaphor is fine if it is earned.
- pillarLines: one per pillar, 10-16 words, one complete sentence, match the score (high = strength, low = weakness). At most TWO pillars get a metricId, and then the exact value is in the line. Otherwise metricId "none".
- crack: 12-20 words, ONE concrete threat in one or two complete sentences. It answers all three loop lines. No sign-off.

## Hard rules
- Use ONLY facts and numbers from the data provided. Never invent numbers, customers, market shares, years or events.
- Write numbers exactly as given (e.g. "28.4%", "2.1 pts", "0.4x").
- Never open a claim with a question, "Did you know", "In this video", "Let's talk about".
- No buy/sell/hold advice, no price targets, no emojis, no hashtags in spoken text.
- Do not speak the score as "X out of 10".
- Whole spoken script stays under 120 words.

Also return
- title: 30-50 characters, ticker or company first, curiosity without ALL-CAPS or !!. If a YouTube search suggestion fits, prefer it. Examples: "ASML: why nobody can copy it" / "Visa's 67.4% problem".
- description: two short English sentences, verdict plus the hook number. We add the first search line, disclaimer and hashtags.
- comment: one pinned-comment question, 10-16 words, debatable, no subscribe/follow/like.

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

function sprechtext(v: unknown): string {
  return ohneKiBindestrich(text(v))
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
        claim: sprechtext(h.claim),
        loop: sprechtext(h.loop),
        land: saubererLand(sprechtext(h.land), verdict, wert),
        metrikId,
      }
    })
    .filter((h) => h.claim)
  if (!hookVarianten.length) throw new Error('Script-KI lieferte keinen Hook — bitte erneut versuchen.')

  const zeilen = new Map(objekte(roh.pillarLines).map((r) => [text(r.id), r]))
  const scores = [moat.score, ...moat.pfeiler.map((p) => p.score)]

  // Bevorzugt die Variante, deren Landung offen in den Hook mündet — Zahl nur im Claim.
  const start =
    hookVarianten.find((h) => {
      const m = metriken.find((x) => x.id === h.metrikId)
      const gesprochen = `${h.claim} ${h.loop} ${h.land}`
      return (
        m &&
        h.claim.includes(m.value) &&
        istOffeneBruecke(h.land, m.value) &&
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
    business: sprechtext(roh.business),
    pillars: moat.pfeiler.map((p) => {
      const z = zeilen.get(p.id)
      const stat = metriken.find((m) => m.id === z?.metricId)
      return {
        id: p.id,
        label: PFEILER_LABEL[p.id],
        score: p.score,
        line: sprechtext(z?.line) || `${PFEILER_LABEL[p.id]} is the weak spot.`,
        stat: stat ? { value: stat.value, label: stat.label } : null,
      }
    }),
    crack: sprechtext(roh.crack),
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
  warnungen.push(...scriptTonWarnungen(gesprochen))
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
