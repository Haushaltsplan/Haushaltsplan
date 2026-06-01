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

export function parseDeDatumZuIso(raw: string): string | null {
  const t = raw.trim()
  const m = t.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  return null
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

export function extrahiereStueck(text: string): number | null {
  const m = STUECK_RE.exec(text)
  if (!m) return null
  return parseEuropeanNumber(m[1])
}

export function normalisiereTrTyp(raw: string): BuchungsTyp {
  const t = raw.toLowerCase().trim()
  if (t.includes('kauf') || t.includes('purchase') || t.includes('buy')) return 'kauf'
  if (t.includes('verkauf') || t.includes('sale') || t.includes('sell')) return 'verkauf'
  if (t.includes('dividend')) return 'dividende'
  if (t.includes('zins') || t.includes('interest')) return 'zins'
  if (t.includes('einzahl') || t.includes('deposit') || t.includes('überweisung eingang')) return 'einzahlung'
  if (t.includes('auszahl') || t.includes('withdraw') || t.includes('überweisung ausgang')) return 'auszahlung'
  if (t.includes('steuer') || t.includes('tax') || t.includes('kapitalertrag')) return 'steuer'
  if (t.includes('gebühr') || t.includes('fee') || t.includes('entgelt')) return 'gebuehr'
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
  if (isin && isin.startsWith('DE')) return 'etf'
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
}): Promise<string> {
  const payload = [
    parts.datum,
    parts.typ,
    parts.isin ?? '',
    parts.stueck != null ? parts.stueck.toFixed(8) : '',
    parts.betragEur.toFixed(2),
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
