/**
 * npx tsx scripts/validate-ms-segments-full.ts
 */
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { ISIN_KENNTNISSE } from '../lib/portfolio-analyse/isin-kenntnisse'
import { marketscreenerSlugKandidaten } from '../lib/portfolio-analyse/marketscreener-slug'

const UA = 'Mozilla/5.0'
const BASE = 'https://www.marketscreener.com/quote/stock'

function decodeAttr(s: string) {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function parseChart(html: string, id: string) {
  const m = html.match(new RegExp(`id="${id}"[\\s\\S]*?data-fct-attr="(\\{[^"]+\\})"`))
  if (!m?.[1]) return null
  try {
    const p = JSON.parse(decodeAttr(m[1])) as { start?: number; data?: Record<string, { data?: number[] }> }
    if (p.start == null || !p.data) return null
    const segmente = Object.entries(p.data).filter(([n]) => !/unallocated|elimination|corporate/i.test(n))
    return { start: p.start, years: segmente[0]?.[1].data?.length ?? 0, segs: segmente.length }
  } catch {
    return null
  }
}

async function slugPasst(slug: string, isin: string): Promise<boolean> {
  for (const path of ['/', '/company/', '/finances/', '/finances-segments/']) {
    const html = await (
      await fetch(`${BASE}/${slug}${path}`, { headers: { 'User-Agent': UA } })
    ).text()
    if (html.includes(isin)) return true
  }
  return false
}

function normalisiereName(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function slugsAusIsinHtml(html: string, name: string): string[] {
  const kern = normalisiereName(name)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['INC', 'PLC', 'AG', 'THE', 'AND', 'HOLDING'].includes(w))
  const haupt = kern.slice(0, 2).join(' ')
  const out: string[] = []
  for (const m of html.matchAll(/href="\/quote\/stock\/([A-Z0-9-]+-\d+)\/"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = normalisiereName(m[2].replace(/<[^>]+>/g, ' '))
    if (haupt && haupt.split(' ').every((w) => text.includes(w))) out.push(m[1]!)
  }
  return [...new Set(out)]
}

async function main() {
  let ok = 0
  for (const p of NACHKAUF_RADAR_WHITELIST) {
    const sym = ISIN_KENNTNISSE[p.isin]?.symbolYahoo?.split('.')[0] ?? ''
    const searchHtml = await (
      await fetch(`https://www.marketscreener.com/search/?q=${encodeURIComponent(p.isin)}`, {
        headers: { 'User-Agent': UA },
      })
    ).text()
    const kandidaten = [
      ...new Set([
        ...marketscreenerSlugKandidaten(p.isin, p.name, sym),
        ...slugsAusIsinHtml(searchHtml, p.name),
      ].flatMap((s) => [s, s.replace(/-CORP-/, '-CORPORATION-')])),
    ]
    let hit: string | null = null
    let prod = 0
    let geo = 0
    let years = 0
    for (const slug of kandidaten) {
      await new Promise((r) => setTimeout(r, 250))
      if (!(await slugPasst(slug, p.isin))) continue
      const html = await (
        await fetch(`${BASE}/${slug}/finances-segments/`, { headers: { 'User-Agent': UA } })
      ).text()
      const ca1 = parseChart(html, 'financialSegmentCA1')
      const ca2 = parseChart(html, 'financialSegmentCA2')
      if (ca1 || ca2) {
        hit = slug
        prod = ca1?.segs ?? 0
        geo = ca2?.segs ?? 0
        years = Math.max(ca1?.years ?? 0, ca2?.years ?? 0)
        break
      }
    }
    const tag = hit && years >= 2 && (prod >= 1 || geo >= 1) ? 'OK' : 'FAIL'
    if (tag === 'OK') ok++
    console.log(`${tag} ${sym.padEnd(6)} ${p.name.slice(0, 22).padEnd(22)} | ${hit ?? '-'} P${prod} G${geo} ${years}J`)
  }
  console.log(`\n${ok}/${NACHKAUF_RADAR_WHITELIST.length}`)
}

main()
