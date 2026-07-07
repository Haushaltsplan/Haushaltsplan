import { readFileSync } from 'fs'

const sym = process.argv[2] ?? 'ODFL'
const h = readFileSync(`scripts/.cache-${sym}.html`, 'utf8')

type Ctx = { dims: Record<string, string>; endYear?: number }
const contexts = new Map<string, Ctx>()
for (const m of h.matchAll(/<xbrli:context id="([^"]+)"[^>]*>([\s\S]*?)<\/xbrli:context>/gi)) {
  const dims: Record<string, string> = {}
  for (const em of m[2].matchAll(/dimension="([^"]+)"[^>]*>([^<]+)</gi)) {
    dims[em[1]!.split(':').pop()!] = em[2]!.replace(/^[^:]+:/, '')
  }
  const end = m[2].match(/<xbrli:endDate>(\d{4})/)?.[1]
  contexts.set(m[1]!, { dims, endYear: end ? parseInt(end, 10) : undefined })
}

function scaledVal(attrs: string, raw: string): number {
  const scale = parseInt(attrs.match(/scale="(-?\d+)"/)?.[1] ?? '0', 10)
  const n = parseFloat(raw.replace(/<[^>]+>/g, '').replace(/,/g, '').replace(/\(([^)]+)\)/, '-$1'))
  if (!Number.isFinite(n)) return NaN
  return n * Math.pow(10, scale)
}

const byDim = new Map<string, Map<number, { tag: string; val: number }>>()

for (const m of h.matchAll(/<ix:nonFraction([^>]*)contextRef="([^"]+)"([^>]*)name="([^"]+)"([^>]*)>([\s\S]*?)<\/ix:nonFraction>/gi)) {
  const attrs = m[1] + m[3] + m[5]
  if (/xsi:nil="true"/i.test(attrs)) continue
  const ctx = contexts.get(m[2]!)
  if (!ctx?.endYear) continue
  const tag = m[4]!.replace(/^[^:]+:/, '')
  if (!/Revenue|Sales|Freight|Premium|OperatingRevenue/i.test(tag)) continue
  const geo = Object.entries(ctx.dims).find(([k]) => /Geographical|Geographic|Country/i.test(k))
  const prod = Object.entries(ctx.dims).find(([k]) => /Product|Service|Commodity|Business|LineOfBusiness/i.test(k))
  if (!geo && !prod) continue
  const val = scaledVal(attrs, m[6]!)
  if (!Number.isFinite(val) || val <= 0) continue
  const key = geo ? `geo:${geo[1]}` : `prod:${prod![1]}`
  if (/elimination|intersegment|parent|consolidated/i.test(key)) continue
  let ym = byDim.get(key)
  if (!ym) { ym = new Map(); byDim.set(key, ym) }
  const prev = ym.get(ctx.endYear!)
  if (!prev || val > prev.val) ym.set(ctx.endYear!, { tag, val })
}

console.log(`\n${sym}:`)
for (const kind of ['geo', 'prod'] as const) {
  const entries = [...byDim.entries()].filter(([k]) => k.startsWith(kind + ':'))
  console.log(kind.toUpperCase(), entries.length)
  for (const [k, ym] of entries.sort((a, b) => b[1].size - a[1].size)) {
    const ys = [...ym.entries()].sort((a, b) => a[0] - b[0])
    console.log(`  ${k.replace(/Member$/i, '')}:`, ys.map(([y, { val, tag }]) => `${y}=$${(val / 1e6).toFixed(0)}M (${tag})`).join(', '))
  }
}
