/**
 * Batch: Disaggregation-Jahre nach Multi-Filing-Merge (US-Whitelist).
 */
import { extrahiereAlleDetailBloeckeAus10kHtml, mergeDetailInMap } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion.ts'
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { ISIN_KENNTNISSE } from '../lib/portfolio-analyse/isin-kenntnisse'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia Haushalt test@example.com'
const MAX_FILINGS = 12

async function secFetch(url: string) {
  await new Promise((r) => setTimeout(r, 350))
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function pickHtml(cik: number, acc: string, primary: string): Promise<string> {
  const accPath = acc.replace(/-/g, '')
  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/`
  let pick = primary
  try {
    const idx = await (await secFetch(`${base}${acc}-index.json`)).json()
    const sorted = (idx.directory?.item ?? [])
      .filter((i: { name: string }) => /\.htm/i.test(i.name) && !/index/i.test(i.name))
      .sort((a: { size: string }, b: { size: string }) => parseInt(b.size || '0') - parseInt(a.size || '0'))
    if (sorted[0]?.name) pick = sorted[0].name
  } catch { /* */ }
  return await (await secFetch(`${base}${pick}`)).text()
}

const PRODUKT_KAT_IDS = ['umsatz_detail', 'segment_reporting', 'franchise_umsatz', 'produkte_services'] as const

async function besteProduktJahre(sym: string, cikStr: string): Promise<{ id: string; n: number; min: number; max: number } | null> {
  const cik = parseInt(cikStr, 10)
  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${cikStr.padStart(10, '0')}.json`)).json()
  const f = sub.filings.recent
  const filings: { acc: string; doc: string; report: string }[] = []
  for (let i = 0; i < f.form.length && filings.length < MAX_FILINGS; i++) {
    if (f.form[i] !== '10-K') continue
    filings.push({
      acc: f.accessionNumber[i],
      doc: f.primaryDocument[i],
      report: f.reportDate?.[i]?.slice(0, 4) ?? '0',
    })
  }
  if (!filings.length) return null

  const kategorieMaps = new Map<string, Map<number, unknown[]>>()
  const kategorieMeta = new Map<string, Map<number, number>>()

  for (const fil of filings) {
    const html = await pickHtml(cik, fil.acc, fil.doc)
    if (html.length < 5000) continue
    const details = extrahiereAlleDetailBloeckeAus10kHtml(html)
    const reportJahr = parseInt(fil.report, 10) || 0
    for (const kat of details) {
      mergeDetailInMap(kategorieMaps as never, kat, reportJahr, kategorieMeta as never)
    }
  }

  let best: { id: string; n: number; min: number; max: number } | null = null
  for (const id of PRODUKT_KAT_IDS) {
    const m = kategorieMaps.get(id)
    if (!m || m.size < 2) continue
    const jahre = [...m.keys()].sort((a, b) => a - b)
    const cand = { id, n: jahre.length, min: jahre[0]!, max: jahre[jahre.length - 1]! }
    if (!best || cand.n > best.n || (cand.n === best.n && cand.max > best.max)) best = cand
  }
  return best
}

async function main() {
  const us = NACHKAUF_RADAR_WHITELIST.filter((p) => p.cik)
  const schwach: string[] = []
  const ok: string[] = []

  for (const pos of us) {
    const sym = ISIN_KENNTNISSE[pos.isin]?.symbolYahoo?.split('.')[0]?.toUpperCase()
    if (!sym || !pos.cik) continue
    try {
      const r = await besteProduktJahre(sym, pos.cik.replace(/^0+/, '').padStart(10, '0'))
      if (!r) {
        schwach.push(`${sym}: keine Produkt-/Segment-Umsätze`)
        continue
      }
      const line = `${sym.padEnd(6)} ${r.n}J  ${r.min}–${r.max}  [${r.id}]`
      if (r.n >= 6 && r.max >= 2024) ok.push(line)
      else schwach.push(`${line} ⚠️`)
    } catch (e) {
      schwach.push(`${sym}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log(`\n✅ ${ok.length}/${us.length} Produkt-/Segment-Umsatz ≥6J und max≥2024:\n`)
  ok.forEach((l) => console.log(' ', l))
  if (schwach.length) {
    console.log(`\n⚠️ ${schwach.length} schwach / fehlend:\n`)
    schwach.forEach((l) => console.log(' ', l))
  }
}

main().catch(console.error)
