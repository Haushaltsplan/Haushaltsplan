/**
 * Diagnose: DivvyDiary Earnings pro Depot-ISIN.
 * npx tsx scripts/check-divvydiary-earnings.ts
 */
import { earningsZeitraum } from '@/lib/portfolio-analyse/earnings-termine-alle'
import { ISIN_KENNTNISSE } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  divvydiaryPfade,
  naechstesEarningsTerminAusHtml,
  parseDivvydiaryHtml,
} from '@/lib/portfolio-analyse/divvydiary-scraper-server'
const ETF = /\b(ETF|UCITS|Index\s+Solutions)\b/i
const { von, bis, heute } = earningsZeitraum()

async function fetchHtml(path: string) {
  const url = `https://divvydiary.com/de/${path}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; mein-haushalt-check/1.0)',
      'Accept-Language': 'de-DE,de;q=0.9',
    },
    signal: AbortSignal.timeout(18_000),
  })
  if (!res.ok) return { ok: false as const, html: '' }
  const html = await res.text()
  return { ok: html.length > 8000, html }
}

async function main() {
const aktien = Object.entries(ISIN_KENNTNISSE).filter(([, k]) => !ETF.test(k.name ?? ''))

for (const [isin, k] of aktien) {
  const name = k.name ?? isin
  const pfade = divvydiaryPfade(isin, name)
  let best: {
    path: string
    termine: ReturnType<typeof naechstesEarningsTerminAusHtml>
    rows: number
    earnLabel: boolean
    hasIsin: boolean
  } | null = null

  for (const path of pfade.slice(0, 6)) {
    const { ok, html } = await fetchHtml(path)
    await new Promise((r) => setTimeout(r, 300))
    if (!ok) continue
    const termine = naechstesEarningsTerminAusHtml(html, isin, heute, bis)
    const rows = parseDivvydiaryHtml(html).length
    const earnLabel = /Earnings\s*Date/i.test(html)
    const score = termine.length * 10 + rows
    if (!best || score > (best.termine.length * 10 + best.rows)) {
      best = { path, termine, rows, earnLabel, hasIsin: html.includes(isin) }
    }
    if (termine.length > 0) break
  }

  const hit = best?.termine[0]
  const status = hit ? `OK  ${hit.terminDatumIso}` : 'FAIL'
  console.log(
    `${status} ${isin} ${name.slice(0, 28).padEnd(28)} | ${best?.path ?? 'no-page'} | earn=${best?.earnLabel} isin=${best?.hasIsin}`,
  )
}
}

void main()
