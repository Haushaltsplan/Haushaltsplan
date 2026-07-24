export type FundamentalUnterTab = 'finanzdaten' | 'bewertung'

export type KeyMetricNavZiel = {
  tab: FundamentalUnterTab
  zeileId: string
}

/**
 * Jede hier gelistete Key-Metric ist anklickbar und muss auf eine existierende
 * Historien-Zeile zeigen (Chart + Tabelle).
 */
const NAV: Record<string, KeyMetricNavZiel> = {
  shares_out: { tab: 'finanzdaten', zeileId: 'aktien' },
  net_debt: { tab: 'finanzdaten', zeileId: 'nettoverschuldung' },
  net_debt_ebitda: { tab: 'bewertung', zeileId: 'net_debt_ebitda' },
  aktien_verwaesserung: { tab: 'finanzdaten', zeileId: 'aktien' },
  fcf_conversion: { tab: 'finanzdaten', zeileId: 'fcf' },
  rule_of_40: { tab: 'finanzdaten', zeileId: 'umsatz' },
  nrr: { tab: 'finanzdaten', zeileId: 'umsatz' },
  interest_coverage: { tab: 'finanzdaten', zeileId: 'ebit' },

  ltm_brutto: { tab: 'finanzdaten', zeileId: 'bruttomarge' },
  ltm_ebit: { tab: 'finanzdaten', zeileId: 'ebit_marge' },
  ltm_roa: { tab: 'finanzdaten', zeileId: 'roa' },
  ltm_roe: { tab: 'finanzdaten', zeileId: 'roe' },
  ltm_roic: { tab: 'finanzdaten', zeileId: 'roi' },
  ltm_value_spread: { tab: 'finanzdaten', zeileId: 'roi' },

  rev_cagr_3y: { tab: 'finanzdaten', zeileId: 'umsatz' },
  ebitda_cagr_3y: { tab: 'finanzdaten', zeileId: 'ebitda' },
  eps_cagr_3y: { tab: 'finanzdaten', zeileId: 'eps' },
  fwd_rev_cagr_2y: { tab: 'finanzdaten', zeileId: 'umsatz' },
  fwd_eps_cagr_2y: { tab: 'finanzdaten', zeileId: 'eps' },
  fwd_ebitda_cagr_2y: { tab: 'finanzdaten', zeileId: 'ebitda' },

  ntm_ev_rev: { tab: 'bewertung', zeileId: 'ev_rev' },
  ntm_ev_ebitda: { tab: 'bewertung', zeileId: 'ev_ebitda' },
  ntm_pe: { tab: 'bewertung', zeileId: 'kgv' },
  ntm_mc_fcf: { tab: 'bewertung', zeileId: 'pfcf' },
  ltm_ev_rev: { tab: 'bewertung', zeileId: 'ev_rev' },
  ltm_pe: { tab: 'bewertung', zeileId: 'kgv' },
  ltm_pb: { tab: 'bewertung', zeileId: 'pb' },
  ltm_ps: { tab: 'bewertung', zeileId: 'ps' },
  ltm_pfcf: { tab: 'bewertung', zeileId: 'pfcf' },

  div_yield: { tab: 'bewertung', zeileId: 'dividendenrendite' },
  payout: { tab: 'bewertung', zeileId: 'ausschuettungsquote' },
}

export function keyMetricNavZiel(metricId: string): KeyMetricNavZiel | null {
  return NAV[metricId] ?? null
}
