/** npx tsx scripts/probe-sa-eu-whitelist.ts */
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { isinKenntnis } from '../lib/portfolio-analyse/isin-kenntnisse'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

const KNOWN: Record<string, string> = {
  HLMA: '/quote/lon/HLMA/metrics/revenue-by-segment/',
  WKL: '/quote/ams/WKL/metrics/revenue-by-segment/',
  SIKA: '/quote/swx/SIKA/metrics/revenue-by-segment/',
  STMN: '/quote/swx/STMN/metrics/revenue-by-segment/',
  ATD: '/quote/tsx/ATD/metrics/revenue-by-segment/',
  HESAY: '/stocks/hesay/metrics/revenue-by-segment/',
  RMS: '/quote/epa/RMS/metrics/revenue-by-segment/',
}

const EU = NACHKAUF_RADAR_WHITELIST.filter((p) => {
  const i = p.isin
  return !i.startsWith('US') && !i.startsWith('CA')
})

async function tryPath(p: string) {
  const res = await fetch(`https://stockanalysis.com${p}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15_000),
  })
  const html = await res.text()
  const ok = res.ok && /Date|Period Ending/i.test(html) && html.length > 30_000
  return ok
}

async function main() {
  for (const pos of EU) {
    const k = isinKenntnis(pos.isin)
    const sym = k?.symbolYahoo ?? '?'
    const paths = new Set<string>()
    for (const key of [k?.logoSymbol, k?.macrotrendsTicker, sym.split('.')[0]]) {
      const s = key?.trim().toUpperCase()
      if (!s) continue
      if (KNOWN[s]) paths.add(KNOWN[s]!)
      paths.add(`/stocks/${s.toLowerCase()}/metrics/revenue-by-segment/`)
      if (sym.includes('.')) {
        const [base, suf] = sym.split('.')
        const ex = { PA: 'epa', AS: 'ams', DE: 'etr', L: 'lon', SW: 'swx', CH: 'swx' }[suf ?? '']
        if (ex && base) paths.add(`/quote/${ex}/${base}/metrics/revenue-by-segment/`)
      }
    }
    let hit = ''
    for (const p of paths) {
      if (await tryPath(p)) {
        hit = p
        break
      }
    }
    console.log(pos.name.padEnd(22), hit || 'NONE', sym)
  }
}

main()
