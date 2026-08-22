/** Unit Economics — Regex-Extraktion aus Berichtstexten (LTV/CAC, NRR). */

export type UnitEconomicsTreffer = {
  ltvCac: number | null
  nrrPct: number | null
  grossRetentionPct: number | null
  quelle: 'sec_10q' | 'sec_10k' | 'earnings_call' | null
  periode: string | null
  snippet: string | null
  hinweis: string | null
}

const LEER: UnitEconomicsTreffer = {
  ltvCac: null,
  nrrPct: null,
  grossRetentionPct: null,
  quelle: null,
  periode: null,
  snippet: null,
  hinweis: null,
}

function normalisiereRatio(raw: string): number | null {
  const n = parseFloat(raw.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0 || n > 50) return null
  return Math.round(n * 10) / 10
}

function normalisiereProzent(raw: string): number | null {
  const n = parseFloat(raw.replace(',', '.'))
  if (!Number.isFinite(n) || n < 50 || n > 200) return null
  return Math.round(n * 10) / 10
}

function snippetUmMatch(text: string, index: number, len = 120): string {
  const start = Math.max(0, index - 40)
  const end = Math.min(text.length, index + len)
  return text.slice(start, end).replace(/\s+/g, ' ').trim()
}

type RegexTreffer = { wert: number; index: number; label: string }

function ersteRatio(text: string, patterns: RegExp[], label: string): RegexTreffer | null {
  for (const re of patterns) {
    re.lastIndex = 0
    const m = re.exec(text)
    if (!m?.[1]) continue
    const wert = normalisiereRatio(m[1])
    if (wert != null) return { wert, index: m.index, label }
  }
  return null
}

function ersteProzent(text: string, patterns: RegExp[], label: string): RegexTreffer | null {
  for (const re of patterns) {
    re.lastIndex = 0
    const m = re.exec(text)
    if (!m?.[1]) continue
    const wert = normalisiereProzent(m[1])
    if (wert != null) return { wert, index: m.index, label }
  }
  return null
}

const LTV_CAC_PATTERNS = [
  /LTV\s*(?:to|-)?\s*CAC\s*(?:ratio\s*)?(?:of\s*|was\s*|is\s*|at\s*|approximately\s*|~)?\s*(\d+(?:\.\d+)?)\s*(?:x|×|:1)?/gi,
  /LTV\s*\/\s*CAC\s*(?:ratio\s*)?(?:of\s*|was\s*|is\s*|at\s*)?\s*(\d+(?:\.\d+)?)\s*(?:x|×|:1)?/gi,
  /(\d+(?:\.\d+)?)\s*(?:x|×)\s*LTV\s*(?:to|-)?\s*CAC/gi,
  /lifetime\s*value\s*(?:to|-)?\s*customer\s*acquisition\s*cost\s*(?:ratio\s*)?(?:of\s*|was\s*|is\s*|at\s*)?\s*(\d+(?:\.\d+)?)/gi,
  /customer\s*acquisition\s*cost\s*(?:to|-)?\s*lifetime\s*value\s*(?:ratio\s*)?(?:of\s*|was\s*|is\s*)?\s*(\d+(?:\.\d+)?)/gi,
]

const NRR_PATTERNS = [
  /net\s*revenue\s*retention\s*(?:rate\s*)?(?:of\s*|was\s*|is\s*|at\s*|of\s*)?\s*(\d+(?:\.\d+)?)\s*%/gi,
  /net\s*retention\s*(?:rate\s*)?(?:of\s*|was\s*|is\s*|at\s*)?\s*(\d+(?:\.\d+)?)\s*%/gi,
  /NRR\s*(?:of\s*|was\s*|is\s*|at\s*|rate\s*)?\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*%/gi,
  /dollar[- ]based\s*net\s*retention\s*(?:rate\s*)?(?:of\s*|was\s*|is\s*|at\s*)?\s*(\d+(?:\.\d+)?)\s*%/gi,
  /dollar[- ]based\s*retention\s*(?:rate\s*)?(?:of\s*|was\s*|is\s*|at\s*)?\s*(\d+(?:\.\d+)?)\s*%/gi,
  /subscription\s*net\s*retention\s*(?:rate\s*)?(?:of\s*|was\s*|is\s*|at\s*)?\s*(\d+(?:\.\d+)?)\s*%/gi,
  /(\d+(?:\.\d+)?)\s*%\s*(?:dollar[- ]based\s*)?net\s*(?:revenue\s*)?retention/gi,
]

const GRR_PATTERNS = [
  /gross\s*revenue\s*retention\s*(?:rate\s*)?(?:of\s*|was\s*|is\s*|at\s*)?\s*(\d+(?:\.\d+)?)\s*%/gi,
  /GRR\s*(?:of\s*|was\s*|is\s*|at\s*)?\s*(\d+(?:\.\d+)?)\s*%/gi,
  /subscription\s*renewal\s*rate\s*(?:of\s*|was\s*|is\s*|at\s*)?\s*(\d+(?:\.\d+)?)\s*%/gi,
  /renewal\s*rate\s*(?:of\s*|was\s*|is\s*|at\s*)?\s*(\d+(?:\.\d+)?)\s*%/gi,
]

/** Extrahiert freiwillig genannte SaaS-Kennzahlen aus Fließtext. */
export function extrahiereUnitEconomicsAusText(
  text: string,
  quelle: UnitEconomicsTreffer['quelle'],
  periode?: string | null,
): UnitEconomicsTreffer {
  if (!text || text.length < 80) {
    return { ...LEER, quelle, periode: periode ?? null, hinweis: 'Kein ausreichender Text.' }
  }

  const probe = text.slice(0, 250_000)
  const ltvHit = ersteRatio(probe, LTV_CAC_PATTERNS, 'LTV/CAC')
  const nrrHit = ersteProzent(probe, NRR_PATTERNS, 'NRR')
  const grrHit = ersteProzent(probe, GRR_PATTERNS, 'GRR')

  if (!ltvHit && !nrrHit && !grrHit) {
    return {
      ...LEER,
      quelle,
      periode: periode ?? null,
      hinweis: 'LTV/CAC im Text nicht explizit genannt.',
    }
  }

  const idx = ltvHit?.index ?? nrrHit?.index ?? grrHit!.index
  const teile: string[] = []
  if (ltvHit) teile.push(`LTV/CAC ${ltvHit.wert}×`)
  if (nrrHit) teile.push(`NRR ${nrrHit.wert} %`)
  if (grrHit) teile.push(`GRR ${grrHit.wert} %`)

  return {
    ltvCac: ltvHit?.wert ?? null,
    nrrPct: nrrHit?.wert ?? null,
    grossRetentionPct: grrHit?.wert ?? null,
    quelle,
    periode: periode ?? null,
    snippet: snippetUmMatch(probe, idx),
    hinweis: teile.length ? `Aus Text extrahiert: ${teile.join(', ')}.` : null,
  }
}

export function mergeUnitEconomicsTreffer(
  kandidaten: UnitEconomicsTreffer[],
): UnitEconomicsTreffer {
  if (kandidaten.length === 0) {
    return { ...LEER, hinweis: 'Keine Unit-Metrics in SEC oder Earnings Call gefunden.' }
  }

  // Felder aus allen Treffern kombinieren (nicht ersten LTV-Hit allein nehmen).
  let ltvCac: number | null = null
  let nrrPct: number | null = null
  let grossRetentionPct: number | null = null
  let quelle: UnitEconomicsTreffer['quelle'] = null
  let periode: string | null = null
  let snippet: string | null = null
  const hinweise: string[] = []

  for (const k of kandidaten) {
    if (ltvCac == null && k.ltvCac != null) {
      ltvCac = k.ltvCac
      quelle = k.quelle
      periode = k.periode
      snippet = k.snippet
    }
    if (nrrPct == null && k.nrrPct != null) {
      nrrPct = k.nrrPct
      if (!quelle) {
        quelle = k.quelle
        periode = k.periode
        snippet = k.snippet
      }
    }
    if (grossRetentionPct == null && k.grossRetentionPct != null) {
      grossRetentionPct = k.grossRetentionPct
      if (!quelle) {
        quelle = k.quelle
        periode = k.periode
        snippet = k.snippet
      }
    }
    if (k.hinweis) hinweise.push(k.hinweis)
  }

  if (ltvCac == null && nrrPct == null && grossRetentionPct == null) {
    return (
      kandidaten.find((k) => k.hinweis) ?? {
        ...LEER,
        hinweis: 'Keine Unit-Metrics in SEC oder Earnings Call gefunden.',
      }
    )
  }

  const teile: string[] = []
  if (ltvCac != null) teile.push(`LTV/CAC ${ltvCac}×`)
  if (nrrPct != null) teile.push(`NRR ${nrrPct} %`)
  if (grossRetentionPct != null) teile.push(`GRR/Renewal ${grossRetentionPct} %`)

  return {
    ltvCac,
    nrrPct,
    grossRetentionPct,
    quelle,
    periode,
    snippet,
    hinweis: teile.length
      ? `Aus Text extrahiert: ${teile.join(', ')}.`
      : hinweise[0] ?? null,
  }
}
