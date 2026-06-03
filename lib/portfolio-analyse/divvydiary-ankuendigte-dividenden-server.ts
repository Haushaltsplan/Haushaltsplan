import { heuteIsoUtc, isoInJahren } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'

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
    .replace(/\p{M}/gu, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function urlKandidaten(isin: string, name: string): string[] {
  const s = slugAusName(name)
  const out: string[] = []
  const add = (path: string) => {
    if (!out.includes(path)) out.push(path)
  }
  if (s) {
    add(`${s}-aktie-${isin}`)
    add(`${s}-software-aktie-${isin}`)
    add(`${s}-${isin}`)
  }
  add(`aktie-${isin}`)
  return out
}

function parseZeilen(html: string): DivvydiaryZeile[] {
  const re =
    /\\"exDate\\":\\"(\d{4}-\d{2}-\d{2})\\",\\"payDate\\":\\"(\d{4}-\d{2}-\d{2})\\",\\"amount\\":([\d.]+),\\"currency\\":\\"([^"]+)\\",\\"forecast\\":(true|false)/g
  const rows: DivvydiaryZeile[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const amount = Number(m[3])
    if (!Number.isFinite(amount) || amount <= 0) continue
    rows.push({
      exDate: m[1],
      payDate: m[2],
      amount,
      forecast: m[5] === 'true',
    })
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
 * DivvyDiary (öffentliche Aktien-Seiten): Ex- und Zahltag je ISIN.
 * Kein API-Key; Daten aus eingebettetem JSON der Wertpapier-Seite.
 */
export async function ladeDivvydiaryAnkuendigteDividende(
  isin: string,
  name: string,
): Promise<DivvydiaryAnkuendigteDividende | null> {
  const isinNorm = isin.trim().toUpperCase()
  if (!isinNorm || isinNorm.length < 10) return null

  const heute = heuteIsoUtc()
  const bis = isoInJahren(HORIZONT_JAHRE)

  for (const path of urlKandidaten(isinNorm, name)) {
    try {
      const res = await fetch(`https://divvydiary.com/de/${path}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; mein-haushalt/1.0; portfolio dividend calendar)',
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
