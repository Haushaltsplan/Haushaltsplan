/** OpenFIGI exchange code → Yahoo Finance Symbol-Suffix. */
export function yahooSymbolAusTicker(ticker: string, exchCode: string): string {
  const t = ticker.trim().toUpperCase()
  const ex = exchCode.trim().toUpperCase()
  if (!t) return ''

  const usBoersen = new Set(['US', 'UW', 'UN', 'UA', 'UQ', 'UR', 'UC', 'UF', 'UM', 'UP', 'UB', 'UT', 'UX'])
  if (usBoersen.has(ex)) return t

  const suffixMap: Record<string, string> = {
    GY: 'DE',
    GB: 'DE',
    GF: 'F',
    GD: 'F',
    GS: 'SG',
    GH: 'HM',
    LN: 'L',
    XL: 'L',
    FP: 'PA',
    PM: 'PA',
    NA: 'AS',
    AS: 'AS',
    SW: 'SW',
    IM: 'MI',
    SQ: 'MC',
    SE: 'ST',
    SS: 'ST',
    HK: 'HK',
    JT: 'T',
    TO: 'TO',
    AX: 'AX',
    NZ: 'NZ',
  }

  const suffix = suffixMap[ex]
  if (suffix) return `${t}.${suffix}`
  if (ex.length === 2) return `${t}.${ex}`
  return t
}
