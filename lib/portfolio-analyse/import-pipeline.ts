import type { ImportQuelle, PortfolioBuchung, PortfolioImportErgebnis, PortfolioPositionSnapshot } from '@/lib/portfolio-analyse/types'
import {
  anonymisiereWertpapierName,
  berechneBuchungsHash,
  extrahiereIsin,
  extrahiereStueck,
  extrahiereWertpapierName,
  istCashZeileUeberspringen,
  normalisiereTrTyp,
  parseDeDatumZuIso,
  parseEuropeanNumber,
  schaetzeAssetKlasse,
} from '@/lib/portfolio-analyse/parse-hilfen'
import type { TrPdfParseErgebnis, TrRawCashZeile, TrRawPosition } from '@/lib/portfolio-analyse/trade-republic-pdf-parser'
import { parseTradeRepublicPdfBuffer } from '@/lib/portfolio-analyse/trade-republic-pdf-parser'
import { parseTradeRepublicCsvText } from '@/lib/portfolio-analyse/trade-republic-csv'

async function cashZeileZuBuchung(
  row: TrRawCashZeile,
  quelle: ImportQuelle,
): Promise<PortfolioBuchung | null> {
  const typRaw = row.typ.trim()
  const beschreibung = row.beschreibung.trim()
  if (istCashZeileUeberspringen(typRaw, beschreibung)) return null

  const datum = parseDeDatumZuIso(row.datum.trim())
  if (!datum) return null

  const typ = normalisiereTrTyp(typRaw)
  const eingang = parseEuropeanNumber(row.zahlungseingang) ?? 0
  const ausgang = parseEuropeanNumber(row.zahlungsausgang) ?? 0
  const betragEur = Math.round((eingang > 0 ? eingang : ausgang) * 100) / 100
  if (betragEur <= 0 && typ !== 'steuer' && typ !== 'gebuehr') return null

  const isin = extrahiereIsin(beschreibung)
  const wertpapierName = anonymisiereWertpapierName(extrahiereWertpapierName(beschreibung, isin))
  let stueck = extrahiereStueck(beschreibung)
  if (stueck != null && typ === 'verkauf') stueck = -Math.abs(stueck)
  if (stueck != null && typ === 'kauf') stueck = Math.abs(stueck)

  let kursEur: number | null = null
  if (stueck != null && stueck !== 0 && betragEur > 0) {
    kursEur = Math.round((betragEur / Math.abs(stueck)) * 10000) / 10000
  }

  const assetKlasse = schaetzeAssetKlasse(wertpapierName, isin, typ)
  const buchungsHash = await berechneBuchungsHash({ datum, typ, isin, stueck, betragEur })

  return {
    buchungsHash,
    datum,
    typ,
    isin,
    wertpapierName,
    stueck,
    kursEur,
    betragEur,
    assetKlasse,
    quelle,
  }
}

function positionZuSnapshot(pos: TrRawPosition): PortfolioPositionSnapshot | null {
  if (pos.quantity == null || !Number.isFinite(pos.quantity) || pos.quantity <= 0) return null
  const isin = pos.isin?.trim() || extrahiereIsin(pos.name)
  const name = anonymisiereWertpapierName(pos.name.trim())
  if (!name) return null
  const wertEur = pos.marketValueEUR ?? (pos.pricePerUnit != null ? pos.quantity * pos.pricePerUnit : 0)
  if (!Number.isFinite(wertEur) || wertEur <= 0) return null
  const assetKlasse = schaetzeAssetKlasse(name, isin, 'sonstiges')
  return {
    isin,
    name,
    stueck: pos.quantity,
    kursEur: pos.pricePerUnit,
    wertEur: Math.round(wertEur * 100) / 100,
    assetKlasse,
  }
}

async function rohZuImportErgebnis(
  roh: TrPdfParseErgebnis,
  quelle: ImportQuelle,
): Promise<PortfolioImportErgebnis> {
  const hinweise: string[] = []
  const buchungen: PortfolioBuchung[] = []
  for (const row of roh.cash) {
    const b = await cashZeileZuBuchung(row, quelle)
    if (b) buchungen.push(b)
  }

  const positionen: PortfolioPositionSnapshot[] = []
  for (const pos of [...roh.portfolio, ...roh.crypto]) {
    const snap = positionZuSnapshot(pos)
    if (snap) positionen.push(snap)
  }

  const hashSet = new Set<string>()
  let doppelteHashes = 0
  const dedup: PortfolioBuchung[] = []
  for (const b of buchungen) {
    if (hashSet.has(b.buchungsHash)) {
      doppelteHashes++
      continue
    }
    hashSet.add(b.buchungsHash)
    dedup.push(b)
  }

  let depotwertEur =
    positionen.length > 0
      ? Math.round(positionen.reduce((s, p) => s + p.wertEur, 0) * 100) / 100
      : null

  if (buchungen.length === 0 && positionen.length === 0) {
    hinweise.push('Keine brauchbaren Buchungen oder Positionen erkannt — ist das ein Trade-Republic-Kontoauszug?')
  }
  if (roh.cash.length > 0 && dedup.length === 0) {
    hinweise.push('Umsatzübersicht gefunden, aber keine anonymisierbaren Buchungen extrahiert.')
  }
  hinweise.push('Rohdatei wurde nicht gespeichert — nur anonymisierte Felder.')

  return {
    buchungen: dedup,
    positionen,
    depotwertEur,
    hinweise,
    statistik: {
      cashZeilen: roh.cash.length,
      positionen: roh.portfolio.length,
      cryptoPositionen: roh.crypto.length,
      doppelteHashes,
    },
  }
}

export async function importiereTradeRepublicPdfBuffer(buffer: ArrayBuffer): Promise<PortfolioImportErgebnis> {
  const roh = await parseTradeRepublicPdfBuffer(buffer)
  return rohZuImportErgebnis(roh, 'pdf')
}

export async function importiereTradeRepublicCsvText(text: string): Promise<PortfolioImportErgebnis> {
  const roh = parseTradeRepublicCsvText(text)
  return rohZuImportErgebnis(roh, 'csv')
}

export async function dedupliziereGegenBestehend(
  neu: PortfolioBuchung[],
  bestehendeHashes: Set<string>,
): Promise<{ neu: PortfolioBuchung[]; uebersprungen: number }> {
  const out: PortfolioBuchung[] = []
  let uebersprungen = 0
  for (const b of neu) {
    if (bestehendeHashes.has(b.buchungsHash)) {
      uebersprungen++
      continue
    }
    out.push(b)
  }
  return { neu: out, uebersprungen }
}
