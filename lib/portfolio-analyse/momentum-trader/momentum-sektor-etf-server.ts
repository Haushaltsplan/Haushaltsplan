import 'server-only'

/** Sektor-ETF für Relative-Stärke vs. Branche (Yahoo/XLF-Style). */
const SEKTOR_ETF: Record<string, string> = {
  technology: 'XLK',
  technologie: 'XLK',
  'financial services': 'XLF',
  finanzdienstleistungen: 'XLF',
  healthcare: 'XLV',
  gesundheitswesen: 'XLV',
  'consumer cyclical': 'XLY',
  'zyklische konsumgüter': 'XLY',
  'consumer defensive': 'XLP',
  'defensive konsumgüter': 'XLP',
  energy: 'XLE',
  energie: 'XLE',
  industrials: 'XLI',
  industrie: 'XLI',
  'basic materials': 'XLB',
  grundstoffe: 'XLB',
  'real estate': 'XLRE',
  immobilien: 'XLRE',
  'communication services': 'XLC',
  kommunikation: 'XLC',
  utilities: 'XLU',
  versorger: 'XLU',
}

export function sektorEtfSymbol(sektor: string | null | undefined): string | null {
  if (!sektor?.trim()) return null
  const key = sektor.trim().toLowerCase()
  return SEKTOR_ETF[key] ?? null
}
