/**
 * npx tsx lib/portfolio-analyse/fundamentaldaten-fwd-multiples.test.ts
 *
 * Spiegel der Plausibilitätsregeln in fundamentaldaten-key-metrics (nicht exportiert).
 */
function ermittleFwdMultiple(opts: {
  fyRoh: number | null | undefined
  ltm: number | null | undefined
  yahoo?: number | null
  histNiveau?: number | null
  fyNiveau?: number | null
  absMax?: number
}): number | null {
  const absMax = opts.absMax ?? 500
  const ltm = opts.ltm != null && Number.isFinite(opts.ltm) && opts.ltm > 0 ? opts.ltm : null
  const skalier =
    ltm != null &&
    opts.histNiveau != null &&
    opts.fyNiveau != null &&
    opts.histNiveau > 0 &&
    opts.fyNiveau > 0
      ? ltm * (opts.histNiveau / opts.fyNiveau)
      : null

  const ok = (v: number | null | undefined): v is number => {
    if (v == null || !Number.isFinite(v) || v <= 0 || v >= absMax) return false
    if (ltm != null && ltm > 0.2) {
      if (v < ltm * 0.25 || v > ltm * 4) return false
    }
    return true
  }

  for (const k of [opts.yahoo, opts.fyRoh, skalier]) {
    if (ok(k)) return Math.round(k * 100) / 100
  }
  if (skalier != null && skalier > 0 && skalier < absMax) return Math.round(skalier * 100) / 100
  if (ltm != null && ltm < absMax) return Math.round(ltm * 100) / 100
  return null
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

// ASML: Schätz EV/Umsatz Einheiten-Mix → LTM
const asml = ermittleFwdMultiple({
  fyRoh: 22054,
  ltm: 18.61,
  absMax: 200,
})
assert(asml === 18.61, `ASML erwartet 18.61, got ${asml}`)

// Sika: ebenso
const sika = ermittleFwdMultiple({
  fyRoh: 3479,
  ltm: 3.49,
  absMax: 200,
})
assert(sika === 3.49, `Sika erwartet 3.49, got ${sika}`)

// Visa: gute FY-Zahl behalten
const visa = ermittleFwdMultiple({
  fyRoh: 15.12,
  ltm: 15.55,
  absMax: 200,
})
assert(visa === 15.12, `Visa erwartet 15.12, got ${visa}`)

// Hermès: FY etwas unter Hist, aber plausibel
const hermes = ermittleFwdMultiple({
  fyRoh: 8.37,
  ltm: 8.74,
  absMax: 200,
})
assert(hermes === 8.37, `Hermes erwartet 8.37, got ${hermes}`)

console.log('fundamentaldaten-fwd-multiples.test.ts: ok')
