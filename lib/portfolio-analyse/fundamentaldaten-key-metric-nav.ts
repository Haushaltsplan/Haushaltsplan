export type FundamentalUnterTab = 'finanzdaten' | 'bewertung'

export type KeyMetricNavZiel = {
  tab: FundamentalUnterTab
  zeileId: string
}

const NAV: Record<string, KeyMetricNavZiel> = {
  shares_out: { tab: 'finanzdaten', zeileId: 'aktien' },
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
  ntm_ev_rev: { tab: 'bewertung', zeileId: 'ntm_ev_rev' },
  ntm_ev_ebitda: { tab: 'bewertung', zeileId: 'ntm_ev_ebitda' },
  ntm_pe: { tab: 'bewertung', zeileId: 'ntm_pe' },
  ntm_mc_fcf: { tab: 'bewertung', zeileId: 'ntm_pfcf' },
  ltm_pe: { tab: 'bewertung', zeileId: 'kgv' },
  ltm_pb: { tab: 'bewertung', zeileId: 'pb' },
  ltm_ps: { tab: 'bewertung', zeileId: 'ps' },
  ltm_pfcf: { tab: 'bewertung', zeileId: 'pfcf' },
  div_yield: { tab: 'bewertung', zeileId: 'kgv' },
  payout: { tab: 'bewertung', zeileId: 'kgv' },
}

export function keyMetricNavZiel(metricId: string): KeyMetricNavZiel | null {
  return NAV[metricId] ?? null
}
