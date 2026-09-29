/**
 * Smoke: SEC-Frames → Screener-Universum
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/verify-screener-sec.ts
 */
import { baueScreenerSnapshot } from '../lib/portfolio-analyse/screener/screener-sec-frames-server'

async function main() {
  const t0 = Date.now()
  const snap = await baueScreenerSnapshot()
  const ms = Date.now() - t0
  const ma = snap.zeilen.find((z) => z.ticker === 'MA')
  const msft = snap.zeilen.find((z) => z.ticker === 'MSFT')
  console.log(`OK n=${snap.n} periode=${snap.periode} ${ms}ms`)
  console.log('MA jahre', ma?.jahreAnzahl, ma?.vonJahr, ma?.bisJahr, 'cagr5', ma?.umsatzCagr5y, 'kgv', ma?.kgv, 'kurs', ma?.kurs)
  console.log('MSFT jahre', msft?.jahreAnzahl, msft?.vonJahr, msft?.bisJahr, 'cagr5', msft?.umsatzCagr5y, 'kgv', msft?.kgv)
  if (snap.n < 3000) {
    console.error('FAIL zu wenig Titel')
    process.exit(1)
  }
  if (!ma?.umsatzMio || ma.umsatzMio < 10_000) {
    console.error('FAIL MA Umsatz')
    process.exit(1)
  }
  if ((ma.jahreAnzahl ?? 0) < 8) {
    console.error('FAIL MA Historie zu kurz', ma.jahreAnzahl)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
