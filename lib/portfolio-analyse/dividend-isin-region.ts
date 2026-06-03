/** EU-/EWR-ISIN → keine Yahoo-Schätzung, nur DivvyDiary-Zahltage. */
export function istEuEwrIsin(isin: string | null | undefined): boolean {
  const s = isin?.trim().toUpperCase() ?? ''
  if (s.length < 2) return false
  return /^(AT|BE|CH|DE|DK|ES|FI|FR|GB|GR|IE|IT|LU|NL|NO|PL|PT|SE)/.test(s)
}
