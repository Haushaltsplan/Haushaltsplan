import type {
  DcfAnnahmen,
  DcfErgebnis,
  DcfFehler,
  DcfJahresZeile,
  DcfResult,
  DcfSensitivitaetsMatrix,
  DcfSensitivitaetsZelle,
} from '@/lib/portfolio-analyse/dcf/dcf-types'

function rate(pct: number): number {
  return pct / 100
}

function wachstumFuerJahr(opts: {
  jahr: number
  n: number
  gStartPct: number
  gTerminalPct: number
  fade: boolean
}): number {
  if (!opts.fade || opts.n <= 1) return opts.gStartPct
  const t = opts.jahr
  return opts.gStartPct + (opts.gTerminalPct - opts.gStartPct) * ((t - 1) / (opts.n - 1))
}

function validiereAnnahmen(a: DcfAnnahmen): string | null {
  if (!(a.fcf0Usd > 0) || !Number.isFinite(a.fcf0Usd)) return 'FCF-Basis muss positiv sein.'
  if (!(a.jahre >= 1) || !(a.jahre <= 30) || !Number.isInteger(a.jahre)) {
    return 'Prognosejahre müssen zwischen 1 und 30 liegen.'
  }
  if (!(a.waccPct > 0) || !Number.isFinite(a.waccPct)) return 'WACC muss positiv sein.'
  if (!(a.sharesOutstanding > 0) || !Number.isFinite(a.sharesOutstanding)) {
    return 'Aktienanzahl muss positiv sein.'
  }
  if (!Number.isFinite(a.gStartPct) || !Number.isFinite(a.gTerminalPct)) {
    return 'Wachstumsraten ungültig.'
  }
  if (a.terminalMethode === 'gordon' && !(a.waccPct > a.gTerminalPct)) {
    return 'Gordon Growth erfordert WACC > Terminalwachstum.'
  }
  if (a.terminalMethode === 'exit_multiple' && (!(a.exitMultiple > 0) || !Number.isFinite(a.exitMultiple))) {
    return 'Exit-Multiple muss positiv sein.'
  }
  if (!Number.isFinite(a.netDebtUsd) || !Number.isFinite(a.minoritiesUsd)) {
    return 'Net Debt / Minorities ungültig.'
  }
  if (!Number.isFinite(a.shareCagrPct) || !Number.isFinite(a.mosPct)) {
    return 'Share-CAGR / MoS ungültig.'
  }
  if (a.mosPct < 0 || a.mosPct >= 100) return 'Margin of Safety muss zwischen 0 und 100 % liegen.'
  return null
}

function terminalValueUsd(fcfLast: number, a: DcfAnnahmen): number {
  if (a.terminalMethode === 'exit_multiple') return fcfLast * a.exitMultiple
  const w = rate(a.waccPct)
  const g = rate(a.gTerminalPct)
  return (fcfLast * (1 + g)) / (w - g)
}

/**
 * FCFF-DCF: diskrete High-Growth-Jahre, optional linearer Fade gStart→gTerminal,
 * Terminal via Gordon oder Exit-Multiple, Equity = EV − Net Debt − Minorities,
 * FV/Aktie mit Shares₀ × (1+shareCagr)^n.
 */
export function berechneDcf(annahmen: DcfAnnahmen): DcfResult {
  const fehler = validiereAnnahmen(annahmen)
  if (fehler) return { ok: false, fehler, annahmen }

  const wacc = rate(annahmen.waccPct)
  const n = annahmen.jahre
  const jahre: DcfJahresZeile[] = []
  let fcf = annahmen.fcf0Usd
  let summePvFcfUsd = 0

  for (let t = 1; t <= n; t++) {
    const wachstumPct = wachstumFuerJahr({
      jahr: t,
      n,
      gStartPct: annahmen.gStartPct,
      gTerminalPct: annahmen.gTerminalPct,
      fade: annahmen.fade,
    })
    fcf = fcf * (1 + rate(wachstumPct))
    const pvFcfUsd = fcf / Math.pow(1 + wacc, t)
    summePvFcfUsd += pvFcfUsd
    jahre.push({ jahr: t, wachstumPct, fcfUsd: fcf, pvFcfUsd })
  }

  const terminalValueUsdVal = terminalValueUsd(fcf, annahmen)
  const pvTerminalUsd = terminalValueUsdVal / Math.pow(1 + wacc, n)
  const enterpriseValueUsd = summePvFcfUsd + pvTerminalUsd
  const equityValueUsd = enterpriseValueUsd - annahmen.netDebtUsd - annahmen.minoritiesUsd
  const sharesEnd = annahmen.sharesOutstanding * Math.pow(1 + rate(annahmen.shareCagrPct), n)
  const fairValuePerShare = equityValueUsd / sharesEnd
  const buyPricePerShare = fairValuePerShare * (1 - rate(annahmen.mosPct))
  const tvAnteilPct =
    enterpriseValueUsd !== 0 ? (pvTerminalUsd / enterpriseValueUsd) * 100 : 0

  let upsidePct: number | null = null
  if (annahmen.kursUsd != null && annahmen.kursUsd > 0 && Number.isFinite(annahmen.kursUsd)) {
    upsidePct = ((fairValuePerShare - annahmen.kursUsd) / annahmen.kursUsd) * 100
  }

  if (
    !Number.isFinite(fairValuePerShare) ||
    !Number.isFinite(enterpriseValueUsd) ||
    !Number.isFinite(equityValueUsd)
  ) {
    return { ok: false, fehler: 'Berechnung lieferte ungültige Werte.', annahmen }
  }

  const ergebnis: DcfErgebnis = {
    ok: true,
    jahre,
    summePvFcfUsd,
    terminalValueUsd: terminalValueUsdVal,
    pvTerminalUsd,
    enterpriseValueUsd,
    equityValueUsd,
    sharesEnd,
    fairValuePerShare,
    buyPricePerShare,
    upsidePct,
    tvAnteilPct,
    annahmen,
  }
  return ergebnis
}

/** WACC-Achse 6–12 % in 0,5-Schritten; Y = gTerm (± um Base) oder Exit-Multiples. */
export function sensitivitaetsMatrix(
  basis: DcfAnnahmen,
  opts?: { waccMin?: number; waccMax?: number; waccSchritt?: number },
): DcfSensitivitaetsMatrix {
  const waccMin = opts?.waccMin ?? 6
  const waccMax = opts?.waccMax ?? 12
  const waccSchritt = opts?.waccSchritt ?? 0.5
  const waccAchse: number[] = []
  for (let w = waccMin; w <= waccMax + 1e-9; w += waccSchritt) {
    waccAchse.push(Math.round(w * 10) / 10)
  }

  const yIstExitMultiple = basis.terminalMethode === 'exit_multiple'
  let yAchse: number[]
  if (yIstExitMultiple) {
    const mid = basis.exitMultiple > 0 ? basis.exitMultiple : 20
    yAchse = [mid * 0.7, mid * 0.85, mid, mid * 1.15, mid * 1.3].map((v) => Math.round(v * 10) / 10)
  } else {
    const mid = basis.gTerminalPct
    yAchse = [mid - 1, mid - 0.5, mid, mid + 0.5, mid + 1].map((v) => Math.round(v * 10) / 10)
  }

  const zellen: DcfSensitivitaetsZelle[][] = yAchse.map((yPct) =>
    waccAchse.map((waccPct) => {
      const annahmen: DcfAnnahmen = {
        ...basis,
        waccPct,
        ...(yIstExitMultiple ? { exitMultiple: yPct } : { gTerminalPct: yPct }),
      }
      const r = berechneDcf(annahmen)
      if (!r.ok) {
        return {
          waccPct,
          yPct,
          fairValuePerShare: null,
          upsidePct: null,
          fehler: (r as DcfFehler).fehler,
        }
      }
      return {
        waccPct,
        yPct,
        fairValuePerShare: r.fairValuePerShare,
        upsidePct: r.upsidePct,
        fehler: null,
      }
    }),
  )

  return { waccAchse, yAchse, yIstExitMultiple, zellen }
}

/**
 * Binäre Suche auf gStartPct, sodass FVPS ≈ Kurs.
 * Fade / übrige Annahmen bleiben unverändert.
 */
export function reverseDcfWachstum(
  basis: DcfAnnahmen,
  opts?: { loPct?: number; hiPct?: number; toleranzUsd?: number; maxIter?: number },
): { gStartPct: number | null; fairValuePerShare: number | null; fehler: string | null } {
  const kurs = basis.kursUsd
  if (kurs == null || !(kurs > 0)) {
    return { gStartPct: null, fairValuePerShare: null, fehler: 'Aktueller Kurs fehlt.' }
  }

  let lo = opts?.loPct ?? -20
  let hi = opts?.hiPct ?? 40
  const toleranz = opts?.toleranzUsd ?? 0.01
  const maxIter = opts?.maxIter ?? 60

  const evalG = (g: number) => berechneDcf({ ...basis, gStartPct: g })

  const atLo = evalG(lo)
  const atHi = evalG(hi)
  if (!atLo.ok && !atHi.ok) {
    return { gStartPct: null, fairValuePerShare: null, fehler: 'Kein gültiger Wachstumsbereich.' }
  }

  // Monotonie: höheres g → höheres FV (bei gültigem Gordon)
  let best: { g: number; fv: number } | null = null
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2
    const r = evalG(mid)
    if (!r.ok) {
      // typisch: zu aggressives g mit Fade nahe WACC — Bereich verengen
      hi = mid
      continue
    }
    best = { g: mid, fv: r.fairValuePerShare }
    if (Math.abs(r.fairValuePerShare - kurs) <= toleranz) {
      return { gStartPct: mid, fairValuePerShare: r.fairValuePerShare, fehler: null }
    }
    if (r.fairValuePerShare < kurs) lo = mid
    else hi = mid
  }

  if (!best) {
    return { gStartPct: null, fairValuePerShare: null, fehler: 'Implizites Wachstum nicht gefunden.' }
  }
  return { gStartPct: best.g, fairValuePerShare: best.fv, fehler: null }
}
