/**
 * Diagnose: Kurshistorie-Abdeckung + Rendite-Heatmap.
 * npx tsx scripts/probe-rendite-heatmap.ts
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { berechneLivePortfolio, symboleAusMeta } from '../lib/portfolio-analyse/live-bewertung'
import { positionenFuerBewertung } from '../lib/portfolio-analyse/bestand'
import { teileArray } from '../lib/portfolio-analyse/batch-hilfen'
import { FX_SYMBOLE } from '../lib/portfolio-analyse/kurs-aufloesung'
import { isinKenntnis } from '../lib/portfolio-analyse/isin-kenntnisse'
import { heatmapAusWertentwicklung } from '../lib/portfolio-analyse/rendite-heatmap'
import { ladeYahooHistorieBatchTaeglich } from '../lib/portfolio-analyse/yahoo-historie-server'
import { ladeStooqHistorieBatchTaeglich, yahooZuStooqSymbol } from '../lib/portfolio-analyse/stooq-historie-server'
import { mergeKursHistorieMitStooqAliase } from '../lib/portfolio-analyse/kurs-historie-merge'
import { lookupIsinMetadaten } from '../lib/portfolio-analyse/isin-lookup-server'
import {
  baueWertentwicklungMitKursen,
  stooqSymboleFuerHistorie,
  yahooSymboleFuerHistorie,
} from '../lib/portfolio-analyse/wertentwicklung-kurse'
import { sanitiereWertentwicklungTimeline } from '../lib/portfolio-analyse/portfolio-berechnungen'
import { fxKurseAusYahooMap } from '../lib/portfolio-analyse/kurs-aufloesung'
import { ladeYahooKurse } from '../lib/portfolio-analyse/yahoo-kurse-server'
import type { PortfolioDbBuchung, PortfolioDbSnapshot } from '../lib/portfolio-analyse/types'
import { heuteIso } from '../lib/portfolio-analyse/wertentwicklung-tage'

function parseEnv(path: string) {
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[line.slice(0, i).trim()] = v
  }
  return out
}

function mapRow(row: Record<string, unknown>): PortfolioDbBuchung {
  return {
    id: String(row.id),
    importiert_am: String(row.importiert_am),
    buchungsHash: String(row.buchungs_hash),
    datum: String(row.datum).slice(0, 10),
    typ: row.typ as PortfolioDbBuchung['typ'],
    isin: row.isin ? String(row.isin) : null,
    wertpapierName: row.wertpapier_name ? String(row.wertpapier_name) : null,
    stueck: row.stueck != null ? Number(row.stueck) : null,
    kursEur: row.kurs_eur != null ? Number(row.kurs_eur) : null,
    betragEur: Number(row.betrag_eur),
    assetKlasse: row.asset_klasse as PortfolioDbBuchung['assetKlasse'],
    quelle: row.quelle ? String(row.quelle) : null,
    realisierterGewinnEur: row.realisierter_gewinn_eur != null ? Number(row.realisierter_gewinn_eur) : null,
    parqetTyp: row.parqet_typ ? String(row.parqet_typ) : null,
  }
}

async function main() {
  const env = parseEnv('.env.local')
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: buchungRows, error: bErr } = await sb
    .from('portfolio_analyse_buchung')
    .select('*')
    .order('datum', { ascending: true })
  if (bErr) throw new Error(bErr.message)

  const buchungen = (buchungRows ?? []).map((r) => mapRow(r as Record<string, unknown>))
  console.log('Buchungen:', buchungen.length)

  const { data: snapRow } = await sb.from('portfolio_analyse_snapshot').select('*').maybeSingle()
  const snapshot: PortfolioDbSnapshot | null = snapRow
    ? {
        id: String(snapRow.id),
        erstellt_am: String(snapRow.erstellt_am),
        positionen: (snapRow.positionen as PortfolioDbSnapshot['positionen']) ?? [],
      }
    : null

  const positionen = positionenFuerBewertung(buchungen, snapshot)
  const isins = [...new Set(buchungen.filter((b) => b.isin && (b.typ === 'kauf' || b.typ === 'verkauf')).map((b) => b.isin!.toUpperCase()))]
  const metaList = await lookupIsinMetadaten(isins)
  const meta = new Map(metaList.map((m) => [m.isin.toUpperCase(), m]))
  const sym = symboleAusMeta(positionen, meta)
  const yahooLive = await ladeYahooKurse(sym)
  const fx = fxKurseAusYahooMap(yahooLive)
  const live = berechneLivePortfolio(buchungen, snapshot, meta, yahooLive, new Date().toISOString(), fx)
  console.log('Depotwert:', live.kennzahlen.depotwertEur.toFixed(2))

  const von = buchungen[0]?.datum ?? heuteIso()
  const bis = heuteIso()
  const yahoo = yahooSymboleFuerHistorie(buchungen, live.positionen, meta)
  const stooq = stooqSymboleFuerHistorie(buchungen, live.positionen, meta)

  const symbolSet = new Set(yahoo.map((s) => s.toUpperCase()))
  for (const m of metaList) {
    if (m.symbolYahoo) symbolSet.add(m.symbolYahoo.toUpperCase())
    for (const c of m.symbolCandidates ?? []) symbolSet.add(c.toUpperCase())
  }
  for (const fx of FX_SYMBOLE) symbolSet.add(fx)
  const allSymbols = [...symbolSet]

  const yahooMap = new Map<string, Map<string, number>>()
  for (const batch of teileArray(allSymbols, 40)) {
    const part = await ladeYahooHistorieBatchTaeglich(batch, von, bis)
    for (const [sym, serie] of part) yahooMap.set(sym, serie)
  }
  const stooqMap = new Map<string, Map<string, number>>()
  for (const batch of teileArray(stooq, 30)) {
    const part = await ladeStooqHistorieBatchTaeglich(batch, von, bis)
    for (const [sym, serie] of part) stooqMap.set(sym, serie)
  }
  const historie = mergeKursHistorieMitStooqAliase(yahooMap, stooqMap, allSymbols)
  console.log('Yahoo symbols:', allSymbols.length, 'Stooq:', stooq.length, 'Serien:', historie.size)

  console.log('\nHistorie-Abdeckung pro ISIN:')
  for (const p of live.positionen) {
    const isin = p.isin?.toUpperCase()
    if (!isin) continue
    const k = isinKenntnis(isin)
    const m = meta.get(isin)
    const cands = [
      ...(k?.symbolCandidates ?? []),
      ...(m?.symbolCandidates ?? []),
      ...(m?.symbolYahoo ? [m.symbolYahoo] : []),
      ...(k?.symbolYahoo ? [k.symbolYahoo] : []),
    ]
    let best = { sym: '', days: 0 }
    for (const c of cands) {
      const n = historie.get(c.toUpperCase())?.size ?? 0
      if (n > best.days) best = { sym: c, days: n }
      const st = yahooZuStooqSymbol(c)
      if (st) {
        const sn = historie.get(`STOOQ:${st}`)?.size ?? 0
        if (sn > best.days) best = { sym: `STOOQ:${st}`, days: sn }
      }
    }
    console.log(`  ${isin} ${p.anzeigeName.slice(0, 30)} → ${best.sym || '?'} (${best.days} Tage)`)
  }

  const timeline = sanitiereWertentwicklungTimeline(
    baueWertentwicklungMitKursen(buchungen, live.kennzahlen.depotwertEur, live.positionen, historie, fx, meta),
  )
  console.log('\nTimeline:', timeline.length, 'Tage')
  if (timeline.length >= 2) {
    const first = timeline[0]
    const last = timeline[timeline.length - 1]
    console.log('Erster:', first.datumIso, 'Wert', first.portfoliowertEur, 'Kapital', first.zugefuehrtEur)
    console.log('Letzter:', last.datumIso, 'Wert', last.portfoliowertEur, 'Kapital', last.zugefuehrtEur)
  }

  const hm = heatmapAusWertentwicklung(timeline, buchungen, 'M')
  for (const z of hm.zeilen.filter((z) => z.jahr >= 2021 && z.jahr <= 2026)) {
    const mon = z.monate
      .map((v, i) => (v != null ? `${i + 1}:${v.toFixed(2)}%` : null))
      .filter(Boolean)
    console.log(`${z.jahr} Gesamt ${z.gesamtProzent?.toFixed(2) ?? '—'}% | ${mon.join(' ')}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
