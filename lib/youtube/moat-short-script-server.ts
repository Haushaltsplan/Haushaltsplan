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
import { gesamtScoreAusPfeilern, type MoatKiBewertung, type MoatPfeilerId } from '@/lib/portfolio-analyse/moat-ki-types'
import { moatMitRichtung } from '@/lib/youtube/moat-short-urteil'
import type { MoatShortErgebnis, MoatShortHookVariante, MoatShortMetrik } from '@/lib/youtube/moat-short-types'
import { sucheYoutubePhrasen } from '@/lib/youtube/youtube-keywords'
import { findeMoatShortLogo } from '@/lib/youtube/moat-short-logo-server'
import {
  beschreibungFuerUpload,
  kommentarFuerUpload,
  istOffeneBruecke,
  ohneKennzahlId,
  ohneKiBindestrich,
  hookPaar,
  kickerFuerBild,
  kuerzeGesprocheneZeile,
  landZurFrage,
  scriptLoopWarnungen,
  scriptStoryWarnungen,
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
const MAX_WOERTER_GESAMT = 78

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
            kicker: { type: 'string' },
            claim: { type: 'string' },
            proof: { type: 'string' },
            land: { type: 'string' },
            metricId: { type: 'string', enum: hookIds },
          },
          required: ['angle', 'kicker', 'claim', 'proof', 'land', 'metricId'],
        },
      },
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
    required: ['hooks', 'pillarLines', 'crack', 'title', 'description', 'comment'],
  } as const
}

const SYSTEM = `You write the spoken voiceover for "Moat Check", a YouTube Short that judges one company's moat in 30 to 35 seconds.

Persona: a grounded, sharp equity analyst talking to another investor over coffee. Complete sentences. Direct. Dry. Specific. You are not a presenter, not a marketer, and not a slogan writer.

## Voice (every company, not one ticker)
Talk like a person at a table. Same move for ASML, Hermès, a railroad, a card network. The examples below are the MOVE, not vocabulary to copy. Never reuse cards, banks, or payment software unless THIS company actually issues cards.

Every spoken line is a normal human sentence: subject, verb, one thought. 8 to 10 words, and under 70 characters. Count the words. A comma is fine. One breath. The subtitle sits on 2 lines. If it would wrap to a third, the line is too long.

Good proof: "Because they print a 47.1% operating margin."
Good: "Ripping that stack out is a nightmare."
Bad: "Microsoft prints a 47.1% operating margin selling software no corporation can avoid."
Bad: "Ripping active directory and azure out of a Fortune 500 company is a nightmare."
Read every line out loud. Contractions are fine. If you would not say it to a friend, rewrite it. One breath, then stop. No stacked ending.
Good: "Replicating [the concrete thing] requires decades and endless capital."
Bad: "[Company] prints cash." / "Look at the margins." / "Lock-in." (slogan or fragment)
Bad: "Customers face extreme operational complexity when leaving this ecosystem."
Bad: "Building a competing global infrastructure requires decades of capital investment."
Bad: a clause that wraps to four subtitle lines.

Do not bark 3 to 6 word punches. Do not write a memo. Prefer verbs and pictures (rip out, rebuild, nightmare, capital) over stacked nouns (operational complexity, infrastructure, ecosystem, institutions).

## Pillar voice (same recipe, company-specific nouns)
- Pricing power: a number that barely moved, or they still charge. Not "sustained pricing power".
- Hard to copy: what you would have to replicate, plus time and capital. Not "decades of capital investment in infrastructure".
- Switching costs: what they would have to rip out, and that it is a nightmare. Not "operational complexity when leaving this ecosystem".
- Market control: no second shop, no other call. Not "dominant market position".

- Active voice. Concrete nouns from THIS business. The number has to mean something.
- Metaphors stay ordinary: "only shop in town", "tollbooth" only if it fits. Never "integrated settlement network".
- FORBIDDEN words: delve, game-changer, unbelievable, testament, revolutionizing, mind-blowing, pivotal, furthermore, consequently, moreover, therefore, thus, additionally, revolutionary, insane, crazy, massive, juggernaut, powerhouse, unstoppable, incredible, groundbreaking, synergy.
- Cut "basically", "essentially", "secret".
- NEVER use an em-dash, en-dash, or a hyphen with spaces around it. That is AI punctuation. Use a comma, or a second full sentence.

## Seamless loop (land + question = ONE sentence)
YouTube restarts the Short on the first frame with zero gap. The last spoken line must be an unfinished bridge into the opening question. Not a summary. Not a repeated number. Not a period.

Draft the pair as one spoken sentence, then split it.

Good pair (read land, then the question, no pause):
- kicker: "No way out"
- claim: "Why can Microsoft raise prices every year and nobody leaves?"
- proof: "Because they print a 47.1% operating margin."
- land: "Nobody else has a lock like this, so the question is"
- Heard loop: "...so the question is why can Microsoft raise prices every year and nobody leaves?"

Bad land
- "Wide moat. The proof is 51.3%." (standalone summary, repeats the number)
- "Wide moat. 9 out of 10."
- "Thanks for watching." / "And that is the story of ASML."
- Any land that contains the hook metric value
- Any land that ends with a period or a finished thought
- Any land that ends with "which is why" and then a statement. The restart must be the question.

Land rules
- 6-12 words. One clause, NO metric value, NO second sentence.
- End exactly on "so the question is". Never end with . ! ? and never with a dash.
- Do not say the score, "wide moat", "narrow moat", or recap the pillars. The stamp already shows the score. After this line the video loops.

Opening rules, seconds 0 to 5. These override the word targets above for claim and proof.
The examples are the MOVE for every company. Do not copy "ETF" or "benchmark" unless this company sells an index. Do not copy "fees" onto a company that sells machines, bags, or drugs. Use the noun this company actually charges for, and finish the noun.

Grammar
- Every spoken line is a complete sentence. The last word is a noun or a full verb, never a bare adjective.
- Bad: "Why can customers pay endless?" Good: "Why can customers pay endless fees?"
- Bad: "causes legal and operational friction." That is a chopped list of two adjectives. Name one concrete thing, or two complete things. Good: "Ripping the system out takes years."

Causality
- proof is the direct reason for THAT question. A viewer who hears only these two lines must see why the number answers the question.
- If proof is a margin or a return on capital, the question asks about pricing power or dominance. A growth rate does not answer a fee question, and a margin does not answer "how fast are they growing?".
- Patterns, same shape for every company:
  * "Why can [Company] charge endless fees?" -> "Because they command a [X]% margin."
  * "How dominant is [Company]'s market monopoly?" -> "They print a [X]% return on capital."
  * "Why can no customer drop [Company]'s [product]?" -> "Because it yields a [X]% operating margin."
- kicker: 2 to 5 words, under 28 characters, one line a viewer can read in under a second. On screen only. Never spoken. No invented number, no market cap, no dollar figure unless that exact figure is in the metrics list.
- claim: the first spoken line. 6 to 10 words, so the number lands around second 3 to 4. A complete question. Start with Why, How, What, Who, Is, or Can. No metric value. No "Did you know".
- proof: the second spoken line, the answer. 6 to 11 words. A complete sentence. Contains the chosen metric value exactly as written, plus the English name: "a 47.1% operating margin". metricId is a machine key. Never say it. Never write "an ltm_ebit of 47.1%".

## Story order, do not skip ahead
There is no "what they sell" line. Do not describe the business model as its own beat. There is no teaser between the number and the pillars. Do not say "one thing could break that lock" or hint at the threat before the crack.
1. claim (the question, no number). Logo and the on-screen kicker only. No pillar, no score, no bar yet.
2. proof (the number, as the answer)
3. four pillars, in order, each its own sentence
4. crack (the FIRST and only time the threat is named)
5. land (bridge into the question, then stop)

The number is the proof, not the hook. It is spoken only in proof, around the third second. The crack comes after all four pillars.

## Each hook
Write THREE hooks. Each has these fields:
1. kicker, the on-screen headline. Not spoken.
2. claim, the spoken question. No metric.
3. proof, the spoken answer. The metric lives here only.
4. land, unfinished bridge into THAT question. Ends with "so the question is". No number.
5. metricId, hook metric whose exact value appears in proof only.

Angles
- number_shock: the question makes the number feel absurd, then proof says it.
- contrast: expected story vs. the real one, then the number.
- stakes: what it would mean if customers could leave, then the number.

## Rest of the script
Length is part of the voice. One verb, then stop. A third clause is what forces the line break.

Crack, the one threat
Good: "Government fee caps and instant payments threaten margins."
Bad: "Stricter government fee caps and direct account to account payment rails could compress margins."
Same move for every company: name the threat and stop. Do not explain the mechanism in the same sentence.

- pillarLines: one per pillar, 8-9 words, under 70 characters, one complete spoken sentence in the pillar voice above, match the score. Nouns from THIS company only. At most TWO pillars get a metricId, and then the exact value is in the line. Otherwise metricId "none".
- crack: 8-9 words, under 70 characters, ONE concrete threat. This is the first time the threat is named. No sign-off.

## Hard rules
- Use ONLY facts and numbers from the data provided. Never invent numbers, customers, market shares, years or events.
- Write numbers exactly as given (e.g. "28.4%", "2.1 pts", "0.4x").
- The first spoken line is the question. Never open with the metric, "Did you know", "In this video", or "Let's talk about".
- No buy/sell/hold advice, no price targets, no emojis, no hashtags in spoken text.
- Do not speak the score as "X out of 10".
- Whole spoken script stays under 72 words. Count every spoken line. With a slightly brisk voice the Short lands at 30 to 35 seconds.

Also return
- title: 28-58 characters. Start with the company name, not a two-letter ticker. One grammatical clause plus the hook number. No slang ("the tell"), no ALL-CAPS, no hashtags. Good: "Mastercard: why a 58.3% margin is the moat".
- description: two grammatical English sentences. Name the company, the number, and the moat or the one threat. No "discover", "unmatched", "key numbers", "in this video". No em dash. Correct spelling. We add the search line, #Shorts and the disclaimer.
- comment: one grammatical question, 10-16 words, debatable, no subscribe/follow/like.

The input data is partly in German. Write everything in English.`

function richtungAnweisung(richtung: 'groesser' | 'kleiner'): string {
  if (richtung === 'groesser') {
    return 'Editor override: one step HIGHER than the model. The pillar scores below are final. Write a more durable moat, with a wider lock and a smaller crack. If a German reason sounds weaker than its score, follow the score.'
  }
  return 'Editor override: one step LOWER than the model. The pillar scores below are final. Write a thinner moat, with a lead that is easier to challenge and a crack that weighs more. If a German reason sounds stronger than its score, follow the score. Do not insult the company.'
}

function baueUserPrompt(
  paket: FundamentaldatenPaket,
  moat: MoatKiBewertung,
  metriken: MoatShortMetrik[],
  suchphrasen: string[],
  richtung?: 'groesser' | 'kleiner',
): string {
  return [
    `Company: ${paket.firmenname} (${moat.ticker})`,
    'Write THIS company in the same spoken style as the Voice rules. Do not copy another industry\'s nouns.',
    paket.sektor ? `Sector: ${paket.sektor}` : null,
    paket.branche ? `Industry: ${paket.branche}` : null,
    '',
    richtung ? richtungAnweisung(richtung) : null,
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
    'Metrics. metricId is a machine key and must never be spoken. Say the English name, number first:',
    ...metriken.map((m) => `- ${m.label} = ${m.value} (metricId: ${m.id})${m.hook ? ' [hook]' : ''}`),
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
  return ohneKennzahlId(ohneKiBindestrich(text(v)))
}

function objekte(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object') : []
}

export async function generiereMoatShort(opts: {
  paket: FundamentaldatenPaket
  isin: string | null
  moatNeu: boolean
  /** Höher oder niedriger als das KI-Urteil. Verschiebt nur diese Script-Kopie. */
  moatRichtung?: 'groesser' | 'kleiner'
}): Promise<MoatShortErgebnis> {
  const { paket, isin } = opts
  const ticker = (paket.symbolYahoo?.split('.')[0] || paket.ticker).trim().toUpperCase()

  let moat = opts.moatNeu ? null : await ladeMoatKiCache(ticker)
  const moatAusCache = moat != null
  if (!moat) moat = await generiereMoatKiBewertung(paket, isin)
  if (opts.moatRichtung) moat = moatMitRichtung(moat, opts.moatRichtung)

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
    [{ role: 'user', content: baueUserPrompt(paket, moat, metriken, suchphrasen, opts.moatRichtung) }],
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
  const crack = kuerzeGesprocheneZeile(sprechtext(roh.crack), { maxWoerter: 12, maxZeichen: 78 })
  const hookVarianten: MoatShortHookVariante[] = objekte(roh.hooks)
    .map((h) => {
      const metrikId = hookMetriken.some((m) => m.id === h.metricId) ? text(h.metricId) : hookMetriken[0]!.id
      const wert = (metriken.find((m) => m.id === metrikId) ?? hookMetriken[0]!).value
      const label = (metriken.find((m) => m.id === metrikId) ?? hookMetriken[0]!).label
      const proofRoh = sprechtext(h.proof) || `Because they command ${wert} ${label.toLowerCase()}.`
      const paar = hookPaar(sprechtext(h.claim), proofRoh, paket.firmenname, wert, label, metrikId)
      return {
        winkel: text(h.angle),
        kicker: kickerFuerBild(sprechtext(h.kicker), paket.firmenname),
        claim: paar.claim,
        proof: paar.proof,
        loop: '',
        land: landZurFrage(sprechtext(h.land), verdict, wert),
        metrikId,
      }
    })
    .filter((h) => h.claim && h.proof)
  if (!hookVarianten.length) throw new Error('Script-KI lieferte keinen Hook — bitte erneut versuchen.')

  const zeilen = new Map(objekte(roh.pillarLines).map((r) => [text(r.id), r]))
  const scores = [moat.score, ...moat.pfeiler.map((p) => p.score)]

  // Frage ohne Zahl, Zahl nur in der Antwort, Landung mündet in die Frage.
  const start =
    hookVarianten.find((h) => {
      const m = metriken.find((x) => x.id === h.metrikId)
      const gesprochen = `${h.claim} ${h.proof} ${h.land}`
      return (
        m &&
        h.proof.includes(m.value) &&
        /\?\s*$/.test(h.claim) &&
        !h.claim.includes(m.value) &&
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
    kicker: start.kicker,
    hook: start.claim,
    proof: start.proof,
    hookLoop: '',
    metricValue: startMetrik.value,
    metricLabel: startMetrik.label,
    business: '',
    pillars: moat.pfeiler.map((p) => {
      const z = zeilen.get(p.id)
      const stat = metriken.find((m) => m.id === z?.metricId)
      return {
        id: p.id,
        label: PFEILER_LABEL[p.id],
        score: p.score,
        line: kuerzeGesprocheneZeile(sprechtext(z?.line) || `${PFEILER_LABEL[p.id]} is the weak spot.`, {
          maxWoerter: 12,
          maxZeichen: 78,
          behalten: stat?.value,
        }),
        stat: stat ? { value: stat.value, label: stat.label } : null,
      }
    }),
    crack,
    verdict,
    score: gesamtScoreAusPfeilern(moat.pfeiler.map((p) => p.score)),
    closing: start.land,
    musicSrc: null,
    musicGain: 0.5,
    musicTrim: 0,
    sfx: true,
    voiceSrc: null,
    voiceAlignment: null,
  }

  const fest = new Set<string>()
  for (let runde = 0; runde < 16; runde++) {
    const teile = [
      { key: 'hook', text: props.hook, behalten: undefined as string | undefined, frage: true },
      { key: 'proof', text: props.proof, behalten: props.metricValue, frage: false },
      ...props.pillars.map((p, i) => ({ key: `p${i}`, text: p.line, behalten: p.stat?.value, frage: false })),
      { key: 'crack', text: props.crack, behalten: undefined as string | undefined, frage: false },
    ]
    const summe = [...teile.map((t) => t.text), props.closing].map(woerter).reduce((a, b) => a + b, 0)
    if (summe <= MAX_WOERTER_GESAMT) break
    const ziel = teile
      .filter((t) => !fest.has(t.key) && woerter(t.text) > 7)
      .sort((a, b) => woerter(b.text) - woerter(a.text))[0]
    if (!ziel) break
    const neu = kuerzeGesprocheneZeile(ziel.text, {
      maxWoerter: woerter(ziel.text) - 1,
      maxZeichen: 78,
      behalten: ziel.behalten,
      frage: ziel.frage,
    })
    if (woerter(neu) >= woerter(ziel.text)) {
      fest.add(ziel.key)
      continue
    }
    if (ziel.key === 'hook') props.hook = neu
    else if (ziel.key === 'proof') props.proof = neu
    else if (ziel.key === 'crack') props.crack = neu
    else {
      const idx = Number(ziel.key.slice(1))
      const pfeiler = props.pillars[idx]
      if (pfeiler) props.pillars[idx] = { ...pfeiler, line: neu }
    }
  }
  const repariert = hookPaar(props.hook, props.proof, props.firmenname, props.metricValue, props.metricLabel, start.metrikId)
  props.hook = repariert.claim
  props.proof = repariert.proof
  start.kicker = props.kicker
  start.claim = props.hook
  start.proof = props.proof
  start.loop = ''
  start.land = props.closing

  const warnungen: string[] = []
  warnungen.push(...scriptLoopWarnungen(props.hook, props.closing, props.metricValue, props.proof, props.metricLabel))
  warnungen.push(...scriptStoryWarnungen(props.hookLoop, props.crack))
  const gesprochen = [props.hook, props.proof, ...props.pillars.map((p) => p.line), props.crack, props.closing]
  warnungen.push(...scriptTonWarnungen(gesprochen))
  const fremd = fremdeZahlen(gesprochen.join(' '), metriken, scores)
  if (fremd.length) warnungen.push(`Zahlen ohne Quelle im Export: ${fremd.join(', ')} — bitte prüfen oder streichen.`)
  const gesamt = gesprochen.map(woerter).reduce((a, b) => a + b, 0)
  if (gesamt > MAX_WOERTER_GESAMT) warnungen.push(`${gesamt} Wörter — zu lang für 30–35 Sekunden.`)
  if (zeilen.size < 4) warnungen.push('Nicht alle vier Pfeiler haben einen eigenen Satz bekommen.')
  if (!logoUrl) warnungen.push('Kein drucktaugliches Firmenlogo gefunden — die Business-Szene zeigt nur den Ticker.')

  const titel = titelFuerUpload(text(roh.title), ticker, startMetrik.value, suchphrasen, {
    firmenname: paket.firmenname,
    metrikLabel: startMetrik.label,
  })
  return {
    props,
    metriken,
    hookVarianten,
    moat,
    moatAusCache,
    title: titel,
    description: beschreibungFuerUpload(
      String(roh.description ?? ''),
      paket.firmenname,
      ticker,
      startMetrik.value,
      titel,
      suchphrasen,
      startMetrik.label,
    ),
    kommentar: kommentarFuerUpload(text(roh.comment), verdict, ticker),
    suchphrasen,
    warnungen,
  }
}
