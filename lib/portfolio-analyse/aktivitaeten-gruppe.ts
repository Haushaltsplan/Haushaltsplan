import { cashBetragEur, anzeigeHandelsBuchung } from '@/lib/portfolio-analyse/parqet-handelswerte'
import type { BuchungsTyp, PortfolioBuchung, PortfolioDbBuchung } from '@/lib/portfolio-analyse/types'

export type AktivitaetenStatistik = {
  kaeufe: number
  verkaeufe: number
  dividenden: number
  andere: number
}

export type AktivitaetenMonatGruppe = {
  key: string
  label: string
  jahr: number
  monat: number
  anzahl: number
  kaeufeSumme: number
  verkaeufeSumme: number
  dividendenSumme: number
  isins: string[]
  buchungen: PortfolioDbBuchung[]
}

export type AktivitaetenJahrGruppe = {
  jahr: number
  anzahl: number
  kaeufeSumme: number
  verkaeufeSumme: number
  dividendenSumme: number
  isins: string[]
  monate: AktivitaetenMonatGruppe[]
}

function monatsKey(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}` : ''
}

function monatLabel(jahr: number, monat: number): string {
  const d = new Date(jahr, monat - 1, 1)
  return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}

function summenAusBuchungen(buchungen: PortfolioBuchung[]) {
  let kaeufeSumme = 0
  let verkaeufeSumme = 0
  let dividendenSumme = 0
  const isins = new Set<string>()
  for (const b of buchungen) {
    if (b.isin) isins.add(b.isin.toUpperCase())
    if (b.typ === 'kauf') kaeufeSumme += cashBetragEur(b)
    else if (b.typ === 'verkauf') verkaeufeSumme += cashBetragEur(b)
    else if (b.typ === 'dividende' || b.typ === 'zins') dividendenSumme += b.betragEur
  }
  return {
    kaeufeSumme: Math.round(kaeufeSumme * 100) / 100,
    verkaeufeSumme: Math.round(verkaeufeSumme * 100) / 100,
    dividendenSumme: Math.round(dividendenSumme * 100) / 100,
    isins: [...isins],
  }
}

export function aktivitaetenStatistik(buchungen: PortfolioBuchung[]): AktivitaetenStatistik {
  let kaeufe = 0
  let verkaeufe = 0
  let dividenden = 0
  let andere = 0
  for (const b of buchungen) {
    if (b.typ === 'kauf') kaeufe++
    else if (b.typ === 'verkauf') verkaeufe++
    else if (b.typ === 'dividende' || b.typ === 'zins') dividenden++
    else andere++
  }
  return { kaeufe, verkaeufe, dividenden, andere }
}

export function gruppiereAktivitaeten(buchungen: PortfolioDbBuchung[]): AktivitaetenJahrGruppe[] {
  const sortiert = [...buchungen].sort((a, b) => b.datum.localeCompare(a.datum))
  const byJahrMonat = new Map<string, PortfolioDbBuchung[]>()

  for (const b of sortiert) {
    const k = monatsKey(b.datum)
    if (!k) continue
    const list = byJahrMonat.get(k) ?? []
    list.push(b)
    byJahrMonat.set(k, list)
  }

  const jahrMap = new Map<number, AktivitaetenMonatGruppe[]>()

  for (const [key, list] of byJahrMonat) {
    const [y, mo] = key.split('-').map(Number)
    const summen = summenAusBuchungen(list)
    const monat: AktivitaetenMonatGruppe = {
      key,
      label: monatLabel(y, mo),
      jahr: y,
      monat: mo,
      anzahl: list.length,
      ...summen,
      buchungen: list.sort((a, b) => b.datum.localeCompare(a.datum)),
    }
    const arr = jahrMap.get(y) ?? []
    arr.push(monat)
    jahrMap.set(y, arr)
  }

  return [...jahrMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([jahr, monate]) => {
      const sortedMonate = monate.sort((a, b) => b.monat - a.monat)
      const alle = sortedMonate.flatMap((m) => m.buchungen)
      const summen = summenAusBuchungen(alle)
      return {
        jahr,
        anzahl: alle.length,
        ...summen,
        monate: sortedMonate,
      }
    })
}

export function filterAktivitaeten(
  buchungen: PortfolioDbBuchung[],
  opts: { typ?: BuchungsTyp | 'alle'; isin?: string | 'alle' },
): PortfolioDbBuchung[] {
  return buchungen.filter((b) => {
    if (opts.typ && opts.typ !== 'alle' && b.typ !== opts.typ) return false
    if (opts.isin && opts.isin !== 'alle') {
      const ziel = opts.isin.toUpperCase()
      if ((b.isin?.toUpperCase() ?? '') !== ziel) return false
    }
    return true
  })
}

export function buchungenZuCsv(buchungen: PortfolioDbBuchung[]): string {
  const header = 'datum;typ;isin;name;stueck;kurs_eur;betrag_eur;assetklasse'
  const rows = [...buchungen]
    .sort((a, b) => b.datum.localeCompare(a.datum))
    .map((b) => {
      const n = anzeigeHandelsBuchung(b)
      return [
        b.datum,
        b.typ,
        b.isin ?? '',
        (b.wertpapierName ?? '').replace(/;/g, ','),
        b.stueck ?? '',
        n.kursEur ?? '',
        n.betragEur.toFixed(2).replace('.', ','),
        b.assetKlasse,
      ].join(';')
    })
  return [header, ...rows].join('\n')
}
