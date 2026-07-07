import { readFileSync } from 'fs'

const sym = process.argv[2] ?? 'UNP'
const h = readFileSync(`scripts/.cache-${sym}.html`, 'utf8')

// All explicit members in contexts
const members = new Set<string>()
for (const m of h.matchAll(/explicitMember dimension="([^"]+)"[^>]*>([^<]+)</gi)) {
  members.add(`${m[1].split(':').pop()}:${m[2].replace(/^[^:]+:/, '')}`)
}
console.log('Unique dimension members (sample):')
for (const x of [...members].sort().filter((s) => /geograph|country|domestic|foreign|product|service|commodity/i.test(s))) {
  console.log(' ', x)
}

// ODFL percentage geo
if (sym === 'ODFL') {
  console.log('\nODFL PercentageOfRevenue facts with geo:')
  for (const m of h.matchAll(/<ix:nonFraction([^>]*)contextRef="([^"]+)"([^>]*)name="([^"]+)"([^>]*)>([\s\S]*?)<\/ix:nonFraction>/gi)) {
    const tag = m[4]!.replace(/^[^:]+:/, '')
    if (!/Percentage|Revenue/i.test(tag)) continue
    const ctxId = m[2]!
    const ctx = h.match(new RegExp(`<xbrli:context id="${ctxId}"[^>]*>([\\s\\S]*?)</xbrli:context>`))?.[1] ?? ''
    if (!/Geographical|Geographic/i.test(ctx)) continue
    const geo = ctx.match(/explicitMember[^>]*>([^<]+)</)?.[1]?.replace(/^[^:]+:/, '')
    const scale = parseInt((m[1]+m[3]+m[5]).match(/scale="(-?\d+)"/)?.[1] ?? '0', 10)
    const val = parseFloat(m[6].replace(/<[^>]+>/g, '').replace(/,/g, '')) * Math.pow(10, scale)
    const year = ctx.match(/endDate>(\d{4})/)?.[1]
    console.log(`  ${year} ${geo} ${tag} = ${val}`)
  }
}
