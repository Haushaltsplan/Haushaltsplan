import { PORTFOLIO_MAX_BUCHUNGEN } from '@/lib/portfolio-analyse/limits'
import { bereinigeFreitext } from '@/lib/portfolio-analyse/parse-hilfen'
import type { PortfolioBuchung, PortfolioPositionSnapshot } from '@/lib/portfolio-analyse/types'

export const PII_BLOCKLIST_STORAGE_KEY = 'mein-haushalt:portfolio-pii-blocklist'

/** Bekannte Firmen-/Fonds-Suffixe — dann ist „Zwei Wörter“ kein Personenname. */
const UNTERNEHMENS_SUFFIX =
  /\b(GmbH|GmbH & Co|AG|SE|N\.V\.|N\. V\.|Inc\.?|Ltd\.?|PLC|Co\.|KG|UCITS|ETF|Holdings?|Group|Corporation|Corp\.?|S\.A\.|S\.p\.A\.|PLC|LP|Trust|Fund|Index|Bond|Anleihe)\b/i

const PII_MUSTER: RegExp[] = [
  /\bDE\d{20}\b/i,
  /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/,
  /\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß][a-zäöüß\s-]{2,}\b/,
  /\b\d{1,4}\s*,?\s*(?:Str\.|Straße|Strasse|Weg|Platz|Allee|Ring)\b/i,
  /\b(Herr|Frau|Hr\.|Fr\.|Herrn|Frau)\s+[A-ZÄÖÜ]/i,
  /\b(Depot|Konto|Kunden|Referenz|Vertrags|Steuer)[- ]?(inhaber|nummer|nr\.?)\b/i,
  /\bgeb\.?\s*\d/i,
  /\bgeburtsdatum\b/i,
  /\b[A-ZÄÖÜ][a-zäöüß]+straße\b/i,
  /\bTrade\s*Republic\s*(Konto|Depot)\b/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\+?\d[\d\s\-/]{8,}\d/,
  /\bDE\d{9,12}\b/,
]

const BESCHREIBUNG_NUR_PERSON =
  /^(überweisung|ueberweisung|einzahlung|auszahlung|gutschrift|lastschrift|transfer)\b/i

export function ladePiiBlockliste(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PII_BLOCKLIST_STORAGE_KEY) ?? ''
    return raw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
  } catch {
    return []
  }
}

export function speicherePiiBlockliste(zeilen: string[]): void {
  if (typeof window === 'undefined') return
  const text = zeilen
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .join(', ')
  try {
    if (text) localStorage.setItem(PII_BLOCKLIST_STORAGE_KEY, text)
    else localStorage.removeItem(PII_BLOCKLIST_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function normalisiereVergleich(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function trifftBlockliste(text: string, blocklist: string[]): boolean {
  const n = normalisiereVergleich(text)
  for (const b of blocklist) {
    const bn = normalisiereVergleich(b)
    if (bn.length >= 2 && n.includes(bn)) return true
  }
  return false
}

function siehtAusWiePersonenname(fragment: string): boolean {
  const t = fragment.trim()
  if (t.length < 4 || UNTERNEHMENS_SUFFIX.test(t)) return false
  if (/\b(ISIN|Stk|Trade Republic|Kapitalertrag|Dividende)\b/i.test(t)) return false
  const zweiWoerter = t.match(/\b([A-ZÄÖÜ][a-zäöüß-]{1,30})\s+([A-ZÄÖÜ][a-zäöüß-]{1,30})\b/)
  if (!zweiWoerter) return false
  const w1 = zweiWoerter[1]
  const w2 = zweiWoerter[2]
  const verdaechtigeVornamen =
    /^(von|van|de|der|und|für|bei|aus|dem|den|die|das|mit|nach|per|an)$/i
  if (verdaechtigeVornamen.test(w1) || verdaechtigeVornamen.test(w2)) return false
  return true
}

/** Prüft Freitext auf personenbezogene Muster (inkl. optionaler Blockliste). */
export function enthaeltPersonenbezogeneDaten(text: string, blocklist: string[] = []): boolean {
  if (!text.trim()) return false
  const t = bereinigeFreitext(text)
  if (trifftBlockliste(t, blocklist)) return true
  for (const re of PII_MUSTER) {
    if (re.test(t)) return true
  }
  if (siehtAusWiePersonenname(t)) return true
  return false
}

export function piiWarnungFuerText(text: string | null | undefined, blocklist: string[]): string | null {
  if (!text?.trim()) return null
  if (enthaeltPersonenbezogeneDaten(text, blocklist)) {
    return 'Mögliche personenbezogene Angabe — bitte abwählen oder aus Blockliste entfernen.'
  }
  return null
}

/** Wertpapiername nur wenn sicher kein PII; sonst null (Anzeige nur über ISIN). */
export function sichererWertpapierName(name: string | null | undefined, blocklist: string[]): string | null {
  if (!name?.trim()) return null
  let t = bereinigeFreitext(name.trim())
  if (t.length < 2) return null
  if (enthaeltPersonenbezogeneDaten(t, blocklist)) return null
  if (t.length > 100) t = t.slice(0, 100).trim()
  return t
}

export function beschreibungZuPersonenbezogen(beschreibung: string, blocklist: string[]): boolean {
  const t = beschreibung.trim()
  if (!t) return false
  if (enthaeltPersonenbezogeneDaten(t, blocklist)) {
    if (/\bISIN\b/i.test(t) || /\b[A-Z]{2}[A-Z0-9]{10}\b/.test(t)) return false
    if (BESCHREIBUNG_NUR_PERSON.test(t)) return true
    if (siehtAusWiePersonenname(t)) return true
    return true
  }
  return false
}

export function bereiteBuchungFuerSpeicherung(
  b: PortfolioBuchung,
  blocklist: string[],
): PortfolioBuchung | null {
  if (beschreibungZuPersonenbezogen(b.wertpapierName ?? '', blocklist) && !b.isin) {
    if (b.typ === 'einzahlung' || b.typ === 'auszahlung' || b.typ === 'sonstiges') {
      return {
        ...b,
        wertpapierName: null,
      }
    }
  }

  const name = sichererWertpapierName(b.wertpapierName, blocklist)
  const gesamt = [name, b.isin, String(b.betragEur)].filter(Boolean).join(' ')
  if (enthaeltPersonenbezogeneDaten(gesamt, blocklist) && !b.isin) {
    return null
  }

  return { ...b, wertpapierName: name }
}

export function bereitePositionFuerSpeicherung(
  p: PortfolioPositionSnapshot,
  blocklist: string[],
): PortfolioPositionSnapshot | null {
  const name = sichererWertpapierName(p.name, blocklist)
  const label = name ?? (p.isin ? `Wertpapier ${p.isin}` : null)
  if (!label) return null
  if (enthaeltPersonenbezogeneDaten(label, blocklist)) return null
  return { ...p, name: label }
}

export function validiereSpeicherPayload(
  buchungen: PortfolioBuchung[],
  positionen: PortfolioPositionSnapshot[],
  blocklist: string[],
): { ok: true } | { ok: false; grund: string } {
  if (buchungen.length > PORTFOLIO_MAX_BUCHUNGEN) {
    return {
      ok: false,
      grund: `Maximal ${PORTFOLIO_MAX_BUCHUNGEN.toLocaleString('de-DE')} Buchungen auf einmal — bitte in mehreren Schritten importieren.`,
    }
  }
  for (const b of buchungen) {
    if (b.wertpapierName && enthaeltPersonenbezogeneDaten(b.wertpapierName, blocklist)) {
      return { ok: false, grund: 'Eine Buchung enthält noch personenbezogene Texte im Namen.' }
    }
  }
  for (const p of positionen) {
    if (enthaeltPersonenbezogeneDaten(p.name, blocklist)) {
      return { ok: false, grund: 'Eine Position enthält noch personenbezogene Angaben im Namen.' }
    }
  }
  return { ok: true }
}

export function buchungPiiWarnung(b: PortfolioBuchung, blocklist: string[]): string | null {
  return piiWarnungFuerText(b.wertpapierName, blocklist)
}

export function positionPiiWarnung(p: PortfolioPositionSnapshot, blocklist: string[]): string | null {
  return piiWarnungFuerText(p.name, blocklist)
}

export function positionSchluessel(p: PortfolioPositionSnapshot): string {
  return p.isin ?? `n:${p.name}:${p.stueck}`
}
