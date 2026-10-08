export type TitelVergleichKennzahlId =
  | 'div_yield'
  | 'pers_div_yield'
  | 'payout'
  | 'ltm_pe'
  | 'ltm_ps'
  | 'ltm_ev_ebitda'
  | 'ltm_fcf_rendite'
  | 'ltm_roic'
  | 'ltm_brutto'
  | 'fcf_marge'
  | 'rev_cagr_5y'
  | 'net_debt_ebitda'

export type TitelVergleichZeileDef = {
  id: TitelVergleichKennzahlId
  label: string
  gruppe: string
  higherIsBetter: boolean | null
  format: 'pct' | 'mult' | 'zahl'
}

export type TitelVergleichSpalte = {
  key: string
  isin: string | null
  name: string
  ticker: string
  symbolYahoo: string | null
  werte: Partial<Record<TitelVergleichKennzahlId, number | null>>
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

export const TITEL_VERGLEICH_ZEILEN: TitelVergleichZeileDef[] = [
  { id: 'div_yield', label: 'Div-Rendite (Markt)', gruppe: 'Dividende', higherIsBetter: true, format: 'pct' },
  {
    id: 'pers_div_yield',
    label: 'Pers. Div-Rendite',
    gruppe: 'Dividende',
    higherIsBetter: true,
    format: 'pct',
  },
  { id: 'payout', label: 'Ausschüttungsquote', gruppe: 'Dividende', higherIsBetter: null, format: 'pct' },
  { id: 'ltm_pe', label: 'KGV (LTM)', gruppe: 'Bewertung', higherIsBetter: false, format: 'mult' },
  { id: 'ltm_ps', label: 'KUV (LTM)', gruppe: 'Bewertung', higherIsBetter: false, format: 'mult' },
  {
    id: 'ltm_ev_ebitda',
    label: 'EV / EBITDA (FY)',
    gruppe: 'Bewertung',
    higherIsBetter: false,
    format: 'mult',
  },
  {
    id: 'ltm_fcf_rendite',
    label: 'FCF-Rendite',
    gruppe: 'Bewertung',
    higherIsBetter: true,
    format: 'pct',
  },
  { id: 'ltm_roic', label: 'ROIC', gruppe: 'Qualität', higherIsBetter: true, format: 'pct' },
  { id: 'ltm_brutto', label: 'Bruttomarge', gruppe: 'Qualität', higherIsBetter: true, format: 'pct' },
  { id: 'fcf_marge', label: 'FCF-Marge', gruppe: 'Qualität', higherIsBetter: true, format: 'pct' },
  {
    id: 'rev_cagr_5y',
    label: 'Umsatz-CAGR 5J',
    gruppe: 'Qualität',
    higherIsBetter: true,
    format: 'pct',
  },
  {
    id: 'net_debt_ebitda',
    label: 'Net Debt / EBITDA',
    gruppe: 'Bilanz',
    higherIsBetter: false,
    format: 'mult',
  },
]
