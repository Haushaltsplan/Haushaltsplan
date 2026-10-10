/**
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/verify-ma-aktuell-quartale.ts
 */
import { ladeGescrapteSegmentStruktur } from '../lib/portfolio-analyse/segment-struktur-scraper-server'

async function main() {
  const paket = await ladeGescrapteSegmentStruktur({
    ticker: 'MA',
    symbolYahoo: 'MA',
    isin: 'US57636Q1040',
    name: 'Mastercard',
    refresh: true,
  })
  if (!paket) {
    console.log('NULL')
    process.exit(1)
  }
  console.log('quelle', paket.quelle)
  console.log(
    'produkt FY',
    paket.produkt?.aeltestesJahr,
    '–',
    paket.produkt?.juengstesJahr,
    paket.produkt?.anzahlJahre,
    'J',
  )
  console.log(
    'last FY',
    paket.produkt?.jahre.at(-1)?.jahr,
    paket.produkt?.jahre
      .at(-1)
      ?.segmente.map((s) => `${s.name}=${s.umsatzMio}`)
      .join(' | '),
  )
  console.log(
    'geo FY',
    paket.geo?.aeltestesJahr,
    '–',
    paket.geo?.juengstesJahr,
    paket.geo?.jahre
      .at(-1)
      ?.segmente.map((s) => `${s.name}=${s.anteilPct?.toFixed(0)}%`)
      .join(' | '),
  )
  console.log('produktQuartale', paket.produktQuartale?.anzahlPerioden ?? 0)
  for (const p of paket.produktQuartale?.perioden.slice(-4) ?? []) {
    console.log(
      ' ',
      p.label,
      p.segmente.map((s) => `${s.name}=${s.umsatzMio}(${s.anteilPct?.toFixed(0)}%)`).join(' | '),
    )
  }
  console.log('geoQuartale', paket.geoQuartale?.anzahlPerioden ?? 0)
  for (const p of paket.geoQuartale?.perioden.slice(-4) ?? []) {
    console.log(
      ' ',
      p.label,
      p.segmente.map((s) => `${s.name}=${s.anteilPct?.toFixed(0)}%`).join(' | '),
    )
  }

  const ok =
    (paket.produkt?.juengstesJahr ?? 0) >= 2025 &&
    (paket.produktQuartale?.anzahlPerioden ?? 0) >= 2 &&
    (paket.geoQuartale?.anzahlPerioden ?? 0) >= 2
  console.log('OK=', ok)
  if (!ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
