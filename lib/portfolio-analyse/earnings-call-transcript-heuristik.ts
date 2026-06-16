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
  /\bpublic transcript\b/i,
  /\binvestor call\b/i,
  /\bresults conference call\b/i,
  /\bresults video\b/i,
  /\bspeaker \d+:/i,
]

/** Link-Text/URL — explizites Transkript oder Webcast-PDF (EU-IR). */
export function istTranskriptLinkStreng(text: string, href: string): boolean {
  const combined = `${text} ${href}`.toLowerCase()
  if (istWebcastDokumentLink(text, href)) return true
  if (/presentation|investor deck|slides|10-q|10-k|annual report/i.test(combined)) {
    if (!/transcript|conference call|earnings call|webcast/i.test(combined)) return false
  }
  if (PRESS_ONLY.test(combined) && !/transcript|conference call|earnings call|webcast transcript|webcast|revenue_q/i.test(combined)) {
    return false
  }
  if (
    /transcript|transkript|conference call|earnings call|webcast transcript|call transcript|prepared remarks|konferenz|quartalsgespr|investor call|investor-call/i.test(
      combined,
    )
  ) {
    return true
  }
  if (/\.pdf(\?|$)/i.test(href) && /transcript|investor-call|results-video-transcript/i.test(combined)) {
    return true
  }
  return false
}

/** Webcast-, Präsentations- oder Ergebnis-PDF (z. B. Hermès finance.hermes.com). */
export function istWebcastDokumentLink(text: string, href: string): boolean {
  const combined = `${text} ${href}`.toLowerCase()
  if (!/\.pdf(\?|$)/i.test(href) && !/assets-finance\.hermes\.com/i.test(href)) return false
  if (/webcast|replay|analyst conference|results presentation|investor presentation|message.*executive|executive management/i.test(combined)) {
    return true
  }
  if (/revenue_q[1-4]|ca_t[1-4]|_t[1-4]_|chiffre.*affaires|half.?year|semest/i.test(combined)) return true
  if (/assets-finance\.hermes\.com/i.test(href) && /revenue|webcast|presentation|message|publishing|urd|ca_t|ca_s/i.test(combined)) {
    return true
  }
  return false
}

/** Rohtext — volles Transkript oder Webcast-/Ergebnis-PDF (ohne Q&A-Pflicht). */
export function istWebcastDokumentText(text: string): boolean {
  if (istEarningsCallTranskript(text)) return true
  const sample = text.slice(0, 80_000)
  if (sample.length < 1_000) return false

  let score = 0
  if (/revenue|turnover|chiffre d'affaires|chiffre d affaires|at constant exchange rates|sales at constant/i.test(sample)) {
    score += 2
  }
  if (/hermes international|executive management|financial communication|analyst conference|webcast/i.test(sample)) {
    score += 1
  }
  if (/\d{1,3}[,.]\d+\s*(million|milliard|bn|m€|%)/i.test(sample)) score += 1
  if (/presentation|prepared remarks|message from/i.test(sample)) score += 1
  return score >= 2
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
