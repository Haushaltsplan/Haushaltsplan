import {
  type AktienSplit,
  SPIN_OFFS,
  alleSplits,
  registriereDynamischeSplits,
  spinOffBereitsGebucht,
} from '@/lib/portfolio-analyse/corporate-actions'
import { depotStandBisDatum } from '@/lib/portfolio-analyse/bestand'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { berechneBuchungsHash, schaetzeAssetKlasse } from '@/lib/portfolio-analyse/parse-hilfen'
import type { PortfolioBuchung } from '@/lib/portfolio-analyse/types'
import { ladeYahooSplits, yahooSchlusskursAm } from '@/lib/portfolio-analyse/yahoo-corporate-actions-client'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function sammleIsins(buchungen: PortfolioBuchung[]): string[] {
  const s = new Set<string>()
  for (const b of buchungen) {
    const isin = b.isin?.trim().toUpperCase()
    if (isin) s.add(isin)
  }
  return [...s]
}

function yahooSymbol(isin: string): string | null {
  const k = isinKenntnis(isin)
  return k?.symbolYahoo?.trim().toUpperCase() ?? k?.kursNurSymbol?.trim().toUpperCase() ?? null
}

async function ladeSplitsFuerIsins(isins: string[]): Promise<AktienSplit[]> {
  const out: AktienSplit[] = []
  const tasks = isins.map(async (isin) => {
    const sym = yahooSymbol(isin)
    if (!sym) return
    const splits = await ladeYahooSplits(sym)
    for (const s of splits) {
      out.push({ isin, datum: s.datum, faktor: s.faktor, quelle: 'yahoo' })
    }
  })
  await Promise.all(tasks)
  return out
}

async function spinOffKostenAnteil(spin: (typeof SPIN_OFFS)[number]): Promise<number> {
  const fallback = Math.min(0.95, Math.max(0.01, spin.childKostenAnteil ?? 0.05))
  const parentSym = yahooSymbol(spin.parentIsin)
  const childSym = yahooSymbol(spin.childIsin)
  if (!parentSym || !childSym) return fallback

  const [parentKurs, childKurs] = await Promise.all([
    yahooSchlusskursAm(parentSym, spin.datum),
    yahooSchlusskursAm(childSym, spin.datum),
  ])
  if (parentKurs == null || childKurs == null || parentKurs <= 0 || childKurs <= 0) return fallback

  const childWertProParent = childKurs * spin.ratio
  const anteil = childWertProParent / (parentKurs + childWertProParent)
  if (!Number.isFinite(anteil) || anteil <= 0 || anteil >= 1) return fallback
  return Math.round(anteil * 10000) / 10000
}

async function spinOffBuchungenErzeugen(
  spin: (typeof SPIN_OFFS)[number],
  buchungen: PortfolioBuchung[],
): Promise<{ buchungen: PortfolioBuchung[]; hinweis: string | null }> {
  if (spinOffBereitsGebucht(buchungen, spin)) {
    return { buchungen: [], hinweis: null }
  }

  const stichtag = spin.recordDatum ?? spin.datum
  const stand = depotStandBisDatum(buchungen, stichtag)
  const parent = stand.byIsin.get(spin.parentIsin.toUpperCase())
  const parentStueck = parent?.stueck ?? 0
  if (parentStueck < 1e-8) return { buchungen: [], hinweis: null }

  const childStueck = round4(parentStueck * spin.ratio)
  if (childStueck < 1e-8) return { buchungen: [], hinweis: null }

  const parentKosten = parent ? parent.stueck * parent.einstandKurs : 0
  if (parentKosten <= 0) return { buchungen: [], hinweis: null }

  const childAnteil = await spinOffKostenAnteil(spin)
  const childKosten = round2(parentKosten * childAnteil)
  const parentAbzug = round2(Math.min(parentKosten, childKosten))

  const parentName = parent?.name ?? isinKenntnis(spin.parentIsin)?.name ?? spin.parentIsin
  const childName = spin.childName

  const costHash = await berechneBuchungsHash({
    datum: spin.datum,
    typ: 'sonstiges',
    isin: spin.parentIsin,
    stueck: null,
    betragEur: parentAbzug,
    zusatz: `spinoff-cost|${spin.childIsin}`,
  })

  const childHash = await berechneBuchungsHash({
    datum: spin.datum,
    typ: 'kauf',
    isin: spin.childIsin,
    stueck: childStueck,
    betragEur: childKosten,
    zusatz: `spinoff|${spin.parentIsin}`,
  })

  const kursEur = childStueck > 0 ? round4(childKosten / childStueck) : null
  const assetKlasse = schaetzeAssetKlasse(childName, spin.childIsin, 'kauf')

  const neu: PortfolioBuchung[] = [
    {
      buchungsHash: costHash,
      datum: spin.datum,
      typ: 'sonstiges',
      isin: spin.parentIsin,
      wertpapierName: parentName,
      stueck: null,
      kursEur: null,
      betragEur: parentAbzug,
      parqetTyp: 'SpinOffCost',
      assetKlasse: parent?.assetKlasse ?? 'aktie',
      quelle: 'csv',
    },
    {
      buchungsHash: childHash,
      datum: spin.datum,
      typ: 'kauf',
      isin: spin.childIsin,
      wertpapierName: childName,
      stueck: childStueck,
      kursEur: kursEur,
      betragEur: childKosten,
      parqetTyp: 'SpinOff',
      assetKlasse,
      quelle: 'csv',
    },
  ]

  const hinweis =
    `Spin-off ${parentName} → ${childName} (${spin.datum}): ` +
    `${childStueck.toLocaleString('de-DE')} Stk., Einstand ${childKosten.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} ` +
    `(${Math.round(childAnteil * 1000) / 10} % vom Eltern-Einstand).`

  return { buchungen: neu, hinweis }
}

export type CorporateActionsErgebnis = {
  zusaetzlicheBuchungen: PortfolioBuchung[]
  hinweise: string[]
  neueSplits: number
}

/** Nur Yahoo-Splits registrieren (ohne Spin-off-Buchungen) — z. B. beim Dashboard-Laden. */
export async function aktualisiereYahooSplitsFuerDepot(buchungen: PortfolioBuchung[]): Promise<number> {
  if (buchungen.length === 0) return 0
  const isins = sammleIsins(buchungen)
  const yahooSplits = await ladeSplitsFuerIsins(isins)
  return registriereDynamischeSplits(yahooSplits)
}

/**
 * Erkennt fehlende Splits (Yahoo) und Spin-offs (Katalog) und erzeugt synthetische Buchungen.
 * @param alleBuchungen Bestehende + neue Import-Buchungen für Bestandsberechnung
 * @param bestehendeHashes Hashes bereits in der DB — keine Duplikate
 */
export async function ermittleCorporateActionBuchungen(
  alleBuchungen: PortfolioBuchung[],
  bestehendeHashes: Set<string>,
): Promise<CorporateActionsErgebnis> {
  const hinweise: string[] = []
  if (alleBuchungen.length === 0) {
    return { zusaetzlicheBuchungen: [], hinweise, neueSplits: 0 }
  }

  const isins = sammleIsins(alleBuchungen)
  const yahooSplits = await ladeSplitsFuerIsins(isins)
  const neueSplits = registriereDynamischeSplits(yahooSplits)

  if (neueSplits > 0) {
    hinweise.push(
      `${neueSplits} Aktiensplit(s) von Yahoo erkannt — Stückzahlen werden im Bestand automatisch angepasst.`,
    )
  }

  const zusaetzliche: PortfolioBuchung[] = []
  for (const spin of SPIN_OFFS) {
    const { buchungen: neu, hinweis } = await spinOffBuchungenErzeugen(spin, alleBuchungen)
    for (const b of neu) {
      if (bestehendeHashes.has(b.buchungsHash)) continue
      zusaetzliche.push(b)
    }
    if (hinweis && neu.length > 0) hinweise.push(hinweis)
  }

  return { zusaetzlicheBuchungen: zusaetzliche, hinweise, neueSplits }
}
