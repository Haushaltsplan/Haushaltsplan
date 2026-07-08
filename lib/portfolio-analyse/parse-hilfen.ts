import type { AssetKlasse, BuchungsTyp } from '@/lib/portfolio-analyse/types'

const ISIN_RE = /\b([A-Z]{2}[A-Z0-9]{10})\b/
const STUECK_RE = /(\d+(?:[.,]\d+)?)\s*(?:Stk\.?|Stück|St\.?)/i
const SKIP_CASH_TYP =
  /^(summe|gesamt|saldo|übertrag|uebertrag|anfangssaldo|endsaldo|balance|subtotal)$/i

/** Entfernt personenbezogene Muster aus Freitext, bevor Felder extrahiert werden. */
export function bereinigeFreitext(raw: string): string {
  return raw
    .replace(/\bDE\d{20}\b/g, '[IBAN]')
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b/g, '[KONTO]')
    .replace(/\b\d{10,}\b/g, '[NR]')
    .replace(/\S+@\S+\.\S+/g, '[EMAIL]')
    .trim()
}

const MONAT: Record<string, string> = {
  jan: '01',
  januar: '01',
  feb: '02',
  februar: '02',
  mar: '03',
  mär: '03',
  maerz: '03',
  märz: '03',
  apr: '04',
  april: '04',
  mai: '05',
  may: '05',
  jun: '06',
  juni: '06',
  jul: '07',
  juli: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  okt: '10',
  oct: '10',
  oktober: '10',
  nov: '11',
  november: '11',
  dez: '12',
  dec: '12',
  dezember: '12',
}

export function parseDeDatumZuIso(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null

  const m = t.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`

  const mKurz = t.match(/^(\d{2})\.(\d{2})\.(\d{2})$/)
  if (mKurz) {
    const jj = Number(mKurz[3])
    const jahr = jj >= 70 ? 1900 + jj : 2000 + jj
    return `${jahr}-${mKurz[2]}-${mKurz[1]}`
  }

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  /** Trade-Republic-Export: „30 Nov 23 10:22 +0000“ */
  const trStamp = t.match(/^(\d{1,2})\s+([A-Za-zäöüÄÖÜß]{3,12})\.?\s+(\d{2,4})\b/i)
  if (trStamp) {
    const tag = trStamp[1].padStart(2, '0')
    const monKey = trStamp[2].toLowerCase().replace(/\./g, '').slice(0, 3)
    const mm =
      MONAT[monKey] ??
      MONAT[trStamp[2].toLowerCase().replace(/\./g, '')] ??
      Object.entries(MONAT).find(([k]) => k.startsWith(monKey) || monKey.startsWith(k.slice(0, 3)))?.[1]
    if (mm) {
      let jahr = Number(trStamp[3])
      if (jahr < 100) jahr = jahr >= 70 ? 1900 + jahr : 2000 + jahr
      return `${jahr}-${mm}-${tag}`
    }
  }

  const dmy = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (dmy) {
    const tag = dmy[1].padStart(2, '0')
    const mon = dmy[2].padStart(2, '0')
    return `${dmy[3]}-${mon}-${tag}`
  }

  const monText = t.match(/^(\d{1,2})\s+([A-Za-zäöüÄÖÜß.]+)\.?\s+(\d{2,4})/)
  if (monText) {
    const tag = monText[1].padStart(2, '0')
    const monKey = monText[2].toLowerCase().replace(/\./g, '')
    const mm = MONAT[monKey]
    if (mm) {
      let jahr = Number(monText[3])
      if (jahr < 100) jahr = jahr >= 70 ? 1900 + jahr : 2000 + jahr
      return `${jahr}-${mm}-${tag}`
    }
  }

  return null
}

/** Datum aus „15.12. - 09:15 Uhr“ + Jahr-Spalte (z. B. transaktionen_2022.csv). */
export function parseDatumUhrzeitMitJahr(raw: string, jahrRaw: string | null | undefined): string | null {
  const t = raw.trim()
  if (!t) return null
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\./)
  if (!m) return parseDeDatumZuIso(t)
  const tag = m[1].padStart(2, '0')
  const mon = m[2].padStart(2, '0')
  let jahr = jahrRaw != null ? Number(String(jahrRaw).trim()) : NaN
  if (!Number.isFinite(jahr) || jahr < 1970 || jahr > 2100) {
    jahr = new Date().getFullYear()
  }
  return `${jahr}-${mon}-${tag}`
}

export function parseEuropeanNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const s = String(raw).replace(/€|\u202f|\s/g, '').trim()
  if (!s || s === '—' || s === '-') return null
  const clean = s.replace(/\./g, '').replace(',', '.')
  const v = Number.parseFloat(clean)
  return Number.isFinite(v) ? v : null
}

export function extrahiereIsin(text: string): string | null {
  const m = ISIN_RE.exec(text.toUpperCase())
  return m ? m[1] : null
}

/** Für Supabase CHECK (ISIN NULL oder 12 Zeichen A–Z/0–9); leere/ungültige Werte → null. */
export function normalisiereIsinFuerDb(isin: string | null | undefined): string | null {
  const s = (isin ?? '').trim().toUpperCase()
  if (!s) return null
  return ISIN_RE.test(s) ? s : null
}

export function extrahiereStueck(text: string): number | null {
  const m = STUECK_RE.exec(text)
  if (!m) return null
  return parseEuropeanNumber(m[1])
}

export function normalisiereTrTyp(raw: string): BuchungsTyp {
  const t = raw.toLowerCase().trim()
  if (t.includes('saveback') || t.includes('round up') || t.includes('roundup')) return 'kauf'
  // Verkauf vor Kauf — „verkauf“ enthält sonst „kauf“ als Teilstring
  if (t.includes('verkauf') || t.includes('sale') || t === 'sell' || t === 'transferout') return 'verkauf'
  if (t.includes('kauf') || t.includes('purchase') || t === 'buy' || t === 'transferin') return 'kauf'
  if (t.includes('dividend')) return 'dividende'
  if (t.includes('interest') || t.includes('zins') || t.includes('interest_payment')) return 'zins'
  if (
    t.includes('einzahl') ||
    t.includes('deposit') ||
    t.includes('überweisung eingang') ||
    t.includes('customer_inbound') ||
    t.includes('inbound')
  ) {
    return 'einzahlung'
  }
  if (t.includes('auszahl') || t.includes('withdrawal') || t.includes('withdraw') || t.includes('outbound')) {
    return 'auszahlung'
  }
  if (t.includes('steuer') || t.includes('tax') || t.includes('kapitalertrag')) return 'steuer'
  if (
    t.includes('gebühr') ||
    t.includes('fee') ||
    t.includes('entgelt') ||
    t.includes('zuschlag') ||
    t.includes('fremdkost') ||
    t.includes('pauschale') ||
    t.includes('provision') ||
    t.includes('spesen')
  ) {
    return 'gebuehr'
  }
  return 'sonstiges'
}

export function istCashZeileUeberspringen(typ: string, beschreibung: string): boolean {
  const t = typ.trim()
  if (!t && !beschreibung.trim()) return true
  if (SKIP_CASH_TYP.test(t)) return true
  if (/^saldo$/i.test(beschreibung.trim())) return true
  if (/^(anfangssaldo|endsaldo|übertrag|uebertrag)/i.test(beschreibung.trim())) return true
  return false
}

export function schaetzeAssetKlasse(name: string | null, isin: string | null, typ: BuchungsTyp): AssetKlasse {
  const n = (name ?? '').toLowerCase()
  if (/bitcoin|ethereum|crypto|krypto/i.test(n)) return 'crypto'
  if (/geldmarkt|money market|zins/i.test(n)) return 'geldmarkt'
  if (/etf|index|ucits|ishares|vanguard|xtrackers|amundi|lyxor|spdr/i.test(n)) return 'etf'
  if (/anleihe|bond|obligation|emission/i.test(n)) return 'anleihe'
  if (typ === 'zins') return 'geldmarkt'
  return 'aktie'
}

export function extrahiereWertpapierName(beschreibung: string, isin: string | null): string | null {
  let t = beschreibung
    .replace(/ISIN:?\s*[A-Z]{2}[A-Z0-9]{10}/gi, '')
    .replace(/\d+(?:[.,]\d+)?\s*(?:Stk\.?|Stück)/gi, '')
    .replace(/Kauf|Verkauf|Dividende|Ertrag|Zinsen/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (isin) t = t.replace(new RegExp(isin, 'gi'), '').trim()
  if (t.length < 2) return null
  if (t.length > 120) t = t.slice(0, 120).trim()
  return t || null
}

export async function berechneBuchungsHash(parts: {
  datum: string
  typ: BuchungsTyp
  isin: string | null
  stueck: number | null
  betragEur: number
  /** Zusatz für eindeutige manuelle Buchungen (z. B. UUID). */
  zusatz?: string
}): Promise<string> {
  const payload = [
    parts.datum,
    parts.typ,
    parts.isin ?? '',
    parts.stueck != null ? parts.stueck.toFixed(8) : '',
    parts.betragEur.toFixed(2),
    parts.zusatz ?? '',
  ].join('|')
  const enc = new TextEncoder().encode(payload)
  const digest = await crypto.subtle.digest('SHA-256', enc)
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hex.slice(0, 32)
}

export function anonymisiereWertpapierName(name: string | null): string | null {
  if (!name) return null
  const n = bereinigeFreitext(name)
  return n.length >= 2 ? n : null
}
