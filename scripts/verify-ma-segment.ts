/** Verify MA segment paket after SEC fallback. */
import { readFileSync } from 'fs'
import { ladeGescrapteSegmentStruktur } from '../lib/portfolio-analyse/segment-struktur-scraper-server'

function loadEnv() {
  try {
    const raw = readFileSync('.env.local', 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1]!.trim()] = m[2]!.trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* */
  }
}
loadEnv()

async function main() {
  const paket = await ladeGescrapteSegmentStruktur({
    isin: 'US57636Q1040',
    name: 'Mastercard',
    ticker: 'MA',
    symbolYahoo: 'MA',
    refresh: true,
  })
  const j = paket?.produkt?.jahre.at(-1)
  console.log('quelle', paket?.quelle)
  console.log('FY', j?.jahr)
  console.log(j?.segmente.map((s) => `${s.name} ${s.anteilPct?.toFixed(0)}% ($${(s.umsatzMio! / 1000).toFixed(1)}B)`).join('\n'))
}

main().catch(console.error)
