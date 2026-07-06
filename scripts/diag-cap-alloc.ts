import { ladeSecCapitalAllocation } from '../lib/portfolio-analyse/sec-edgar-companyfacts-server'

async function main() {
  const cik = Number(process.argv[2] ?? 1652044)
  const r = await ladeSecCapitalAllocation(cik)
  console.log(JSON.stringify(r, null, 2))
}

main().catch(console.error)
