/**
 * Batch: max. Segment-Jahr pro US-Whitelist-Ticker (nur neuester 10-K).
 */
import { extrahiereAlleDetailBloeckeAus10kHtml } from '../lib/portfolio-analyse/sec-edgar-detail-extraktion'
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { ISIN_KENNTNISSE } from '../lib/portfolio-analyse/isin-kenntnisse'

const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia Haushalt test@example.com'

async function secFetch(url: string) {
  await new Promise((r) => setTimeout(r, 350))
  return fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
}

async function pickLesbares10kHtml(cik: number, acc: string, primary: string): Promise<string> {
  const accPath = acc.replace(/-/g, '')
  const base = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/`

  const kandidaten: { name: string; size: number }[] = []

  try {
    const idxRes = await secFetch(`${base}${acc}-index.json`)
    if (idxRes.ok) {
      const txt = await idxRes.text()
      if (txt.trimStart().startsWith('{')) {
        const idx = JSON.parse(txt) as { directory?: { item?: { name: string; size?: string }[] } }
        for (const i of idx.directory?.item ?? []) {
          if (!/\.htm/i.test(i.name) || /index/i.test(i.name)) continue
          kandidaten.push({ name: i.name, size: parseInt(i.size?.replace(/,/g, '') ?? '0', 10) || 0 })
        }
      }
    }
  } catch { /* */ }

  if (kandidaten.length === 0) {
    try {
      const htmRes = await secFetch(`${base}${acc}-index.htm`)
      if (htmRes.ok) {
        const htm = await htmRes.text()
        for (const m of htm.matchAll(/href="([^"]+\.htm)"/gi)) {
          const name = m[1]!.split('/').pop() ?? m[1]!
          if (/index/i.test(name)) continue
          if (!kandidaten.some((k) => k.name === name)) {
            kandidaten.push({ name, size: 0 })
          }
        }
      }
    } catch { /* */ }
  }

  kandidaten.sort((a, b) => b.size - a.size)
  if (kandidaten[0]?.name) return kandidaten[0].name
  return primary
}

async function maxJahrFuerTicker(sym: string, cik: string): Promise<{ max: number; kat: string; jahre: number } | null> {
  const sub = await (await secFetch(`https://data.sec.gov/submissions/CIK${cik.padStart(10, '0')}.json`)).json()
  const f = sub.filings.recent
  let acc = ''
  let doc = ''
  for (let i = 0; i < f.form.length; i++) {
    if (f.form[i] !== '10-K') continue
    acc = f.accessionNumber[i]
    doc = f.primaryDocument[i]
    break
  }
  if (!acc) return null

  const accPath = acc.replace(/-/g, '')
  const pick = await pickLesbares10kHtml(parseInt(cik, 10), acc, doc)

  const html = await (await secFetch(`https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${accPath}/${pick}`)).text()
  if (html.length < 5000) return null

  const details = extrahiereAlleDetailBloeckeAus10kHtml(html)
  let bestMax = 0
  let bestKat = ''
  let bestLen = 0
  for (const d of details) {
    const jahre = d.jahre.map((j) => j.jahr)
    const max = Math.max(...jahre)
    if (max > bestMax || (max === bestMax && jahre.length > bestLen)) {
      bestMax = max
      bestKat = d.def.id
      bestLen = jahre.length
    }
  }
  if (bestMax === 0) return null
  return { max: bestMax, kat: bestKat, jahre: bestLen }
}

async function main() {
  const us = NACHKAUF_RADAR_WHITELIST.filter((p) => p.cik)
  const fehler: string[] = []
  const ok: string[] = []

  for (const pos of us) {
    const sym = ISIN_KENNTNISSE[pos.isin]?.symbolYahoo?.split('.')[0]
    if (!sym || !pos.cik) continue
    try {
      const r = await maxJahrFuerTicker(sym, pos.cik)
      if (!r) {
        fehler.push(`${sym}: keine Segment-Daten`)
        continue
      }
      const line = `${sym.padEnd(6)} ${r.kat.padEnd(28)} ${r.jahre}J max=${r.max}`
      if (r.max >= 2025) ok.push(line)
      else fehler.push(`${line} ⚠️`)
    } catch (e) {
      fehler.push(`${sym}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  console.log(`\n✅ ${ok.length}/${us.length} mit max≥2025:\n`)
  ok.forEach((l) => console.log(' ', l))
  if (fehler.length) {
    console.log(`\n⚠️ ${fehler.length} ohne 2025:\n`)
    fehler.forEach((l) => console.log(' ', l))
  }
}

main().catch(console.error)
