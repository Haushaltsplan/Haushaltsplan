/** Satzgrenze im fertigen Film, an der die Abo-Karte liegt. Nur zwischen Minute 4 und 5. */

const MINUTE_4_MS = 4 * 60 * 1000
const MINUTE_5_MS = 5 * 60 * 1000

export function aboStartMs(teile: { dauerMs: number; schnitteMs: number[] }[]): number | null {
  let cursor = 0
  for (const teil of teile) {
    for (const schnitt of teil.schnitteMs) {
      const abs = cursor + schnitt
      if (abs >= MINUTE_4_MS && abs < MINUTE_5_MS) return abs
    }
    cursor += teil.dauerMs
  }
  return null
}
