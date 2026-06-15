/** iXBRL / XBRL-Metadaten aus SEC-Berichtstext entfernen. */

const XBRL_ZEILE =
  /^(TRUE|FALSE)\s+\d{4}\s+Q[1-4]\b|^\d{10}$|^http:\/\/fasb\.org\/|^http:\/\/xbrl\.org\/|^https:\/\/xbrl\.org\//i

export function bereinigeIxbrlHtml(html: string): string {
  return html
    .replace(/<ix:header[\s\S]*?<\/ix:header>/gi, ' ')
    .replace(/<ix:hidden[\s\S]*?<\/ix:hidden>/gi, ' ')
    .replace(/<link\b[^>]*>/gi, ' ')
    .replace(/<meta\b[^>]*>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<div[^>]*style="[^"]*display\s*:\s*none[^"]*"[^>]*>[\s\S]*?<\/div>/gi, ' ')
}

export function istXbrlZeile(p: string): boolean {
  const t = p.trim()
  if (t.length < 8) return false
  if (XBRL_ZEILE.test(t)) return true
  if (/fasb\.org\/us-gaap/i.test(t)) return true
  if (/xbrl\.org/i.test(t)) return true
  if (/iso4217:|xbrli:|us-gaap:|dei:|goog:|msft:|aapl:/i.test(t) && t.length < 220) return true
  if (/\bMember$/i.test(t) && t.length < 180) return true
  if (/^[\d\s\-/]+(TRUE|FALSE)/i.test(t) && t.length < 120) return true
  const memberCount = (t.match(/Member\b/gi) ?? []).length
  if (memberCount >= 2 && t.length < 400) return true
  return false
}

export function filterXbrlMuell(text: string): string {
  const absaetze = text
    .split('\n\n')
    .map((p) => p.trim())
    .filter((p) => p.length >= 25 && !istXbrlZeile(p))

  const deduped: string[] = []
  const seen = new Set<string>()
  for (const p of absaetze) {
    const key = p.slice(0, 100)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(p)
  }

  return deduped.join('\n\n')
}

/** Heuristik: Text besteht überwiegend aus XBRL-Taxonomie statt Prosa. */
export function istXbrlMuell(text: string): boolean {
  if (text.length < 300) return false
  const sample = text.slice(0, 8000)
  let score = 0
  if (/fasb\.org\/us-gaap/i.test(sample)) score += 4
  if (/xbrli:shares|iso4217:usd/i.test(sample)) score += 3
  if ((sample.match(/\bMember\b/g) ?? []).length >= 4) score += 4
  if (/^(TRUE|FALSE)\s+\d{4}\s+Q[1-4]/m.test(sample)) score += 3

  const absaetze = sample.split('\n\n').filter((p) => p.trim().length > 20)
  const xbrlAbsaetze = absaetze.filter(istXbrlZeile).length
  if (absaetze.length > 0 && xbrlAbsaetze / absaetze.length > 0.45) score += 5

  return score >= 6
}
