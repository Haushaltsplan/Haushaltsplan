import { writeFileSync } from 'fs'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const ms = await (
    await fetch(
      'https://www.marketscreener.com/quote/stock/HERMES-INTERNATIONAL-4657/finances/',
      { headers: { 'User-Agent': UA, Accept: 'text/html', Referer: 'https://www.marketscreener.com/' } },
    )
  ).text()

  const idx = ms.indexOf('income-statement-annual')
  const block = ms.slice(idx, idx + 350_000)
  const table = [...block.matchAll(/<table[\s\S]*?<\/table>/gi)].find((t) => /Net sales|Revenue|Umsatz/i.test(t[0]))?.[0]
  console.log('table found', Boolean(table), 'len', table?.length)
  if (table) {
    const labels = [...table.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((l) => l.length > 2 && l.length < 60 && !/^\d|^\(|^€|^\$/.test(l))
    console.log('labels sample', [...new Set(labels)].slice(0, 40))
  }

  // Also try all tables with Gross
  const gi = ms.search(/Gross (profit|margin)|Marge brute|Résultat brut/i)
  console.log('gross idx in finances', gi, ms.slice(Math.max(0, gi - 50), gi + 120).replace(/\s+/g, ' '))

  const sa = await (
    await fetch('https://stockanalysis.com/quote/epa/RMS/financials/', {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
    })
  ).text()

  // Find script with financial data
  for (const pat of ['annualData', 'income', 'data:', 'fiscalYear', 'periodEnding']) {
    console.log('SA has', pat, sa.includes(pat))
  }
  const scripts = [...sa.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
  console.log('scripts', scripts.length)
  for (const s of scripts) {
    const body = s[1]
    if (body.length < 500) continue
    if (/11379|11,?379|Gross|revenue/i.test(body) && /\d{4}/.test(body)) {
      console.log('candidate script len', body.length, body.slice(0, 200).replace(/\s+/g, ' '))
      writeFileSync('scripts/_sa-rms-script.txt', body.slice(0, 15000))
      const nums = body.match(/11,?379|6402|11379/)
      console.log('num hit', nums)
      break
    }
  }

  // Table rows in SA
  const tr = [...sa.matchAll(/Gross Profit[\s\S]{0,800}/i)][0]?.[0]
  console.log('SA gross row', tr?.replace(/\s+/g, ' ').slice(0, 500))
}

main().catch(console.error)
