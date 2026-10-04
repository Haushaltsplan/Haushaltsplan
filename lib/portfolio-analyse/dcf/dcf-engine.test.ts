/**
 * Self-check für DCF-Engine (kein Jest im Repo).
 *
 *   npx tsx lib/portfolio-analyse/dcf/dcf-engine.test.ts
 */
import { berechneDcf, reverseDcfWachstum, sensitivitaetsMatrix } from '@/lib/portfolio-analyse/dcf/dcf-engine'
import type { DcfAnnahmen } from '@/lib/portfolio-analyse/dcf/dcf-types'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

function approx(a: number, b: number, eps = 1e-2) {
  return Math.abs(a - b) <= eps
}

/** Beispiel: FCF 100M, n=10, g=12 %, WACC 8 %, gTerm 3 %, Net Debt 0, Shares 100M */
const beispiel: DcfAnnahmen = {
  fcf0Usd: 100_000_000,
  jahre: 10,
  gStartPct: 12,
  gTerminalPct: 3,
  fade: false,
  waccPct: 8,
  terminalMethode: 'gordon',
  exitMultiple: 20,
  netDebtUsd: 0,
  minoritiesUsd: 0,
  sharesOutstanding: 100_000_000,
  shareCagrPct: 0,
  mosPct: 25,
  kursUsd: 50,
}

function manuellPvSumme(): { summePv: number; fcf10: number; tv: number; pvTv: number; ev: number; fvps: number } {
  const wacc = 0.08
  let fcf = 100_000_000
  let summePv = 0
  for (let t = 1; t <= 10; t++) {
    fcf *= 1.12
    summePv += fcf / Math.pow(1 + wacc, t)
  }
  const tv = (fcf * 1.03) / (0.08 - 0.03)
  const pvTv = tv / Math.pow(1 + wacc, 10)
  const ev = summePv + pvTv
  return { summePv, fcf10: fcf, tv, pvTv, ev, fvps: ev / 100_000_000 }
}

function main() {
  const ref = manuellPvSumme()
  const r = berechneDcf(beispiel)
  assert(r.ok, 'Beispiel muss ok sein')
  if (!r.ok) return

  assert(approx(r.summePvFcfUsd, ref.summePv, 1), `PV-Summe ${r.summePvFcfUsd} ≠ ${ref.summePv}`)
  assert(approx(r.terminalValueUsd, ref.tv, 1), `TV ${r.terminalValueUsd} ≠ ${ref.tv}`)
  assert(approx(r.pvTerminalUsd, ref.pvTv, 1), `PV(TV) ${r.pvTerminalUsd} ≠ ${ref.pvTv}`)
  assert(approx(r.enterpriseValueUsd, ref.ev, 1), `EV ${r.enterpriseValueUsd} ≠ ${ref.ev}`)
  assert(approx(r.fairValuePerShare, ref.fvps, 0.01), `FVPS ${r.fairValuePerShare} ≠ ${ref.fvps}`)
  assert(approx(r.buyPricePerShare, ref.fvps * 0.75, 0.01), 'MoS 25 %')
  assert(r.jahre.length === 10, '10 Jahreszeilen')
  assert(approx(r.jahre[0]!.wachstumPct, 12), 'Jahr-1 Wachstum 12 %')
  assert(r.tvAnteilPct > 0 && r.tvAnteilPct < 100, 'TV-Anteil sinnvoll')

  const bad = berechneDcf({ ...beispiel, waccPct: 2, gTerminalPct: 3 })
  assert(!bad.ok, 'WACC ≤ gTerm muss fehlschlagen')

  const fade = berechneDcf({ ...beispiel, fade: true })
  assert(fade.ok, 'Fade muss ok sein')
  if (fade.ok) {
    assert(approx(fade.jahre[0]!.wachstumPct, 12), 'Fade Jahr 1 = gStart')
    assert(approx(fade.jahre[9]!.wachstumPct, 3), 'Fade Jahr 10 = gTerm')
    assert(fade.fairValuePerShare < r.fairValuePerShare, 'Fade senkt FV vs. konstantem High-Growth')
  }

  const exit = berechneDcf({ ...beispiel, terminalMethode: 'exit_multiple', exitMultiple: 25 })
  assert(exit.ok, 'Exit Multiple ok')
  if (exit.ok) {
    const fcf10 = exit.jahre[9]!.fcfUsd
    assert(approx(exit.terminalValueUsd, fcf10 * 25, 1), 'TV = FCF×Multiple')
  }

  const matrix = sensitivitaetsMatrix(beispiel)
  assert(matrix.waccAchse.length >= 10, 'WACC-Achse')
  assert(matrix.zellen.length === matrix.yAchse.length, 'Matrix-Zeilen')
  assert(matrix.zellen[0]!.length === matrix.waccAchse.length, 'Matrix-Spalten')

  const rev = reverseDcfWachstum(beispiel)
  assert(rev.gStartPct != null && rev.fehler == null, `Reverse DCF: ${rev.fehler}`)
  if (rev.gStartPct != null && rev.fairValuePerShare != null) {
    assert(approx(rev.fairValuePerShare, 50, 0.5), `Reverse FVPS ≈ Kurs (${rev.fairValuePerShare})`)
    if (r.fairValuePerShare > 50) {
      assert(rev.gStartPct < 12, 'Kurs unter FV → implizites g unter Base')
    } else {
      assert(rev.gStartPct > 12, 'Kurs über FV → implizites g über Base')
    }
  }

  console.log('OK dcf-engine', {
    fvps: Math.round(r.fairValuePerShare * 100) / 100,
    tvAnteilPct: Math.round(r.tvAnteilPct * 10) / 10,
    reverseG: rev.gStartPct != null ? Math.round(rev.gStartPct * 100) / 100 : null,
  })
}

main()
