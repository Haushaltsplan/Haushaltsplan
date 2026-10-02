/**
 * Deep controller: LTM-Flows, CAGR, EBIT-Ableitung, EV ohne ND.
 * npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/verify-quartals-deep.ts
 */
import { baueKontextWerte } from '../lib/portfolio-analyse/fundamentaldaten-kontext-werte'
import { ergaenzeMargenZeilen } from '../lib/portfolio-analyse/fundamentaldaten-margen-zeilen'
import { ergaenzeNettoverschuldungZeilen } from '../lib/portfolio-analyse/fundamentaldaten-nettoverschuldung-zeilen'
import { ergaenzeQuartalsRenditenTTM } from '../lib/portfolio-analyse/fundamentaldaten-roic-berechnung'
import { enterpriseValueMioFuerKey } from '../lib/portfolio-analyse/fundamentaldaten-ev-multiples-zeilen'
import { ttmOderLetzterFlow } from '../lib/portfolio-analyse/fundamentaldaten-roic-hilfen'
import { cagr3AusSerie, cagr5AusSerie } from '../lib/portfolio-analyse/fundamentaldaten-format'
import { ladeSecFundamentaldaten } from '../lib/portfolio-analyse/sec-fundamentaldaten-server'

async function main() {
  let fail = 0

  // CAGR: 13 Quartale mit +10%/Jahr YoY → cagr3 ≈ 10
  const qSerie: number[] = []
  for (let i = 0; i < 13; i++) qSerie.push(100 * Math.pow(1.1, i / 4))
  const c3 = cagr3AusSerie(qSerie, { quartal: true })
  if (c3 == null || Math.abs(c3 - 10) > 1.5) {
    console.log('FAIL cagr3 quartal', c3)
    fail++
  } else console.log('OK cagr3 quartal', c3.toFixed(1))

  // Ohne quartal-Flag würde slice(-4) ≈ QoQ annualisiert falsch sein
  const c3falsch = cagr3AusSerie(qSerie)
  if (c3falsch != null && Math.abs(c3falsch - 10) < 2) {
    console.log('WARN annual-cagr on Q-serie coincidentally ~10', c3falsch)
  }

  const roh = await ladeSecFundamentaldaten(
    { ticker: 'ROL', slug: 'rollins', firmenname: 'Rollins' },
    'quartal',
  )
  if (!roh) {
    console.log('FAIL kein ROL')
    process.exit(1)
  }
  ergaenzeNettoverschuldungZeilen(roh.perioden, roh.zeilen, { ohneEbitdaMultiple: true })
  ergaenzeMargenZeilen(roh.perioden, roh.zeilen)
  ergaenzeQuartalsRenditenTTM(roh.perioden, roh.zeilen)

  const umsatz = roh.zeilen.find((z) => z.id === 'umsatz')!
  const ttmU = ttmOderLetzterFlow(umsatz, roh.perioden)
  const lastU = umsatz.werte[roh.perioden.filter((p) => !p.istLtm).at(-1)!.iso]
  if (ttmU == null || lastU == null || ttmU < lastU * 2.5) {
    console.log('FAIL ttmUmsatz nicht ~4× Quartal', ttmU, lastU)
    fail++
  } else console.log('OK ttmUmsatz', ttmU.toFixed(0), 'vs Q', lastU.toFixed(0))

  // EBIT 2016 abgeleitet, Marge plausibel
  const ebit2016 = roh.zeilen.find((z) => z.id === 'ebit')?.werte['2016-03-31']
  const u2016 = umsatz.werte['2016-03-31']
  if (ebit2016 == null || u2016 == null || ebit2016 / u2016 < 0.08 || ebit2016 / u2016 > 0.35) {
    console.log('FAIL EBIT-Ableitung 2016', ebit2016, u2016)
    fail++
  } else console.log('OK EBIT 2016', ebit2016, 'marge', ((ebit2016 / u2016) * 100).toFixed(1))

  // EV ohne ND → null
  const lean = [
    {
      id: 'marktkapitalisierung',
      label: 'MC',
      gruppe: 'bewertung_trailing' as const,
      einheit: 'waehrung_usd_mio' as const,
      werte: { '2024-12-31': 100_000 },
    },
  ]
  const ev = enterpriseValueMioFuerKey(lean, '2024-12-31')
  if (ev != null) {
    console.log('FAIL EV ohne ND sollte null', ev)
    fail++
  } else console.log('OK EV ohne ND = null')

  const ctx = baueKontextWerte({
    yahoo: null,
    roh: { perioden: roh.perioden, zeilen: roh.zeilen },
    schaetzungen: { perioden: [], zeilen: [] },
    yahooFinanz: null,
  })
  if (ctx.netDebtEbitda != null && ctx.netDebtEbitda > 8) {
    console.log('FAIL ND/EBITDA zu hoch (Quartals-EBITDA?)', ctx.netDebtEbitda)
    fail++
  } else console.log('OK ND/EBITDA', ctx.netDebtEbitda)
  if (ctx.umsatzCagr3 != null && (ctx.umsatzCagr3 < 0 || ctx.umsatzCagr3 > 40)) {
    console.log('WARN umsatzCagr3 ungewöhnlich', ctx.umsatzCagr3)
  } else console.log('OK umsatzCagr3', ctx.umsatzCagr3)

  if (fail > 0) {
    console.error(`\n${fail} Fehler`)
    process.exit(1)
  }
  console.log('\nDeep-Checks OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
