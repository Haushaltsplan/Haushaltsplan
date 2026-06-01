export function teileArray<T>(arr: T[], groesse: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += groesse) out.push(arr.slice(i, i + groesse))
  return out
}
