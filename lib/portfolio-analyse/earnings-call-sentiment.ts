/**
 * Earnings-Call Sentiment −100…+100 aus KI-Zusammenfassung (oder Heuristik).
 */

/** Explizite Score-Zeile aus dem Prompt (bevorzugt). */
export function parseSentimentScoreAusText(text: string): number | null {
  if (!text) return null
  // LLMs schreiben oft „SENTIMENT_SCORE: +50“ — Pluszeichen muss erlaubt sein.
  const patterns = [
    /SENTIMENT[_\s-]*SCORE\s*[:=]\s*([+-]?\d{1,3})/i,
    /Sentiment(?:-Score)?\s*[:=]\s*([+-]?\d{1,3})\s*(?:\/\s*100)?/i,
    /Stimmung(?:sscore)?\s*[:=]\s*([+-]?\d{1,3})/i,
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
    'herausragend',
    'außerordentlich',
    'ausserordentlich',
    'exzellent',
    'starkes wachstum',
    'über den erwartungen',
    'ueber den erwartungen',
    'übertrifft',
    'uebertrifft',
    'beat',
    'anhebung',
    'guidance angehoben',
    'prognose angehoben',
    'rekord',
    'robuste nachfrage',
    'margin expansion',
    'buyback',
    'moat gestärkt',
    'confident',
    'raised guidance',
    'strong demand',
    'vervierfacht',
    'selbstbewusst',
  ]
  // Kein nacktes „risiko“ — steht in jedem kritischen Memo und invertiert sonst starke Calls.
  const negativ = [
    'vorsichtig',
    'enttäusch',
    'unter den erwartungen',
    'miss',
    'senkung',
    'guidance gesenkt',
    'prognose gesenkt',
    'kostenüberschreitung',
    'kostenexplosion',
    'abschreibung',
    'klage',
    'katastrophal',
    'herausfordernd',
    'schwäche',
    'schwaeche',
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

  // Executive Summary stärker gewichten (erste ~1200 Zeichen)
  const exec = t.slice(0, Math.min(1200, t.length))
  for (const w of positiv) {
    if (exec.includes(w)) score += 8
  }
  for (const w of negativ) {
    if (exec.includes(w)) score -= 6
  }

  return Math.max(-100, Math.min(100, Math.round(score)))
}

export function sentimentScoreAusZusammenfassung(
  text: string,
  gespeichert?: number | null,
): number {
  const parsed = parseSentimentScoreAusText(text)
  if (parsed != null) return parsed
  const heur = heuristikSentimentScore(text)
  if (gespeichert != null && Number.isFinite(gespeichert)) {
    // Alte Invertierungen: Store stark negativ, Text/Heuristik positiv → Heuristik
    if (gespeichert <= -25 && heur >= 5) return heur
    return Math.max(-100, Math.min(100, Math.round(gespeichert)))
  }
  return heur
}
