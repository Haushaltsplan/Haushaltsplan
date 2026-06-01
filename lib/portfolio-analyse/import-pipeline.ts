import type { ImportQuelle, PortfolioBuchung, PortfolioImportErgebnis, PortfolioPositionSnapshot } from '@/lib/portfolio-analyse/types'
import {
  beschreibungZuPersonenbezogen,
  sichererWertpapierName,
} from '@/lib/portfolio-analyse/anonymisierung'
import { positiverGeldbetrag } from '@/lib/portfolio-analyse/parse-geld-betrag'
import {
  berechneBuchungsHash,
  extrahiereIsin,
  extrahiereStueck,
  extrahiereWertpapierName,
  istCashZeileUeberspringen,
  normalisiereIsinFuerDb,
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
  blocklist: string[],
): Promise<PortfolioBuchung | null> {
  const typRaw = row.typ.trim()
  const beschreibung = row.beschreibung.trim()
  if (istCashZeileUeberspringen(typRaw, beschreibung)) return null

  const datum = parseDeDatumZuIso(row.datum.trim())
  if (!datum) return null

  const typ = normalisiereTrTyp(typRaw || beschreibung)
  const isinAusZeile = row.isin?.trim() || extrahiereIsin(beschreibung)
  if (
    beschreibungZuPersonenbezogen(beschreibung, blocklist) &&
    !isinAusZeile &&
    typ !== 'einzahlung' &&
    typ !== 'auszahlung'
  ) {
    return null
  }

  const eingang = positiverGeldbetrag(row.zahlungseingang) ?? 0
  const ausgang = positiverGeldbetrag(row.zahlungsausgang) ?? 0
  if (eingang <= 0 && ausgang <= 0) return null
  const betragEur = Math.round((eingang > 0 ? eingang : ausgang) * 100) / 100
  if (betragEur <= 0 && typ !== 'steuer' && typ !== 'gebuehr') return null

  const isin = normalisiereIsinFuerDb(isinAusZeile || extrahiereIsin(beschreibung))
  const wertpapierName = sichererWertpapierName(extrahiereWertpapierName(beschreibung, isin), blocklist)
  let stueck = row.stueck ?? extrahiereStueck(beschreibung)
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

function positionZuSnapshot(pos: TrRawPosition, blocklist: string[]): PortfolioPositionSnapshot | null {
  if (pos.quantity == null || !Number.isFinite(pos.quantity) || pos.quantity <= 0) return null
  const isin = normalisiereIsinFuerDb(pos.isin?.trim() || extrahiereIsin(pos.name))
  const name = sichererWertpapierName(pos.name.trim(), blocklist)
  if (!name && !isin) return null
  const wertEur = pos.marketValueEUR ?? (pos.pricePerUnit != null ? pos.quantity * pos.pricePerUnit : 0)
  if (!Number.isFinite(wertEur) || wertEur <= 0) return null
  const assetKlasse = schaetzeAssetKlasse(name, isin, 'sonstiges')
  return {
    isin,
    name: name ?? (isin ? `Wertpapier ${isin}` : 'Wertpapier'),
    stueck: pos.quantity,
    kursEur: pos.pricePerUnit,
    wertEur: Math.round(wertEur * 100) / 100,
    assetKlasse,
  }
}

async function rohZuImportErgebnis(
  roh: TrPdfParseErgebnis,
  quelle: ImportQuelle,
  blocklist: string[],
): Promise<PortfolioImportErgebnis> {
  const hinweise: string[] = []
  const buchungen: PortfolioBuchung[] = []
  for (const row of roh.cash) {
    const b = await cashZeileZuBuchung(row, quelle, blocklist)
    if (b) buchungen.push(b)
  }

  const positionen: PortfolioPositionSnapshot[] = []
  for (const pos of [...roh.portfolio, ...roh.crypto]) {
    const snap = positionZuSnapshot(pos, blocklist)
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
  if (blocklist.length > 0) {
    hinweise.push(`Persönliche Blockliste aktiv (${blocklist.length} Eintrag/Einträge).`)
  }

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

export async function importiereTradeRepublicPdfBuffer(
  buffer: ArrayBuffer,
  blocklist: string[] = [],
): Promise<PortfolioImportErgebnis> {
  const roh = await parseTradeRepublicPdfBuffer(buffer)
  return rohZuImportErgebnis(roh, 'pdf', blocklist)
}

export async function importiereTradeRepublicCsvText(
  text: string,
  blocklist: string[] = [],
): Promise<PortfolioImportErgebnis> {
  const roh = parseTradeRepublicCsvText(text)
  const ergebnis = await rohZuImportErgebnis(roh, 'csv', blocklist)
  for (const h of roh.meta.hinweise) {
    if (!ergebnis.hinweise.includes(h)) ergebnis.hinweise.push(h)
  }
    if (roh.meta.format === 'depot_positionen' && roh.cash.length === 0) {
      ergebnis.hinweise.push(
        'Hinweis: Diese CSV enthält nur Depotpositionen — für Buchungen/Summen Aktivitäts-/Transaktions-CSV oder PDF nutzen.',
      )
    }
    if (roh.meta.format === 'transaktionen_de') {
      ergebnis.hinweise.push(
        'Transaktions-CSV: Kauf/Verkauf/Dividende aus Spalte Typ, Betrag_EUR inkl. Gebühren_EUR, Steuern bei Dividenden abgezogen. ISIN-Wechsel ignoriert.',
      )
    }
    if (roh.meta.format === 'tr_transaktionsexport') {
      ergebnis.hinweise.push(
        'TR-Transaktionsexport: Beträge aus „amount“ (negativ = Ausgang), Gebühren aus „fee“. STOCKPERK wird nicht importiert (sonst Doppelung mit Kauf).',
      )
    }
    if (roh.meta.format === 'tr_aktivitaet') {
      ergebnis.hinweise.push(
        'TR-Aktivitäts-CSV: Beträge aus Spalten Debit (Ausgang) und Credit (Eingang), Typ aus Spalte „Type“.',
      )
    }
  return ergebnis
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
