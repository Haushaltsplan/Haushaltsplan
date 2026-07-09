/**
 * Prüft Segment-Summen vs. Macrotrends-Umsatz für alle Whitelist-Titel.
 *
 *   npx tsx --require ./scripts/mock-server-only.cjs scripts/audit-segment-umsatz-abgleich.ts
 */
import { readFileSync } from 'fs'

import { isinKenntnis } from '../lib/portfolio-analyse/isin-kenntnisse'
import { baueUmsatzProJahrAusYahoo } from '../lib/portfolio-analyse/fundamentaldaten-yahoo-guv-server'
import {
  baueUmsatzProJahrAusMacrotrends,
  loeseMacrotrendsIdent,
} from '../lib/portfolio-analyse/macrotrends-scraper-server'
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import {
  baueUmsatzProJahrAusFinanzzeile,
  normalisiereSegmentPaketGegenUmsatz,
  pruefeSegmentPaketGegenUmsatz,
} from '../lib/portfolio-analyse/segment-umsatz-abgleich'
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

function basisTicker(k: ReturnType<typeof isinKenntnis>): string {
  for (const sym of [k?.logoSymbol, k?.macrotrendsTicker, k?.symbolYahoo, k?.symbolCandidates?.[0]]) {
    const t = sym?.trim().toUpperCase().split('.')[0]
    if (t) return t
  }
  return ''
}

async function main() {
  const filter = new Set(process.argv.slice(2).map((a) => a.toUpperCase()))
  const liste = NACHKAUF_RADAR_WHITELIST.filter((pos) => {
    if (filter.size === 0) return true
    const k = isinKenntnis(pos.isin)
    const sym = basisTicker(k)
    return filter.has(pos.name.toUpperCase()) || filter.has(pos.isin) || filter.has(sym)
  })

  console.log(`Audit Segment-Umsatz-Abgleich: ${liste.length} Titel\n`)

  let ok = 0
  let korrigiert = 0
  let ohneSegment = 0
  const offen: string[] = []

  for (const pos of liste) {
    const k = isinKenntnis(pos.isin)
    const ticker = basisTicker(k)
    const sym = k?.symbolYahoo ?? ticker

    const ident = await loeseMacrotrendsIdent(ticker, {
      erwarteterTicker: ticker,
      firmenname: pos.name,
      slug: k?.macrotrendsSlug,
      macrotrendsTicker: k?.macrotrendsTicker,
    })
    if (!ident) {
      offen.push(`${pos.name}: kein Macrotrends-Ident`)
      continue
    }

    let umsatzMap = await baueUmsatzProJahrAusMacrotrends(ident)
    if (umsatzMap.size === 0 && sym?.trim()) {
      umsatzMap = await baueUmsatzProJahrAusYahoo(sym)
    }
    if (umsatzMap.size === 0) {
      offen.push(`${pos.name}: kein Umsatz aus Finanzdaten (MT/Yahoo)`)
      continue
    }

    const paket = await ladeGescrapteSegmentStruktur({
      isin: pos.isin,
      name: pos.name,
      symbolYahoo: sym,
      ticker,
      refresh: true,
    })

    if (!paket?.produkt && !paket?.geo) {
      ohneSegment++
      console.log(`— ${pos.name.padEnd(26)} keine Segment-Daten`)
      continue
    }

    const vorher = pruefeSegmentPaketGegenUmsatz(paket, umsatzMap)
    const nachherPaket = normalisiereSegmentPaketGegenUmsatz(paket, umsatzMap)
    const nachher = pruefeSegmentPaketGegenUmsatz(nachherPaket, umsatzMap)

    if (vorher.length === 0) {
      ok++
      console.log(`OK ${pos.name.padEnd(26)} bereits konsistent`)
    } else if (nachher.length === 0) {
      korrigiert++
      const beispiel = vorher[0]!
      console.log(
        `FIX ${pos.name.padEnd(26)} ${vorher.length} Jahr(e) korrigiert — z.B. FY${beispiel.jahr} ${beispiel.art} ${(beispiel.ratio * 100).toFixed(0)}% → 100%`,
      )
    } else {
      const b = nachher[0]!
      offen.push(
        `${pos.name}: nach Normalisierung noch FY${b.jahr} ${b.art} ratio=${b.ratio.toFixed(2)}`,
      )
      console.log(
        `!! ${pos.name.padEnd(26)} ${nachher.length} Abweichung(en) verbleiben — FY${b.jahr} ${b.art} ${(b.ratio * 100).toFixed(0)}%`,
      )
    }

    await new Promise((r) => setTimeout(r, 800))
  }

  console.log(`\n---\nOK: ${ok} | Korrigiert: ${korrigiert} | Ohne Segment: ${ohneSegment} | Offen: ${offen.length}`)
  if (offen.length) {
    console.log('\nOffen:')
    for (const o of offen) console.log(' ', o)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
