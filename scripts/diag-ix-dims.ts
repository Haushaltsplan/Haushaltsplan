/**
 * Extract dimensional revenue from inline iXBRL facts
 */
import { readFileSync } from 'fs'

const sym = process.argv[2] ?? 'ODFL'
const h = readFileSync(`scripts/.cache-${sym}.html`, 'utf8')

// Parse contexts with geographic/product dimensions
type Ctx = { id: string; dims: Record<string, string>; fy?: number; fp?: string }
const contexts = new Map<string, Ctx>()
const ctxRe = /<xbrli:context id="([^"]+)"[^>]*>([\s\S]*?)<\/xbrli:context>/gi
let m: RegExpExecArray | null
while ((m = ctxRe.exec(h))) {
  const id = m[1]!
  const body = m[2]!
  const dims: Record<string, string> = {}
  for (const em of body.matchAll(/dimension="([^"]+)"[^>]*>([^<]+)</gi)) {
    dims[em[1]!] = em[2]!.replace(/^[^:]+:/, '')
  }
  const end = body.match(/<xbrli:endDate>(\d{4})/)?.[1]
  const instant = body.match(/<xbrli:instant>(\d{4})/)?.[1]
  const fp = body.match(/<xbrli:period>[\s\S]*?<xbrli:([^>]+)>/)?.[1]
  contexts.set(id, { id, dims, fy: parseInt(end ?? instant ?? '0', 10), fp: fp ?? '' })
}

const revenueTags = /Revenue|Sales|Freight|Premium|OperatingRevenue/i
const facts = new Map<string, Map<number, number>>()

const factRe = /<ix:nonFraction[^>]*contextRef="([^"]+)"[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/ix:nonFraction>/gi
while ((m = factRe.exec(h))) {
  const ctxId = m[1]!
  const tag = m[2]!.replace(/^[^:]+:/, '')
  if (!revenueTags.test(tag)) continue
  const ctx = contexts.get(ctxId)
  if (!ctx?.fy) continue
  const geoDim = Object.entries(ctx.dims).find(([k]) => /Geographical|Geographic|Country/i.test(k))
  const prodDim = Object.entries(ctx.dims).find(([k]) => /Product|Service|Commodity|Business|LineOfBusiness/i.test(k))
  if (!geoDim && !prodDim) continue
  const val = parseFloat(m[3].replace(/<[^>]+>/g, '').replace(/,/g, '').replace(/\(([^)]+)\)/, '-$1'))
  if (!Number.isFinite(val) || val <= 0) continue
  const dimKey = geoDim ? `geo:${geoDim[1]}` : `prod:${prodDim![1]}`
  if (/consolidat|total|elimination|parent|reportable/i.test(dimKey)) continue
  let map = facts.get(dimKey)
  if (!map) { map = new Map(); facts.set(dimKey, map) }
  const prev = map.get(ctx.fy)
  if (prev == null || val > prev) map.set(ctx.fy, val)
}

console.log(`\n${sym} dimensional revenue facts:`)
const geo = [...facts.entries()].filter(([k]) => k.startsWith('geo:'))
const prod = [...facts.entries()].filter(([k]) => k.startsWith('prod:'))
console.log('GEO:', geo.length)
for (const [k, jahre] of geo.sort((a, b) => b[1].size - a[1].size)) {
  const ys = [...jahre.entries()].sort((a, b) => a[0] - b[0])
  console.log(`  ${k}: ${ys.length}J`, ys.map(([y, v]) => `${y}=${(v/1e6).toFixed(0)}M`).join(', '))
}
console.log('PROD:', prod.length)
for (const [k, jahre] of prod.sort((a, b) => b[1].size - a[1].size).slice(0, 15)) {
  const ys = [...jahre.entries()].sort((a, b) => a[0] - b[0])
  console.log(`  ${k}: ${ys.length}J`, ys.map(([y, v]) => `${y}=${(v/1e6).toFixed(0)}M`).join(', '))
}
