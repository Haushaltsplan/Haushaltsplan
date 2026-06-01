import type { PortfolioBuchung, PortfolioDbSnapshot, PortfolioPositionSnapshot } from '@/lib/portfolio-analyse/types'

/** Offene Stücke + Einstand je ISIN aus Buchungshistorie. */
export function bestandAusBuchungen(buchungen: PortfolioBuchung[]): PortfolioPositionSnapshot[] {
  const sortiert = [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))
  const map = new Map<
    string,
    { stueck: number; kosten: number; name: string; assetKlasse: PortfolioPositionSnapshot['assetKlasse'] }
  >()

  for (const b of sortiert) {
    if (!b.isin) continue
    const isin = b.isin.toUpperCase()
    const cur = map.get(isin) ?? {
      stueck: 0,
      kosten: 0,
      name: b.wertpapierName?.trim() ?? isin,
      assetKlasse: b.assetKlasse,
    }

    if (b.typ === 'kauf') {
      let stk = b.stueck != null ? Math.abs(b.stueck) : 0
      if (stk <= 0 && b.kursEur != null && b.kursEur > 0) stk = b.betragEur / b.kursEur
      if (stk <= 0 && b.betragEur > 0) stk = 1
      cur.stueck += stk
      cur.kosten += b.betragEur
    } else if (b.typ === 'verkauf') {
      let stk = b.stueck != null ? Math.abs(b.stueck) : 0
      if (stk <= 0 && b.kursEur != null && b.kursEur > 0) stk = b.betragEur / b.kursEur
      if (cur.stueck > 0 && stk > 0) {
        const anteil = Math.min(1, stk / cur.stueck)
        cur.kosten = Math.round(cur.kosten * (1 - anteil) * 100) / 100
        cur.stueck = Math.max(0, cur.stueck - stk)
      } else {
        cur.kosten = Math.max(0, cur.kosten - b.betragEur)
      }
    }

    if (b.wertpapierName?.trim()) cur.name = b.wertpapierName.trim()
    map.set(isin, cur)
  }

  const out: PortfolioPositionSnapshot[] = []
  for (const [isin, cur] of map) {
    if (cur.stueck < 1e-8) continue
    const einstandKurs = cur.kosten / cur.stueck
    out.push({
      isin,
      name: cur.name,
      stueck: Math.round(cur.stueck * 1e6) / 1e6,
      kursEur: Math.round(einstandKurs * 10000) / 10000,
      wertEur: Math.round(cur.kosten * 100) / 100,
      assetKlasse: cur.assetKlasse,
    })
  }
  return out.sort((a, b) => b.wertEur - a.wertEur)
}

/** Snapshot-Stückzahlen mit Buchungs-Einstand kombinieren. */
export function positionenFuerBewertung(
  buchungen: PortfolioBuchung[],
  snapshot: PortfolioDbSnapshot | null,
): PortfolioPositionSnapshot[] {
  const ausBuchungen = bestandAusBuchungen(buchungen)
  const snap = snapshot?.positionen ?? []
  if (snap.length === 0) return ausBuchungen
  if (ausBuchungen.length === 0) return snap

  const buchMap = new Map(ausBuchungen.map((p) => [p.isin?.toUpperCase() ?? '', p]))
  const merged = new Map<string, PortfolioPositionSnapshot>()

  for (const p of snap) {
    const isin = p.isin?.toUpperCase() ?? ''
    if (!isin) continue
    const b = buchMap.get(isin)
    let stueck = p.stueck
    if (b && b.stueck > 0 && stueck > 0) {
      const ratio = stueck / b.stueck
      if (ratio > 8 || ratio < 0.125) stueck = b.stueck
    }
    if (stueck <= 0) stueck = b?.stueck ?? stueck
    const wertEur = b?.wertEur ?? p.wertEur
    merged.set(isin, {
      ...p,
      stueck,
      name: p.name || b?.name || isin,
      kursEur: b?.kursEur ?? p.kursEur,
      wertEur,
      assetKlasse: p.assetKlasse,
    })
  }
  for (const p of ausBuchungen) {
    const isin = p.isin?.toUpperCase() ?? ''
    if (!isin || merged.has(isin)) continue
    merged.set(isin, p)
  }
  return [...merged.values()].sort((a, b) => b.wertEur - a.wertEur)
}

export function cashSaldoAusBuchungen(buchungen: PortfolioBuchung[]): number {
  let cash = 0
  for (const b of buchungen) {
    switch (b.typ) {
      case 'einzahlung':
        cash += b.betragEur
        break
      case 'auszahlung':
        cash -= b.betragEur
        break
      case 'kauf':
        cash -= b.betragEur
        break
      case 'verkauf':
        cash += b.betragEur
        break
      case 'dividende':
      case 'zins':
        cash += b.betragEur
        break
      case 'steuer':
      case 'gebuehr':
        cash -= b.betragEur
        break
      default:
        break
    }
  }
  return Math.round(cash * 100) / 100
}
