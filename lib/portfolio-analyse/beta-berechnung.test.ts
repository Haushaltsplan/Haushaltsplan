/**
 * Self-check OLS-Beta.
 *
 *   npx tsx lib/portfolio-analyse/beta-berechnung.test.ts
 */
import {
  berechneBetaAusMonatskursen,
  berechneOlsBeta,
  monatsRenditenAusPreisen,
} from '@/lib/portfolio-analyse/beta-berechnung'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

// Synthetisch: r_i = 1.2 * r_m → Beta ≈ 1.2
const marktR: number[] = []
const aktieR: number[] = []
for (let i = 0; i < 60; i++) {
  const rm = ((i % 7) - 3) / 100
  marktR.push(rm)
  aktieR.push(1.2 * rm)
}
const b = berechneOlsBeta(aktieR, marktR)
assert(b != null && Math.abs(b - 1.2) < 0.02, `erwartet ~1.2, got ${b}`)

// Zu wenig Monate
assert(berechneOlsBeta(aktieR.slice(0, 20), marktR.slice(0, 20)) == null, 'min Monate')

// Aus Preisen: r_i = 0.8 * r_m mit schwankendem Markt → Beta ≈ 0.8
const marktP: { datum: string; kurs: number }[] = []
const aktieP: { datum: string; kurs: number }[] = []
let m = 100
let a = 100
marktP.push({ datum: '2020-01-28', kurs: m })
aktieP.push({ datum: '2020-01-28', kurs: a })
for (let i = 1; i <= 60; i++) {
  const rm = ((i % 7) - 3) / 100
  m *= 1 + rm
  a *= 1 + 0.8 * rm
  const y = 2020 + Math.floor(i / 12)
  const mo = (i % 12) + 1
  const d = `${y}-${String(mo).padStart(2, '0')}-28`
  marktP.push({ datum: d, kurs: Math.round(m * 1e6) / 1e6 })
  aktieP.push({ datum: d, kurs: Math.round(a * 1e6) / 1e6 })
}
const hit = berechneBetaAusMonatskursen(aktieP, marktP)
assert(hit != null && Math.abs(hit.beta - 0.8) < 0.05, `Preis-Beta ~0.8, got ${hit?.beta}`)

const renditen = monatsRenditenAusPreisen([100, 110, 121])
assert(Math.abs(renditen[0]! - 0.1) < 1e-9 && Math.abs(renditen[1]! - 0.1) < 1e-9, 'Renditen')

console.log('beta-berechnung.test.ts: ok')
