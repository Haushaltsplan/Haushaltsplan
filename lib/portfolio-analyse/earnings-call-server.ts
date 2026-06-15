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
  ladeUnternehmenCache,
  loescheEarningsCallKiCacheEintrag,
  speichereEarningsCallKiCache,
  speichereUnternehmenTranskripte,
} from '@/lib/portfolio-analyse/earnings-call-unternehmen-cache-server'
import type {
  EarningsCallAnfrage,
  EarningsCallPaket,
  EarningsCallQuartalEintrag,
  EarningsCallQuelle,
} from '@/lib/portfolio-analyse/earnings-call-types'
import { ladeFinnhubTranskriptHistorie } from '@/lib/portfolio-analyse/finnhub-earnings-transcript-server'
import { ladeMarketbeatTranskriptHistorie } from '@/lib/portfolio-analyse/marketbeat-earnings-transcript-server'
import { ladeInvestingTranskriptHistorie } from '@/lib/portfolio-analyse/investing-earnings-transcript-server'
import { ladeIrTranskriptHistorie } from '@/lib/portfolio-analyse/ir-earnings-scraper'
import { aufloeseEarningsCallKontext } from '@/lib/portfolio-analyse/earnings-call-kenntnisse'
import { irEarningsQuelleFuerIsin } from '@/lib/portfolio-analyse/ir-earnings-sources'
import { ladeMotleyFoolTranskriptHistorie } from '@/lib/portfolio-analyse/motley-fool-earnings-transcript-server'
import { ladeInvestorRelationsUrl } from '@/lib/portfolio-analyse/investor-relations-url'
import { ladeSecEdgarTranskriptHistorie } from '@/lib/portfolio-analyse/sec-edgar-earnings-transcript-server'
import { resolveCoachProviderFromMode, runCoachCompletion, earningsCallGeminiModelKandidaten } from '@/lib/ki-coach-backend'
import { zusammenfassungMitMarktkontext } from '@/lib/portfolio-analyse/marktkontext-ki-server'

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

function mappeRohe(
  liste: Array<{ titel: string; url: string; callDatum: string | null; text: string }>,
  quelle: EarningsCallQuelle,
): RohesTranskript[] {
  return liste.map((s) => ({
    titel: s.titel,
    url: s.url,
    callDatum: s.callDatum,
    text: s.text,
    quelle,
  }))
}

async function mitZeitlimit<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

async function entdeckeTranskripte(
  anfrage: EarningsCallAnfrage,
  irUrl: string | null,
): Promise<RohesTranskript[]> {
  const kontext = aufloeseEarningsCallKontext(anfrage)
  const ticker = tickerKey(kontext.foolTicker || anfrage.ticker)
  const firmenname = kontext.firmenname ?? anfrage.firmenname

  if (kontext.istEtf) {
    throw new Error(
      `${firmenname ?? ticker}: ETFs veröffentlichen keine klassischen Earnings Calls — Quelle nicht verfügbar.`,
    )
  }

  const isUsSec = kontext.isUsSec
  const symbolYahoo = kontext.symbolYahoo

  const irHard = irEarningsQuelleFuerIsin(anfrage.isin ?? '')
  const irErwarteTranskript = !kontext.irNurWebcast && irHard?.erwarteVollesTranskript !== false
  const irVersuchen =
    irErwarteTranskript && Boolean(anfrage.isin?.trim() || irUrl) && (!isUsSec || Boolean(irHard?.listenUrls.length))

  const marketbeatVersuchen = async (budgetMs: number) => {
    const mb = await mitZeitlimit(
      ladeMarketbeatTranskriptHistorie(ticker, firmenname, MAX_QUARTALE, symbolYahoo),
      budgetMs,
      [],
    )
    if (mb.length > 0) return mappeRohe(mb, 'marketbeat')
    return null
  }

  const irVersuchenUndLaden = async (budgetMs: number) => {
    if (!irVersuchen) return null
    const ir = await mitZeitlimit(
      ladeIrTranskriptHistorie(anfrage.isin ?? '', irUrl, MAX_QUARTALE).catch(() => []),
      budgetMs,
      [],
    )
    if (ir.length > 0) return mappeRohe(ir, 'ir_scrape')
    return null
  }

  if (isUsSec) {
    // US: MarketBeat zuerst (Quartr) — war zuverlässigste Quelle
    try {
      const hit = await marketbeatVersuchen(60_000)
      if (hit) return hit
    } catch {
      /* IR / Fool */
    }

    try {
      const ir = await irVersuchenUndLaden(20_000)
      if (ir) return ir
    } catch {
      /* Fool */
    }
  } else {
    // EU: IR zuerst, dann MarketBeat
    try {
      const ir = await irVersuchenUndLaden(45_000)
      if (ir) return ir
    } catch {
      /* MarketBeat */
    }

    try {
      const hit = await marketbeatVersuchen(50_000)
      if (hit) return hit
    } catch {
      /* Investing / Finnhub */
    }
  }

  // 3) Investing.com — EU/internationale Transkripte (z. B. LVMH, ASML)
  if (!isUsSec) {
    try {
      const inv = await mitZeitlimit(
        ladeInvestingTranskriptHistorie(ticker, firmenname, MAX_QUARTALE),
        40_000,
        [],
      )
      if (inv.length > 0) {
        return mappeRohe(inv, 'investing_com')
      }
    } catch {
      /* Finnhub */
    }
  }

  // 4) Finnhub — optional (Paid-Plan); oft internationale ADRs und EU-Listings
  if (!isUsSec) {
    try {
      const fh = await mitZeitlimit(ladeFinnhubTranskriptHistorie(ticker, symbolYahoo, MAX_QUARTALE), 35_000, [])
      if (fh.length > 0) {
        return mappeRohe(fh, 'finnhub')
      }
    } catch {
      /* Fool */
    }
  }

  // 5) Motley Fool
  let foolBlockiert = false
  try {
    const fool = await mitZeitlimit(
      ladeMotleyFoolTranskriptHistorie(ticker, firmenname, MAX_QUARTALE, {
        extraSlugs: kontext.foolSlugs,
        onBlockiert: () => {
          foolBlockiert = true
        },
      }),
      95_000,
      [],
    )
    if (fool.length > 0) {
      return mappeRohe(fool, 'motley_fool')
    }
  } catch {
    /* SEC / Ende */
  }

  // 6) SEC — nur US/CA; viele Firmen haben nur EX-99.1 Pressemitteilung, kein Transkript
  if (isUsSec) {
    try {
      const sec = await mitZeitlimit(ladeSecEdgarTranskriptHistorie(ticker, MAX_QUARTALE), 45_000, [])
      if (sec.length > 0) {
        return mappeRohe(sec, 'sec_edgar')
      }
    } catch {
      /* Ende */
    }
  }

  const quellen = isUsSec
    ? foolBlockiert
      ? 'MarketBeat, Motley Fool (Rate-Limit) und SEC'
      : 'MarketBeat, Motley Fool und SEC'
    : 'IR, MarketBeat, Investing.com, Finnhub, Motley Fool'

  throw new Error(
    `Kein Earnings-Call-Transkript (Conference Call inkl. Q&A) für ${firmenname ?? ticker} (${ticker}) gefunden. Geprüft: ${quellen}.`,
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
  const basis = result.reply
  return zusammenfassungMitMarktkontext(basis, {
    ticker: meta.ticker,
    firmenname: meta.firmenname,
    berichtLabel: `${meta.label} · ${meta.titel}`,
  })
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
  const kontext = aufloeseEarningsCallKontext(anfrage)
  const ticker = tickerKey(kontext.foolTicker || anfrage.ticker)

  if (!ticker) {
    return {
      ok: false,
      ticker: '',
      quartale: [],
      aktivesQuartalId: null,
      geladenAm: new Date().toISOString(),
      ausCache: false,
      fehler: 'Ticker fehlt.',
      investorRelationsUrl: null,
    }
  }

  let cache = getDiscovery(ticker, anfrage.force)
  const hadMemoryCache = Boolean(cache)
  let fromFileCache = false
  let persistedIrUrl: string | null = null
  const staleHit = discoveryCache.get(ticker)

  if (!cache && !anfrage.force) {
    const persisted = await ladeUnternehmenCache(ticker)
    if (persisted?.roh.length) {
      persistedIrUrl = persisted.investorRelationsUrl
      const summaries = new Map<string, string>()
      for (const [quartalId, row] of Object.entries(persisted.summaries)) {
        summaries.set(quartalId, row.zusammenfassung)
      }
      cache = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        roh: persisted.roh,
        summaries,
      }
      discoveryCache.set(ticker, cache)
      fromFileCache = true
    }
  }

  let irUrl = persistedIrUrl
  const brauchtIrLookup = !cache || anfrage.force
  if (brauchtIrLookup && anfrage.isin?.trim()) {
    irUrl = await ladeInvestorRelationsUrl(
      anfrage.isin,
      kontext.firmenname ?? anfrage.firmenname ?? '',
      kontext.symbolYahoo ?? ticker,
    ).catch(() => persistedIrUrl)
  }

  if (!cache) {
    try {
      const roh = await entdeckeTranskripte(anfrage, irUrl)
      setDiscovery(ticker, roh, anfrage.force ? staleHit : undefined)
      cache = discoveryCache.get(ticker)!
      try {
        await speichereUnternehmenTranskripte(
          ticker,
          {
            isin: anfrage.isin,
            firmenname: anfrage.firmenname,
            investorRelationsUrl: irUrl,
          },
          roh,
        )
      } catch (persistErr) {
        console.warn('Earnings-Call: Server-Cache nicht schreibbar', persistErr)
      }
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
        hinweis: 'Quellen: IR · MarketBeat · Motley Fool · SEC',
        investorRelationsUrl: irUrl,
      }
    }
  }

  await ladePersistenteSummaries(ticker, cache)

  const ausCache = hadMemoryCache || fromFileCache
  const quartale = rohZuQuartale(cache.roh)
  const zielId = anfrage.quartalId?.trim() || null

  if (!zielId) {
    return bauePaket(ticker, cache, irUrl, null, ausCache, null)
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
        try {
          await speichereEarningsCallKiCache({
            ticker,
            quartalId: zielId,
            transcriptUrl: roh.url,
            zusammenfassung: summary,
          })
        } catch (persistErr) {
          console.warn('Earnings-Call KI-Cache nicht schreibbar', persistErr)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'KI-Zusammenfassung fehlgeschlagen'
        return {
          ...bauePaket(ticker, cache, irUrl, zielId, ausCache, null),
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
      : quelle === 'marketbeat'
        ? 'Transkripte von MarketBeat (Quartr, Conference Call inkl. Q&A).'
        : quelle === 'motley_fool'
          ? 'Transkripte von The Motley Fool (Conference Call inkl. Q&A).'
          : quelle === 'sec_edgar'
          ? 'Offizielle SEC-8-K-Transkripte (US).'
          : quelle === 'finnhub'
            ? 'Transkripte von Finnhub (Earnings-Call-API).'
            : quelle === 'investing_com'
              ? 'Transkripte von Investing.com (Earnings Call inkl. Q&A).'
              : null

  return bauePaket(ticker, cache, irUrl, zielId, ausCache && !anfrage.force, hinweis)
}

/** Für UI-Gruppierung */
export { gruppiereNachJahr }
