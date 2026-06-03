import { heuteIsoUtc, isoInJahren } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

const CACHE_REVALIDATE = 86400
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
    add(k.divvydiarySlug)
  }

  const s = slugAusName(k?.name ?? name)
  if (s) {
    add(`${s}-aktie-${isinNorm}`)
    add(`${s}-software-aktie-${isinNorm}`)
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
 * DivvyDiary: Ex- und Zahltag je ISIN (eingebettetes JSON auf der Aktien-Seite).
 */
export async function ladeDivvydiaryAnkuendigteDividende(
  isin: string,
  name: string,
): Promise<DivvydiaryAnkuendigteDividende | null> {
  const isinNorm = isin.trim().toUpperCase()
  if (!isinNorm || isinNorm.length < 10) return null

  const heute = heuteIsoUtc()
  const bis = isoInJahren(HORIZONT_JAHRE)
  const anzeigeName = isinKenntnis(isinNorm)?.name ?? name

  for (const path of urlKandidaten(isinNorm, anzeigeName)) {
    try {
      const res = await fetch(`https://divvydiary.com/de/${path}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; mein-haushalt/1.0)',
          Accept: 'text/html',
        },
        next: { revalidate: CACHE_REVALIDATE },
      })
      if (!res.ok) continue
      const html = await res.text()
      if (!html.includes(isinNorm)) continue

      const hit = naechsteImHorizont(parseZeilen(html), heute, bis)
      if (!hit) continue

      return {
        zahlungsdatumIso: hit.payDate,
        exDatumIso: hit.exDate <= bis ? hit.exDate : null,
        dividendeProStueckEur: Math.round(hit.amount * 10000) / 10000,
      }
    } catch {
      continue
    }
  }

  return null
}
