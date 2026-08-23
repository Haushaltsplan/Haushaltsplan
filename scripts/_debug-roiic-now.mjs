/** Debug ROIIC-Methoden für SPGI/TMO mit SA-Daten. */
import { berechneRoiicAusSnaps, roiicOrganicPct, roiicTangiblePct, roiicBookPct } from '../lib/portfolio-analyse/incremental-roic.ts'

const UA = 'Mozilla/5.0 Chrome/131 Safari/537.36'

async function saSnaps(slug) {
  const r = await fetch(`https://stockanalysis.com/stocks/${slug}/financials/`, {
    headers: { 'User-Agent': UA, Referer: 'https://stockanalysis.com/' },
  })
  const html = await r.text()
  const idx = html.search(/fiscalYear:\s*\[/)
  if (idx < 0) return []
  const block = html.slice(Math.max(0, idx - 20), Math.min(html.length, idx + 45000))
  const years = [...block.matchAll(/fiscalYear:\s*\[([\d,\s]+)\]/g)]
  const fy = years[0]?.[1]?.split(',').map((x) => +x.trim()).filter((n) => n > 2000) ?? []
  const parseArr = (key) => {
    const needle = `${key}:[`
    const start = block.indexOf(needle)
    if (start < 0) return []
    const from = start + needle.length
    const end = block.indexOf(']', from)
    if (end < 0) return []
    return block
      .slice(from, end)
      .split(',')
      .map((x) => {
        const n = Number(x.trim())
        return Number.isFinite(n) ? n / 1_000_000 : null
      })
  }
  const opinc = parseArr('opinc')
  const equity = parseArr('equity')
  const debt = parseArr('debt')
  const cash = parseArr('cashneq')
  const gw = parseArr('goodwill')
  const inta = parseArr('otherIntangibles')
  const capex = parseArr('capex')
  const da = parseArr('depAmorEbitda')
  const snaps = []
  for (let i = 0; i < fy.length; i++) {
    const oi = opinc[i]
    const eq = equity[i]
    if (oi == null || eq == null) continue
    snaps.push({
      jahr: fy[i],
      nopatMio: oi * 0.79,
      icMio: eq + (debt[i] ?? 0) - (cash[i] ?? 0),
      goodwillMio: gw[i] ?? null,
      intangiblesMio: inta[i] ?? null,
      capexMio: capex[i] != null ? Math.abs(capex[i]) : null,
      daMio: da[i] != null ? Math.abs(da[i]) : null,
    })
  }
  return snaps.sort((a, b) => a.jahr - b.jahr)
}

for (const [slug, name] of [
  ['spgi', 'SPGI'],
  ['tmo', 'TMO'],
]) {
  const snaps = await saSnaps(slug)
  console.log('\n===', name, 'Jahre', snaps.map((s) => s.jahr).join(','), '===')
  const last = snaps[snaps.length - 1]
  for (const span of [1, 2, 3, 5]) {
    const basis = snaps.find((s) => s.jahr === last.jahr - span)
    if (!basis) continue
    const daz = snaps.filter((s) => s.jahr >= basis.jahr && s.jahr <= last.jahr)
    console.log(
      `${basis.jahr}→${last.jahr}:`,
      'org', roiicOrganicPct(last, basis, daz),
      'tang', roiicTangiblePct(last, basis),
      'book', roiicBookPct(last, basis),
    )
  }
  console.log('PAKET:', berechneRoiicAusSnaps(snaps, 'stockanalysis'))
}
