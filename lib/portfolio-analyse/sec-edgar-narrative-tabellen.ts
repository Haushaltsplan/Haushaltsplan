/**
 * Segment-Tabellen in Fließtext/HTML ohne iXBRL-TextBlock (z. B. KNSL Prämien nach Sparte).
 */

import {
  anteileBerechnen,
  parseMehrjahresSegmenteDetail,
  type SecSegmentJahrEintrag,
  type SecSegmentRoh,
} from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

function extrahiereErsteTabelleNach(html: string, startIdx: number): string | null {
  const chunk = html.slice(startIdx, startIdx + 100_000)
  const t0 = chunk.indexOf('<table')
  if (t0 < 0) return null
  const t1 = chunk.indexOf('</table>', t0)
  if (t1 < 0) return null
  return chunk.slice(t0, t1 + 8)
}

function zellenText(tdHtml: string): string {
  return tdHtml
    .replace(/<ix:nonfraction[^>]*>([\s\S]*?)<\/ix:nonfraction>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseBetragTausend(z: string): number | null {
  const s = z.replace(/[$%\s]/g, '').replace(/,/g, '').trim()
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null
  const n = parseFloat(s)
  return Number.isFinite(n) && n >= 10_000 ? n : null
}

function parseCommercialPersonalGeo(table: string): SecSegmentJahrEintrag[] {
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
  const jahre: number[] = []

  for (const row of rows.slice(0, 6)) {
    const zellen = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => zellenText(c[1]!))
    for (const z of zellen) {
      const y = parseInt(z, 10)
      if (y >= 2015 && y <= 2035) jahre.push(y)
    }
    if (jahre.length >= 2) break
  }
  if (jahre.length < 2) return []

  const byJahr = new Map<number, SecSegmentRoh[]>()

  for (const row of rows) {
    const zellen = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => zellenText(c[1]!))
    if (zellen.length < 2) continue
    const label = zellen[0]!.toLowerCase()
    if (!label.startsWith('total commercial') && !label.startsWith('total personal')) continue
    const name = label.includes('commercial') ? 'Commercial' : 'Personal'

    const betraege: number[] = []
    for (const z of zellen.slice(1)) {
      const n = parseBetragTausend(z)
      if (n != null) betraege.push(n)
    }

    for (let i = 0; i < Math.min(jahre.length, betraege.length); i++) {
      const jahr = jahre[i]!
      const umsatzMio = Math.round(betraege[i]! / 1000)
      let seg = byJahr.get(jahr)
      if (!seg) {
        seg = []
        byJahr.set(jahr, seg)
      }
      seg.push({ name, umsatzMio, anteilPct: null })
    }
  }

  return [...byJahr.entries()]
    .sort((a, b) => a[0] - b[0])
    .filter(([, seg]) => seg.length >= 2)
    .map(([jahr, segmente]) => ({ jahr, segmente: anteileBerechnen(segmente) }))
}

export function extrahiereNarrativeSegmentTabellen(html: string): {
  produkt: SecSegmentJahrEintrag[]
  geo: SecSegmentJahrEintrag[]
} {
  const produkt: SecSegmentJahrEintrag[] = []
  const geo: SecSegmentJahrEintrag[] = []

  const idx = html.search(/premiums written by division/i)
  if (idx >= 0) {
    const table = extrahiereErsteTabelleNach(html, idx)
    if (table && table.length > 500) {
      const det = parseMehrjahresSegmenteDetail(table, 'produkt')
      for (const j of det) {
        const segmente = j.segmente.filter(
          (s) =>
            (s.umsatzMio ?? 0) >= 10 &&
            !/^total/i.test(s.name) &&
            !/^commercial:?$/i.test(s.name) &&
            !/^personal:?$/i.test(s.name),
        )
        if (segmente.length >= 2) {
          produkt.push({ jahr: j.jahr, segmente: anteileBerechnen(segmente) })
        }
      }
      const g = parseCommercialPersonalGeo(table)
      if (g.length >= 2) geo.push(...g)
    }
  }

  return { produkt, geo }
}
