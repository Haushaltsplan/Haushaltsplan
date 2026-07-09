/**
 * Segment-Struktur in Supabase vorwärmen (lokal — Marketscreener blockiert Vercel-IPs).
 *
 * Voraussetzung: Migration `20260708180000_segment_struktur_cache.sql` in Supabase ausführen.
 *
 *   npx tsx --require ./scripts/mock-server-only.cjs scripts/seed-segment-struktur-cloud.ts
 *   npx tsx --require ./scripts/mock-server-only.cjs scripts/seed-segment-struktur-cloud.ts MSCI MSFT
 *   npx tsx --require ./scripts/mock-server-only.cjs scripts/seed-segment-struktur-cloud.ts --retry-fail
 */
import { readFileSync } from 'fs'

import { isinKenntnis } from '../lib/portfolio-analyse/isin-kenntnisse'
import { NACHKAUF_RADAR_WHITELIST } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'
import { ladeGescrapteSegmentStruktur } from '../lib/portfolio-analyse/segment-struktur-scraper-server'
import { ladeSegmentStrukturAusCloud } from '../lib/portfolio-analyse/segment-struktur-cloud-server'
import { summeUmsatzMio } from '../lib/portfolio-analyse/segment-historie-merge-hilfen'

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

function basisTicker(k: ReturnType<typeof isinKenntnis>): string {
  for (const sym of [k?.logoSymbol, k?.macrotrendsTicker, k?.symbolYahoo, k?.symbolCandidates?.[0]]) {
    const t = sym?.trim().toUpperCase().split('.')[0]
    if (t) return t
  }
  return ''
}

const PAUSE_MS = 1_100
const RETRY_PAUSE_MS = 2_500

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
    console.warn(`  ⚠ Cloud-Speichern fehlgeschlagen für ${isin} — Migration/Service-Role prüfen`)
  }
  const prodB = (summeUmsatzMio(paket?.produkt) / 1000).toFixed(1)
  const geoB = paket?.geo ? (summeUmsatzMio(paket.geo) / 1000).toFixed(1) : '—'
  console.log(
    `${ok ? 'OK' : 'FAIL'} ${name.padEnd(24)} live ${prod}/${geo}/${backlog} ~${prodB}B/${geoB}B quelle=${paket?.quelle ?? '?'} cloud=${cloudOk ? 'ja' : 'nein'}`,
  )
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
    if (filter.size === 0) return true
    const k = isinKenntnis(pos.isin)
    const sym = (k?.symbolYahoo ?? '').toUpperCase()
    const ticker = basisTicker(k)
    return (
      filter.has(pos.name.toUpperCase()) ||
      filter.has(pos.isin.toUpperCase()) ||
      filter.has(sym) ||
      filter.has(ticker)
    )
  })

  console.log(`Seed ${liste.length} Titel …\n`)
  const fehlgeschlagen: typeof liste = []
  let ok = 0
  for (const pos of liste) {
    const k = isinKenntnis(pos.isin)
    const sym = k?.symbolYahoo ?? ''
    const ticker = basisTicker(k)
    if (await seedEinen(pos.name, pos.isin, sym, ticker)) ok++
    else fehlgeschlagen.push(pos)
    await new Promise((r) => setTimeout(r, PAUSE_MS))
  }

  if (retryFail && fehlgeschlagen.length > 0) {
    console.log(`\n--- Retry ${fehlgeschlagen.length} fehlgeschlagene Titel (längere Pause) ---\n`)
    for (const pos of fehlgeschlagen) {
      const k = isinKenntnis(pos.isin)
      const sym = k?.symbolYahoo ?? ''
      const ticker = basisTicker(k)
      await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS))
      if (await seedEinen(pos.name, pos.isin, sym, ticker)) ok++
    }
  }

  console.log(`\nFertig: ${ok}/${liste.length} mit Daten`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
