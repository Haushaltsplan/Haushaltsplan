/**
 * Struktur-Punkte inkl. lesbarer Aufschlüsselung (Punkte 2–7 + Bilanzrisiko).
 * Rein regelbasiert — gleiche Logik für Score und UI.
 */

import type { NachkaufZusatzSignale } from './nachkauf-zusatz-signale-server'

export type StrukturSignalZeile = {
  id: string
  label: string
  wert: string
  /** Beitrag zu strukturPunkte (kann 0 sein = nur Info). */
  delta: number
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function push(
  zeilen: StrukturSignalZeile[],
  id: string,
  label: string,
  wert: string,
  delta: number,
): number {
  zeilen.push({ id, label, wert, delta })
  return delta
}

/**
 * Berechnet Struktur-Punkte (−12…+6) und die sichtbare Zerlegung.
 */
export function berechneStrukturMitAufschluesselung(
  zusatz: NachkaufZusatzSignale | null | undefined,
): { punkte: number; zeilen: StrukturSignalZeile[] } {
  if (!zusatz) return { punkte: 0, zeilen: [] }

  const zeilen: StrukturSignalZeile[] = []
  let pts = 0

  const nd = zusatz.netDebtEbitda
  if (nd != null) {
    let d = 0
    if (nd > 3.5) d = -4
    else if (nd > 2.5) d = -2
    else if (nd < 0.8) d = 1
    pts += push(zeilen, 'net_debt', 'Net Debt / EBITDA', `${nd.toFixed(1)}×`, d)
  }
  if (zusatz.netDebtFcf != null) {
    let d = 0
    if (zusatz.netDebtFcf > 8) d = -3
    else if (zusatz.netDebtFcf > 5) d = -2
    else if (zusatz.netDebtFcf < 1) d = 1
    pts += push(zeilen, 'net_debt_fcf', 'Net Debt / FCF', `${zusatz.netDebtFcf.toFixed(1)}×`, d)
  } else if (zusatz.nettoCashMio != null && nd == null) {
    let d = 0
    if (zusatz.nettoCashMio > 500) d = 1
    else if (zusatz.nettoCashMio < -2_000) d = -2
    pts += push(
      zeilen,
      'netto_cash',
      'Netto-Cash',
      `$${zusatz.nettoCashMio.toLocaleString('de-DE')} Mio.`,
      d,
    )
  }

  if (zusatz.reinvestitionsquotePct != null) {
    let d = 0
    if (zusatz.reinvestitionsquotePct >= 50 && (zusatz.incrementalRoicPct == null || zusatz.incrementalRoicPct >= 12)) {
      d = 1
    } else if (zusatz.reinvestitionsquotePct < 10 && (zusatz.incrementalRoicPct == null || zusatz.incrementalRoicPct < 8)) {
      d = -1
    }
    pts += push(
      zeilen,
      'reinvest',
      'Reinvestitionsquote',
      `${zusatz.reinvestitionsquotePct.toFixed(0)} %${zusatz.incrementalRoicPct != null ? ` · Incr. ROIC ${zusatz.incrementalRoicPct.toFixed(0)} %` : ''}`,
      d,
    )
  }

  if (zusatz.sloanRatio != null && zusatz.sloanRatio > 0.08) {
    pts += push(zeilen, 'sloan', 'Sloan-Ratio', zusatz.sloanRatio.toFixed(3), -2)
  }
  if (zusatz.beneishMScore != null && zusatz.beneishMScore > -1.78) {
    pts += push(zeilen, 'beneish', 'Beneish M-Score', `${zusatz.beneishMScore.toFixed(2)} (Risiko)`, -3)
  } else if (zusatz.beneishRisiko === 'erhoeht') {
    pts += push(
      zeilen,
      'beneish',
      'Beneish M-Score',
      zusatz.beneishMScore != null ? zusatz.beneishMScore.toFixed(2) : 'erhöht',
      -1,
    )
  }

  if (zusatz.capexDaRatio != null) {
    let d = 0
    if (zusatz.capexDaRatio > 2.8) d = -1
    else if (zusatz.capexDaRatio < 1.15) d = 1
    pts += push(zeilen, 'capex_da', 'CapEx / D&A', `${zusatz.capexDaRatio.toFixed(2)}×`, d)
  }

  if (zusatz.goodwillAnteilPct != null && zusatz.goodwillAnteilPct >= 35) {
    pts += push(
      zeilen,
      'goodwill',
      'Goodwill-Anteil',
      `${zusatz.goodwillAnteilPct.toFixed(0)} %`,
      -1,
    )
  }

  if (zusatz.segmentDatenZuverlaessig !== false) {
    if (zusatz.segmentKonzentrationPct != null && zusatz.segmentKonzentrationPct >= 55) {
      pts += push(
        zeilen,
        'segment',
        'Segment-Konzentration',
        `${zusatz.segmentKonzentrationPct.toFixed(0)} %`,
        -1,
      )
    }
    if (zusatz.segmentShiftPct != null && Math.abs(zusatz.segmentShiftPct) >= 12) {
      pts += push(
        zeilen,
        'segment_shift',
        'Segment-Shift',
        `${zusatz.segmentShiftPct > 0 ? '+' : ''}${zusatz.segmentShiftPct.toFixed(0)} PP`,
        -1,
      )
    }
  }

  if (zusatz.umsatzanteilTop1KundenPct != null && zusatz.umsatzanteilTop1KundenPct >= 10) {
    pts += push(
      zeilen,
      'kunde_top1',
      'Top-Kunde Umsatzanteil',
      `${zusatz.umsatzanteilTop1KundenPct.toFixed(0)} %${zusatz.topKundenNamen[0] ? ` (${zusatz.topKundenNamen[0]})` : ''}`,
      zusatz.umsatzanteilTop1KundenPct >= 20 ? -3 : -2,
    )
  } else if (zusatz.umsatzanteilTop3KundenPct != null && zusatz.umsatzanteilTop3KundenPct >= 35) {
    pts += push(
      zeilen,
      'kunde_top3',
      'Top-3-Kunden Umsatzanteil',
      `${zusatz.umsatzanteilTop3KundenPct.toFixed(0)} %`,
      -1,
    )
  } else if (
    zusatz.umsatzanteilTop1KundenPct != null &&
    zusatz.umsatzanteilTop1KundenPct > 0 &&
    zusatz.umsatzanteilTop1KundenPct < 10
  ) {
    pts += push(
      zeilen,
      'kunde_divers',
      'Kunden diversifiziert',
      `Top-1 ${zusatz.umsatzanteilTop1KundenPct.toFixed(0)} %`,
      1,
    )
  }

  if (zusatz.bruttoMargeStd10y != null && zusatz.bruttoMargeStd10y > 2) {
    pts += push(
      zeilen,
      'brutto_std',
      'Bruttomarge-Volatilität',
      `±${zusatz.bruttoMargeStd10y.toFixed(1)} Pp.`,
      -3,
    )
  } else if (zusatz.bruttoMargeStd10y != null && zusatz.pricingPowerOk === true) {
    pts += push(
      zeilen,
      'pricing_power',
      'Pricing-Power (Bruttomarge stabil)',
      `±${zusatz.bruttoMargeStd10y.toFixed(1)} Pp.`,
      1,
    )
  }

  if (zusatz.debtRefi24mPct != null && zusatz.debtRefi24mPct >= 25) {
    pts += push(
      zeilen,
      'debt_refi',
      'Refi-Risiko 24M',
      `${zusatz.debtRefi24mPct.toFixed(0)} %${zusatz.debtDue24mMio != null ? ` (${zusatz.debtDue24mMio.toLocaleString('de-DE')} Mio.)` : ''}`,
      zusatz.debtRefi24mPct >= 40 ? -3 : -2,
    )
  } else if (zusatz.debtRefi24mPct != null && zusatz.debtRefi24mPct >= 0 && zusatz.debtRefi24mPct < 15) {
    pts += push(
      zeilen,
      'debt_refi_ok',
      'Refi-Risiko 24M niedrig',
      `${zusatz.debtRefi24mPct.toFixed(0)} %`,
      1,
    )
  }

  if (zusatz.rdAktivierungsquotePct != null && zusatz.rdAktivierungsquotePct >= 15) {
    pts += push(
      zeilen,
      'rd_cap',
      'F&E-Aktivierungsquote',
      `${zusatz.rdAktivierungsquotePct.toFixed(0)} %`,
      zusatz.rdAktivierungsquotePct >= 30 ? -2 : -1,
    )
  } else if (zusatz.rdAktivierungsquotePct != null && zusatz.rdAktivierungsquotePct <= 5) {
    pts += push(
      zeilen,
      'rd_cap_ok',
      'F&E konservativ (kaum aktiviert)',
      `${zusatz.rdAktivierungsquotePct.toFixed(0)} %`,
      1,
    )
  }

  if (zusatz.backlogWachstumPct != null && zusatz.backlogWachstumPct <= -8) {
    pts += push(
      zeilen,
      'backlog',
      zusatz.backlogLabel ?? 'Backlog',
      `${zusatz.backlogWachstumPct.toFixed(0)} % YoY`,
      -1,
    )
  }

  const strukturRisiko = (zusatz.pensionVerpflichtungMio ?? 0) + (zusatz.leaseVerpflichtungMio ?? 0)
  if (strukturRisiko > 5_000) {
    pts += push(zeilen, 'off_balance', 'Pension+Lease', `$${strukturRisiko.toLocaleString('de-DE')} Mio.`, -2)
  } else if (strukturRisiko > 2_000) {
    pts += push(zeilen, 'off_balance', 'Pension+Lease', `$${strukturRisiko.toLocaleString('de-DE')} Mio.`, -1)
  }

  if (zusatz.shortFloatPct != null && zusatz.shortFloatPct >= 12) {
    pts += push(zeilen, 'short', 'Short Float', `${zusatz.shortFloatPct.toFixed(1)} %`, -2)
  } else if (zusatz.shortFloatPct != null && zusatz.shortFloatPct >= 8) {
    pts += push(zeilen, 'short', 'Short Float', `${zusatz.shortFloatPct.toFixed(1)} %`, -1)
  }

  // Insider nur hier, wenn Form-4-Liste leer bleibt — sonst zählt insiderPunkte separat
  // (kein Double-Count im Score: Insider wird in berechneNachkaufScore aus Struktur entfernt
  //  wenn Form-4-Punkte > 0; hier immer nur dokumentieren wenn Richtung gesetzt)
  if (zusatz.insiderNettoRichtung === 'verkauf') {
    pts += push(zeilen, 'insider', 'Insider-Netto 90T', 'Netto-Verkauf', -2)
  } else if (zusatz.insiderNettoRichtung === 'kauf') {
    pts += push(zeilen, 'insider', 'Insider-Netto 90T', 'Netto-Kauf', 1)
  }

  // Punkt 2: Verwässerung — SBC nur wenn keine starke Dilution-Messung
  let dilutionDelta = 0
  if (zusatz.aktienVerwaesserungJaehrlichPct != null) {
    if (zusatz.aktienVerwaesserungJaehrlichPct >= 3) dilutionDelta = -2
    else if (zusatz.aktienVerwaesserungJaehrlichPct >= 1.5) dilutionDelta = -1
    else if (zusatz.aktienVerwaesserungJaehrlichPct <= -1.5) dilutionDelta = 1
    pts += push(
      zeilen,
      'dilution',
      'Aktien-Verwässerung p.a.',
      `${zusatz.aktienVerwaesserungJaehrlichPct > 0 ? '+' : ''}${zusatz.aktienVerwaesserungJaehrlichPct.toFixed(1)} %`,
      dilutionDelta,
    )
  } else if (zusatz.aktienYoYPct != null) {
    if (zusatz.aktienYoYPct >= 4) dilutionDelta = -1
    else if (zusatz.aktienYoYPct <= -3) dilutionDelta = 1
    pts += push(
      zeilen,
      'shares_yoy',
      'Shares YoY',
      `${zusatz.aktienYoYPct > 0 ? '+' : ''}${zusatz.aktienYoYPct.toFixed(1)} %`,
      dilutionDelta,
    )
  }

  if (zusatz.sbcVsFcfPct != null) {
    let sbcDelta = 0
    if (zusatz.sbcVsFcfPct >= 28) sbcDelta = -2
    else if (zusatz.sbcVsFcfPct >= 16) sbcDelta = -1
    // Keine Doppelbestrafung: wenn Dilution schon ≤ −2, SBC nur noch Info
    if (dilutionDelta <= -2 && sbcDelta < 0) sbcDelta = 0
    pts += push(zeilen, 'sbc', 'SBC / FCF', `${zusatz.sbcVsFcfPct.toFixed(0)} %`, sbcDelta)
  }

  // Punkt 3: FCF-Qualität
  if (zusatz.fcfConversion3yPct != null) {
    let d = 0
    if (zusatz.fcfConversion3yPct < 60) d = -2
    else if (zusatz.fcfConversion3yPct < 85) d = -1
    else if (zusatz.fcfConversion3yPct >= 100 && zusatz.fcfConversion3yPct <= 300) d = 1
    pts += push(
      zeilen,
      'fcf_conv',
      'FCF-Conversion (3J)',
      `${zusatz.fcfConversion3yPct.toFixed(0)} %`,
      d,
    )
  } else if (zusatz.fcfConversionPct != null) {
    let d = 0
    if (zusatz.fcfConversionPct < 55) d = -1
    else if (zusatz.fcfConversionPct >= 110 && zusatz.fcfConversionPct <= 300) d = 1
    pts += push(
      zeilen,
      'fcf_conv',
      'FCF-Conversion',
      `${zusatz.fcfConversionPct.toFixed(0)} %`,
      d,
    )
  }

  // Punkt 4: Software
  if (zusatz.nrrPct != null) {
    let d = 0
    if (zusatz.nrrPct >= 120) d = 2
    else if (zusatz.nrrPct >= 110) d = 1
    else if (zusatz.nrrPct < 100) d = -2
    else if (zusatz.nrrPct < 105) d = -1
    pts += push(zeilen, 'nrr', 'NRR', `${zusatz.nrrPct.toFixed(0)} %`, d)
  } else if (zusatz.ruleOf40 != null) {
    let d = 0
    if (zusatz.ruleOf40 >= 50) d = 1
    else if (zusatz.ruleOf40 < 25) d = -1
    pts += push(zeilen, 'ro40', 'Rule of 40', zusatz.ruleOf40.toFixed(0), d)
  }

  // Punkt 5: Zins / Refi
  if (zusatz.interestCoverage != null && zusatz.interestCoverage > 0) {
    let d = 0
    if (zusatz.interestCoverage < 3) d = -3
    else if (zusatz.interestCoverage < 6) d = -1
    else if (zusatz.interestCoverage >= 15) d = 1
    pts += push(
      zeilen,
      'interest',
      'Zinsdeckung',
      `${zusatz.interestCoverage.toFixed(1)}×`,
      d,
    )
  }
  if (zusatz.kurzfristSchuldenAnteilPct != null) {
    let d = 0
    if (zusatz.kurzfristSchuldenAnteilPct >= 40) d = -2
    else if (zusatz.kurzfristSchuldenAnteilPct >= 25) d = -1
    if (d !== 0 || zusatz.kurzfristSchuldenAnteilPct >= 20) {
      pts += push(
        zeilen,
        'st_debt',
        'Kurzfrist-Schulden',
        `${zusatz.kurzfristSchuldenAnteilPct.toFixed(0)} %`,
        d,
      )
    }
  }

  // Punkt 7: GAAP-Kosmetik
  if (zusatz.gaapAdjEpsLueckePct != null) {
    let d = 0
    if (zusatz.gaapAdjEpsLueckePct >= 35) d = -2
    else if (zusatz.gaapAdjEpsLueckePct >= 18) d = -1
    if (d !== 0 || zusatz.gaapAdjEpsLueckePct >= 12) {
      pts += push(
        zeilen,
        'gaap_adj',
        'GAAP→Adj-EPS-Lücke',
        `+${zusatz.gaapAdjEpsLueckePct.toFixed(0)} %`,
        d,
      )
    }
  } else if (
    zusatz.cashEpsVsGaapLueckePct != null &&
    Math.abs(zusatz.cashEpsVsGaapLueckePct) <= 150
  ) {
    let d = 0
    if (zusatz.cashEpsVsGaapLueckePct <= -40) d = -2
    else if (zusatz.cashEpsVsGaapLueckePct <= -20) d = -1
    else if (zusatz.cashEpsVsGaapLueckePct >= 20) d = 1
    if (d !== 0) {
      pts += push(
        zeilen,
        'cash_eps',
        'Cash-EPS vs GAAP',
        `${zusatz.cashEpsVsGaapLueckePct > 0 ? '+' : ''}${zusatz.cashEpsVsGaapLueckePct.toFixed(0)} %`,
        d,
      )
    }
  }

  // Punkt 6 Anzeige (Score steckt im hist. Bonus, hier nur Transparenz)
  if (zusatz.pePerzentil5y != null) {
    push(
      zeilen,
      'pe_pct',
      'KGV-Perzentil 5J',
      `${zusatz.pePerzentil5y.toFixed(0)} (0=günstig)`,
      0,
    )
  }

  if (zusatz.dsoTrendDelta != null && zusatz.dsoTrendDelta >= 8) {
    pts += push(zeilen, 'dso', 'DSO-Trend', `+${zusatz.dsoTrendDelta.toFixed(0)} Tage`, -1)
  }
  if (zusatz.dioTrendDelta != null && zusatz.dioTrendDelta >= 12) {
    pts += push(zeilen, 'dio', 'DIO-Trend', `+${zusatz.dioTrendDelta.toFixed(0)} Tage`, -1)
  } else if (
    zusatz.wcProfil === 'finanz' &&
    zusatz.cccTrendDelta != null &&
    zusatz.cccTrendDelta >= 12
  ) {
    pts += push(
      zeilen,
      'ccc',
      'CCC-Trend (Finanz)',
      `+${zusatz.cccTrendDelta.toFixed(0)} Tage Kapitalbindung`,
      -1,
    )
  }
  if (zusatz.dpoTrendDelta != null && zusatz.dpoTrendDelta <= -10) {
    pts += push(zeilen, 'dpo', 'DPO-Trend', `${zusatz.dpoTrendDelta.toFixed(0)} Tage`, -1)
  }

  return { punkte: clamp(pts, -12, 6), zeilen }
}
