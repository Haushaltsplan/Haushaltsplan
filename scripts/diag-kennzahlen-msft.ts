/**
 * Diagnose SEC Kennzahlen — MSFT Jahr/Zuordnung
 * npx tsx scripts/diag-kennzahlen-msft.ts
 */
import { readFileSync } from 'fs'

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
const CIK = 789019

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

function jahrAusEintragAktuell(e: FactsUnit): number | null {
  if (e.fy != null && e.fy >= 1990 && e.fy <= 2035) return e.fy
  const iso = e.end
  if (!iso) return null
  const y = parseInt(iso.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

function jahrAusEintragEnd(e: FactsUnit): number | null {
  const iso = e.end
  if (!iso) return e.fy ?? null
  const y = parseInt(iso.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

function extrahiere(
  liste: FactsUnit[],
  jahrFn: (e: FactsUnit) => number | null,
): Map<number, number> {
  const map = new Map<number, { val: number; filed: string }>()
  for (const e of liste) {
    if (e.form && e.form !== '10-K') continue
    if (e.fp && e.fp !== 'FY') continue
    const jahr = jahrFn(e)
    const val = e.val
    if (jahr == null || val == null || !Number.isFinite(val)) continue
    const norm = zuMioUsd(val)
    const filed = e.filed ?? e.end ?? ''
    const prev = map.get(jahr)
    if (!prev || filed > prev.filed) map.set(jahr, { val: norm, filed })
  }
  return new Map([...map.entries()].map(([j, { val }]) => [j, val]))
}

async function main() {
  const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json`, {
    headers: { 'User-Agent': UA },
  })
  const data = await res.json()
  const tag = 'RevenueFromContractWithCustomerExcludingAssessedTax'
  const liste: FactsUnit[] = data?.facts?.['us-gaap']?.[tag]?.units?.USD ?? []
  const fy = liste.filter((e) => e.form === '10-K' && e.fp === 'FY' && (e.fy ?? 0) >= 2018)

  console.log('=== Rohdaten', tag, '===')
  for (const e of fy.sort((a, b) => (a.fy ?? 0) - (b.fy ?? 0) || (a.filed ?? '').localeCompare(b.filed ?? ''))) {
    console.log(`fy=${e.fy} end=${e.end} val=${e.val} filed=${e.filed?.slice(0, 10)}`)
  }

  const mitFy = extrahiere(liste, jahrAusEintragAktuell)
  const mitEnd = extrahiere(liste, jahrAusEintragEnd)

  console.log('\n=== Aktuelle Logik (fy zuerst) ===')
  for (const [j, v] of [...mitFy.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`${j}: ${v}`)
  }

  console.log('\n=== Alternative (end-Jahr) ===')
  for (const [j, v] of [...mitEnd.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`${j}: ${v}`)
  }

  const erwartet: Record<number, number> = {
    2021: 168088,
    2022: 198270,
    2023: 211915,
    2024: 245122,
  }
  console.log('\n=== Abgleich fy-first vs end-year ===')
  for (const [jahr, exp] of Object.entries(erwartet)) {
    const j = Number(jahr)
    const gotFy = mitFy.get(j)
    const gotEnd = mitEnd.get(j)
    console.log(
      `FY${jahr}: erwartet ~${exp} | fy-first=${gotFy ?? '–'} | end-year=${gotEnd ?? '–'}`,
    )
  }
}

main().catch(console.error)
