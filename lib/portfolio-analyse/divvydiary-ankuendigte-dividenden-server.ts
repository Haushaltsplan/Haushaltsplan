import {
  heuteIsoUtc,
  isoInJahren,
  tageZwischenIso,
} from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

const CACHE_MS = 6 * 60 * 60 * 1000
const HORIZONT_JAHRE = 1

export type DivvydiaryAnkuendigteDividende = {
  zahlungsdatumIso: string
  exDatumIso: string | null
  dividendeProStueckEur: number
}

type DivvydiaryZeile = {
  exDate: string
  payDate: string
  amount: number
  forecast: boolean
}

const fetchCache = new Map<string, { at: number; hit: DivvydiaryAnkuendigteDividende | null }>()

function slugAusName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function urlKandidaten(isin: string, name: string): string[] {
  const isinNorm = isin.trim().toUpperCase()
  const k = isinKenntnis(isinNorm)
  const out: string[] = []
  const add = (path: string) => {
    if (!out.includes(path)) out.push(path)
  }

  if (k?.divvydiarySlug) {
    add(`${k.divvydiarySlug}-${isinNorm}`)
    add(`${k.divvydiarySlug}`)
  }

  const s = slugAusName(k?.name ?? name)
  if (s) {
    add(`${s}-aktie-${isinNorm}`)
    add(`${s}-software-aktie-${isinNorm}`)
    add(`${s}-group-aktie-${isinNorm}`)
    add(`${s}-${isinNorm}`)
  }
  add(`aktie-${isinNorm}`)
  return out
}

function parseZeilen(html: string): DivvydiaryZeile[] {
  const patterns = [
    /\\"exDate\\":\\"(\d{4}-\d{2}-\d{2})\\",\\"payDate\\":\\"(\d{4}-\d{2}-\d{2})\\",\\"amount\\":([\d.]+),\\"currency\\":\\"([^"]+)\\",\\"forecast\\":(true|false)/g,
    /"exDate":"(\d{4}-\d{2}-\d{2})","payDate":"(\d{4}-\d{2}-\d{2})","amount":([\d.]+),"currency":"([^"]+)","forecast":(true|false)/g,
  ]
  const seen = new Set<string>()
  const rows: DivvydiaryZeile[] = []

  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      const key = `${m[1]}|${m[2]}|${m[3]}`
      if (seen.has(key)) continue
      seen.add(key)
      const amount = Number(m[3])
      if (!Number.isFinite(amount) || amount <= 0) continue
      rows.push({
        exDate: m[1],
        payDate: m[2],
        amount,
        forecast: m[5] === 'true',
      })
    }
  }
  return rows
}

function naechsteImHorizont(rows: DivvydiaryZeile[], heute: string, bis: string): DivvydiaryZeile | null {
  const zukunft = rows
    .filter((r) => r.payDate >= heute && r.payDate <= bis)
    .sort((a, b) => a.payDate.localeCompare(b.payDate))

  const bestaetigt = zukunft.find((r) => !r.forecast)
  if (bestaetigt) return bestaetigt
  return zukunft[0] ?? null
}

/**
 * US-Quartalsaktien: Termin noch nicht in DivvyDiary, aber historisch gleicher Monat
 * (z. B. UNH Juni nach März-Zahlung).
 */
function erwarteteUsQuartalszahlung(
  rows: DivvydiaryZeile[],
  heute: string,
  bis: string,
): DivvydiaryZeile | null {
  const direkt = naechsteImHorizont(rows, heute, bis)
  if (direkt) return direkt

  const monat = Number(heute.slice(5, 7))
  const jahr = heute.slice(0, 4)
  const refRows = rows.filter(
    (r) => Number(r.payDate.slice(5, 7)) === monat && r.payDate < heute,
  )
  if (refRows.length === 0) return null

  const letzte = rows
    .filter((r) => r.payDate < heute)
    .sort((a, b) => b.payDate.localeCompare(a.payDate))[0]
  if (!letzte || tageZwischenIso(letzte.payDate, heute) < 55) return null

  const ref = refRows.sort((a, b) => b.payDate.localeCompare(a.payDate))[0]
  const payProj = `${jahr}-${ref.payDate.slice(5)}`
  const exProj = `${jahr}-${ref.exDate.slice(5)}`
  if (payProj < heute || payProj > bis) return null

  const jahrAmount =
    rows.find((r) => r.exDate.startsWith(jahr) && !r.forecast)?.amount ?? ref.amount

  return {
    exDate: exProj,
    payDate: payProj,
    amount: jahrAmount,
    forecast: true,
  }
}

function waehleZeile(
  rows: DivvydiaryZeile[],
  isinNorm: string,
  heute: string,
  bis: string,
): DivvydiaryZeile | null {
  if (isinNorm.startsWith('US')) {
    return erwarteteUsQuartalszahlung(rows, heute, bis)
  }
  return naechsteImHorizont(rows, heute, bis)
}

async function ladeHtml(path: string): Promise<string | null> {
  const res = await fetch(`https://divvydiary.com/de/${path}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.text()
}

/**
 * DivvyDiary: Ex- und Zahltag je ISIN (eingebettetes JSON auf der Aktien-Seite).
 */
export async function ladeDivvydiaryAnkuendigteDividende(
  isin: string,
  name: string,
): Promise<DivvydiaryAnkuendigteDividende | null> {
  const isinNorm = isin.trim().toUpperCase()
  if (!isinNorm || isinNorm.length < 10) return null

  const cached = fetchCache.get(isinNorm)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.hit

  const heute = heuteIsoUtc()
  const bis = isoInJahren(HORIZONT_JAHRE)
  const anzeigeName = isinKenntnis(isinNorm)?.name ?? name

  let result: DivvydiaryAnkuendigteDividende | null = null

  for (const path of urlKandidaten(isinNorm, anzeigeName)) {
    try {
      const html = await ladeHtml(path)
      if (!html) continue

      const rows = parseZeilen(html)
      if (rows.length === 0) continue
      if (!html.includes(isinNorm) && rows.length < 3) continue

      const hit = waehleZeile(rows, isinNorm, heute, bis)
      if (!hit) continue

      result = {
        zahlungsdatumIso: hit.payDate,
        exDatumIso: hit.exDate <= bis ? hit.exDate : null,
        dividendeProStueckEur: Math.round(hit.amount * 10000) / 10000,
      }
      break
    } catch {
      continue
    }
  }

  if (result) {
    fetchCache.set(isinNorm, { at: Date.now(), hit: result })
  }
  return result
}
