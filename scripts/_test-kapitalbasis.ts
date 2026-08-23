/**
 * Diagnose: Kapitalbasis + ROIIC aus SEC-XBRL für beliebige Ticker.
 * Aufruf: npx tsx scripts/_test-kapitalbasis.ts SPGI MSFT MCD ASML
 */

import { cikFuerTicker } from '@/lib/portfolio-analyse/sec-edgar-common-server'
import { ladeSecKapitalbasis } from '@/lib/portfolio-analyse/kapitalbasis/sec-xbrl-serie-server'
import { baueAbleitungen } from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-ableitung'
import { berechneRoiic } from '@/lib/portfolio-analyse/kapitalbasis/roiic-berechnung'
import {
  KAPITALBASIS_ROHFELDER,
  type KapitalbasisRohfeld,
} from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-typen'

async function main() {
const tickers = process.argv.slice(2)
if (tickers.length === 0) tickers.push('SPGI')

for (const ticker of tickers) {
  const cik = await cikFuerTicker(ticker)
  if (cik == null) {
    console.log(`\n===== ${ticker}: kein SEC-Filer =====`)
    continue
  }
  const roh = await ladeSecKapitalbasis(cik)
  if (!roh) {
    console.log(`\n===== ${ticker} (CIK ${cik}): keine Company Facts =====`)
    continue
  }
  const ableitungen = baueAbleitungen(roh.jahre)
  const roiic = berechneRoiic(roh.jahre, ableitungen)

  console.log(`\n===== ${ticker} (CIK ${cik}) — Berichtswährung ${roh.waehrung} =====`)

  const ablMap = new Map(ableitungen.map((a) => [a.jahr, a]))
  console.table(
    roh.jahre.slice(-10).map((j) => {
      const a = ablMap.get(j.jahr)!
      return {
        Jahr: j.jahr,
        Ende: j.periodenEnde ?? '–',
        EBIT: j.ebitMio,
        Pretax: j.pretaxMio,
        Steuer: j.steuerMio,
        Netto: j.nettogewinnMio,
        'Tax%': Math.round(a.steuersatz * 1000) / 10,
        Ers: a.steuersatzErsetzt ? 'ja' : '',
        NOPAT: a.nopatMio,
        IC: a.icMio,
        'IC tang': a.icTangibleMio,
        GW: j.goodwillMio,
        Intang: j.intangiblesMio,
        CapEx: j.capexMio,
        'D&A': j.daMio,
        Reinv: a.bruttoReinvestMio,
        'ROIC%': a.roicPct,
      }
    }),
  )

  const fehlend: KapitalbasisRohfeld[] = KAPITALBASIS_ROHFELDER.filter(
    (f) => !roh.jahre.some((j) => j[f] != null),
  )
  console.log('Fehlende Rohfelder:', fehlend.length ? fehlend.join(', ') : 'keine')
  console.log('M&A-Jahre (Goodwill-Sprung):', roiic.maJahre.join(', ') || 'keine')

  console.log(`\nROIIC Leitwert: ${roiic.roiicPct ?? '–'} % (${roiic.leitArt ?? '–'})`)
  for (const v of [roiic.organisch, roiic.buch]) {
    if (!v) continue
    console.log(
      `  ${v.art.padEnd(10)} ${String(v.pct ?? '–').padStart(7)} %  ` +
        `[${v.regime}] Fenster ${v.fensterJahre}J  ` +
        `NOPAT ${v.nopatVonJahr}→${v.nopatBisJahr} Δ${v.deltaNopatMio}  ` +
        `IC ${v.icVonJahr}→${v.icBisJahr} Δ${v.deltaIcMio}  Nenner ${v.nennerMio}` +
        `${v.gedeckelt ? ' (gedeckelt)' : ''}`,
    )
    console.log(`             ${v.begruendung}`)
  }
}
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
