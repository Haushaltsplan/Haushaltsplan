/**
 * EU-Kennzahlen (Marketscreener) in Supabase vorwärmen (lokal — MS blockiert oft Vercel-IPs).
 *
 * Voraussetzung: Migration `20260713214600_portfolio_analyse_eu_fundamental_cache.sql` in Supabase ausführen.
 *
 *   npx tsx --require ./scripts/mock-server-only.cjs scripts/seed-eu-fundamental-cloud.ts
 *   npx tsx --require ./scripts/mock-server-only.cjs scripts/seed-eu-fundamental-cloud.ts ASML
 *   npx tsx --require ./scripts/mock-server-only.cjs scripts/seed-eu-fundamental-cloud.ts --retry-fail
 */
import { readFileSync } from 'fs'

import { isinKenntnis } from '../lib/portfolio-analyse/isin-kenntnisse'
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { ladeEuFundamentalAusCloud } from '../lib/portfolio-analyse/eu-fundamental-cloud-server'
import { ladeEuFundamentalKennzahlen } from '../lib/portfolio-analyse/marketscreener-fundamental-kennzahlen-server'
import { speichereEuFundamentalInCloud } from '../lib/portfolio-analyse/eu-fundamental-cloud-server'

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

function istEuIsin(isin: string): boolean {
  const i = isin.trim().toUpperCase()
  return i.startsWith('DE') || i.startsWith('NL') || i.startsWith('FR') || i.startsWith('CH') || i.startsWith('GB')
}

const PAUSE_MS = 900
const RETRY_PAUSE_MS = 2_000

async function seedEinen(name: string, isin: string, symbolYahoo: string) {
  const live = await ladeEuFundamentalKennzahlen(isin, name, symbolYahoo || null)
  if (live) {
    await speichereEuFundamentalInCloud({
      isin,
      ticker: symbolYahoo?.trim().toUpperCase() || null,
      firmenname: name,
      paket: live,
    })
  }
  const cloud = await ladeEuFundamentalAusCloud(isin)
  const ok = Boolean(live?.kennzahlen?.length)
  const cloudOk = Boolean(cloud?.kennzahlen?.length)
  const anzahl = live?.kennzahlen?.length ?? 0
  if (ok && !cloudOk) {
    console.warn(`  ⚠ Cloud-Speichern fehlgeschlagen für ${isin} — Migration/Service-Role prüfen`)
  }
  console.log(`${ok ? 'OK' : 'FAIL'} ${name.padEnd(24)} kennzahlen=${anzahl} cloud=${cloudOk ? 'ja' : 'nein'}`)
  return ok
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local')
    process.exit(1)
  }

  const args = process.argv.slice(2)
  const retryFail = args.includes('--retry-fail')
  const filter = new Set(args.filter((a) => !a.startsWith('--')).map((a) => a.toUpperCase()))

  const liste = NACHKAUF_RADAR_WHITELIST.filter((pos) => {
    if (!istEuIsin(pos.isin)) return false
    if (filter.size === 0) return true
    const k = isinKenntnis(pos.isin)
    const sym = (k?.symbolYahoo ?? '').toUpperCase()
    return (
      filter.has(pos.name.toUpperCase()) ||
      filter.has(pos.isin.toUpperCase()) ||
      (sym ? filter.has(sym) : false)
    )
  })

  console.log(`Seed ${liste.length} EU-Titel …\n`)
  const fehlgeschlagen: typeof liste = []
  let ok = 0
  for (const pos of liste) {
    const k = isinKenntnis(pos.isin)
    const sym = k?.symbolYahoo ?? ''
    if (await seedEinen(pos.name, pos.isin, sym)) ok++
    else fehlgeschlagen.push(pos)
    await new Promise((r) => setTimeout(r, PAUSE_MS))
  }

  if (retryFail && fehlgeschlagen.length > 0) {
    console.log(`\n--- Retry ${fehlgeschlagen.length} fehlgeschlagene Titel (längere Pause) ---\n`)
    for (const pos of fehlgeschlagen) {
      const k = isinKenntnis(pos.isin)
      const sym = k?.symbolYahoo ?? ''
      await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS))
      if (await seedEinen(pos.name, pos.isin, sym)) ok++
    }
  }

  console.log(`\nFertig: ${ok}/${liste.length} mit Daten`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

