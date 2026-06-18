/**
 * Nachkauf-Radar — Whitelist der Depot-Positionen.
 *
 * Nur diese 32 Quality-Positionen werden gescannt.
 * Ergänzt die ISIN-Kenntnisse mit Ticker und Anzeigename.
 */

export type WhitelistPosition = {
  isin: string
  name: string
}

export const NACHKAUF_RADAR_WHITELIST: WhitelistPosition[] = [
  { isin: 'US02079K1079', name: 'Alphabet C' },
  { isin: 'US57636Q1040', name: 'Mastercard' },
  { isin: 'US78409V1044', name: 'S&P Global' },
  { isin: 'FR0000052292', name: 'Hermès' },
  { isin: 'NL0010273215', name: 'ASML Holding' },
  { isin: 'US91324P1021', name: 'UnitedHealth' },
  { isin: 'US5949181045', name: 'Microsoft' },
  { isin: 'US8835561023', name: 'Thermo Fisher Scientific' },
  { isin: 'US55354G1004', name: 'MSCI' },
  { isin: 'US92826C8394', name: 'Visa' },
  { isin: 'US7611521078', name: 'ResMed' },
  { isin: 'US6795801009', name: 'Old Dominion Freight Line' },
  { isin: 'US94106L1098', name: 'Waste Management' },
  { isin: 'US98978V1035', name: 'Zoetis' },
  { isin: 'US9078181081', name: 'Union Pacific' },
  { isin: 'US5801351017', name: "McDonald's" },
  { isin: 'US81762P1021', name: 'ServiceNow' },
  { isin: 'US0576652004', name: 'Balchem' },
  { isin: 'IE000S9YS762', name: 'Linde' },
  { isin: 'CH1175448666', name: 'Straumann Holding' },
  { isin: 'US23804L1035', name: 'Datadog' },
  { isin: 'GB0004052071', name: 'Halma' },
  { isin: 'US4370761029', name: 'The Home Depot' },
  { isin: 'CH0418792922', name: 'Sika' },
  { isin: 'US49714P1084', name: 'Kinsale Capital' },
  { isin: 'US3841091040', name: 'Graco' },
  { isin: 'US9224751084', name: 'Veeva Systems' },
  { isin: 'CA01626P1484', name: 'Alimentation Couche-Tard' },
  { isin: 'US0404132054', name: 'Arista Networks' },
  { isin: 'US7757111049', name: 'Rollins' },
  { isin: 'NL0000395903', name: 'Wolters Kluwer' },
  { isin: 'US1729081059', name: 'Cintas' },
]
