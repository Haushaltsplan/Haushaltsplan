/**
 * Englisch fürs Video: Sektor/Branche und typische DE-Labels aus dem Export,
 * plus grober Leak-Check für gesprochenen Text.
 */

const SEKTOR_EN: Record<string, string> = {
  technologie: 'Technology',
  'basiskonsumgüter': 'Consumer Defensive',
  basiskonsumgueter: 'Consumer Defensive',
  'nicht-basiskonsumgüter': 'Consumer Cyclical',
  'nicht-basiskonsumgueter': 'Consumer Cyclical',
  finanzdienstleistungen: 'Financial Services',
  gesundheitswesen: 'Healthcare',
  industrials: 'Industrials',
  industrie: 'Industrials',
  grundstoffe: 'Basic Materials',
  energie: 'Energy',
  versorgungsunternehmen: 'Utilities',
  immobilien: 'Real Estate',
  kommunikation: 'Communication Services',
  'kommunikationsdienste': 'Communication Services',
}

const BRANCHE_EN: Record<string, string> = {
  halbleiter: 'Semiconductors',
  'halbleiterausrüstung': 'Semiconductor Equipment',
  'halbleiterausruestung': 'Semiconductor Equipment',
  software: 'Software',
  'anwendungssoftware': 'Application Software',
  'infrastruktursoftware': 'Infrastructure Software',
  'verbraucherelektronik': 'Consumer Electronics',
  biotechnologie: 'Biotechnology',
  'arzneimittelhersteller': 'Drug Manufacturers',
  banken: 'Banks',
  'kapitalmärkte': 'Capital Markets',
  'kapitalmaerkte': 'Capital Markets',
  versicherung: 'Insurance',
  einzelhandel: 'Retail',
  'interneteinzelhandel': 'Internet Retail',
  'autohersteller': 'Auto Manufacturers',
  luftfahrt: 'Aerospace & Defense',
  'öl & gas': 'Oil & Gas',
  'oel & gas': 'Oil & Gas',
  'bergbau & metalle': 'Mining & Metals',
}

/**
 * Deutsche Leak-Wörter (keine EN-Homonyme wie „was“/„die“).
 * Zusätzlich: Umlaute in klingtNachDeutsch.
 */
const DEUTSCH_LEAK =
  /\b(und|nicht|für|fuer|eine|einer|eines|oder|auch|noch|aber|wenn|warum|heute|morgen|gestern|unternehmen|aktie|aktien|umsatz|gewinn|dividende|bewertung|burggraben|kennzahlen|wachstum|risiko|risiken|zusammenfassung|fazit|überblick|ueberblick|jahre|prozent|technologie|halbleiter|geschäftsmodell|geschaeftsmodell|preissetzungsmacht|replikationsbarriere|wechselkosten|marktdichte)\b/i

export function sektorBrancheEnglisch(roh: string | null | undefined): string | null {
  if (!roh?.trim()) return null
  const t = roh.trim()
  const key = t.toLowerCase()
  if (SEKTOR_EN[key]) return SEKTOR_EN[key]!
  if (BRANCHE_EN[key]) return BRANCHE_EN[key]!
  // Schon Englisch (nur ASCII-Buchstaben und &/-)
  if (/^[A-Za-z0-9][A-Za-z0-9 &/'’.-]*$/.test(t) && !DEUTSCH_LEAK.test(t)) return t
  // Fallback: bekannte Teilstrings ersetzen
  let out = t
  for (const [de, en] of Object.entries({ ...SEKTOR_EN, ...BRANCHE_EN })) {
    out = out.replace(new RegExp(de, 'ig'), en)
  }
  return out
}

export function industrieZeileEnglisch(sektor: string | null, branche: string | null): string | null {
  const teile = [sektorBrancheEnglisch(sektor), sektorBrancheEnglisch(branche)].filter(Boolean) as string[]
  return teile.length ? teile.join(' · ') : null
}

/** true, wenn der Text wie Deutsch klingt (Umlaute oder häufige Funktionswörter). */
export function klingtNachDeutsch(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/[äöüÄÖÜß]/.test(t)) return true
  return DEUTSCH_LEAK.test(t)
}

/** Strenger als der Skript-Check: halb übersetzte Moat-Sätze zählen weiter als Deutsch. */
const BILD_DEUTSCH =
  /\b(die|der|das|den|dem|des|ein|eine|einer|eines|ist|sind|wird|werden|für|fuer|mit|von|auf|aus|bei|nach)\b|\b(erfordert|fertigung|investition|fabrik|halbleiter|milliarden|technisch)\w*/i

export function textIstDeutschFuerBild(text: string | null | undefined): boolean {
  const t = text?.trim() ?? ''
  if (!t) return false
  if (klingtNachDeutsch(t)) return true
  if (/^(die|der|das|den|ein|eine)\b/i.test(t)) return true
  return BILD_DEUTSCH.test(t)
}

/** Nur zurückgeben, wenn der Satz wirklich englisch ist. */
export function englischOderLeer(text: string | null | undefined): string | null {
  const t = text?.trim()
  if (!t || textIstDeutschFuerBild(t)) return null
  return t
}

/** Segmentnamen, die keine Produkt-/Geo-Labels sind (Jahreszeilen aus Filings). */
export function istMuellSegmentName(name: string): boolean {
  const t = name.trim()
  if (t.length < 2) return true
  return /^(for the year ended|year ended|für das jahr|fuer das jahr|gesamt|total|other|sonstige)\b/i.test(t)
}
