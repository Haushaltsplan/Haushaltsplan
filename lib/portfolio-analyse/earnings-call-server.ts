/** Earnings Call — Scrape (Seeking Alpha) + KI-Zusammenfassung. */

import 'server-only'

import { EARNINGS_CALL_SYSTEM_PROMPT } from '@/lib/portfolio-analyse/earnings-call-prompt'
import type { EarningsCallAnfrage, EarningsCallPaket } from '@/lib/portfolio-analyse/earnings-call-types'
import { scrapeSeekingAlphaLetztesTranskript } from '@/lib/portfolio-analyse/seeking-alpha-playwright'
import { resolveCoachProvider, runCoachCompletion, type CoachMessage } from '@/lib/ki-coach-backend'

const MAX_TRANSCRIPT_CHARS = 100_000
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

type CacheEntry = EarningsCallPaket & { expiresAt: number }

const serverCache = new Map<string, CacheEntry>()

function cacheKey(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function ausCache(ticker: string, force?: boolean): EarningsCallPaket | null {
  if (force) return null
  const hit = serverCache.get(cacheKey(ticker))
  if (!hit || hit.expiresAt < Date.now()) {
    if (hit) serverCache.delete(cacheKey(ticker))
    return null
  }
  return { ...hit, ausCache: true }
}

function schreibeCache(paket: EarningsCallPaket): void {
  serverCache.set(cacheKey(paket.ticker), {
    ...paket,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

async function zusammenfasseTranscript(
  transcript: string,
  meta: { ticker: string; titel: string; firmenname?: string | null },
): Promise<string> {
  const provider = resolveCoachProvider()
  if (!provider) {
    throw new Error(
      'KI nicht konfiguriert — GEMINI_API_KEY oder OPENAI_API_KEY in .env.local (wie Finanz-Coach).',
    )
  }

  const clipped =
    transcript.length > MAX_TRANSCRIPT_CHARS
      ? `${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}\n\n[… Transkript gekürzt für KI-Kontext …]`
      : transcript

  const userText = [
    `Unternehmen: ${meta.firmenname?.trim() || meta.ticker} (${meta.ticker})`,
    `Transkript-Titel: ${meta.titel}`,
    '',
    '--- TRANSKRIPT ---',
    clipped,
  ].join('\n')

  const messages: CoachMessage[] = [{ role: 'user', content: userText }]
  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    EARNINGS_CALL_SYSTEM_PROMPT,
    messages,
    { temperature: 0.35, skipMessageTrim: true },
  )

  if (!result.ok) throw new Error(result.hint)
  return result.reply
}

export async function ladeEarningsCallZusammenfassung(anfrage: EarningsCallAnfrage): Promise<EarningsCallPaket> {
  const ticker = anfrage.ticker.trim().toUpperCase()
  if (!ticker) {
    return {
      ok: false,
      ticker: '',
      titel: null,
      transcriptUrl: null,
      callDatum: null,
      transcriptZeichen: 0,
      zusammenfassung: null,
      geladenAm: new Date().toISOString(),
      ausCache: false,
      quelle: 'seeking_alpha',
      fehler: 'Ticker fehlt.',
    }
  }

  const cached = ausCache(ticker, anfrage.force)
  if (cached) return cached

  try {
    const scraped = await scrapeSeekingAlphaLetztesTranskript(ticker)
    const zusammenfassung = await zusammenfasseTranscript(scraped.text, {
      ticker,
      titel: scraped.titel,
      firmenname: anfrage.firmenname,
    })

    const paket: EarningsCallPaket = {
      ok: true,
      ticker,
      titel: scraped.titel,
      transcriptUrl: scraped.url,
      callDatum: scraped.callDatum,
      transcriptZeichen: scraped.text.length,
      zusammenfassung,
      geladenAm: new Date().toISOString(),
      ausCache: false,
      quelle: 'seeking_alpha',
      hinweis:
        process.env.VERCEL === '1'
          ? 'Auf Vercel kann Playwright/Chromium fehlen — lokal oder mit installiertem Chromium deployen.'
          : null,
    }
    schreibeCache(paket)
    return paket
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Earnings Call fehlgeschlagen'
    return {
      ok: false,
      ticker,
      titel: null,
      transcriptUrl: null,
      callDatum: null,
      transcriptZeichen: 0,
      zusammenfassung: null,
      geladenAm: new Date().toISOString(),
      ausCache: false,
      quelle: 'seeking_alpha',
      fehler: msg,
    }
  }
}
