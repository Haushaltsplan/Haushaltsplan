import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { EarningsSchaetzungen } from '@/lib/portfolio-analyse/earnings-schaetzungen'

const BASE = 'https://www.wallstreet-online.de/aktien'
const CACHE_MS = 6 * 60 * 60 * 1000
const MIN_ABSTAND_MS = 280

let letzterAbruf = 0

const pageCache = new Map<string, { at: number; html: string | null }>()

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

export function wallstreetSlugKandidaten(isin: string, name: string): string[] {
  const isinNorm = isin.trim().toUpperCase()
  const k = isinKenntnis(isinNorm)
  const out: string[] = []
  const add = (s: string) => {
    const t = s.trim().toLowerCase()
    if (t && !out.includes(t)) out.push(t)
  }

  if (k?.divvydiarySlug) add(k.divvydiarySlug)

  const s = slugAusName(k?.name ?? name)
  if (s) {
    add(`${s}-aktie`)
    add(s)
  }

  const sym = k?.symbolYahoo?.trim().toUpperCase()
  if (sym && !sym.includes('.')) add(`${sym.toLowerCase()}-aktie`)

  return out
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function parseDeZahl(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(/%/g, '')
  if (!t || t === '-' || t === '—') return null
  const cleaned = t.includes(',')
    ? t.replace(/\./g, '').replace(',', '.')
    : t.replace(/,/g, '')
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function zellenAusZeile(trHtml: string): string[] {
  return [...trHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
    m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function parseSchaetzungsTabelle(html: string): {
  eps: number | null
  umsatzJeAktie: number | null
  jahr: string | null
} | null {
  const tables = [...html.matchAll(/<table class="t-data[\s\S]*?<\/table>/gi)]
  for (const t of tables) {
    const block = t[0]
    if (!/2026e|2025e|2027e/i.test(block)) continue

    const headerRow = block.match(/<thead>[\s\S]*?<\/thead>/i)?.[0] ?? ''
    const headers = zellenAusZeile(headerRow.match(/<tr[^>]*>[\s\S]*?<\/tr>/i)?.[0] ?? '')
    const estIdx = headers.findIndex((h) => /202\d+e/i.test(h))
    if (estIdx < 0) continue

    const jahr = headers[estIdx]?.match(/20\d{2}/)?.[0] ?? null
    let eps: number | null = null
    let umsatzJeAktie: number | null = null

    for (const row of block.matchAll(/<tbody>[\s\S]*?<\/tbody>/gi)) {
      for (const tr of row[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const cells = zellenAusZeile(tr[1])
        if (cells.length <= estIdx) continue
        const label = cells[0]?.toLowerCase() ?? ''
        const val = parseDeZahl(cells[estIdx] ?? '')
        if (val == null) continue
        if (label.includes('gewinn je aktie') || label === 'eps') eps = val
        if (label.includes('umsatz je aktie')) umsatzJeAktie = val
      }
    }

    if (eps != null || umsatzJeAktie != null) return { eps, umsatzJeAktie, jahr }
  }
  return null
}

/** Umsatz gesamt (Mio.) aus Kennzahlen-Tabelle ohne „e“-Spalte — letzte Spalte oft aktuell. */
function parseUmsatzMio(html: string): number | null {
  const m = html.match(
    /<th[^>]*>\s*Umsatz\s*<\/th>[\s\S]*?<td[^>]*class="text-end"[^>]*>\s*<\/td>[\s\S]*?<td[^>]*class="text-end"[^>]*>([\d.,]+)/i,
  )
  if (!m) return null
  const n = parseDeZahl(m[1])
  return n != null ? n * 1_000_000 : null
}

async function fetchWallstreetSeite(slug: string): Promise<string | null> {
  const cached = pageCache.get(slug)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.html

  const now = Date.now()
  const warten = Math.max(0, MIN_ABSTAND_MS - (now - letzterAbruf))
  if (warten > 0) await pause(warten)
  letzterAbruf = Date.now()

  const url = `${BASE}/${slug}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'de-DE,de;q=0.9',
        Referer: 'https://www.wallstreet-online.de/',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(18_000),
    })
    if (!res.ok) {
      pageCache.set(slug, { at: Date.now(), html: null })
      return null
    }
    const html = await res.text()
    const ok = html.length > 50_000 && html.includes('wallstreet-online')
    pageCache.set(slug, { at: Date.now(), html: ok ? html : null })
    return ok ? html : null
  } catch {
    pageCache.set(slug, { at: Date.now(), html: null })
    return null
  }
}

function zuEarningsSchaetzungen(
  parsed: { eps: number | null; umsatzJeAktie: number | null; jahr: string | null },
  umsatzMio: number | null,
): EarningsSchaetzungen | null {
  if (parsed.eps == null && parsed.umsatzJeAktie == null && umsatzMio == null) return null

  const jahrLabel = parsed.jahr ? `${parsed.jahr}e` : 'Schätzung'
  return {
    quelle: 'wallstreet',
    terminDatumIso: null,
    isEarningsDateEstimate: true,
    earningsCallDateIso: null,
    jahr: parsed.jahr ? Number(parsed.jahr) : null,
    berichtszeit: `Wallstreet ${jahrLabel}`,
    eps: {
      low: null,
      high: null,
      average: parsed.eps,
      averageAnzeige:
        parsed.eps != null
          ? parsed.eps.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : null,
    },
    umsatz: {
      low: null,
      high: null,
      average: umsatzMio,
      averageAnzeige:
        umsatzMio != null
          ? `${(umsatzMio / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mrd.`
          : parsed.umsatzJeAktie != null
            ? `${parsed.umsatzJeAktie.toLocaleString('de-DE', { maximumFractionDigits: 2 })} €/Aktie`
            : null,
    },
  }
}

export async function ladeWallstreetEarningsSchaetzungen(
  isin: string,
  name: string,
): Promise<EarningsSchaetzungen | null> {
  const isinNorm = isin.trim().toUpperCase()
  if (isinNorm.length < 10) return null

  for (const slug of wallstreetSlugKandidaten(isinNorm, name)) {
    const html = await fetchWallstreetSeite(slug)
    if (!html) continue
    const parsed = parseSchaetzungsTabelle(html)
    if (!parsed) continue
    const hit = zuEarningsSchaetzungen(parsed, parseUmsatzMio(html))
    if (hit) return hit
  }
  return null
}
