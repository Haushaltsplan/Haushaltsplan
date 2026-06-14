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
import { istParqetPortfolioCsv, parseParqetPortfolioCsvText } from '@/lib/portfolio-analyse/parqet-portfolio-csv'
import {
  istTradeRepublicCsv,
  parseTradeRepublicCsvText,
} from '@/lib/portfolio-analyse/trade-republic-csv'

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

  let kursEur: number | null =
    row.kursEur != null && row.kursEur > 0 ? Math.round(row.kursEur * 10000) / 10000 : null
  if (kursEur == null && stueck != null && stueck !== 0 && betragEur > 0) {
    kursEur = Math.round((betragEur / Math.abs(stueck)) * 10000) / 10000
  }

  const assetKlasse = schaetzeAssetKlasse(wertpapierName, isin, typ)
  const buchungsHash = await berechneBuchungsHash({ datum, typ, isin, stueck, betragEur })

  const parqetTyp = quelle === 'csv' ? typRaw || null : null
  let realisierterGewinnEur: number | null = null
  if (
    /^sell$/i.test(typRaw) &&
    row.realisierterGewinnEur != null &&
    Number.isFinite(row.realisierterGewinnEur)
  ) {
    realisierterGewinnEur = Math.round(row.realisierterGewinnEur * 100) / 100
  }

  let steuerEur: number | null = null
  if (row.steuerEur != null && row.steuerEur > 0) {
    steuerEur = Math.round(row.steuerEur * 100) / 100
  }

  return {
    buchungsHash,
    datum,
    typ,
    isin,
    wertpapierName,
    stueck,
    kursEur,
    betragEur,
    realisierterGewinnEur,
    parqetTyp,
    steuerEur,
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
    hinweise.push(
      'Keine brauchbaren Buchungen oder Positionen erkannt — Trade-Republic-Kontoauszug, Wertpapierabrechnung oder CSV erwartet.',
    )
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

/** Parqet-Portfolio-CSV oder Trade-Republic-CSV (Transaktionsexport / Aktivität). */
export async function importierePortfolioCsvText(
  text: string,
  blocklist: string[] = [],
): Promise<PortfolioImportErgebnis> {
  if (istParqetPortfolioCsv(text)) {
    const roh = parseParqetPortfolioCsvText(text)
    const ergebnis = await rohZuImportErgebnis(roh, 'csv', blocklist)
    for (const h of roh.meta.hinweise) {
      if (!ergebnis.hinweise.includes(h)) ergebnis.hinweise.push(h)
    }
    if (roh.cash.length === 0) {
      ergebnis.hinweise.push('Keine Buchungen erkannt — Datei prüfen oder erneut aus Parqet exportieren.')
    }
    return ergebnis
  }

  if (istTradeRepublicCsv(text)) {
    const roh = parseTradeRepublicCsvText(text)
    const ergebnis = await rohZuImportErgebnis(roh, 'csv', blocklist)
    for (const h of roh.meta.hinweise) {
      if (!ergebnis.hinweise.includes(h)) ergebnis.hinweise.push(h)
    }
    if (roh.cash.length === 0 && roh.portfolio.length === 0) {
      ergebnis.hinweise.push(
        'Trade-Republic-CSV erkannt, aber keine Buchungen extrahiert — Datumsspalte (Timestamp/datetime) und Beträge prüfen.',
      )
    }
    return ergebnis
  }

  return {
    buchungen: [],
    positionen: [],
    depotwertEur: null,
    hinweise: [
      'Unbekanntes CSV-Format.',
      'Parqet: Portfolio → Export → „Aktien Portfolio“ (datetime, type, shares, amount, identifier, holdingname).',
      'Trade Republic: Profil → Dokumente → Transaktionsexport oder Aktivitäts-CSV (Spalten u. a. Timestamp, Type, Debit/Credit oder amount).',
      'Optional: Kontoauszug als PDF (TR-PDF-Import).',
    ],
    statistik: {
      cashZeilen: 0,
      positionen: 0,
      cryptoPositionen: 0,
      doppelteHashes: 0,
    },
  }
}

/** @deprecated Nutze importierePortfolioCsvText — behält Parqet-only-Fehlertext bei Nicht-Parqet. */
export async function importiereParqetPortfolioCsvText(
  text: string,
  blocklist: string[] = [],
): Promise<PortfolioImportErgebnis> {
  return importierePortfolioCsvText(text, blocklist)
}

export function mergeImportErgebnisse(ergebnisse: PortfolioImportErgebnis[]): PortfolioImportErgebnis {
  if (ergebnisse.length === 0) {
    return {
      buchungen: [],
      positionen: [],
      depotwertEur: null,
      hinweise: [],
      statistik: { cashZeilen: 0, positionen: 0, cryptoPositionen: 0, doppelteHashes: 0 },
    }
  }
  if (ergebnisse.length === 1) return ergebnisse[0]!

  const hinweise: string[] = []
  const hashSet = new Set<string>()
  const buchungen: PortfolioBuchung[] = []
  let doppelteHashes = 0
  let cashZeilen = 0
  let positionenCount = 0
  let cryptoPositionen = 0

  for (const e of ergebnisse) {
    for (const h of e.hinweise) {
      if (!hinweise.includes(h)) hinweise.push(h)
    }
    cashZeilen += e.statistik.cashZeilen
    positionenCount += e.statistik.positionen
    cryptoPositionen += e.statistik.cryptoPositionen
    for (const b of e.buchungen) {
      if (hashSet.has(b.buchungsHash)) {
        doppelteHashes++
        continue
      }
      hashSet.add(b.buchungsHash)
      buchungen.push(b)
    }
  }

  const letzteMitSnapshot = [...ergebnisse].reverse().find((e) => e.positionen.length > 0)
  const positionen = letzteMitSnapshot?.positionen ?? []
  const depotwertEur = letzteMitSnapshot?.depotwertEur ?? null

  hinweise.unshift(`${ergebnisse.length} Datei(en) zusammengeführt — ${buchungen.length} Buchung(en).`)

  return {
    buchungen,
    positionen,
    depotwertEur,
    hinweise,
    statistik: {
      cashZeilen,
      positionen: positionenCount,
      cryptoPositionen,
      doppelteHashes,
    },
  }
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
