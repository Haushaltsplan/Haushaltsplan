/** Earnings Call — SEC + IR-Scrape + KI, nach Quartalen. */

import 'server-only'

import {
  gruppiereNachJahr,
  parseQuartalAusText,
  sortiereQuartale,
} from '@/lib/portfolio-analyse/earnings-call-quartal'
import { EARNINGS_CALL_SYSTEM_PROMPT } from '@/lib/portfolio-analyse/earnings-call-prompt'
import {
  ladeEarningsCallKiCacheEintrag,
  ladeEarningsCallKiCacheFuerTicker,
  loescheEarningsCallKiCacheEintrag,
  speichereEarningsCallKiCache,
} from '@/lib/portfolio-analyse/earnings-call-ki-cache-server'
import type {
  EarningsCallAnfrage,
  EarningsCallPaket,
  EarningsCallQuartalEintrag,
  EarningsCallQuelle,
} from '@/lib/portfolio-analyse/earnings-call-types'
import { ladeFinnhubLetztesTranskript } from '@/lib/portfolio-analyse/finnhub-earnings-transcript-server'
import { ladeIrTranskriptHistorie } from '@/lib/portfolio-analyse/ir-earnings-scraper'
import { ladeMotleyFoolTranskriptHistorie } from '@/lib/portfolio-analyse/motley-fool-earnings-transcript-server'
import { ladeInvestorRelationsUrl } from '@/lib/portfolio-analyse/investor-relations-url'
import { ladeSecEdgarTranskriptHistorie } from '@/lib/portfolio-analyse/sec-edgar-earnings-transcript-server'
import { resolveCoachProviderFromMode, runCoachCompletion, earningsCallGeminiModelKandidaten } from '@/lib/ki-coach-backend'

const MAX_TRANSCRIPT_CHARS = 100_000
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_QUARTALE = 8

type RohesTranskript = {
  titel: string
  url: string
  callDatum: string | null
  text: string
  quelle: EarningsCallQuelle
}

type DiscoveryCache = {
  expiresAt: number
  roh: RohesTranskript[]
  summaries: Map<string, string>
}

const discoveryCache = new Map<string, DiscoveryCache>()

function tickerKey(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function getDiscovery(ticker: string, force?: boolean): DiscoveryCache | null {
  const hit = discoveryCache.get(tickerKey(ticker))
  if (!hit || hit.expiresAt < Date.now()) {
    if (hit) discoveryCache.delete(tickerKey(ticker))
    return null
  }
  if (force) return null
  return hit
}

function setDiscovery(ticker: string, roh: RohesTranskript[], prev?: DiscoveryCache): void {
  discoveryCache.set(tickerKey(ticker), {
    expiresAt: Date.now() + CACHE_TTL_MS,
    roh,
    summaries: prev?.summaries ?? new Map(),
  })
}

async function ladePersistenteSummaries(ticker: string, cache: DiscoveryCache): Promise<void> {
  const gespeichert = await ladeEarningsCallKiCacheFuerTicker(ticker)
  for (const [quartalId, eintrag] of gespeichert) {
    if (!cache.summaries.has(quartalId)) {
      cache.summaries.set(quartalId, eintrag.zusammenfassung)
    }
  }
}

async function summaryAusPersistenz(
  ticker: string,
  quartalId: string,
  transcriptUrl: string,
  forceKi?: boolean,
): Promise<string | null> {
  if (forceKi) return null
  const hit = await ladeEarningsCallKiCacheEintrag(ticker, quartalId)
  if (!hit) return null
  if (hit.transcriptUrl && hit.transcriptUrl !== transcriptUrl) {
    await loescheEarningsCallKiCacheEintrag(ticker, quartalId)
    return null
  }
  return hit.zusammenfassung
}

async function entdeckeTranskripte(
  anfrage: EarningsCallAnfrage,
  irUrl: string | null,
): Promise<RohesTranskript[]> {
  const ticker = tickerKey(anfrage.ticker)
  const isUsIsin = Boolean(anfrage.isin?.trim().toUpperCase().startsWith('US'))

  // 1) IR-Website / Q4-API — volle Call-Transkripte (Priorität)
  if (anfrage.isin?.trim() || irUrl) {
    try {
      const ir = await ladeIrTranskriptHistorie(anfrage.isin ?? '', irUrl, MAX_QUARTALE)
      if (ir.length > 0) {
        return ir.map((s) => ({
          titel: s.titel,
          url: s.url,
          callDatum: s.callDatum,
          text: s.text,
          quelle: 'ir_scrape' as const,
        }))
      }
    } catch (irErr) {
      if (!isUsIsin) {
        const finnhub = await ladeFinnhubLetztesTranskript(ticker)
        if (finnhub) {
          return [
            {
              titel: finnhub.titel,
              url: finnhub.url,
              callDatum: finnhub.callDatum,
              text: finnhub.text,
              quelle: 'finnhub',
            },
          ]
        }
        throw irErr
      }
    }
  }

  // 2) Motley Fool — kostenlose Call-Transkripte (US & große internationale Titel)
  try {
    const fool = await ladeMotleyFoolTranskriptHistorie(ticker, anfrage.firmenname, MAX_QUARTALE)
    if (fool.length > 0) {
      return fool.map((s) => ({
        titel: s.titel,
        url: s.url,
        callDatum: s.callDatum,
        text: s.text,
        quelle: 'motley_fool' as const,
      }))
    }
  } catch {
    /* SEC / Finnhub */
  }

  // 3) SEC — nur echte Call-Transkripte (Ex. 99.2)
  let sec: Awaited<ReturnType<typeof ladeSecEdgarTranskriptHistorie>> = []
  try {
    sec = await ladeSecEdgarTranskriptHistorie(ticker, MAX_QUARTALE)
  } catch {
    /* Finnhub */
  }
  if (sec.length > 0) {
    return sec.map((s) => ({
      titel: s.titel,
      url: s.url,
      callDatum: s.callDatum,
      text: s.text,
      quelle: 'sec_edgar' as const,
    }))
  }

  const finnhub = await ladeFinnhubLetztesTranskript(ticker)
  if (finnhub) {
    return [
      {
        titel: finnhub.titel,
        url: finnhub.url,
        callDatum: finnhub.callDatum,
        text: finnhub.text,
        quelle: 'finnhub',
      },
    ]
  }

  if (isUsIsin) {
    throw new Error(
      `Kein Earnings-Call-Transkript (Conference Call inkl. Q&A) für ${ticker} gefunden. Motley Fool, SEC und IR-Seite wurden geprüft.`,
    )
  }

  throw new Error(
    'Kein Earnings-Call-Transkript gefunden. Gesucht wird das Conference-Call-Transkript mit Q&A — nicht Präsentation oder Pressemitteilung.',
  )
}

function rohZuQuartale(roh: RohesTranskript[]): EarningsCallQuartalEintrag[] {
  const eintraege: EarningsCallQuartalEintrag[] = []
  const usedIds = new Set<string>()

  for (const r of roh) {
    const q = parseQuartalAusText(r.titel, r.callDatum)
    let id = q?.id ?? `unknown-${r.url.slice(-12)}`
    let jahr = q?.jahr ?? (r.callDatum ? new Date(r.callDatum).getFullYear() : new Date().getFullYear())
    let quartal = q?.quartal ?? (1 as const)
    let label = q?.label ?? r.titel.slice(0, 40)

    if (usedIds.has(id)) {
      id = `${id}-${eintraege.length}`
    }
    usedIds.add(id)

    eintraege.push({
      id,
      jahr,
      quartal,
      label,
      titel: r.titel,
      callDatum: r.callDatum,
      transcriptUrl: r.url,
      quelle: r.quelle,
      transcriptZeichen: r.text.length,
      zusammenfassung: null,
    })
  }

  return sortiereQuartale(eintraege)
}

async function zusammenfasseTranscript(
  transcript: string,
  meta: { ticker: string; titel: string; label: string; firmenname?: string | null },
): Promise<string> {
  const provider = resolveCoachProviderFromMode('gemini')
  if (!provider) {
    throw new Error('KI nicht konfiguriert — GEMINI_API_KEY in .env.local setzen.')
  }

  const clipped =
    transcript.length > MAX_TRANSCRIPT_CHARS
      ? `${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}\n\n[… gekürzt …]`
      : transcript

  const userText = [
    `Unternehmen: ${meta.firmenname?.trim() || meta.ticker} (${meta.ticker})`,
    `Quartal: ${meta.label}`,
    `Titel: ${meta.titel}`,
    '',
    '--- TRANSKRIPT ---',
    clipped,
  ].join('\n')

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    EARNINGS_CALL_SYSTEM_PROMPT,
    [{ role: 'user', content: userText }],
    {
      temperature: 0.35,
      skipMessageTrim: true,
      geminiModels: earningsCallGeminiModelKandidaten(),
    },
  )

  if (!result.ok) throw new Error(result.hint)
  return result.reply
}

function findeRohFuerQuartal(cache: DiscoveryCache, quartalId: string): RohesTranskript | null {
  const quartale = rohZuQuartale(cache.roh)
  const meta = quartale.find((q) => q.id === quartalId)
  if (!meta) return null
  return cache.roh.find((r) => r.url === meta.transcriptUrl) ?? null
}

function bauePaket(
  ticker: string,
  cache: DiscoveryCache,
  irUrl: string | null,
  aktivesQuartalId: string | null,
  ausCache: boolean,
  hinweis?: string | null,
): EarningsCallPaket {
  const quartale = rohZuQuartale(cache.roh).map((q) => ({
    ...q,
    zusammenfassung: cache.summaries.get(q.id) ?? null,
  }))

  return {
    ok: quartale.length > 0,
    ticker,
    quartale,
    aktivesQuartalId: aktivesQuartalId ?? null,
    geladenAm: new Date().toISOString(),
    ausCache,
    hinweis,
    investorRelationsUrl: irUrl,
  }
}

export async function ladeEarningsCallZusammenfassung(anfrage: EarningsCallAnfrage): Promise<EarningsCallPaket> {
  const ticker = tickerKey(anfrage.ticker)
  const irUrl = anfrage.isin?.trim()
    ? await ladeInvestorRelationsUrl(anfrage.isin, anfrage.firmenname ?? '', ticker).catch(() => null)
    : null

  if (!ticker) {
    return {
      ok: false,
      ticker: '',
      quartale: [],
      aktivesQuartalId: null,
      geladenAm: new Date().toISOString(),
      ausCache: false,
      fehler: 'Ticker fehlt.',
      investorRelationsUrl: irUrl,
    }
  }

  let cache = getDiscovery(ticker, anfrage.force)
  const hadMemoryCache = Boolean(cache)
  const staleHit = discoveryCache.get(ticker)

  if (!cache) {
    try {
      const roh = await entdeckeTranskripte(anfrage, irUrl)
      setDiscovery(ticker, roh, anfrage.force ? staleHit : undefined)
      cache = discoveryCache.get(ticker)!
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Earnings Call fehlgeschlagen'
      const msg = /doctype|not valid json|unexpected token/i.test(raw)
        ? 'Datenquelle lieferte HTML statt JSON — bitte erneut versuchen.'
        : raw
      return {
        ok: false,
        ticker,
        quartale: [],
        aktivesQuartalId: null,
        geladenAm: new Date().toISOString(),
        ausCache: false,
        fehler: msg,
        hinweis: 'Quellen: IR · Motley Fool · SEC · Finnhub',
        investorRelationsUrl: irUrl,
      }
    }
  }

  await ladePersistenteSummaries(ticker, cache)

  const quartale = rohZuQuartale(cache.roh)
  const zielId = anfrage.quartalId?.trim() || null

  if (!zielId) {
    return bauePaket(ticker, cache, irUrl, null, hadMemoryCache, null)
  }

  const roh = findeRohFuerQuartal(cache, zielId)
  const meta = quartale.find((q) => q.id === zielId)

  if (roh && meta && (!cache.summaries.has(zielId) || anfrage.forceKi)) {
    const cached = await summaryAusPersistenz(ticker, zielId, roh.url, anfrage.forceKi)
    if (cached) {
      cache.summaries.set(zielId, cached)
    } else {
      try {
        const summary = await zusammenfasseTranscript(roh.text, {
          ticker,
          titel: roh.titel,
          label: meta.label,
          firmenname: anfrage.firmenname,
        })
        cache.summaries.set(zielId, summary)
        await speichereEarningsCallKiCache({
          ticker,
          quartalId: zielId,
          transcriptUrl: roh.url,
          zusammenfassung: summary,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'KI-Zusammenfassung fehlgeschlagen'
        return {
          ...bauePaket(ticker, cache, irUrl, zielId, hadMemoryCache, null),
          ok: true,
          fehler: msg,
        }
      }
    }
  }

  const quelle = cache.roh[0]?.quelle
  const hinweis =
    quelle === 'ir_scrape'
      ? 'Transkripte von der Investor-Relations-Seite.'
      : quelle === 'motley_fool'
        ? 'Transkripte von The Motley Fool (Conference Call inkl. Q&A).'
        : quelle === 'sec_edgar'
          ? 'Offizielle SEC-8-K-Transkripte (US).'
          : null

  return bauePaket(ticker, cache, irUrl, zielId, hadMemoryCache && !anfrage.force, hinweis)
}

/** Für UI-Gruppierung */
export { gruppiereNachJahr }
