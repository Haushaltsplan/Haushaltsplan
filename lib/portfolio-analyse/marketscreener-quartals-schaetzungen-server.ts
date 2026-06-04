import { zeileMitIst } from '@/lib/portfolio-analyse/finnhub-earnings-ist-server'
import {
  bauePrognoseZeile,
  type EarningsQuartalsPrognose,
  type QuartalsPrognoseMetrik,
  type QuartalsPrognoseZeile,
  QUARTALS_METRIK_REIHENFOLGE,
} from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import {
  terminIstVergangen,
  waehleMsQuartalFuerTermin,
} from '@/lib/portfolio-analyse/earnings-quartal-termin'
import { marketscreenerSlugKandidaten } from '@/lib/portfolio-analyse/marketscreener-slug'

const BASE = 'https://www.marketscreener.com/quote/stock'
const CACHE_MS = 6 * 60 * 60 * 1000
const MIN_ABSTAND_MS = 140

let letzterAbruf = 0
const pageCache = new Map<string, { at: number; html: string | null }>()

type QHeader = { label: string; index: number }

type ZeilenMap = Partial<
  Record<QuartalsPrognoseMetrik | 'capex', { schaetzung: number; vorjahr: number | null }>
>

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function zellenLabel(tdHtml: string): string {
  return tdHtml
    .replace(/<sup[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseMioZahl(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '')
  if (!t || t === '-' || t === '—') return null
  const n = Number(t.replace(/,/g, ''))
  return Number.isFinite(n) ? n * 1_000_000 : null
}

function istSchaetzungsZelle(classAttr: string, cellHtml: string): boolean {
  return (
    /estimate|txt-italic|txt-muted/i.test(classAttr) ||
    /class="[^"]*estimate/i.test(cellHtml)
  )
}

function parseQuartalsTabelle(
  html: string,
  terminIso?: string | null,
): {
  naechstesQuartal: string | null
  vorjahrQuartal: string | null
  waehrung: string
  zeilen: ZeilenMap
} | null {
  const idx = html.indexOf('income-statement-quarterly')
  if (idx < 0) return null

  const block = html.slice(idx, idx + 400_000)
  const tableMatch = [...block.matchAll(/<table[\s\S]*?<\/table>/gi)].find((t) =>
    /\d{4} Q\d/.test(t[0]),
  )
  if (!tableMatch) return null

  const table = tableMatch[0]
  const qHeaders: QHeader[] = []
  for (const m of table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)) {
    const label = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (/\d{4} Q\d/.test(label)) qHeaders.push({ label, index: qHeaders.length })
  }
  if (qHeaders.length === 0) return null

  const vorjahrLabel = (q: string): string | null => {
    const m = /^(\d{4}) Q(\d)$/.exec(q)
    if (!m) return null
    let y = Number(m[1])
    let n = Number(m[2])
    n -= 1
    if (n < 1) {
      n = 4
      y -= 1
    }
    return `${y} Q${n}`
  }

  const headerLabels = qHeaders.map((h) => h.label)
  const termin = terminIso?.slice(0, 10)
  let naechstesQuartal: string | null =
    termin && terminIstVergangen(termin) ? waehleMsQuartalFuerTermin(headerLabels, termin) : null
  let vorjahrQuartal: string | null = naechstesQuartal ? vorjahrLabel(naechstesQuartal) : null

  const zeilen: ZeilenMap = {}

  const metrikFuerLabel = (label: string): (QuartalsPrognoseMetrik | 'capex') | null => {
    const l = label.trim()
    if (/^Net sales/i.test(l)) return 'umsatz'
    if (/^EBITDA/i.test(l)) return 'ebitda'
    if (/^EBIT$/i.test(l)) return 'ebit'
    if (/^Net income/i.test(l)) return null
    if (/^CAPEX$/i.test(l)) return 'capex'
    return null
  }

  for (const tr of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = tr[1]
    if (!row.startsWith('<td')) continue

    const tds = [...row.matchAll(/<td[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/td>/gi)]
    if (tds.length < 2) continue

    const rowLabel = zellenLabel(tds[0][2])
    const metrik = metrikFuerLabel(rowLabel)
    if (!metrik) continue

    if (!naechstesQuartal) {
      for (let i = 0; i < qHeaders.length; i++) {
        const td = tds[i + 1]
        if (!td) continue
        if (istSchaetzungsZelle(td[1], td[2])) {
          naechstesQuartal = qHeaders[i].label
          vorjahrQuartal = vorjahrLabel(naechstesQuartal)
          break
        }
      }
    }

    if (!naechstesQuartal) continue

    const estIdx = qHeaders.findIndex((h) => h.label === naechstesQuartal)
    const prevLabel = vorjahrQuartal
    const prevIdx = prevLabel ? qHeaders.findIndex((h) => h.label === prevLabel) : -1

    const estTd = tds[estIdx + 1]
    const schaetzung = estTd ? parseMioZahl(estTd[2].replace(/<[^>]+>/g, '').trim()) : null
    const prevTd = prevIdx >= 0 ? tds[prevIdx + 1] : null
    const vorjahr = prevTd ? parseMioZahl(prevTd[2].replace(/<[^>]+>/g, '').trim()) : null

    if (schaetzung != null) {
      zeilen[metrik] = { schaetzung, vorjahr }
    }
  }

  if (!naechstesQuartal || Object.keys(zeilen).length === 0) return null

  return { naechstesQuartal, vorjahrQuartal, waehrung: 'USD', zeilen }
}

function zuPrognose(
  parsed: NonNullable<ReturnType<typeof parseQuartalsTabelle>>,
  terminDatumIso: string | null,
): EarningsQuartalsPrognose | null {
  const { naechstesQuartal, vorjahrQuartal, waehrung, zeilen } = parsed
  const m = /^(\d{4}) Q(\d)$/.exec(naechstesQuartal ?? '')
  const quartalLabel = m ? `Q${m[2]} ${m[1]}` : (naechstesQuartal ?? 'Quartal')
  const vorjahrQuartalLabel = vorjahrQuartal
    ? (() => {
        const vm = /^(\d{4}) Q(\d)$/.exec(vorjahrQuartal)
        return vm ? `Q${vm[2]} ${vm[1]}` : vorjahrQuartal
      })()
    : 'Vorjahr'

  const labelMap: Record<QuartalsPrognoseMetrik | 'capex', string> = {
    umsatz: 'Revenue',
    ebitda: 'EBITDA',
    ebit: 'EBIT',
    eps: 'EPS',
    capex: 'Capex',
  }

  const outZeilen: QuartalsPrognoseZeile[] = []
  const reihenfolge: (QuartalsPrognoseMetrik | 'capex')[] = [...QUARTALS_METRIK_REIHENFOLGE, 'capex']

  for (const metrik of reihenfolge) {
    const z = zeilen[metrik]
    if (!z) continue
    const row = bauePrognoseZeile(metrik, labelMap[metrik], waehrung, z.schaetzung, z.vorjahr)
    if (row) outZeilen.push(row)
  }

  if (outZeilen.length === 0) return null

  return {
    quartalLabel,
    vorjahrQuartalLabel,
    periodEndIso: null,
    terminDatumIso,
    berichtszeit: null,
    berichtszeitLabel: null,
    zeilen: outZeilen,
  }
}

async function fetchFinancesHtml(slug: string): Promise<string | null> {
  const cached = pageCache.get(slug)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.html

  const now = Date.now()
  const warten = Math.max(0, MIN_ABSTAND_MS - (now - letzterAbruf))
  if (warten > 0) await pause(warten)
  letzterAbruf = Date.now()

  const urls = [
    `${BASE}/${slug}/finances/`,
    `${BASE}/${slug.replace(/-CORP-/, '-CORPORATION-')}/finances/`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) continue
      const html = await res.text()
      if (html.length > 100_000 && html.includes('income-statement')) {
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

function quartalLabelZuMsHeader(quartalLabel: string): string | null {
  const m = /^Q(\d)\s+(\d{4})$/i.exec(quartalLabel.trim())
  if (!m) return null
  return `${m[2]} Q${m[1]}`
}

function parseIstAusTabelle(
  html: string,
  quartalLabel: string,
): Partial<Record<QuartalsPrognoseMetrik, number>> | null {
  const msHeader = quartalLabelZuMsHeader(quartalLabel)
  if (!msHeader) return null

  const idx = html.indexOf('income-statement-quarterly')
  if (idx < 0) return null
  const block = html.slice(idx, idx + 400_000)
  const tableMatch = [...block.matchAll(/<table[\s\S]*?<\/table>/gi)].find((t) =>
    /\d{4} Q\d/.test(t[0]),
  )
  if (!tableMatch) return null
  const table = tableMatch[0]

  const qHeaders: string[] = []
  for (const m of table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)) {
    const label = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (/\d{4} Q\d/.test(label)) qHeaders.push(label)
  }
  const colIdx = qHeaders.indexOf(msHeader)
  if (colIdx < 0) return null

  const metrikFuerLabel = (label: string): QuartalsPrognoseMetrik | null => {
    const l = label.trim()
    if (/^Net sales/i.test(l)) return 'umsatz'
    if (/^EBITDA/i.test(l)) return 'ebitda'
    if (/^EBIT$/i.test(l)) return 'ebit'
    if (/^CAPEX$/i.test(l)) return 'capex'
    return null
  }

  const out: Partial<Record<QuartalsPrognoseMetrik, number>> = {}

  for (const tr of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = tr[1]
    if (!row.startsWith('<td')) continue
    const tds = [...row.matchAll(/<td[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/td>/gi)]
    const rowLabel = zellenLabel(tds[0]?.[2] ?? '')
    const metrik = metrikFuerLabel(rowLabel)
    if (!metrik) continue
    const td = tds[colIdx + 1]
    if (!td) continue
    if (istSchaetzungsZelle(td[1], td[2])) continue
    const val = parseMioZahl(td[2].replace(/<[^>]+>/g, '').trim())
    if (val != null) out[metrik] = val
  }

  return Object.keys(out).length > 0 ? out : null
}

export function prognoseMitMarketscreenerIst(
  prognose: EarningsQuartalsPrognose,
  html: string,
  zusaetzlicheQuartalLabels: string[] = [],
): EarningsQuartalsPrognose {
  const labels = [...new Set([prognose.quartalLabel, ...zusaetzlicheQuartalLabels].filter(Boolean))]
  let ist: Partial<Record<QuartalsPrognoseMetrik, number>> | null = null
  for (const label of labels) {
    ist = parseIstAusTabelle(html, label)
    if (ist) break
  }
  if (!ist) return prognose
  return {
    ...prognose,
    zeilen: prognose.zeilen.map((z) => {
      const v = ist[z.metrik]
      return v != null ? zeileMitIst(z, v) : z
    }),
  }
}

/** Konsens-Schätzungen aus Marketscreener (Quartalstabelle mit italic/estimate-Spalten). */
export async function ladeMarketscreenerQuartalsPrognose(
  isin: string,
  name: string,
  symbolYahoo?: string | null,
  terminDatumIso?: string,
): Promise<{ prognose: EarningsQuartalsPrognose; html: string } | null> {
  const termin = terminDatumIso?.slice(0, 10) ?? null

  for (const slug of marketscreenerSlugKandidaten(isin, name, symbolYahoo)) {
    const html = await fetchFinancesHtml(slug)
    if (!html) continue
    const parsed = parseQuartalsTabelle(html, termin)
    if (!parsed) continue
    const prognose = zuPrognose(parsed, termin)
    if (prognose) return { prognose, html }
  }
  return null
}
