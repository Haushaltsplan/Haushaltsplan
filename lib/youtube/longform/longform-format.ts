/** Englische Zahlenformate fürs Video. Dieselben Funktionen bauen Fakten und prüfen das Skript. */

function usdZahl(v: number): string {
  const gerundet = Math.round(v * 10) / 10
  const ganz = Number.isInteger(gerundet)
  return gerundet.toLocaleString('en-US', {
    minimumFractionDigits: ganz ? 0 : 1,
    maximumFractionDigits: ganz ? 0 : 1,
  })
}

/** $12.4 billion, $860 million, $34,210 — nicht $12.40B. */
export function usd(n: number): string {
  const abs = Math.abs(n)
  const vz = n < 0 ? '-' : ''
  const wort = (div: number, name: string) => {
    return `${vz}$${usdZahl(abs / div)} ${name}`
  }
  if (abs >= 1e12) return wort(1e12, 'trillion')
  if (abs >= 1e9) return wort(1e9, 'billion')
  if (abs >= 1e6) return wort(1e6, 'million')
  return `${vz}$${Math.round(abs).toLocaleString('en-US')}`
}

/** Chart-Achse: $12.4B, eine Nachkommastelle, kein $12.40B. */
export function usdKurz(n: number): string {
  const abs = Math.abs(n)
  const vz = n < 0 ? '-' : ''
  if (abs >= 1e12) return `${vz}$${usdZahl(abs / 1e12)}T`
  if (abs >= 1e9) return `${vz}$${usdZahl(abs / 1e9)}B`
  if (abs >= 1e6) return `${vz}$${usdZahl(abs / 1e6)}M`
  return `${vz}$${Math.round(abs).toLocaleString('en-US')}`
}

const USD_SUFFIX: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }

/** $12.40B im schon gespeicherten Text → $12.4 billion. Der Suffix trägt die Größenordnung. */
export function dollarKompakt(text: string): string {
  return text.replace(/-?\$[\d,.]+\s*[KMBT]\b/gi, (token) => {
    const m = token.match(/^(-?)\$([\d,.]+)\s*([KMBT])$/i)
    if (!m) return token
    const n = Number(m[2]!.replace(/,/g, ''))
    const mult = USD_SUFFIX[m[3]!.toLowerCase()]
    if (!Number.isFinite(n) || mult == null) return token
    return usd((m[1] ? -1 : 1) * n * mult)
  })
}

/** Kompakte $-Kürzel ausschreiben. Ein nacktes $10,000 bleibt über den Rohwert gruppiert. */
export function dollarImText(text: string, wert: number | null): string {
  if (!text.includes('$')) return text
  const ausgeschrieben = dollarKompakt(text)
  if (ausgeschrieben !== text) return ausgeschrieben
  if (wert != null && Number.isFinite(wert) && /^\s*-?\$[\d,.]+\s*$/.test(text)) return usd(wert)
  return text
}

export function pct(n: number, opts?: { vorzeichen?: boolean }): string {
  const r = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10
  const s = String(r)
  return `${opts?.vorzeichen && r > 0 ? '+' : ''}${s}%`
}

export function multiple(n: number): string {
  return `${Math.round(n * 10) / 10}x`
}

export function monatJahr(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** Deutsche Anzeige aus der Scorecard („17,93 %“, „20 J. ohne Senkung“) für englische Grafiken. */
export function scorecardTextEnglisch(roh: string): string {
  return roh
    .replace(/(\d)\.(\d{3})(?!\d)/g, '$1,$2')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\s*%/g, '%')
    .replace(/\bJ\.\s*ohne Senk\w*\.?/gi, 'y without a cut')
    .replace(/\bJ\./g, 'y')
    .replace(/\bPp\./gi, 'pp')
    .replace(/\bpp\./gi, 'pp')
    .replace(/\bWarnung\b/gi, 'Warning')
    .replace(/\bwarnung\b/gi, 'warning')
    .replace(/\bbeobachten\b/gi, 'watch')
    .replace(/\bkapitalleicht\b/gi, 'asset-light')
    .replace(/\bKapitalleicht\b/gi, 'Asset-light')
    .replace(/\bkeine Daten\b/gi, 'no data')
    .replace(/\bintakt\b/gi, 'intact')
    .replace(/\berodiert\b/gi, 'eroding')
    .replace(/\bklass\.\s*/gi, 'classic ')
    .replace(/\bPerz\.\s*/gi, 'pctl. ')
    .replace(/\bkein COGS\b/gi, 'no COGS')
    .replace(/\bgruen\b/gi, 'green')
    .replace(/\bgelb\b/gi, 'yellow')
    .replace(/\brot\b/gi, 'red')
    .replace(/\bgesamt\b/gi, 'total')
    .replace(/\bStabilität\b/gi, 'stability')
    .replace(/\bStabilitaet\b/gi, 'stability')
    .replace(/\bWachstum\b/gi, 'growth')
    .replace(/\bQualität\b/gi, 'quality')
    .replace(/\bQualitaet\b/gi, 'quality')
    .replace(/\bTilgung\b/gi, 'paydown')
    .replace(/\bAusschüttung\b/gi, 'payout')
    .replace(/\bAusschuettung\b/gi, 'payout')
    .replace(/\bGeschäft\b/gi, 'Business')
    .replace(/\bGeschaeft\b/gi, 'Business')
    .replace(/\bBurggraben\b/gi, 'Moat')
    .replace(/\bUmsatz\b/gi, 'Revenue')
    .replace(/\bGewinn\b/gi, 'Earnings')
}

/** Moat-/Geschäftsmodell-Freitext: DE-Reste raus, Kurzform für On-Screen. */
export function moatTextEnglisch(roh: string | null | undefined): string | null {
  if (!roh?.trim()) return null
  const t = scorecardTextEnglisch(roh.trim())
    .replace(/\bGeschäftsmodell\b/gi, 'Business model')
    .replace(/\bGeschaeftsmodell\b/gi, 'Business model')
    .replace(/\bKunden\b/gi, 'customers')
    .replace(/\bProdukte\b/gi, 'products')
    .replace(/\bund\b/gi, 'and')
  return t.length > 220 ? `${t.slice(0, 217).trim()}…` : t
}

/** Alle Zahlen eines Textes, normalisiert („58,240“ → 58240, „1.2B“ → 1.2e9). */
export function zahlenImText(text: string): { roh: string; wert: number; einheit: 'pct' | 'usd' | 'x' | 'zahl' }[] {
  const out: { roh: string; wert: number; einheit: 'pct' | 'usd' | 'x' | 'zahl' }[] = []
  const re = /(\$)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(%|percent|x\b|times\b|[KMBT]\b|thousand|million|billion|trillion)?/gi
  for (const m of text.matchAll(re)) {
    const dollar = Boolean(m[1])
    let wert = Number(m[2]!.replace(/,/g, ''))
    if (!Number.isFinite(wert)) continue
    const suffix = (m[3] ?? '').toLowerCase()
    if (suffix === 'k' || suffix === 'thousand') wert *= 1e3
    if (suffix === 'm' || suffix === 'million') wert *= 1e6
    if (suffix === 'b' || suffix === 'billion') wert *= 1e9
    if (suffix === 't' || suffix === 'trillion') wert *= 1e12
    const einheit = suffix === '%' || suffix === 'percent' ? 'pct' : suffix === 'x' || suffix === 'times' ? 'x' : dollar ? 'usd' : 'zahl'
    out.push({ roh: m[0]!.trim(), wert, einheit })
  }
  return out
}
