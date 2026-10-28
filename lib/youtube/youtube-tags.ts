/** YouTube zählt alle Tags zusammen, Kommas inklusive, bis 500 Zeichen. */

export function tagBereinigen(roh: string): string {
  return roh.replace(/#/g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
}

export function tagsZusammen(automatisch: string[], eigene: string[]): string[] {
  const unique: string[] = []
  let zeichen = 0
  for (const roh of [...eigene, ...automatisch]) {
    const n = tagBereinigen(roh)
    if (!n || unique.some((u) => u.toLowerCase() === n.toLowerCase())) continue
    const kosten = n.length + (unique.length ? 1 : 0)
    if (unique.length >= 30 || zeichen + kosten > 500) break
    unique.push(n)
    zeichen += kosten
  }
  return unique
}

export function tagsSichtbar(automatisch: string[], eigene: string[], ohne: string[]): string[] {
  const weg = new Set(ohne.map((t) => t.toLowerCase()))
  return tagsZusammen(
    automatisch.filter((t) => !weg.has(t.toLowerCase())),
    eigene,
  )
}
