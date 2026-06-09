/** VO₂-Max-Schätzung — Uth-Sørensen-Overgaard-Pedersen (WHOOP-ähnlich). */

import { maxHrSchaetzung } from '@/lib/fitnessdaten/scores'

/**
 * WHOOP nutzt intern HF-Reserve-Modelle; die Uth-Formel (15,3 × MHR/RHR)
 * liefert für fitte Nutzer typischerweise Werte um 50–60 ml/kg/min.
 */
export function schaetzeVo2Max(
  rhr: number | null,
  maxHr: number | null,
  age: number,
): number | null {
  if (rhr == null || rhr < 35 || rhr > 100) return null
  const mhr = maxHr ?? maxHrSchaetzung(age)
  if (mhr <= rhr) return null
  const raw = 15.3 * (mhr / rhr)
  return Math.round(Math.min(75, Math.max(25, raw)))
}
