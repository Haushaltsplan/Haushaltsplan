/**
 * Batch: SEC Kennzahlen Jahr-Zuordnung für alle US-Whitelist-Ticker.
 * npx tsx scripts/diag-kennzahlen-batch.ts
 */
import { readFileSync } from 'fs'
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'

function loadEnv() {
  try {
    const raw = readFileSync('.env.local', 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1]!.trim()] = m[2]!.trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* */ }
}
loadEnv()

const UA = process.env.SEC_EDGAR_USER_AGENT || 'Omnia Haushalt test@example.com'

type FactsUnit = {
  end?: string
  val?: number
  fy?: number
  fp?: string
  form?: string
  filed?: string
}

function zuMioUsd(val: number): number {
  const abs = Math.abs(val)
  if (abs >= 1_000_000_000) return Math.round((val / 1_000_000) * 10) / 10
  if (abs >= 10_000_000) return Math.round((val / 1_000_000) * 10) / 10
  return Math.round(val * 10) / 10
}

function jahrAusEintrag(e: FactsUnit): number | null {
  const iso = e.end
  if (iso) {
    const y = parseInt(iso.slice(0, 4), 10)
    if (Number.isFinite(y) && y >= 1990 && y <= 2035) return y
  }
  if (e.fy != null && e.fy >= 1990 && e.fy <= 2035) return e.fy
  return null
}

function extrahiereUmsatz(facts: Record<string, unknown>, tags: string[]): Map<number, number> {
  const map = new Map<number, { val: number; filed: string }>()
  const gaap = (facts as { facts?: { 'us-gaap'?: Record<string, { units?: Record<string, FactsUnit[]> }> } }).facts?.[
    'us-gaap'
  ]
  if (!gaap) return new Map()

  for (const tag of tags) {
    const einheiten = gaap[tag]?.units
    if (!einheiten) continue
    for (const liste of Object.values(einheiten)) {
      for (const e of liste ?? []) {
        if (e.form && e.form !== '10-K') continue
        if (e.fp && e.fp !== 'FY') continue
        const jahr = jahrAusEintrag(e)
        const val = e.val
        if (jahr == null || val == null || !Number.isFinite(val) || val <= 0) continue
        const norm = zuMioUsd(val)
        const filed = e.filed ?? e.end ?? ''
        const prev = map.get(jahr)
        if (
          !prev ||
          filed > prev.filed ||
          (filed === prev.filed && Math.abs(norm) > Math.abs(prev.val))
        ) {
          map.set(jahr, { val: norm, filed })
        }
      }
    }
    if (map.size >= 8) break
  }
  return new Map([...map.entries()].map(([j, { val }]) => [j, val]))
}

const UMSATZ_TAGS = [
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'Revenues',
  'SalesRevenueNet',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
]

/** Plausibilität: kein 2-Jahres-Vorlauf (fy-first-Bug) — letztes Jahr ≈ vorletztes × Wachstum. */
function pruefeJahrVerschiebung(umsatz: Map<number, number>): string | null {
  const jahre = [...umsatz.keys()].sort((a, b) => a - b)
  if (jahre.length < 4) return null
  const neueste = jahre[jahre.length - 1]!
  const v1 = umsatz.get(neueste)
  const v2 = umsatz.get(neueste - 1)
  const v3 = umsatz.get(neueste - 2)
  const v4 = umsatz.get(neueste - 3)
  if (v1 == null || v2 == null || v3 == null || v4 == null) return null

  // fy-first-Bug: v(neueste) ≈ v(neueste-2) statt v(neueste-1) Wachstumsmuster
  const ratio12 = v1 / v2
  const ratio23 = v2 / v3
  const ratio34 = v3 / v4
  if (Math.abs(ratio12 - ratio34) < 0.02 && Math.abs(ratio23 - ratio34) > 0.08) {
    return `Verdacht 2-Jahres-Verschiebung: ${neueste}=${v1}, ${neueste - 1}=${v2}, ${neueste - 2}=${v3}`
  }
  return null
}

async function main() {
  const us = NACHKAUF_RADAR_WHITELIST.filter((e) => e.cik)
  let ok = 0
  let fail = 0

  for (const entry of us) {
    const cik = parseInt(entry.cik!.replace(/\D/g, ''), 10)
    const ticker = entry.ticker
    await new Promise((r) => setTimeout(r, 300))
    try {
      const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`, {
        headers: { 'User-Agent': UA },
      })
      if (!res.ok) {
        console.log(`FAIL ${ticker}: HTTP ${res.status}`)
        fail++
        continue
      }
      const data = await res.json()
      const umsatz = extrahiereUmsatz(data, UMSATZ_TAGS)
      if (umsatz.size < 5) {
        console.log(`FAIL ${ticker}: nur ${umsatz.size} Jahre Umsatz`)
        fail++
        continue
      }
      const jahre = [...umsatz.keys()].sort((a, b) => a - b)
      const neueste = jahre[jahre.length - 1]!
      const aelteste = jahre[0]!
      const letzte3 = jahre.slice(-3).map((j) => `${j}=${umsatz.get(j)?.toLocaleString('de-DE')}`).join(', ')
      const bug = pruefeJahrVerschiebung(umsatz)
      if (bug) {
        console.log(`FAIL ${ticker}: ${bug} | ${letzte3}`)
        fail++
      } else {
        console.log(`OK   ${ticker}: ${aelteste}–${neueste} (${umsatz.size}J) | ${letzte3}`)
        ok++
      }
    } catch (e) {
      console.log(`FAIL ${ticker}: ${e}`)
      fail++
    }
  }

  console.log(`\n=== ${ok}/${us.length} OK, ${fail} FAIL ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(console.error)
