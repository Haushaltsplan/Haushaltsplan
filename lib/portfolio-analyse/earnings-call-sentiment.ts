/**
 * Earnings-Call Sentiment −100…+100 aus KI-Zusammenfassung (oder Heuristik).
 */

/** Explizite Score-Zeile aus dem Prompt (bevorzugt). */
export function parseSentimentScoreAusText(text: string): number | null {
  if (!text) return null
  const patterns = [
    /SENTIMENT[_\s-]*SCORE\s*[:=]\s*(-?\d{1,3})/i,
    /Sentiment(?:-Score)?\s*[:=]\s*(-?\d{1,3})\s*(?:\/\s*100)?/i,
    /Stimmung(?:sscore)?\s*[:=]\s*(-?\d{1,3})/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (!m?.[1]) continue
    const n = parseInt(m[1], 10)
    if (!Number.isFinite(n)) continue
    return Math.max(-100, Math.min(100, n))
  }
  return null
}

/** Fallback-Heuristik aus deutsch/englischen Stichworten (ohne LLM). */
export function heuristikSentimentScore(text: string): number {
  if (!text || text.length < 40) return 0
  const t = text.toLowerCase()

  const positiv = [
    'optimistisch',
    'zuversichtlich',
    'starkes wachstum',
    'über den erwartungen',
    'beat',
    'anhebung',
    'guidance angehoben',
    'rekord',
    'robuste nachfrage',
    'margin expansion',
    'buyback',
    'moat gestärkt',
    'confident',
    'raised guidance',
    'strong demand',
  ]
  const negativ = [
    'vorsichtig',
    'enttäusch',
    'unter den erwartungen',
    'miss',
    'senkung',
    'guidance gesenkt',
    'kostenüberschreitung',
    'kostenexplosion',
    'abschreibung',
    'klage',
    'risiko',
    'herausfordernd',
    'schwäche',
    'lowered guidance',
    'headwind',
    'uncertainty',
    'restructuring',
  ]

  let score = 0
  for (const w of positiv) {
    if (t.includes(w)) score += 12
  }
  for (const w of negativ) {
    if (t.includes(w)) score -= 14
  }

  // Executive Summary stärker gewichten
  const exec = t.slice(0, Math.min(1200, t.length))
  for (const w of positiv) {
    if (exec.includes(w)) score += 6
  }
  for (const w of negativ) {
    if (exec.includes(w)) score -= 8
  }

  return Math.max(-100, Math.min(100, Math.round(score)))
}

export function sentimentScoreAusZusammenfassung(text: string): number {
  return parseSentimentScoreAusText(text) ?? heuristikSentimentScore(text)
}
