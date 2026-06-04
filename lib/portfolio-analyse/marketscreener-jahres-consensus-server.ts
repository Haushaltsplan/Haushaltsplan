import { formatEpsUsd, formatKompaktUsd } from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import type { JahresEarningsSchaetzung } from '@/lib/portfolio-analyse/jahres-earnings-schaetzung'
import { marketscreenerSlugKandidaten } from '@/lib/portfolio-analyse/marketscreener-slug'
import { wachstumProzent, formatWachstumProzent } from '@/lib/portfolio-analyse/earnings-kennzahlen'

const BASE = 'https://www.marketscreener.com/quote/stock'
const CACHE_MS = 6 * 60 * 60 * 1000
const MIN_ABSTAND_MS = 320

let letzterAbruf = 0
const pageCache = new Map<string, { at: number; html: string | null }>()

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function parseJahresKonsens(html: string): {
  jahrSchaetzung: number
  jahrBasis: number
  umsatzEst: number
  umsatzBasis: number | null
} | null {
  const start = html.indexOf('Income Statement and Estimates')
  if (start < 0) return null
  const block = html.slice(start, start + 120_000)

  const headers: { jahr: number; schaetzung: boolean }[] = []
  for (const m of block.matchAll(/>(\d{4})\s*(\*)?<\/th>/g)) {
    const jahr = Number(m[1])
    if (!Number.isFinite(jahr)) continue
    headers.push({ jahr, schaetzung: m[2] === '*' })
  }

  const estIdx = headers.findIndex((h) => h.schaetzung)
  if (estIdx < 0) return null
  const basisIdx = estIdx > 0 ? estIdx - 1 : -1
  const jahrSchaetzung = headers[estIdx].jahr
  const jahrBasis = basisIdx >= 0 ? headers[basisIdx].jahr : null

  const ns = block.indexOf('Net sales</td>')
  if (ns < 0) return null
  const row = block.slice(ns, ns + 12_000)
  const vals: number[] = []
  for (const m of row.matchAll(
    /<span class="efd_USD[^"]*"[^>]*>[\s\S]*?<span title="([^"]+)">/g,
  )) {
    const n = Number(m[1].replace(/,/g, ''))
    if (Number.isFinite(n)) vals.push(n)
  }
  if (vals.length <= estIdx) return null

  const umsatzEst = vals[estIdx]
  const umsatzBasis = basisIdx >= 0 && vals.length > basisIdx ? vals[basisIdx] : null
  if (umsatzEst < 1e8) return null

  return {
    jahrSchaetzung,
    jahrBasis: jahrBasis ?? jahrSchaetzung - 1,
    umsatzEst,
    umsatzBasis,
  }
}

async function fetchConsensusHtml(slug: string): Promise<string | null> {
  const cached = pageCache.get(slug)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.html

  const now = Date.now()
  const warten = Math.max(0, MIN_ABSTAND_MS - (now - letzterAbruf))
  if (warten > 0) await pause(warten)
  letzterAbruf = Date.now()

  const urls = [
    `${BASE}/${slug}/finances-consensus/`,
    `${BASE}/${slug.replace(/-CORP-/, '-CORPORATION-')}/finances-consensus/`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) continue
      const html = await res.text()
      if (html.length > 80_000 && html.includes('Net sales')) {
        pageCache.set(slug, { at: Date.now(), html })
        return html
      }
    } catch {
      continue
    }
  }
  pageCache.set(slug, { at: Date.now(), html: null })
  return null
}

/** Jahres-Umsatz-Konsens von Marketscreener (nur wenn sauber parsebar). */
export async function ladeMarketscreenerJahresUmsatz(
  isin: string,
  name: string,
  symbolYahoo?: string | null,
): Promise<Pick<JahresEarningsSchaetzung, 'jahrLabel' | 'vorjahrLabel' | 'waehrung' | 'umsatz'> | null> {
  for (const slug of marketscreenerSlugKandidaten(isin, name, symbolYahoo)) {
    const html = await fetchConsensusHtml(slug)
    if (!html) continue
    const parsed = parseJahresKonsens(html)
    if (!parsed) continue

    const w = wachstumProzent(parsed.umsatzEst, parsed.umsatzBasis)
    return {
      jahrLabel: `Geschäftsjahr ${parsed.jahrSchaetzung}e`,
      vorjahrLabel: `Geschäftsjahr ${parsed.jahrBasis}`,
      waehrung: 'USD',
      umsatz: {
        schaetzung: parsed.umsatzEst,
        schaetzungAnzeige: formatKompaktUsd(parsed.umsatzEst),
        vorjahr: parsed.umsatzBasis,
        vorjahrAnzeige: parsed.umsatzBasis != null ? formatKompaktUsd(parsed.umsatzBasis) : null,
        wachstumAnzeige: formatWachstumProzent(w),
      },
    }
  }
  return null
}

/** EPS aus Wallstreet-Jahrestabelle (nur EPS, kein Umsatz). */
export function jahresEpsAusWallstreet(
  ws: { jahr?: number | null; kennzahlen: { schluessel: string; spanne: { average: number | null; averageAnzeige: string | null }; vorjahrWert: number | null; vorjahrAnzeige: string | null; wachstumAnzeige: string | null }[] } | null,
  waehrung: string,
): JahresEarningsSchaetzung['eps'] | null {
  if (!ws) return null
  const epsK = ws.kennzahlen.find((k) => k.schluessel === 'eps')
  if (!epsK?.spanne.average) return null
  return {
    schaetzung: epsK.spanne.average,
    schaetzungAnzeige: epsK.spanne.averageAnzeige ?? formatEpsUsd(epsK.spanne.average),
    vorjahr: epsK.vorjahrWert,
    vorjahrAnzeige: epsK.vorjahrAnzeige,
    wachstumAnzeige: epsK.wachstumAnzeige,
  }
}

export async function ladeJahresSchaetzungKombiniert(
  isin: string,
  name: string,
  symbolYahoo: string | null,
  wallstreet: Parameters<typeof jahresEpsAusWallstreet>[0],
): Promise<JahresEarningsSchaetzung | null> {
  const [msUmsatz] = await Promise.all([
    ladeMarketscreenerJahresUmsatz(isin, name, symbolYahoo),
  ])
  const eps = jahresEpsAusWallstreet(wallstreet, msUmsatz?.waehrung ?? 'EUR')
  const hatUmsatz = msUmsatz?.umsatz.schaetzung != null && msUmsatz.umsatz.schaetzung >= 1e8
  const hatEps = eps?.schaetzung != null
  if (!hatUmsatz && !hatEps) return null

  return {
    jahrLabel:
      msUmsatz?.jahrLabel ??
      (wallstreet?.jahr ? `Geschäftsjahr ${wallstreet.jahr}e` : 'Geschäftsjahr'),
    vorjahrLabel: msUmsatz?.vorjahrLabel ?? null,
    waehrung: msUmsatz?.waehrung ?? 'EUR',
    umsatz: hatUmsatz
      ? msUmsatz!.umsatz
      : {
          schaetzung: null,
          schaetzungAnzeige: null,
          vorjahr: null,
          vorjahrAnzeige: null,
          wachstumAnzeige: null,
        },
    eps: eps ?? {
      schaetzung: null,
      schaetzungAnzeige: null,
      vorjahr: null,
      vorjahrAnzeige: null,
      wachstumAnzeige: null,
    },
  }
}
