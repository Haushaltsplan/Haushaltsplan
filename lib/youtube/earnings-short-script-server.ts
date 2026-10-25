/**
 * Englisches ~55-Sekunden-Script für Earnings Check — Free-Tier Gemini.
 */
import 'server-only'

import {
  geminiFreeTierFlashModelKandidaten,
  resolveGeminiFreeTierProvider,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'
import { sucheYoutubePhrasen } from '@/lib/youtube/youtube-keywords'
import { findeMoatShortLogo } from '@/lib/youtube/moat-short-logo-server'
import { bilderAusJson, type EarningsShortBild } from '@/lib/youtube/earnings-short-bilder'
import { ladeEarningsShortQuellen } from '@/lib/youtube/earnings-short-quellen-server'
import {
  earningsBeschreibungFuerUpload,
  earningsKommentarFuerUpload,
  earningsLoopWarnungen,
  earningsTitelFuerUpload,
} from '@/lib/youtube/earnings-short-script'
import type { EarningsShortAntwort } from '@/lib/youtube/earnings-short-types'
import { ohneKennzahlId, ohneKiBindestrich } from '@/lib/youtube/moat-short-script'
import type { EarningsShortProps } from '@/remotion/earnings-short-types'

const MAX_WOERTER = 160

const SCHEMA = {
  type: 'object',
  properties: {
    hook: { type: 'string' },
    numbers: { type: 'string' },
    call0: { type: 'string' },
    call1: { type: 'string' },
    filing: { type: 'string' },
    takeaway: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    comment: { type: 'string' },
  },
  required: ['hook', 'numbers', 'call0', 'call1', 'filing', 'takeaway', 'title', 'description', 'comment'],
} as const

const SYSTEM = `You write the spoken voiceover for "Earnings Check", a YouTube Short that briefs one company's latest quarter in about 55 seconds.

Persona: a grounded, sharp equity analyst talking to another investor over coffee. Complete sentences. Direct. Dry. Specific.

This is NOT a beat ticker. The beat or miss opens the door. The Short exists to tell what actually mattered on the earnings call and in the quarterly report.

## Voice
Talk like a person at a table. No slogans. Two short sentences are fine on the call and filing lines so the Short can hold 50 to 58 seconds.
FORBIDDEN words: delve, game-changer, unbelievable, testament, revolutionizing, mind-blowing, pivotal, furthermore, consequently, moreover, therefore, thus, additionally, revolutionary, insane, crazy, massive, juggernaut, powerhouse, unstoppable, incredible, groundbreaking, synergy.
NEVER use an em-dash, en-dash, or a hyphen with spaces around it. Use a comma, or a second full sentence.
No buy/sell/hold, no price targets, no emojis, no hashtags in spoken text.
Use ONLY facts from the provided call summary, filing summary, numbers, and estimate screenshots. Never invent numbers, customers, or events.
If screenshots of consensus / estimates are attached, they are the source of truth for expected EPS and revenue. Prefer those figures over the cache whenever they disagree. Speak the screenshot numbers exactly.

## Story order
1. hook — company + quarter + the surprise number exactly as given. Once.
2. numbers — EPS and revenue actual vs estimate, one sentence. Do not repeat "beat" or "miss" if the hook already said it.
3. call0 — the most material call topic (guidance, demand, backlog, segment). Two sentences, 28-36 words.
4. call1 — the second topic (margin, FCF, a risk, or a management line). Two sentences, 28-36 words.
5. filing — one point from the 10-Q/IR that adds or contradicts the call, 20-28 words. If no filing text, a third call point.
6. takeaway — unfinished bridge into the hook, 12-16 words. End on "which is why" or "that's why". No period. Do NOT repeat the surprise number. Not "beat, therefore buy".

Word budget 140 to 160. Roughly: hook+numbers 40, two call blocks 70, filing 25, takeaway 20.

## Hook
MUST start with the company name or ticker, then a verb.
MUST contain the surprise value exactly as written (e.g. "+4.2%").
12-16 words, one sentence.

## Takeaway / loop
YouTube restarts on frame one. takeaway + hook must read as one sentence.
Good takeaway: "The call is about the backlog, not the print, which is why"
Bad: "Solid quarter. That's the story."

Also return
- title: 28-58 characters. Ticker first. Curiosity + earnings, not ALL-CAPS.
- description: two English sentences that expand the title. We add #Shorts and the disclaimer.
- comment: one pinned question, 10-16 words, no subscribe.

The source text may be German. Write everything in English.`

function woerter(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
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

export async function generiereEarningsShort(opts: {
  ticker: string
  firmenname?: string | null
  isin?: string | null
  website?: string | null
  symbolYahoo?: string | null
  estimateBilder?: unknown
}): Promise<EarningsShortAntwort> {
  const geladen = await ladeEarningsShortQuellen({ ticker: opts.ticker, firmenname: opts.firmenname })
  if (!geladen.ok) {
    return { ok: false, fehler: geladen.luecken.map((l) => l.hinweis).join(' '), luecken: geladen.luecken }
  }
  const q = geladen.quellen

  const provider = resolveGeminiFreeTierProvider()
  if (!provider) throw new Error('GEMINI_API_KEY_FREE fehlt — das Script nutzt den Free-Key.')

  const suchphrasen = await sucheYoutubePhrasen(q.ticker, q.firmenname)
  if (!suchphrasen.some((p) => /earnings/i.test(p))) suchphrasen.unshift(`${q.ticker} earnings`)

  const shots: EarningsShortBild[] = bilderAusJson(opts.estimateBilder)
  const user = [
    `Company: ${q.firmenname} (${q.ticker})`,
    `Quarter: ${q.quartalLabel}`,
    `Print: ${q.beat} · surprise ${q.metricValue} (${q.metricLabel})`,
    `EPS actual ${q.eps.ist} vs estimate ${q.eps.schaetzung} (${q.eps.anzeige})`,
    `Revenue actual ${q.umsatz.ist} vs estimate ${q.umsatz.schaetzung} (${q.umsatz.anzeige})`,
    shots.length
      ? `\n${shots.length} consensus screenshot(s) attached. Read EPS/revenue estimates (and actuals if shown). Those numbers override the cache for the spoken hook and numbers line.`
      : null,
    '',
    `Earnings call (${q.callLabel}) — full KI summary, pick the 2-3 most material topics:`,
    q.callZusammenfassung,
    q.transcriptAuszug ? `\nTranscript excerpt (do not quote junk, only if it supports a topic):\n${q.transcriptAuszug}` : null,
    q.berichtZusammenfassung
      ? `\nQuarterly report (${q.berichtLabel ?? 'filing'}) — one complementary or contradictory point:\n${q.berichtZusammenfassung}`
      : '\nNo filing summary. Use a third call point for the filing line.',
    suchphrasen.length ? `\nYouTube search suggestions: ${suchphrasen.join(' · ')}` : null,
  ]
    .filter((z) => z != null)
    .join('\n')

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    SYSTEM,
    [
      {
        role: 'user',
        content: user,
        images: shots.map((s) => ({ mimeType: s.mimeType, base64: s.base64 })),
      },
    ],
    {
      geminiModels: geminiFreeTierFlashModelKandidaten(),
      geminiForceFreeApiKey: true,
      jsonResponse: { schema: SCHEMA },
      maxOutputTokens: 4096,
      timeoutMs: 90_000,
      geminiTotalBudgetMs: 120_000,
    },
  )
  if (!result.ok) throw new Error(result.hint || 'Script-Generierung fehlgeschlagen')

  const roh = parseJson(result.reply)
  if (!roh) throw new Error('Script-KI lieferte kein gültiges JSON — bitte erneut versuchen.')

  const logoUrl = await findeMoatShortLogo({
    ticker: q.ticker,
    firmenname: q.firmenname,
    isin: opts.isin ?? null,
    website: opts.website ?? null,
    symbolYahoo: opts.symbolYahoo ?? q.ticker,
  })

  const props: EarningsShortProps = {
    ticker: q.ticker,
    firmenname: q.firmenname,
    logoUrl,
    quartalLabel: q.quartalLabel,
    hook: sprechtext(roh.hook),
    metricValue: q.metricValue,
    metricLabel: q.metricLabel,
    numbers: sprechtext(roh.numbers),
    eps: q.eps,
    umsatz: q.umsatz,
    call0: sprechtext(roh.call0),
    call1: sprechtext(roh.call1),
    filing: sprechtext(roh.filing),
    takeaway: sprechtext(roh.takeaway),
    beat: q.beat,
    musicSrc: null,
    musicGain: 0.5,
    musicTrim: 0,
    sfx: true,
    voiceSrc: null,
    voiceAlignment: null,
  }

  const gesprochen = [props.hook, props.numbers, props.call0, props.call1, props.filing, props.takeaway]
  const warnungen = [...earningsLoopWarnungen(props.hook, props.takeaway, props.metricValue)]
  const gesamt = gesprochen.map(woerter).reduce((a, b) => a + b, 0)
  if (gesamt > MAX_WOERTER) warnungen.push(`${gesamt} Wörter — lieber unter 160 für 50–58 Sekunden.`)
  if (!q.berichtZusammenfassung) warnungen.push('Kein Bericht-Cache — der Filing-Satz kommt aus dem Call.')
  if (!logoUrl) warnungen.push('Kein Firmenlogo gefunden — die Kopfzeile zeigt nur den Ticker.')
  if (!shots.length) warnungen.push('Kein Estimate-Screenshot — Konsens kommt nur aus dem Cache.')

  const titel = earningsTitelFuerUpload(text(roh.title), q.ticker, q.metricValue, suchphrasen)
  return {
    ok: true,
    props,
    title: titel,
    description: earningsBeschreibungFuerUpload(String(roh.description ?? ''), q.firmenname, q.ticker, q.metricValue, titel, suchphrasen),
    kommentar: earningsKommentarFuerUpload(text(roh.comment), q.ticker),
    suchphrasen,
    warnungen,
    quartalLabel: q.quartalLabel,
    callLabel: q.callLabel,
    hatBericht: Boolean(q.berichtZusammenfassung),
  }
}
