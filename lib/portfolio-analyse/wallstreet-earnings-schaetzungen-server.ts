import {
  formatWachstumProzent,
  kennzahlAusSpanne,
  wachstumProzent,
} from '@/lib/portfolio-analyse/earnings-kennzahlen'
import type { EarningsKennzahlPrognose, EarningsKennzahlSchluessel } from '@/lib/portfolio-analyse/earnings-kennzahlen'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  bauePrognoseZeile,
  type EarningsQuartalsPrognose,
  type QuartalsPrognoseMetrik,
} from '@/lib/portfolio-analyse/earnings-quartals-prognose'
import type { EarningsSchaetzungen } from '@/lib/portfolio-analyse/earnings-schaetzungen'

const BASE = 'https://www.wallstreet-online.de/aktien'
const CACHE_MS = 6 * 60 * 60 * 1000
const MIN_ABSTAND_MS = 140

let letzterAbruf = 0

const pageCache = new Map<string, { at: number; html: string | null }>()

const ZEILEN_MAP: { match: RegExp; schluessel: EarningsKennzahlSchluessel; label: string }[] = [
  { match: /gewinn je aktie|^eps$/i, schluessel: 'eps', label: 'Gewinn je Aktie (EPS)' },
  { match: /umsatz je aktie/i, schluessel: 'umsatz_je_aktie', label: 'Umsatz je Aktie' },
  { match: /^kgv$|kursgewinn/i, schluessel: 'kgv', label: 'KGV' },
  { match: /dividende je aktie/i, schluessel: 'dividende', label: 'Dividende je Aktie' },
  { match: /dividendenrendite/i, schluessel: 'sonstiges', label: 'Dividendenrendite' },
  { match: /ebitda/i, schluessel: 'ebitda', label: 'EBITDA' },
  { match: /^ebit(?!da)/i, schluessel: 'ebit', label: 'EBIT' },
  { match: /free cash|fcf/i, schluessel: 'free_cashflow', label: 'Free Cashflow' },
]

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

type WallstreetJahresTabelle = {
  jahrSchaetzung: string | null
  jahrBasis: string | null
  kennzahlen: EarningsKennzahlPrognose[]
}

function schluesselFuerLabel(label: string): { schluessel: EarningsKennzahlSchluessel; label: string } | null {
  const l = label.trim().toLowerCase()
  for (const m of ZEILEN_MAP) {
    if (m.match.test(l)) return { schluessel: m.schluessel, label: m.label }
  }
  return null
}

function parseJahresPrognoseTabelle(html: string): WallstreetJahresTabelle | null {
  const tables = [...html.matchAll(/<table class="t-data[\s\S]*?<\/table>/gi)]
  for (const t of tables) {
    const block = t[0]
    if (!/202\d+e/i.test(block)) continue

    const headerRow = block.match(/<thead>[\s\S]*?<\/thead>/i)?.[0] ?? ''
    const headers = zellenAusZeile(headerRow.match(/<tr[^>]*>[\s\S]*?<\/tr>/i)?.[0] ?? '')
    const estIdx = headers.findIndex((h) => /202\d+e/i.test(h))
    if (estIdx < 0) continue

    const basisIdx = estIdx > 0 ? estIdx - 1 : -1

    const jahrSchaetzung = headers[estIdx]?.match(/20\d{2}/)?.[0] ?? null
    const jahrBasis = basisIdx >= 0 ? headers[basisIdx]?.match(/20\d{2}/)?.[0] ?? null : null

    const kennzahlen: EarningsKennzahlPrognose[] = []

    for (const tbody of block.matchAll(/<tbody>[\s\S]*?<\/tbody>/gi)) {
      for (const tr of tbody[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const cells = zellenAusZeile(tr[1])
        if (cells.length <= estIdx) continue
        const meta = schluesselFuerLabel(cells[0] ?? '')
        if (!meta) continue

        const konsens = parseDeZahl(cells[estIdx] ?? '')
        const vorjahr =
          basisIdx >= 0 && cells.length > basisIdx ? parseDeZahl(cells[basisIdx] ?? '') : null
        if (konsens == null && vorjahr == null) continue

        const w = wachstumProzent(konsens, vorjahr)
        const spanne = {
          low: null,
          high: null,
          average: konsens,
          averageAnzeige:
            konsens != null
              ? meta.schluessel === 'sonstiges' && (cells[estIdx] ?? '').includes('%')
                ? `${konsens.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`
                : konsens.toLocaleString('de-DE', {
                    minimumFractionDigits: meta.schluessel === 'eps' ? 2 : 0,
                    maximumFractionDigits: meta.schluessel === 'eps' ? 2 : 2,
                  })
              : null,
        }

        const k = kennzahlAusSpanne(meta.schluessel, meta.label, spanne, {
          vorjahrWert: vorjahr,
          vorjahrAnzeige:
            vorjahr != null
              ? meta.schluessel === 'sonstiges'
                ? `${vorjahr.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`
                : vorjahr.toLocaleString('de-DE', { maximumFractionDigits: 2 })
              : null,
          wachstumProzent: w,
          vergleichArt: 'vorjahr_geschaeftsjahr',
          vergleichLabel:
            jahrBasis && jahrSchaetzung
              ? `vs. Geschäftsjahr ${jahrBasis} (${jahrSchaetzung}e)`
              : 'vs. Vorjahr',
        })
        if (k && k.wachstumAnzeige == null) {
          k.wachstumAnzeige = formatWachstumProzent(w)
        }
        if (k) kennzahlen.push(k)
      }
    }

    if (kennzahlen.length > 0) {
      return { jahrSchaetzung, jahrBasis: jahrBasis ?? null, kennzahlen }
    }
  }
  return null
}

/** Umsatz gesamt (Mio.) aus Kennzahlen-Tabelle ohne „e“-Spalte. */
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
  tabelle: WallstreetJahresTabelle,
  umsatzMio: number | null,
): EarningsSchaetzungen | null {
  const epsK = tabelle.kennzahlen.find((k) => k.schluessel === 'eps')
  const umsatzJeAktieK = tabelle.kennzahlen.find((k) => k.schluessel === 'umsatz_je_aktie')

  if (!epsK && !umsatzJeAktieK && umsatzMio == null) return null

  const jahrLabel = tabelle.jahrSchaetzung ? `${tabelle.jahrSchaetzung}e` : 'Schätzung'

  const umsatzSpanne = {
    low: null,
    high: null,
    average: umsatzMio,
    averageAnzeige:
      umsatzMio != null
        ? `${(umsatzMio / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mrd.`
        : umsatzJeAktieK?.spanne.averageAnzeige ?? null,
  }

  return {
    quelle: 'wallstreet',
    terminDatumIso: null,
    isEarningsDateEstimate: true,
    earningsCallDateIso: null,
    jahr: tabelle.jahrSchaetzung ? Number(tabelle.jahrSchaetzung) : null,
    berichtszeit: `Wallstreet ${jahrLabel}`,
    eps: epsK?.spanne ?? { low: null, high: null, average: null, averageAnzeige: null },
    umsatz: umsatzSpanne,
    prognosePeriode: tabelle.jahrSchaetzung
      ? `Geschäftsjahr ${tabelle.jahrSchaetzung} (Schätzung)`
      : null,
    quartalsPrognose: null,
    kennzahlen: tabelle.kennzahlen,
    weitereKennzahlen: tabelle.kennzahlen.filter(
      (k) => k.schluessel !== 'eps' && k.schluessel !== 'umsatz' && k.schluessel !== 'umsatz_je_aktie',
    ),
  }
}

function metrikAusSchluessel(s: EarningsKennzahlSchluessel): QuartalsPrognoseMetrik | null {
  if (s === 'eps') return 'eps'
  if (s === 'umsatz' || s === 'umsatz_je_aktie') return 'umsatz'
  if (s === 'ebitda') return 'ebitda'
  if (s === 'ebit') return 'ebit'
  return null
}

/** Jahres-Konsens (Wallstreet) als Prognose-Tabelle für das Detail-Panel. */
export function wallstreetZuQuartalsPrognose(
  ws: EarningsSchaetzungen,
  terminDatumIso: string | null,
): EarningsQuartalsPrognose | null {
  const jahr = ws.jahr ?? ws.prognosePeriode?.match(/20\d{2}/)?.[0] ?? null
  const basisMatch = ws.kennzahlen
    .map((k) => k.vergleichLabel?.match(/20\d{2}/)?.[0])
    .find(Boolean)
  const quartalLabel = jahr ? `Geschäftsjahr ${jahr} (Schätzung)` : (ws.prognosePeriode ?? 'Geschäftsjahr (Schätzung)')
  const vorjahrQuartalLabel = basisMatch ? `Geschäftsjahr ${basisMatch}` : 'Vorjahr'
  const waehrung = 'EUR'

  const zeilen = []
  if (ws.umsatz.average != null) {
    const u = ws.kennzahlen.find((k) => k.schluessel === 'umsatz')
    const row = bauePrognoseZeile(
      'umsatz',
      'Umsatz',
      waehrung,
      ws.umsatz.average,
      u?.vorjahrWert ?? null,
      u?.wachstumProzent ?? null,
    )
    if (row) zeilen.push(row)
  }

  for (const k of ws.kennzahlen) {
    const metrik = metrikAusSchluessel(k.schluessel)
    if (!metrik || metrik === 'umsatz') continue
    const row = bauePrognoseZeile(
      metrik,
      k.label,
      waehrung,
      k.spanne.average,
      k.vorjahrWert,
      k.wachstumProzent,
    )
    if (row) zeilen.push(row)
  }

  if (zeilen.length === 0) return null

  return {
    quartalLabel,
    vorjahrQuartalLabel,
    periodEndIso: null,
    terminDatumIso,
    berichtszeit: null,
    berichtszeitLabel: null,
    zeilen,
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
    const tabelle = parseJahresPrognoseTabelle(html)
    if (!tabelle) continue
    const hit = zuEarningsSchaetzungen(tabelle, parseUmsatzMio(html))
    if (hit) return hit
  }
  return null
}
