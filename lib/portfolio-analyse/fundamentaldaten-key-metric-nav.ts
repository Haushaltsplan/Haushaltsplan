export type FundamentalUnterTab = 'kennzahlen'

export type KeyMetricNavZiel = {
  tab: FundamentalUnterTab
  zeileId: string
}

/**
 * Jede hier gelistete Key-Metric ist anklickbar und muss auf eine existierende
 * Historien-Zeile zeigen (Chart + Tabelle).
 */
const NAV: Record<string, KeyMetricNavZiel> = {
  shares_out: { tab: 'kennzahlen', zeileId: 'aktien' },
  net_debt: { tab: 'kennzahlen', zeileId: 'nettoverschuldung' },
  net_debt_ebitda: { tab: 'kennzahlen', zeileId: 'net_debt_ebitda' },
  aktien_verwaesserung: { tab: 'kennzahlen', zeileId: 'aktien' },
  fcf_conversion: { tab: 'kennzahlen', zeileId: 'fcf' },
  rule_of_40: { tab: 'kennzahlen', zeileId: 'umsatz' },
  nrr: { tab: 'kennzahlen', zeileId: 'umsatz' },
  interest_coverage: { tab: 'kennzahlen', zeileId: 'ebit' },

  ltm_brutto: { tab: 'kennzahlen', zeileId: 'bruttomarge' },
  ltm_ebit: { tab: 'kennzahlen', zeileId: 'ebit_marge' },
  ltm_roa: { tab: 'kennzahlen', zeileId: 'roa' },
  ltm_roe: { tab: 'kennzahlen', zeileId: 'roe' },
  ltm_roic: { tab: 'kennzahlen', zeileId: 'roi' },
  ltm_value_spread: { tab: 'kennzahlen', zeileId: 'roi' },

  rev_cagr_3y: { tab: 'kennzahlen', zeileId: 'umsatz' },
  ebitda_cagr_3y: { tab: 'kennzahlen', zeileId: 'ebitda' },
  eps_cagr_3y: { tab: 'kennzahlen', zeileId: 'eps' },
  fwd_rev_cagr_2y: { tab: 'kennzahlen', zeileId: 'umsatz' },
  fwd_eps_cagr_2y: { tab: 'kennzahlen', zeileId: 'eps' },
  fwd_ebitda_cagr_2y: { tab: 'kennzahlen', zeileId: 'ebitda' },

  ntm_ev_rev: { tab: 'kennzahlen', zeileId: 'ev_rev' },
  ntm_ev_ebitda: { tab: 'kennzahlen', zeileId: 'ev_ebitda' },
  ntm_pe: { tab: 'kennzahlen', zeileId: 'kgv' },
  ntm_mc_fcf: { tab: 'kennzahlen', zeileId: 'pfcf' },
  ltm_ev_rev: { tab: 'kennzahlen', zeileId: 'ev_rev' },
  ltm_pe: { tab: 'kennzahlen', zeileId: 'kgv' },
  ltm_pb: { tab: 'kennzahlen', zeileId: 'pb' },
  ltm_ps: { tab: 'kennzahlen', zeileId: 'ps' },
  ltm_pfcf: { tab: 'kennzahlen', zeileId: 'pfcf' },

  div_yield: { tab: 'kennzahlen', zeileId: 'dividendenrendite' },
  payout: { tab: 'kennzahlen', zeileId: 'ausschuettungsquote' },
}

export function keyMetricNavZiel(metricId: string): KeyMetricNavZiel | null {
  return NAV[metricId] ?? null
}
