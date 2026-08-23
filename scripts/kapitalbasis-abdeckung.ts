/**
 * Abdeckungs-Report der Kapitalbasis über Whitelist (und optional weitere Ticker).
 *
 * Zeigt je Titel: Quelle, Jahresabdeckung, ROIC, ROIIC (organisch/buch) und fehlende
 * Pflichtfelder. Dient als Regressionsnetz — nach Änderungen an den Scrapern muss die
 * Spalte „Lücken" leer bleiben.
 *
 * Aufruf:
 *   npx tsx --conditions=react-server scripts/kapitalbasis-abdeckung.ts
 *   npx tsx --conditions=react-server scripts/kapitalbasis-abdeckung.ts ANET DDOG
 */

import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { NACHKAUF_RADAR_WHITELIST } from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { ladeKapitalbasis } from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-server'
import { KAPITALBASIS_PFLICHTFELDER } from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-typen'
import { berechneRoiic } from '@/lib/portfolio-analyse/kapitalbasis/roiic-berechnung'

type Ziel = { name: string; isin: string | null; symbol: string }

function zieleAusWhitelist(): Ziel[] {
  return NACHKAUF_RADAR_WHITELIST.map((p) => {
    const kenntnis = isinKenntnis(p.isin)
    return {
      name: p.name,
      isin: p.isin,
      symbol: (p.symbolYahoo ?? kenntnis?.symbolYahoo ?? '').trim(),
    }
  })
}

async function main() {
  const argv = process.argv.slice(2)
  const ziele: Ziel[] =
    argv.length > 0
      ? argv.map((s) => ({ name: s, isin: null, symbol: s }))
      : zieleAusWhitelist()

  const zeilen: Record<string, unknown>[] = []
  let ohneDaten = 0
  let mitLuecken = 0

  for (const ziel of ziele) {
    if (!ziel.symbol) {
      zeilen.push({ Titel: ziel.name, Symbol: '—', Quelle: 'kein Symbol' })
      ohneDaten++
      continue
    }

    const serie = await ladeKapitalbasis({ symbolYahoo: ziel.symbol, isin: ziel.isin })
    if (!serie || serie.jahre.length < 3) {
      zeilen.push({
        Titel: ziel.name,
        Symbol: ziel.symbol,
        Quelle: serie?.beitragendeQuellen.join('+') || 'keine',
        Jahre: serie?.jahre.length ?? 0,
      })
      ohneDaten++
      continue
    }

    const roiic = berechneRoiic(serie.jahre, serie.ableitungen)
    const letzte = serie.ableitungen[serie.ableitungen.length - 1]!
    const jahre = serie.jahre.map((j) => j.jahr)
    const luecken = KAPITALBASIS_PFLICHTFELDER.filter(
      (f) => !serie.jahre.some((j) => j[f] != null),
    )
    if (luecken.length > 0) mitLuecken++

    zeilen.push({
      Titel: ziel.name.slice(0, 22),
      Symbol: ziel.symbol,
      Quelle: serie.beitragendeQuellen.join('+'),
      Verworfen: serie.verworfeneQuellen.join('+') || '',
      Whg: serie.waehrung,
      Jahre: `${jahre[0]}–${jahre[jahre.length - 1]} (${jahre.length})`,
      'ROIC%': letzte.roicPct,
      'ROIIC org%': roiic.organisch?.pct ?? null,
      Regime: roiic.organisch?.regime ?? '—',
      'M&A im Fenster': roiic.organisch?.fensterUeberspanntMa ? 'ja' : '',
      'ROIIC buch%': roiic.buch?.pct ?? null,
      'M&A': roiic.maJahre.slice(-2).join(',') || '—',
      Lücken: luecken.join(',') || '',
    })
  }

  console.table(zeilen)
  console.log(
    `\n${ziele.length} Titel | ohne belastbare Serie: ${ohneDaten} | mit fehlenden Pflichtfeldern: ${mitLuecken}`,
  )
  if (ohneDaten > 0 || mitLuecken > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
