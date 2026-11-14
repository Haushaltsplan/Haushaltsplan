import { gesamtScoreAusPfeilern } from '@/lib/portfolio-analyse/moat-ki-types'

/** Der Zähler darf vor dem Crack nicht über 9,8 laufen, sonst wirkt 10 schon vergeben. */
const PEAK_DECKEL = 9.8

export type LiveScorePlan = {
  finalScore: number
  crackPenalty: number
  peakScore: number
  /** Stand nach jeder positiven Karte. Der letzte Wert ist der Peak. */
  stufen: number[]
}

function eineStelle(n: number): number {
  return Math.round(n * 10) / 10
}

/** Sichtbarer Abzug, wenn der Export keine crack_penalty mitbringt. Hängt an der Streuung der Karten. */
function strafeAusKarten(karten: number[], finalScore: number): number {
  const raum = eineStelle(PEAK_DECKEL - finalScore)
  if (raum <= 0 || karten.length < 2) return 0
  const mittel = karten.reduce((a, b) => a + b, 0) / karten.length
  const streu = Math.sqrt(karten.reduce((a, s) => a + (s - mittel) ** 2, 0) / karten.length)
  const roh = eineStelle(Math.min(0.9, Math.max(0.3, streu * 0.45)))
  return Math.min(roh, raum)
}

/**
 * Verteilt den Peak proportional auf die Karten. Die letzte Stufe ist exakt der Peak,
 * der Abzug danach exakt der finale Score.
 */
export function liveScorePlan(scores: number[], strafeRoh?: number | null): LiveScorePlan {
  const karten = scores.filter((s) => Number.isFinite(s)).map((s) => Math.max(0, s))
  const finalScore = gesamtScoreAusPfeilern(karten)
  const summe = karten.reduce((a, b) => a + b, 0)
  let strafe =
    strafeRoh != null && Number.isFinite(strafeRoh) && strafeRoh > 0 ? eineStelle(strafeRoh) : strafeAusKarten(karten, finalScore)
  let peak = eineStelle(finalScore + strafe)
  if (peak > PEAK_DECKEL) peak = PEAK_DECKEL
  if (peak < finalScore) peak = finalScore
  strafe = eineStelle(Math.max(0, peak - finalScore))

  if (!karten.length || summe <= 0) {
    return { finalScore, crackPenalty: 0, peakScore: finalScore, stufen: karten.map(() => finalScore) }
  }

  const stufen: number[] = []
  let lauf = 0
  karten.forEach((karte, i) => {
    if (i === karten.length - 1) {
      stufen.push(peak)
      return
    }
    lauf = eineStelle(lauf + (karte / summe) * peak)
    const vorher = stufen[i - 1] ?? 0
    if (lauf < vorher) lauf = vorher
    if (lauf > peak) lauf = peak
    stufen.push(lauf)
  })
  return { finalScore, crackPenalty: strafe, peakScore: peak, stufen }
}

export type LiveScoreStand = {
  wert: number
  zeigen: boolean
  /** 0–1, vor der Pill-Deckkraft. */
  deckkraft: number
  /** 1 während des Abzugs, danach zurück auf die Ruhefarbe. */
  rot: number
  delta: boolean
}

function gang(frame: number, start: number, dauer: number): number {
  if (dauer <= 0) return frame >= start ? 1 : 0
  const t = Math.min(1, Math.max(0, (frame - start) / dauer))
  return 1 - (1 - t) ** 3
}

/** Stand der Pill für einen absoluten Frame. Intro bleibt bei 0 und unsichtbar. */
export function liveScoreBeiFrame(opts: {
  frame: number
  fps: number
  pillarFrom: number[]
  crackFrom: number
  stempelFrom: number
  plan: LiveScorePlan
}): LiveScoreStand {
  const { frame, plan } = opts
  const fps = Math.max(1, opts.fps)
  const zaehl = Math.max(1, Math.round(0.35 * fps))
  const fade = Math.max(1, Math.round(0.2 * fps))
  const erste = opts.pillarFrom[0] ?? Number.POSITIVE_INFINITY
  const ein = frame < erste ? 0 : Math.min(1, (frame - erste) / fade)
  const aus = frame < opts.stempelFrom ? 1 : Math.max(0, 1 - (frame - opts.stempelFrom) / fade)
  const deckkraft = ein * aus

  let wert = 0
  let rot = 0
  let delta = false
  if (frame >= opts.crackFrom) {
    const t = gang(frame, opts.crackFrom, zaehl)
    wert = plan.peakScore + (plan.finalScore - plan.peakScore) * t
    const rueck = Math.max(1, Math.round(0.45 * fps))
    rot = t >= 1 ? Math.max(0, 1 - (frame - opts.crackFrom - zaehl) / rueck) : 1
    delta = plan.crackPenalty > 0 && frame < opts.crackFrom + Math.round(1.2 * fps) && frame < opts.stempelFrom
  } else {
    let idx = -1
    for (let i = 0; i < opts.pillarFrom.length; i++) {
      if (frame >= opts.pillarFrom[i]!) idx = i
    }
    if (idx >= 0) {
      const von = idx === 0 ? 0 : plan.stufen[idx - 1] ?? 0
      const nach = plan.stufen[idx] ?? plan.peakScore
      const t = gang(frame, opts.pillarFrom[idx]!, zaehl)
      wert = von + (nach - von) * t
    }
  }
  if (frame >= opts.stempelFrom) wert = plan.finalScore
  return { wert, zeigen: deckkraft > 0.01, deckkraft, rot, delta }
}
