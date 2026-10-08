/**
 * 5-Jahres-Aktien-Beta vs. Markt (OLS), Yahoo-ähnlich:
 * monatliche Total-Return-Renditen (adj. closes), β = Cov(rᵢ,rₘ) / Var(rₘ).
 */

export const BETA_MIN_MONATE = 36
export const BETA_ZIEL_MONATE = 60
/** Preise für 60 Renditen → 61 Monatsenden; Puffer für Feiertage/Lücken. */
export const BETA_PREIS_FENSTER_MONATE = 66

export type BetaBerechnungErgebnis = {
  beta: number
  monate: number
  marktSymbol: string
}

function mittel(werte: number[]): number {
  let s = 0
  for (const v of werte) s += v
  return s / werte.length
}

/** Monatsrenditen aus chronologisch sortierten Preisen (adj.). */
export function monatsRenditenAusPreisen(preise: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < preise.length; i++) {
    const a = preise[i - 1]!
    const b = preise[i]!
    if (!(a > 0) || !(b > 0)) continue
    out.push(b / a - 1)
  }
  return out
}

/**
 * OLS-Beta aus gepaarten Renditen (gleiche Länge, zeitlich aligned).
 * Sample-Kovarianz/-Varianz (n−1), wie üblich bei Finanz-Betas.
 */
export function berechneOlsBeta(
  aktienRenditen: number[],
  marktRenditen: number[],
  opts?: { minMonate?: number; maxBeta?: number },
): number | null {
  const minMonate = opts?.minMonate ?? BETA_MIN_MONATE
  const maxBeta = opts?.maxBeta ?? 5
  const n = Math.min(aktienRenditen.length, marktRenditen.length)
  if (n < minMonate) return null

  const rI = aktienRenditen.slice(-n)
  const rM = marktRenditen.slice(-n)
  const meanI = mittel(rI)
  const meanM = mittel(rM)

  let cov = 0
  let varM = 0
  for (let i = 0; i < n; i++) {
    const dI = rI[i]! - meanI
    const dM = rM[i]! - meanM
    cov += dI * dM
    varM += dM * dM
  }
  const denom = n - 1
  if (denom <= 0 || !(varM > 0)) return null
  cov /= denom
  varM /= denom

  const beta = cov / varM
  if (!Number.isFinite(beta) || beta <= 0 || beta >= maxBeta) return null
  return Math.round(beta * 100) / 100
}

/** Paart Monatszeitreihen über YYYY-MM und schneidet auf die letzten `zielMonate` Renditen. */
export function berechneBetaAusMonatskursen(
  aktie: { datum: string; kurs: number }[],
  markt: { datum: string; kurs: number }[],
  opts?: { minMonate?: number; zielMonate?: number; maxBeta?: number },
): BetaBerechnungErgebnis | null {
  const minMonate = opts?.minMonate ?? BETA_MIN_MONATE
  const zielMonate = opts?.zielMonate ?? BETA_ZIEL_MONATE

  const marktMap = new Map<string, number>()
  for (const p of markt) {
    const k = p.datum.slice(0, 7)
    if (p.kurs > 0) marktMap.set(k, p.kurs)
  }

  const paarAktie: number[] = []
  const paarMarkt: number[] = []
  const gesehen = new Set<string>()
  const sortiert = [...aktie].sort((a, b) => a.datum.localeCompare(b.datum))
  for (const p of sortiert) {
    if (!(p.kurs > 0)) continue
    const k = p.datum.slice(0, 7)
    if (gesehen.has(k)) continue
    const m = marktMap.get(k)
    if (m == null || !(m > 0)) continue
    gesehen.add(k)
    paarAktie.push(p.kurs)
    paarMarkt.push(m)
  }

  if (paarAktie.length < minMonate + 1) return null

  // Auf ~61 Preise begrenzen (60 Renditen), neueste Monate.
  const maxPreise = zielMonate + 1
  const aPreise = paarAktie.length > maxPreise ? paarAktie.slice(-maxPreise) : paarAktie
  const mPreise = paarMarkt.length > maxPreise ? paarMarkt.slice(-maxPreise) : paarMarkt

  const rI = monatsRenditenAusPreisen(aPreise)
  const rM = monatsRenditenAusPreisen(mPreise)
  const beta = berechneOlsBeta(rI, rM, opts)
  if (beta == null) return null
  return { beta, monate: Math.min(rI.length, rM.length), marktSymbol: '^GSPC' }
}
