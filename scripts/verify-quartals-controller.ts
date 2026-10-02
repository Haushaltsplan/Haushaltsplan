/**
 * Controller-Checks für Quartals-Kennzahlen (TTM-Renditen, WC-Tage, FCF).
 *
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/verify-quartals-controller.ts
 */
import { ergaenzeMargenZeilen } from '../lib/portfolio-analyse/fundamentaldaten-margen-zeilen'
import { ergaenzeNettoverschuldungZeilen } from '../lib/portfolio-analyse/fundamentaldaten-nettoverschuldung-zeilen'
import { ergaenzeQuartalsRenditenTTM } from '../lib/portfolio-analyse/fundamentaldaten-roic-berechnung'
import { ladeSecFundamentaldaten } from '../lib/portfolio-analyse/sec-fundamentaldaten-server'

function g(
  zeilen: { id: string; werte: Record<string, number | null> }[],
  id: string,
  iso: string,
): number | null {
  const v = zeilen.find((z) => z.id === id)?.werte[iso]
  return v != null && Number.isFinite(v) ? v : null
}

async function main() {
  let fail = 0
  for (const t of ['ROL', 'MA', 'MSFT']) {
    const roh = await ladeSecFundamentaldaten(
      { ticker: t, slug: t.toLowerCase(), firmenname: t },
      'quartal',
    )
    if (!roh) {
      console.log('FAIL', t, 'kein Paket')
      fail++
      continue
    }
    ergaenzeNettoverschuldungZeilen(roh.perioden, roh.zeilen, { ohneEbitdaMultiple: true })
    ergaenzeMargenZeilen(roh.perioden, roh.zeilen)
    ergaenzeQuartalsRenditenTTM(roh.perioden, roh.zeilen)

    const ps = roh.perioden.filter((p) => !p.istLtm).map((p) => p.iso)
    // ROE/ROA/ROIC: letztes verfügbares Quartal mit Wert (nicht zwingend letzte Spalte)
    const lastRoe = [...ps].reverse().map((iso) => g(roh.zeilen, 'roe', iso)).find((v) => v != null) ?? null
    const lastRoa = [...ps].reverse().map((iso) => g(roh.zeilen, 'roa', iso)).find((v) => v != null) ?? null
    const lastRoi = [...ps].reverse().map((iso) => g(roh.zeilen, 'roi', iso)).find((v) => v != null) ?? null
    const lastDso = [...ps].reverse().map((iso) => g(roh.zeilen, 'dso', iso)).find((v) => v != null) ?? null
    const last = ps[ps.length - 1]!
    const fcf = g(roh.zeilen, 'fcf', last)
    const ocf = g(roh.zeilen, 'ocf', last)
    const capex = g(roh.zeilen, 'capex', last)
    const ndE = [...ps].reverse().map((iso) => g(roh.zeilen, 'net_debt_ebitda', iso)).find((v) => v != null) ?? null

    if (lastRoe != null && lastRoe > 0 && lastRoe < 5) {
      console.log(`FAIL ${t} ROE ${lastRoe}% wirkt wie Einzelquartal`)
      fail++
    }
    if (lastRoa != null && lastRoa > 0 && lastRoa < 1.5) {
      console.log(`FAIL ${t} ROA ${lastRoa}% wirkt wie Einzelquartal`)
      fail++
    }
    if (t === 'ROL' && (lastRoi == null || lastRoi < 15)) {
      console.log(`FAIL ROL ROIC ${lastRoi} zu niedrig`)
      fail++
    }
    if (lastDso != null && lastDso > 200) {
      console.log(`FAIL ${t} DSO ${lastDso}d wirkt wie Quartals×365`)
      fail++
    }
    if (ocf != null && capex == null && fcf != null) {
      console.log(`FAIL ${t} FCF ohne CapEx`)
      fail++
    }
    if (ocf != null && capex != null && fcf != null) {
      const expect = Math.round((ocf + capex) * 1000) / 1000
      if (Math.abs(fcf - expect) > 0.1) {
        console.log(`FAIL ${t} FCF≠OCF+CapEx`, fcf, expect)
        fail++
      }
    }
    // MSFT/MA: FY-Ende muss Bilanz haben
    if (t === 'MSFT' || t === 'MA') {
      const ekLast = g(roh.zeilen, 'eigenkapital', last)
      if (ekLast == null) {
        console.log(`FAIL ${t} Eigenkapital am letzten Quartal fehlt (10-K Instant?)`)
        fail++
      }
    }

    console.log(
      'CHECK',
      t,
      `roe=${lastRoe}`,
      `roa=${lastRoa}`,
      `roi=${lastRoi}`,
      `dso=${lastDso}`,
      `nd/ebitda=${ndE}`,
      `fcf=${fcf}`,
      `ekLast=${g(roh.zeilen, 'eigenkapital', last)}`,
    )
  }

  if (fail > 0) {
    console.error(`\n${fail} Fehler`)
    process.exit(1)
  }
  console.log('\nController-Checks OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
