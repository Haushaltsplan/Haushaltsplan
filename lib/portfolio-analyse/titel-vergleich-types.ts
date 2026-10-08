/** Freie IDs: Key-Metric-IDs + abgeleitete Hist-/Snapshot-Felder. */
export type TitelVergleichKennzahlId = string

export type TitelVergleichZeileDef = {
  id: TitelVergleichKennzahlId
  label: string
  gruppe: string
  /** true = höher besser, false = niedriger besser, null = neutral */
  higherIsBetter: boolean | null
  format: 'pct' | 'mult' | 'zahl'
  /**
   * Quelle:
   * - km: paket.keyMetrics[id]
   * - zeile: LTM/letzter Wert aus paket.zeilen[id]
   * - hist: berechneHistorischeBewertung Feld
   * - special: Server-Sonderlogik (pers_div_yield, …)
   */
  quelle: 'km' | 'zeile' | 'hist' | 'special'
  /** Bei quelle=hist: Feldname auf HistorischeBewertung */
  histFeld?: string
  /** Alternative Key-Metric-IDs (Fallback-Reihenfolge) */
  kmFallbacks?: string[]
}

export type TitelVergleichSpalte = {
  key: string
  isin: string | null
  name: string
  ticker: string
  symbolYahoo: string | null
  werte: Partial<Record<string, number | null>>
  ok: boolean
  fehler?: string | null
}

export type TitelVergleichPaket = {
  ok: boolean
  spalten: TitelVergleichSpalte[]
  zeilen: TitelVergleichZeileDef[]
  geladenAm: string
  fehler?: string | null
}

export type TitelVergleichAnfrage = {
  isin?: string | null
  symbolYahoo?: string | null
  name?: string | null
}

function km(
  id: string,
  label: string,
  gruppe: string,
  higherIsBetter: boolean | null,
  format: TitelVergleichZeileDef['format'],
  kmFallbacks?: string[],
): TitelVergleichZeileDef {
  return { id, label, gruppe, higherIsBetter, format, quelle: 'km', kmFallbacks }
}

function zeile(
  id: string,
  label: string,
  gruppe: string,
  higherIsBetter: boolean | null,
  format: TitelVergleichZeileDef['format'],
): TitelVergleichZeileDef {
  return { id, label, gruppe, higherIsBetter, format, quelle: 'zeile' }
}

function hist(
  id: string,
  histFeld: string,
  label: string,
  gruppe: string,
  higherIsBetter: boolean | null,
  format: TitelVergleichZeileDef['format'],
): TitelVergleichZeileDef {
  return { id, label, gruppe, higherIsBetter, format, quelle: 'hist', histFeld }
}

/**
 * Volle Vergleichsmatrix — orientiert an Fundamentaldaten-Key-Metrics
 * + hist. Bewertung + Schätzungen. Sinnvolle Ampel-Richtung je Zeile.
 */
export const TITEL_VERGLEICH_ZEILEN: TitelVergleichZeileDef[] = [
  // —— Dividende ——
  km('div_yield', 'Div-Rendite (Markt)', 'Dividende', true, 'pct'),
  {
    id: 'pers_div_yield',
    label: 'Pers. Div-Rendite',
    gruppe: 'Dividende',
    higherIsBetter: true,
    format: 'pct',
    quelle: 'special',
  },
  km('payout', 'Ausschüttungsquote', 'Dividende', null, 'pct'),

  // —— Bewertung LTM ——
  km('ltm_pe', 'KGV (LTM)', 'Bewertung LTM', false, 'mult'),
  km('ltm_ps', 'KUV (LTM)', 'Bewertung LTM', false, 'mult'),
  km('ltm_pb', 'KBV (LTM)', 'Bewertung LTM', false, 'mult'),
  km('ltm_pfcf', 'KCV / FCF (LTM)', 'Bewertung LTM', false, 'mult'),
  km('ltm_fcf_rendite', 'FCF-Rendite (LTM)', 'Bewertung LTM', true, 'pct'),
  km('ltm_ev_rev', 'EV / Umsatz (LTM)', 'Bewertung LTM', false, 'mult', ['ntm_ev_rev']),
  {
    id: 'ltm_ev_ebitda',
    label: 'EV / EBITDA',
    gruppe: 'Bewertung LTM',
    higherIsBetter: false,
    format: 'mult',
    quelle: 'km',
    kmFallbacks: ['ntm_ev_ebitda'],
  },

  // —— Bewertung FY / Schätzungen ——
  km('ntm_pe', 'FY KGV (P/E)', 'Bewertung FY / Schätzung', false, 'mult'),
  km('ntm_ev_rev', 'FY EV / Umsatz', 'Bewertung FY / Schätzung', false, 'mult'),
  km('ntm_ev_ebitda', 'FY EV / EBITDA', 'Bewertung FY / Schätzung', false, 'mult'),
  km('ntm_mc_fcf', 'FY MC / FCF', 'Bewertung FY / Schätzung', false, 'mult'),
  km('ntm_fcf_rendite', 'FY FCF-Rendite', 'Bewertung FY / Schätzung', true, 'pct'),
  km('peg_ratio', 'PEG (Fwd)', 'Bewertung FY / Schätzung', false, 'mult'),
  km('target_price', 'Kursziel (Konsens)', 'Bewertung FY / Schätzung', null, 'zahl'),

  // —— Hist. Bewertung (eigene Historie) ——
  hist('hist_median_pe_5y', 'medianPe5y', 'KGV Median 5J', 'Hist. Bewertung', false, 'mult'),
  hist('hist_pe_pctl_5y', 'pePerzentil5y', 'KGV Perzentil 5J', 'Hist. Bewertung', false, 'pct'),
  hist('hist_pe_pctl_10y', 'pePerzentil10y', 'KGV Perzentil 10J', 'Hist. Bewertung', false, 'pct'),
  hist(
    'hist_median_fcf_yield_5y',
    'medianFcfYield5y',
    'FCF-Rendite Median 5J',
    'Hist. Bewertung',
    true,
    'pct',
  ),
  hist(
    'hist_median_ev_ebitda_5y',
    'medianEvEbitda5y',
    'EV/EBITDA Median 5J',
    'Hist. Bewertung',
    false,
    'mult',
  ),
  hist(
    'hist_ev_ebitda_pctl_5y',
    'evEbitdaPerzentil5y',
    'EV/EBITDA Perzentil 5J',
    'Hist. Bewertung',
    false,
    'pct',
  ),
  hist(
    'hist_ev_ebitda_pctl_10y',
    'evEbitdaPerzentil10y',
    'EV/EBITDA Perzentil 10J',
    'Hist. Bewertung',
    false,
    'pct',
  ),
  hist('hist_median_ev_rev_5y', 'medianEvRev5y', 'EV/Umsatz Median 5J', 'Hist. Bewertung', false, 'mult'),
  hist(
    'hist_ev_rev_pctl_5y',
    'evRevPerzentil5y',
    'EV/Umsatz Perzentil 5J',
    'Hist. Bewertung',
    false,
    'pct',
  ),

  // —— Wachstum historisch ——
  km('rev_cagr_3y', 'Umsatz-CAGR 3J', 'Wachstum historisch', true, 'pct'),
  km('rev_cagr_5y', 'Umsatz-CAGR 5J', 'Wachstum historisch', true, 'pct'),
  km('ebitda_cagr_3y', 'EBITDA-CAGR 3J', 'Wachstum historisch', true, 'pct'),
  km('eps_cagr_3y', 'EPS-CAGR 3J', 'Wachstum historisch', true, 'pct'),
  km('eps_cagr_5y', 'EPS-CAGR 5J', 'Wachstum historisch', true, 'pct'),
  km('fcf_je_aktie_cagr_5y', 'FCF/Aktie-CAGR 5J', 'Wachstum historisch', true, 'pct'),

  // —— Wachstum Schätzungen ——
  km('fwd_rev_cagr_2y', 'Erw. Umsatz-CAGR 2J', 'Wachstum Schätzung', true, 'pct'),
  km('fwd_ebitda_cagr_2y', 'Erw. EBITDA-CAGR 2J', 'Wachstum Schätzung', true, 'pct'),
  km('fwd_eps_cagr_2y', 'Erw. EPS-CAGR 2J', 'Wachstum Schätzung', true, 'pct'),

  // —— Qualität / Rentabilität ——
  km('ltm_brutto', 'Bruttomarge', 'Qualität', true, 'pct'),
  km('brutto_std_10y', 'Bruttomarge σ 10J', 'Qualität', false, 'pct'),
  km('ltm_ebit', 'EBIT-Marge', 'Qualität', true, 'pct'),
  zeile('fcf_marge', 'FCF-Marge', 'Qualität', true, 'pct'),
  km('ltm_roa', 'ROA', 'Qualität', true, 'pct'),
  km('ltm_roe', 'ROE', 'Qualität', true, 'pct'),
  km('ltm_roic', 'ROIC', 'Qualität', true, 'pct'),
  km('ltm_roic_ex_gw', 'ROIC ex Goodwill', 'Qualität', true, 'pct'),
  km('roic_5y_avg', 'ROIC Ø 5J', 'Qualität', true, 'pct'),
  km('wacc', 'WACC (geschätzt)', 'Qualität', false, 'pct'),
  km('ltm_value_spread', 'Value Spread (ROIC−WACC)', 'Qualität', true, 'pct'),
  km('incremental_roic', 'Incremental ROIC', 'Qualität', true, 'pct'),
  km('incremental_value_spread', 'Incr. Value Spread', 'Qualität', true, 'pct'),
  km('reinvest_quote', 'Reinvestitionsquote', 'Qualität', null, 'pct'),
  km('rule_of_40', 'Rule of 40', 'Qualität', true, 'pct'),
  km('nrr', 'Net Revenue Retention', 'Qualität', true, 'pct'),

  // —— Effizienz / Kapital ——
  km('fcf_conversion', 'FCF-Conversion', 'Effizienz', true, 'pct'),
  km('aktien_verwaesserung', 'Aktien-Verwässerung p.a.', 'Effizienz', false, 'pct'),
  km('sbc_fcf_ratio', 'SBC / FCF', 'Effizienz', false, 'pct'),
  km('sbc_ocf_ratio', 'SBC / OCF', 'Effizienz', false, 'pct'),
  km('sloan_ratio', 'Sloan Ratio', 'Effizienz', null, 'pct'),
  km('beneish_m', 'Beneish M-Score', 'Effizienz', false, 'zahl'),

  // —— Bilanz ——
  km('net_debt_ebitda', 'Net Debt / EBITDA', 'Bilanz', false, 'mult'),
  km('net_debt_fcf', 'Net Debt / FCF', 'Bilanz', false, 'mult'),
  km('interest_coverage', 'Zinsdeckung', 'Bilanz', true, 'mult'),

  // —— Marktdaten (kompakt) ——
  km('beta', 'Beta (5J vs. S&P)', 'Marktdaten', null, 'zahl'),
  km('float', 'Free Float', 'Marktdaten', null, 'pct'),
]
