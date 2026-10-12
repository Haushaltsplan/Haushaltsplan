/** Reiner Zinseszins-/Sparplan-Rechner (monatliche Iteration). */

export type ZinsFrequenz = 'monatlich' | 'quartalsweise' | 'jaehrlich'

export type ZinseszinsEingabe = {
  startkapitalEur: number
  sparrateMonatEur: number
  /** Nominalzins p.a., z. B. 7 für 7 % */
  jahresRenditePct: number
  laufzeitJahre: number
  frequenz: ZinsFrequenz
  /** Jährliche Erhöhung der Sparrate, z. B. 2 für +2 %/Jahr */
  sparrateSteigerungPct: number
  /** Inflation p.a. für Kaufkraft-Anpassung */
  inflationPct: number
}

export type ZinseszinsJahrZeile = {
  jahr: number
  eingezahltEur: number
  zinsenEur: number
  endwertEur: number
  realEndwertEur: number
}

export type ZinseszinsErgebnis = {
  endwertEur: number
  eingezahltEur: number
  zinsenEur: number
  realEndwertEur: number
  /** Anteil Zinsen am Endwert, 0–100 */
  zinsenAnteilPct: number
  jahre: ZinseszinsJahrZeile[]
  /** Monatspunkte für Chart (Jahr als Dezimal, z. B. 0, 0.083, …) */
  verlauf: Array<{
    monat: number
    jahrLabel: number
    endwertEur: number
    eingezahltEur: number
  }>
}

function clampNonNeg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

function monateProZinsperiode(frequenz: ZinsFrequenz): number {
  if (frequenz === 'monatlich') return 1
  if (frequenz === 'quartalsweise') return 3
  return 12
}

/**
 * Nominaler Periodenzins aus Jahresrendite (wie klassische Bankenrechner).
 * Beispiel 7 % p.a. monatlich → 7/12/100 je Monat.
 */
export function periodenzins(jahresRenditePct: number, frequenz: ZinsFrequenz): number {
  const r = jahresRenditePct / 100
  const n = 12 / monateProZinsperiode(frequenz)
  return r / n
}

export function berechneZinseszins(raw: ZinseszinsEingabe): ZinseszinsErgebnis {
  const start = clampNonNeg(raw.startkapitalEur)
  const laufzeitJahre = Math.min(80, Math.max(0, Math.floor(raw.laufzeitJahre)))
  const monateGesamt = laufzeitJahre * 12
  const sparSteig = Math.max(0, raw.sparrateSteigerungPct) / 100
  const inflation = Math.max(0, raw.inflationPct) / 100
  const zinsMonate = monateProZinsperiode(raw.frequenz)
  const pZins = periodenzins(raw.jahresRenditePct, raw.frequenz)

  let kapital = start
  let sparrate = clampNonNeg(raw.sparrateMonatEur)
  let eingezahlt = start
  let monateSeitZins = 0

  const jahre: ZinseszinsJahrZeile[] = []
  const verlauf: ZinseszinsErgebnis['verlauf'] = [
    { monat: 0, jahrLabel: 0, endwertEur: start, eingezahltEur: start },
  ]

  if (monateGesamt === 0) {
    return {
      endwertEur: start,
      eingezahltEur: start,
      zinsenEur: 0,
      realEndwertEur: start,
      zinsenAnteilPct: 0,
      jahre: [],
      verlauf,
    }
  }

  for (let m = 1; m <= monateGesamt; m++) {
    kapital += sparrate
    eingezahlt += sparrate
    monateSeitZins += 1

    if (monateSeitZins >= zinsMonate) {
      kapital *= 1 + pZins
      monateSeitZins = 0
    }

    // Sparratensteigerung jeweils zum Jahreswechsel (nach 12, 24, … Monaten)
    if (m % 12 === 0 && sparSteig > 0 && m < monateGesamt) {
      sparrate *= 1 + sparSteig
    }

    const jahr = m / 12
    if (m % 12 === 0 || m === monateGesamt) {
      verlauf.push({
        monat: m,
        jahrLabel: Math.round(jahr * 10) / 10,
        endwertEur: kapital,
        eingezahltEur: eingezahlt,
      })
    }

    if (m % 12 === 0) {
      const j = m / 12
      const real = inflation > 0 ? kapital / Math.pow(1 + inflation, j) : kapital
      jahre.push({
        jahr: j,
        eingezahltEur: eingezahlt,
        zinsenEur: kapital - eingezahlt,
        endwertEur: kapital,
        realEndwertEur: real,
      })
    }
  }

  // Restzinsen am Ende, falls Periode nicht aufging (sollte bei ganzen Jahren nicht vorkommen)
  if (monateSeitZins > 0 && pZins > 0) {
    kapital *= 1 + pZins * (monateSeitZins / zinsMonate)
  }

  const endwertEur = kapital
  const zinsenEur = endwertEur - eingezahlt
  const realEndwertEur =
    inflation > 0 && laufzeitJahre > 0
      ? endwertEur / Math.pow(1 + inflation, laufzeitJahre)
      : endwertEur
  const zinsenAnteilPct = endwertEur > 0 ? (zinsenEur / endwertEur) * 100 : 0

  // Letzten Verlaufspunkt ggf. mit finalem Kapital aktualisieren
  const last = verlauf[verlauf.length - 1]
  if (last && last.monat === monateGesamt) {
    last.endwertEur = endwertEur
    last.eingezahltEur = eingezahlt
  }
  if (jahre.length > 0) {
    const lj = jahre[jahre.length - 1]!
    lj.endwertEur = endwertEur
    lj.eingezahltEur = eingezahlt
    lj.zinsenEur = zinsenEur
    lj.realEndwertEur = realEndwertEur
  }

  return {
    endwertEur,
    eingezahltEur: eingezahlt,
    zinsenEur,
    realEndwertEur,
    zinsenAnteilPct,
    jahre,
    verlauf,
  }
}

/** Monatsrate, um Zielkapital zu erreichen (ohne Sparratensteigerung, feste Rendite). */
export function sparrateFuerZiel(opts: {
  startkapitalEur: number
  zielEur: number
  jahresRenditePct: number
  laufzeitJahre: number
  frequenz: ZinsFrequenz
}): number | null {
  const jahre = Math.floor(opts.laufzeitJahre)
  if (jahre <= 0 || opts.zielEur <= 0) return null
  const start = clampNonNeg(opts.startkapitalEur)

  // Binäre Suche über Monatsrate (robuster als Formel bei versch. Frequenzen)
  let lo = 0
  let hi = Math.max(opts.zielEur, 1)
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2
    const e = berechneZinseszins({
      startkapitalEur: start,
      sparrateMonatEur: mid,
      jahresRenditePct: opts.jahresRenditePct,
      laufzeitJahre: jahre,
      frequenz: opts.frequenz,
      sparrateSteigerungPct: 0,
      inflationPct: 0,
    })
    if (e.endwertEur < opts.zielEur) lo = mid
    else hi = mid
  }
  const rate = (lo + hi) / 2
  if (!Number.isFinite(rate) || rate < 0) return null
  return Math.round(rate * 100) / 100
}
