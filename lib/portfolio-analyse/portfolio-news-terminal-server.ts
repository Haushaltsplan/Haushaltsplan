import 'server-only'

import {
  artikelIstAktuell,
  holePortfolioNewsRoh,
  istWichtigerPortfolioEintrag,
} from '@/lib/aktien-portfolio-news'
import { ladePortfolioKomplett } from '@/lib/investment-portfolio-store'
import { isinAusYahooSymbol } from '@/lib/portfolio-analyse/isin-kenntnisse'

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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function ladeUnternehmenRefs(extra?: NewsTerminalUnternehmen[]): Promise<NewsTerminalUnternehmen[]> {
  const { positionen } = await ladePortfolioKomplett()
  const seen = new Set<string>()
  const out: NewsTerminalUnternehmen[] = []

  for (const p of positionen) {
    const symbol = p.symbolYahoo?.trim().toUpperCase() || null
    const id = symbol ?? p.name.trim().toUpperCase()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      name: p.name.trim(),
      symbol,
      isin: symbol ? isinAusYahooSymbol(symbol) : null,
    })
  }

  for (const e of extra ?? []) {
    const id = e.isin?.trim().toUpperCase() || e.symbol?.trim().toUpperCase() || e.name.trim().toUpperCase()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(e)
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

function findeBetroffeneUnternehmen(
  titel: string,
  roh: string,
  unternehmen: NewsTerminalUnternehmen[],
): NewsTerminalUnternehmen[] {
  const kombi = `${titel} ${roh}`
  const treffer: NewsTerminalUnternehmen[] = []
  for (const u of unternehmen) {
    const name = u.name.trim()
    if (name.length >= 4 && kombi.toLowerCase().includes(name.toLowerCase())) {
      treffer.push(u)
      continue
    }
    if (u.symbol && u.symbol.length >= 2) {
      if (new RegExp(`\\b${escapeRegex(u.symbol)}\\b`, 'i').test(kombi)) {
        treffer.push(u)
      }
    }
  }
  return treffer
}

export async function ladePortfolioNewsTerminal(opts?: {
  nurHeute?: boolean
  extraUnternehmen?: NewsTerminalUnternehmen[]
  limit?: number
}): Promise<NewsTerminalPaket> {
  const unternehmen = await ladeUnternehmenRefs(opts?.extraUnternehmen)
  const { artikel, fehler } = await holePortfolioNewsRoh()
  const zeilen: NewsTerminalZeile[] = []
  const seen = new Set<string>()

  for (const a of artikel) {
    if (!artikelIstAktuell(a.veroeffentlichtAm)) continue
    if (!istWichtigerPortfolioEintrag(a.titel, a.sucheFuerLokal)) continue
    const istHeute = istHeuteBerlin(a.veroeffentlichtAm)
    if (opts?.nurHeute && !istHeute) continue

    const betroffen = findeBetroffeneUnternehmen(a.titel, a.sucheFuerLokal, unternehmen)
    if (betroffen.length === 0) continue

    if (seen.has(a.href)) continue
    seen.add(a.href)

    zeilen.push({
      id: a.href,
      titel: a.titel,
      href: a.href,
      quelle: a.quelle,
      veroeffentlichtAm: a.veroeffentlichtAm,
      unternehmen: betroffen,
      kategorie: kategorieAusText(a.titel, a.sucheFuerLokal),
      istHeute,
    })
  }

  zeilen.sort((a, b) => {
    const ta = a.veroeffentlichtAm ? Date.parse(a.veroeffentlichtAm) : 0
    const tb = b.veroeffentlichtAm ? Date.parse(b.veroeffentlichtAm) : 0
    return tb - ta
  })

  return {
    zeilen: zeilen.slice(0, opts?.limit ?? 48),
    unternehmen,
    fehler,
    aktualisiertAm: new Date().toISOString(),
  }
}
