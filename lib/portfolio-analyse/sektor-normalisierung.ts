/** Einheitliche deutsche Sektor-Labels (GICS/Yahoo/manuell). */
const SEKTOR_KANONISCH: Record<string, string> = {
  'Information Technology': 'Informationstechnologie',
  Technology: 'Informationstechnologie',
  Informationstechnologie: 'Informationstechnologie',
  'Communication Services': 'Kommunikation',
  Kommunikation: 'Kommunikation',
  'Consumer Discretionary': 'Zyklischer Konsum',
  'Consumer Staples': 'Basiskonsum',
  'Health Care': 'Gesundheitswesen',
  Gesundheitswesen: 'Gesundheitswesen',
  Industrials: 'Industrie',
  Industrieunternehmen: 'Industrie',
  Industrie: 'Industrie',
  Financials: 'Finanzwesen',
  'Financial Services': 'Finanzwesen',
  Finanzunternehmen: 'Finanzwesen',
  Finanzwesen: 'Finanzwesen',
  Energy: 'Energie',
  Energie: 'Energie',
  Utilities: 'Versorger',
  Versorger: 'Versorger',
  'Real Estate': 'Immobilien',
  Immobilien: 'Immobilien',
  Materials: 'Grundstoffe',
  Grundstoffe: 'Grundstoffe',
  'ETF & Fonds': 'ETF & Fonds',
  'Nicht aufgelöst': 'Nicht aufgelöst',
  Sonstige: 'Sonstige',
  Unbekannt: 'Sonstige',
}

export function normalisiereSektor(name: string | null | undefined): string {
  const raw = name?.trim()
  if (!raw) return 'Sonstige'
  return SEKTOR_KANONISCH[raw] ?? SEKTOR_KANONISCH[raw.replace(/\s+/g, ' ')] ?? raw
}
