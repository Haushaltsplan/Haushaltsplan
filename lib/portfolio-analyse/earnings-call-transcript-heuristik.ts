/** Erkennt echte Earnings-Call-Transkripte (mit Q&A) vs. Pressemitteilung/Präsentation. */

const PRESS_ONLY = /\bpress release\b|\bearnings release\b|\bfinancial results\b.*\breport\b/i

const CALL_SIGNALS = [
  /\bconference call transcript\b/i,
  /\bearnings call transcript\b/i,
  /\bquestion[- ]and[- ]answer\b/i,
  /\bq\s*&\s*a\s+session\b/i,
  /\bquestions and answers\b/i,
  /\bconference operator\b/i,
  /\boperator:\s/i,
  /\bAnalyst\b.*\?/i,
  /\bChief Financial Officer\b.*\n.*\?/i,
  /\bfragen und antworten\b/i,
  /\bkonferenzgespräch\b/i,
  /\bkonferenzgespraech\b/i,
  /\bquartalsgespräch\b/i,
  /\bquartalsgespraech\b/i,
  /\bconférence téléphonique\b/i,
  /\bquestions?[- ]r[eé]ponses?\b/i,
]

/** Link-Text/URL — explizites Transkript, keine reine Pressemitteilung. */
export function istTranskriptLinkStreng(text: string, href: string): boolean {
  const combined = `${text} ${href}`.toLowerCase()
  if (/presentation|investor deck|slides|10-q|10-k|annual report/i.test(combined)) {
    if (!/transcript|conference call|earnings call/i.test(combined)) return false
  }
  if (PRESS_ONLY.test(combined) && !/transcript|conference call|earnings call|webcast transcript/i.test(combined)) {
    return false
  }
  if (
    /transcript|transkript|conference call|earnings call|webcast transcript|call transcript|prepared remarks|konferenz|quartalsgespr/i.test(
      combined,
    )
  ) {
    return true
  }
  return false
}

/** Rohtext — typische Merkmale eines Calls inkl. Q&A. */
export function istEarningsCallTranskript(text: string): boolean {
  const sample = text.slice(0, 120_000)
  if (sample.length < 800) return false

  let score = 0
  for (const re of CALL_SIGNALS) {
    if (re.test(sample)) score++
  }

  const speakerLines = (sample.match(/\n[A-Z][A-Za-z .'-]{2,40}:\s/g) || []).length
  if (speakerLines >= 8) score++
  if ((sample.match(/\?\s*\n/g) || []).length >= 4) score++

  if (/conference call transcript|earnings call transcript/i.test(sample)) return true
  return score >= 2
}

export function istPresseMitteilung(text: string): boolean {
  const head = text.slice(0, 4000)
  if (PRESS_ONLY.test(head) && !istEarningsCallTranskript(text)) return true
  if (/for immediate release/i.test(head) && !istEarningsCallTranskript(text)) return true
  return false
}
