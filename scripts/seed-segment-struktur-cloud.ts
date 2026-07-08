/**
 * Segment-Struktur in Supabase vorwärmen (lokal — Marketscreener blockiert Vercel-IPs).
 *
 * Voraussetzung: Migration `20260708180000_segment_struktur_cache.sql` in Supabase ausführen.
 *
 *   npx tsx --require ./scripts/mock-server-only.cjs scripts/seed-segment-struktur-cloud.ts
 *   npx tsx --require ./scripts/mock-server-only.cjs scripts/seed-segment-struktur-cloud.ts MSCI MSFT
 */
import { readFileSync } from 'fs'

import { isinKenntnis } from '../lib/portfolio-analyse/isin-kenntnisse'
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { ladeGescrapteSegmentStruktur } from '../lib/portfolio-analyse/segment-struktur-scraper-server'
import { ladeSegmentStrukturAusCloud } from '../lib/portfolio-analyse/segment-struktur-cloud-server'

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

async function seedEinen(name: string, isin: string, symbolYahoo: string, ticker: string) {
  const paket = await ladeGescrapteSegmentStruktur({
    isin,
    name,
    symbolYahoo,
    ticker,
    refresh: true,
  })
  const cloud = await ladeSegmentStrukturAusCloud(isin)
  const prod = paket?.produkt?.anzahlJahre ?? 0
  const geo = paket?.geo?.anzahlJahre ?? 0
  const backlog = paket?.backlog?.anzahlJahre ?? 0
  const ok = Boolean(paket && (prod > 0 || geo > 0 || backlog > 0))
  const cloudOk = Boolean(cloud)
  if (ok && !cloudOk) {
    console.warn(`  ⚠ Cloud-Speichern fehlgeschlagen für ${isin} — Migration segment_struktur_cache ausgeführt?`)
  }
  console.log(
    `${ok ? 'OK' : 'FAIL'} ${name.padEnd(22)} live ${prod}/${geo}/${backlog} cloud=${cloudOk ? 'ja' : 'nein'}`,
  )
  return ok
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local')
    process.exit(1)
  }

  const filter = new Set(process.argv.slice(2).map((a) => a.toUpperCase()))
  const liste = NACHKAUF_RADAR_WHITELIST.filter((pos) => {
    if (filter.size === 0) return true
    const k = isinKenntnis(pos.isin)
    const sym = (k?.symbolYahoo ?? '').toUpperCase()
    const ticker = sym.split('.')[0] ?? ''
    return (
      filter.has(pos.name.toUpperCase()) ||
      filter.has(pos.isin.toUpperCase()) ||
      filter.has(sym) ||
      filter.has(ticker)
    )
  })

  console.log(`Seed ${liste.length} Titel …\n`)
  let ok = 0
  for (const pos of liste) {
    const k = isinKenntnis(pos.isin)
    const sym = k?.symbolYahoo ?? ''
    const ticker = sym.split('.')[0] ?? ''
    if (await seedEinen(pos.name, pos.isin, sym, ticker)) ok++
    await new Promise((r) => setTimeout(r, 400))
  }
  console.log(`\nFertig: ${ok}/${liste.length} mit Daten`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
