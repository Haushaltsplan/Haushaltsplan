import { parseGeldBetrag } from '@/lib/portfolio-analyse/parse-geld-betrag'
import {
  berechneBuchungsHash,
  normalisiereIsinFuerDb,
  parseEuropeanNumber,
  schaetzeAssetKlasse,
} from '@/lib/portfolio-analyse/parse-hilfen'
import type {
  AssetKlasse,
  BuchungsTyp,
  PortfolioBuchung,
  PortfolioImportErgebnis,
} from '@/lib/portfolio-analyse/types'

export type ManuelleBuchungInput = {
  datum: string
  typ: BuchungsTyp
  isin?: string | null
  wertpapierName?: string | null
  stueck?: number | null
  betragEur: number
  kursEur?: number | null
  assetKlasse?: AssetKlasse
}

export function parseManuelleZahl(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  return parseGeldBetrag(t) ?? parseEuropeanNumber(t)
}

export async function erstelleManuelleBuchung(input: ManuelleBuchungInput): Promise<PortfolioBuchung> {
  const isin = normalisiereIsinFuerDb(input.isin)
  const wertpapierName = input.wertpapierName?.trim() || null

  let stueck = input.stueck ?? null
  if (stueck != null && Number.isFinite(stueck)) {
    if (input.typ === 'verkauf') stueck = -Math.abs(stueck)
    else if (input.typ === 'kauf') stueck = Math.abs(stueck)
  } else {
    stueck = null
  }

  const betragEur = Math.round(Math.abs(input.betragEur) * 100) / 100

  let kursEur = input.kursEur != null && input.kursEur > 0 ? Math.round(input.kursEur * 10000) / 10000 : null
  if (kursEur == null && stueck != null && stueck !== 0 && betragEur > 0) {
    kursEur = Math.round((betragEur / Math.abs(stueck)) * 10000) / 10000
  }

  const assetKlasse = input.assetKlasse ?? schaetzeAssetKlasse(wertpapierName, isin, input.typ)
  const buchungsHash = await berechneBuchungsHash({
    datum: input.datum,
    typ: input.typ,
    isin,
    stueck,
    betragEur,
    zusatz: crypto.randomUUID(),
  })

  return {
    buchungsHash,
    datum: input.datum,
    typ: input.typ,
    isin,
    wertpapierName,
    stueck,
    kursEur,
    betragEur,
    assetKlasse,
    quelle: 'manuell',
  }
}

export function manuellerImportErgebnis(buchung: PortfolioBuchung): PortfolioImportErgebnis {
  return {
    buchungen: [buchung],
    positionen: [],
    depotwertEur: null,
    hinweise: ['Manuell erfasste Buchung — bitte vor dem Speichern prüfen.'],
    statistik: {
      cashZeilen: 0,
      positionen: 0,
      cryptoPositionen: 0,
      doppelteHashes: 0,
    },
  }
}

export function validiereManuelleBuchungInput(input: ManuelleBuchungInput): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.datum)) {
    return 'Gültiges Datum wählen.'
  }
  if (!Number.isFinite(input.betragEur) || input.betragEur <= 0) {
    return 'Betrag in EUR eingeben (größer 0).'
  }
  const isinRoh = (input.isin ?? '').trim()
  if (isinRoh && !normalisiereIsinFuerDb(isinRoh)) {
    return 'ISIN ungültig (12 Zeichen, z. B. US5949181045).'
  }
  const name = (input.wertpapierName ?? '').trim()
  const handelsTyp = input.typ === 'kauf' || input.typ === 'verkauf' || input.typ === 'dividende'
  if (handelsTyp && !isinRoh && !name) {
    return 'Bei Kauf/Verkauf/Dividende ISIN oder Bezeichnung angeben.'
  }
  if ((input.typ === 'kauf' || input.typ === 'verkauf') && input.stueck != null) {
    if (!Number.isFinite(input.stueck) || input.stueck <= 0) {
      return 'Stückzahl muss größer 0 sein.'
    }
  }
  return null
}
