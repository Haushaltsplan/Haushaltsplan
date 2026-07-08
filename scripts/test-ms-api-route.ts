/** npx tsx scripts/test-ms-api-route.ts */
import { GET } from '../app/api/portfolio-analyse/marketscreener-segmente/route'

async function test(isin: string, name: string, symbol: string) {
  const url = `http://localhost/api/portfolio-analyse/marketscreener-segmente?isin=${isin}&name=${encodeURIComponent(name)}&symbol=${symbol}`
  const res = await GET(new Request(url))
  const j = (await res.json()) as { ok?: boolean; fehler?: string; paket?: { anzahl10k?: number } }
  console.log(`${j.ok ? 'OK' : 'FAIL'} ${name.padEnd(12)} status=${res.status} jahre=${j.paket?.anzahl10k ?? 0} ${j.fehler ?? ''}`)
  return j.ok
}

async function main() {
  const cases = [
    ['US5949181045', 'Microsoft', 'MSFT'],
    ['US92826C8394', 'Visa', 'V'],
    ['NL0010273215', 'ASML', 'ASML.AS'],
  ] as const
  let ok = 0
  for (const c of cases) {
    if (await test(...c)) ok++
  }
  process.exit(ok === cases.length ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
