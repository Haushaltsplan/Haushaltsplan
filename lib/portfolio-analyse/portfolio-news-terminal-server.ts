import 'server-only'

import { teileArray } from '@/lib/portfolio-analyse/batch-hilfen'
import { ladeFundamentalNews } from '@/lib/portfolio-analyse/fundamentaldaten-news-server'
import { isinAusYahooSymbol, isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

export type NewsTerminalKategorie =
  | 'earnings'
  | 'dividende'
  | 'insider'
  | 'ma'
  | 'guidance'
  | 'produkt'
  | 'sonstiges'

export type NewsTerminalUnternehmen = {
  id: string
  name: string
  symbol: string | null
  isin: string | null
}

export type NewsTerminalDepotPosition = {
  isin?: string | null
  name: string
  symbolYahoo?: string | null
}

export type NewsTerminalZeile = {
  id: string
  titel: string
  href: string
  quelle: string
  veroeffentlichtAm: string | null
  unternehmen: NewsTerminalUnternehmen[]
  kategorie: NewsTerminalKategorie
  istHeute: boolean
}

export type NewsTerminalPaket = {
  zeilen: NewsTerminalZeile[]
  unternehmen: NewsTerminalUnternehmen[]
  fehler: string | null
  aktualisiertAm: string
}

const PARALLEL = 6
const ZEITFENSTER_48H_MS = 48 * 60 * 60 * 1000

/** Titel-Fingerprint — erkennt dieselbe Story über Yahoo/Google/unterschiedliche URLs hinweg. */
function normalisiereNewsTitel(titel: string): string {
  return titel
    .replace(/\s*[-–—|]\s*[^-–—|]{2,48}$/u, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`´]/g, '')
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function linkFingerabdruck(href: string): string | null {
  try {
    const u = new URL(href)
    if (u.hostname.includes('news.google.com')) return null
    u.search = ''
    u.hash = ''
    return `${u.hostname}${u.pathname}`.toLowerCase()
  } catch {
    return null
  }
}

function bevorzugterLink(a: string, b: string): string {
  const aGoogle = a.includes('news.google.com')
  const bGoogle = b.includes('news.google.com')
  if (aGoogle && !bGoogle) return b
  if (bGoogle && !aGoogle) return a
  return a
}

function bevorzugteQuelle(a: string, b: string): string {
  const quellen = [...new Set([a, b].filter(Boolean))]
  if (quellen.length <= 1) return quellen[0] ?? ''
  const ohneGoogle = quellen.filter((q) => q !== 'Google News')
  if (ohneGoogle.length === 1) return ohneGoogle[0]!
  if (ohneGoogle.length > 1) return ohneGoogle.slice(0, 2).join(' · ')
  return quellen[0]!
}

function mergeUnternehmen(
  a: NewsTerminalUnternehmen[],
  b: NewsTerminalUnternehmen[],
): NewsTerminalUnternehmen[] {
  const seen = new Set<string>()
  const out: NewsTerminalUnternehmen[] = []
  for (const u of [...a, ...b]) {
    if (seen.has(u.id)) continue
    seen.add(u.id)
    out.push(u)
  }
  return out
}

function mergeZeilen(a: NewsTerminalZeile, b: NewsTerminalZeile): NewsTerminalZeile {
  const ta = a.veroeffentlichtAm ? Date.parse(a.veroeffentlichtAm) : 0
  const tb = b.veroeffentlichtAm ? Date.parse(b.veroeffentlichtAm) : 0
  const neuer = tb > ta ? b : a
  const aelter = tb > ta ? a : b
  return {
    id: neuer.id,
    titel: neuer.titel.length >= aelter.titel.length ? neuer.titel : aelter.titel,
    href: bevorzugterLink(a.href, b.href),
    quelle: bevorzugteQuelle(a.quelle, b.quelle),
    veroeffentlichtAm: neuer.veroeffentlichtAm ?? aelter.veroeffentlichtAm,
    unternehmen: mergeUnternehmen(a.unternehmen, b.unternehmen),
    kategorie: a.kategorie !== 'sonstiges' ? a.kategorie : b.kategorie,
    istHeute: a.istHeute || b.istHeute,
  }
}

function dedupliziereZeilen(zeilen: NewsTerminalZeile[]): NewsTerminalZeile[] {
  const byTitel = new Map<string, NewsTerminalZeile>()

  for (const z of zeilen) {
    const titelFp = normalisiereNewsTitel(z.titel)
    const linkFp = linkFingerabdruck(z.href)

    if (titelFp && byTitel.has(titelFp)) {
      byTitel.set(titelFp, mergeZeilen(byTitel.get(titelFp)!, z))
      continue
    }

    if (linkFp) {
      let gefunden = false
      for (const [k, v] of byTitel) {
        if (linkFingerabdruck(v.href) === linkFp) {
          byTitel.set(k, mergeZeilen(v, z))
          gefunden = true
          break
        }
      }
      if (gefunden) continue
    }

    const key = titelFp || linkFp || z.href
    byTitel.set(key, z)
  }

  return [...byTitel.values()]
}

function unternehmenAusDepotPosition(p: NewsTerminalDepotPosition): NewsTerminalUnternehmen | null {
  const isin = p.isin?.trim().toUpperCase() || null
  const k = isin ? isinKenntnis(isin) : null
  const symbol =
    p.symbolYahoo?.trim().toUpperCase() ||
    k?.symbolYahoo?.trim().toUpperCase() ||
    k?.kursNurSymbol?.trim().toUpperCase() ||
    null
  const name = (k?.name ?? p.name).trim()
  if (!name) return null
  const id = isin ?? symbol ?? name.toUpperCase()
  if (!symbol && !isin) return null
  return { id, name, symbol, isin }
}

function ladeUnternehmenRefs(opts?: {
  depotPositionen?: NewsTerminalDepotPosition[]
  extraUnternehmen?: NewsTerminalUnternehmen[]
}): NewsTerminalUnternehmen[] {
  const seen = new Set<string>()
  const out: NewsTerminalUnternehmen[] = []

  for (const p of opts?.depotPositionen ?? []) {
    const u = unternehmenAusDepotPosition(p)
    if (!u || !u.symbol || seen.has(u.id)) continue
    seen.add(u.id)
    out.push(u)
  }

  for (const e of opts?.extraUnternehmen ?? []) {
    const symbol = e.symbol?.trim().toUpperCase() || null
    const isin = e.isin?.trim().toUpperCase() || (symbol ? isinAusYahooSymbol(symbol) : null)
    const k = isin ? isinKenntnis(isin) : null
    const name = (k?.name ?? e.name).trim()
    const id = isin ?? symbol ?? name.toUpperCase()
    if (!id || seen.has(id) || !symbol) continue
    seen.add(id)
    out.push({ id, name, symbol, isin })
  }

  return out
}

function istHeuteBerlin(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return false
  const fmt = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(d) === fmt.format(new Date())
}

function artikelImZeitfenster(iso: string | null, nurHeute: boolean): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return false
  if (nurHeute) return istHeuteBerlin(iso)
  return t >= Date.now() - ZEITFENSTER_48H_MS
}

function kategorieAusText(titel: string, roh: string): NewsTerminalKategorie {
  const s = `${titel} ${roh}`.toLowerCase()
  if (/\b(earnings|quartals(zahlen|bericht|ergebnis)|geschäftszahlen|eps|ebit|umsatz(ergebnis)?)\b/.test(s)) {
    return 'earnings'
  }
  if (/\b(dividend|dividende|ausschütt)\b/.test(s)) return 'dividende'
  if (/\b(insider|form\s*4)\b/.test(s)) return 'insider'
  if (/\b(übernahme|akquisition|acquisition|merger|fusion|takeover)\b/.test(s)) return 'ma'
  if (/\b(guidance|ausblick|prognose)\b/.test(s)) return 'guidance'
  if (/\b(fda|zulassung|launch|produkt)\b/.test(s)) return 'produkt'
  return 'sonstiges'
}

async function ladeNewsFuerUnternehmen(
  u: NewsTerminalUnternehmen,
  nurHeute: boolean,
): Promise<NewsTerminalZeile[]> {
  if (!u.symbol) return []
  const artikel = await ladeFundamentalNews(u.symbol, u.name)
  const zeilen: NewsTerminalZeile[] = []

  for (const a of artikel) {
    const veroeffentlichtAm = a.veroeffentlicht
    if (!artikelImZeitfenster(veroeffentlichtAm, nurHeute)) continue
    zeilen.push({
      id: a.link,
      titel: a.titel,
      href: a.link,
      quelle: a.quelle,
      veroeffentlichtAm,
      unternehmen: [u],
      kategorie: kategorieAusText(a.titel, a.zusammenfassung ?? ''),
      istHeute: istHeuteBerlin(veroeffentlichtAm),
    })
  }

  return zeilen
}

export async function ladePortfolioNewsTerminal(opts?: {
  nurHeute?: boolean
  depotPositionen?: NewsTerminalDepotPosition[]
  extraUnternehmen?: NewsTerminalUnternehmen[]
  limit?: number
}): Promise<NewsTerminalPaket> {
  const nurHeute = opts?.nurHeute ?? false
  const unternehmen = ladeUnternehmenRefs({
    depotPositionen: opts?.depotPositionen,
    extraUnternehmen: opts?.extraUnternehmen,
  })

  const mitSymbol = unternehmen.filter((u) => u.symbol)
  const fehler: string[] = []
  const rohZeilen: NewsTerminalZeile[] = []

  for (const batch of teileArray(mitSymbol, PARALLEL)) {
    const teile = await Promise.all(
      batch.map(async (u) => {
        try {
          return await ladeNewsFuerUnternehmen(u, nurHeute)
        } catch (e) {
          fehler.push(`${u.symbol}: ${e instanceof Error ? e.message : 'Fehler'}`)
          return []
        }
      }),
    )
    for (const block of teile) {
      rohZeilen.push(...block)
    }
  }

  const zeilen = dedupliziereZeilen(rohZeilen)

  zeilen.sort((a, b) => {
    const ta = a.veroeffentlichtAm ? Date.parse(a.veroeffentlichtAm) : 0
    const tb = b.veroeffentlichtAm ? Date.parse(b.veroeffentlichtAm) : 0
    return tb - ta
  })

  return {
    zeilen: zeilen.slice(0, opts?.limit ?? 48),
    unternehmen,
    fehler: fehler.length ? fehler.slice(0, 5).join(' · ') : null,
    aktualisiertAm: new Date().toISOString(),
  }
}
