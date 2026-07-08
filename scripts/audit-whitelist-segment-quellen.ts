/**
 * Segment-Audit aller 32 Nachkauf-Whitelist-Titel (MS vs. SA).
 * npx tsx scripts/audit-whitelist-segment-quellen.ts
 */
import { writeFileSync } from 'node:fs'
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { isinKenntnis } from '../lib/portfolio-analyse/isin-kenntnisse'
import { bekannterMarketscreenerSlug } from '../lib/portfolio-analyse/marketscreener-slug'
import { extrahiereMsSegmentHistorien } from '../lib/portfolio-analyse/marketscreener-segment-parser'
import { extrahiereStockanalysisSegmentHistorieAusHtml } from '../lib/portfolio-analyse/stockanalysis-segment-parser'
import { saMetrikPfade } from '../lib/portfolio-analyse/stockanalysis-metrik-pfade'
import { summeUmsatzMio } from '../lib/portfolio-analyse/segment-historie-merge-hilfen'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

type AuditRow = {
  name: string
  isin: string
  ticker: string
  msSlug: string | null
  msProdJahr: number | null
  msProdB: number | null
  msGeoJahr: number | null
  msGeoB: number | null
  saProdJahr: number | null
  saProdB: number | null
  saGeoJahr: number | null
  saGeoB: number | null
  prodRatio: number | null
  geoRatio: number | null
  status: string
  fix: string
}

function tickerVon(isin: string): string {
  const k = isinKenntnis(isin)
  const y = k?.symbolYahoo ?? k?.logoSymbol ?? k?.macrotrendsTicker ?? ''
  return y.split('.')[0] ?? isin.slice(0, 6)
}

function b(mio: number | null): string {
  if (mio == null || mio <= 0) return '—'
  return (mio / 1000).toFixed(1) + 'B'
}

function ratio(ms: number | null, sa: number | null): number | null {
  if (!ms || !sa || sa <= 0) return null
  return ms / sa
}

function statusVon(prodRatio: number | null, saProd: number | null, msProd: number | null): { status: string; fix: string } {
  if (!msProd && !saProd) return { status: 'keine_daten', fix: 'MS+SA fehlen' }
  if (!saProd && msProd) return { status: 'nur_ms', fix: 'SA-Fallback fehlt — MS nicht validierbar' }
  if (!msProd && saProd) return { status: 'nur_sa', fix: 'OK (nur SA)' }
  if (prodRatio != null && prodRatio > 1.25) return { status: 'ms_aufgeblaeht', fix: 'Merge bevorzugt SA (Fix aktiv)' }
  if (prodRatio != null && prodRatio < 0.75) return { status: 'sa_zu_niedrig', fix: 'SA prüfen / MS bevorzugen' }
  return { status: 'ok', fix: '—' }
}

async function fetchSaHistorie(
  isin: string,
  ticker: string,
  symbolYahoo: string | null,
  art: 'produkt' | 'geo',
): Promise<ReturnType<typeof extrahiereStockanalysisSegmentHistorieAusHtml>> {
  const suffix = art === 'geo' ? 'revenue-by-geography/' : 'revenue-by-segment/'
  for (const p of saMetrikPfade({ isin, symbolYahoo, ticker }, suffix)) {
    try {
      const res = await fetch(`https://stockanalysis.com${p}`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) continue
      const html = await res.text()
      const h = extrahiereStockanalysisSegmentHistorieAusHtml(html, art, ticker)
      if (h && h.anzahlJahre >= 1) return h
    } catch {
      /* nächster Pfad */
    }
  }
  return null
}

async function auditEintrag(pos: (typeof NACHKAUF_RADAR_WHITELIST)[0]): Promise<AuditRow> {
  const k = isinKenntnis(pos.isin)
  const symbolYahoo = k?.symbolYahoo ?? null
  const ticker = tickerVon(pos.isin)
  const slug = bekannterMarketscreenerSlug(pos.isin)

  let msProd = null
  let msGeo = null
  if (slug) {
    try {
      const res = await fetch(`https://www.marketscreener.com/quote/stock/${slug}/finances-segments/`, {
        headers: { 'User-Agent': UA, Referer: 'https://www.marketscreener.com/' },
        signal: AbortSignal.timeout(25_000),
      })
      if (res.ok) {
        const html = await res.text()
        const ms = extrahiereMsSegmentHistorien(html)
        msProd = ms.produkt
        msGeo = ms.geo
      }
    } catch {
      /* leer */
    }
  }

  const saProd = await fetchSaHistorie(pos.isin, ticker, symbolYahoo, 'produkt')
  await new Promise((r) => setTimeout(r, 400))
  const saGeo = await fetchSaHistorie(pos.isin, ticker, symbolYahoo, 'geo')

  const msProdSum = summeUmsatzMio(msProd)
  const saProdSum = summeUmsatzMio(saProd)
  const prodRatio = ratio(msProdSum, saProdSum)
  const { status, fix } = statusVon(prodRatio, saProdSum, msProdSum)

  return {
    name: pos.name,
    isin: pos.isin,
    ticker,
    msSlug: slug,
    msProdJahr: msProd?.juengstesJahr ?? null,
    msProdB: msProdSum || null,
    msGeoJahr: msGeo?.juengstesJahr ?? null,
    msGeoB: summeUmsatzMio(msGeo) || null,
    saProdJahr: saProd?.juengstesJahr ?? null,
    saProdB: saProdSum || null,
    saGeoJahr: saGeo?.juengstesJahr ?? null,
    saGeoB: summeUmsatzMio(saGeo) || null,
    prodRatio,
    geoRatio: ratio(summeUmsatzMio(msGeo), summeUmsatzMio(saGeo)),
    status,
    fix,
  }
}

async function main() {
  const rows: AuditRow[] = []
  for (let i = 0; i < NACHKAUF_RADAR_WHITELIST.length; i++) {
    const pos = NACHKAUF_RADAR_WHITELIST[i]!
    process.stdout.write(`[${i + 1}/32] ${pos.name}… `)
    const row = await auditEintrag(pos)
    rows.push(row)
    console.log(row.status, `MS ${b(row.msProdB)}`, `SA ${b(row.saProdB)}`, row.prodRatio ? `×${row.prodRatio.toFixed(2)}` : '')
    await new Promise((r) => setTimeout(r, 800))
  }

  const aufgeblaeht = rows.filter((r) => r.status === 'ms_aufgeblaeht')
  const nurMs = rows.filter((r) => r.status === 'nur_ms')
  const keine = rows.filter((r) => r.status === 'keine_daten')
  const ok = rows.filter((r) => r.status === 'ok')

  console.log('\n=== ZUSAMMENFASSUNG ===')
  console.log(`OK: ${ok.length}`, ok.map((r) => r.ticker).join(', '))
  console.log(`MS aufgebläht (>1.25×): ${aufgeblaeht.length}`, aufgeblaeht.map((r) => r.ticker).join(', '))
  console.log(`Nur MS (kein SA): ${nurMs.length}`, nurMs.map((r) => r.ticker).join(', '))
  console.log(`Keine Daten: ${keine.length}`, keine.map((r) => r.ticker).join(', '))

  const md = [
    '# Segment-Audit Nachkauf-Whitelist (32 Titel)',
    '',
    `Stand: ${new Date().toISOString().slice(0, 10)}`,
    '',
    '| Titel | Ticker | MS Prod | SA Prod | Ratio | Status | Fix |',
    '|-------|--------|---------|---------|-------|--------|-----|',
    ...rows.map(
      (r) =>
        `| ${r.name} | ${r.ticker} | ${b(r.msProdB)} | ${b(r.saProdB)} | ${r.prodRatio?.toFixed(2) ?? '—'} | ${r.status} | ${r.fix} |`,
    ),
    '',
    '## Handlungsbedarf',
    '',
    aufgeblaeht.length
      ? `- **MS aufgebläht** (Merge-Fix greift): ${aufgeblaeht.map((r) => r.ticker).join(', ')}`
      : '- Keine aufgeblähten MS-Daten',
    nurMs.length
      ? `- **SA fehlt** (nur MS, nicht validierbar): ${nurMs.map((r) => r.ticker).join(', ')}`
      : '- SA für alle MS-Titel vorhanden oder MS fehlt',
    '',
  ].join('\n')

  writeFileSync('scripts/audit-whitelist-segment-quellen.md', md)
  writeFileSync('scripts/audit-whitelist-segment-quellen.json', JSON.stringify(rows, null, 2))
  console.log('\nGespeichert: scripts/audit-whitelist-segment-quellen.md')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
