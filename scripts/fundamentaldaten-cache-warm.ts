/**
 * Fundamentaldaten-Paket-Cache vorwärmen (Whitelist + Watchlist).
 *
 * Voraussetzung: Migration `20260823220000_fundamentaldaten_paket_cache.sql`.
 *
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/fundamentaldaten-cache-warm.ts
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/fundamentaldaten-cache-warm.ts MSFT ASML
 *   npx tsx --conditions=react-server --require ./scripts/mock-server-only.cjs scripts/fundamentaldaten-cache-warm.ts --erneuern
 */
import { readFileSync } from 'fs'

import { createSupabaseAdmin } from '../lib/supabase-admin'
import { ladeFundamentaldaten } from '../lib/portfolio-analyse/fundamentaldaten-server'
import {
  fundamentaldatenCacheKey,
  ladeFundamentaldatenPaketCache,
} from '../lib/portfolio-analyse/fundamentaldaten-paket-cache-server'
import { ladeNachkaufKandidaten } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-watchlist-cloud-server'
import { ladeDepotAktieAnfragen } from '../lib/portfolio-analyse/depot-gewichte-server'
import type { WhitelistPosition } from '../lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-whitelist'

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

const PARALLEL = 2
const PAUSE_MS = 900
const TIMEOUT_SCHNELL_MS = 120_000
const TIMEOUT_EU_MS = 480_000
const TABLE = 'fundamentaldaten_paket_cache'

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function istEuIsin(isin: string): boolean {
  return /^(DE|NL|FR|CH|GB|IE|BE|AT|IT|ES|SE|DK|NO|FI)/i.test(isin.trim())
}

async function mitTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout ${Math.round(ms / 1000)}s ${label}`)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function tickerVon(k: WhitelistPosition): string {
  return (k.symbolYahoo ?? k.symbolCandidates?.[0] ?? '').trim().toUpperCase()
}

async function warmEinen(
  k: WhitelistPosition,
  i: number,
  gesamt: number,
  erneuern: boolean,
  timeoutMs: number,
): Promise<{ ok: boolean; imCache: boolean }> {
  const label = `${String(i + 1).padStart(2, '0')}/${gesamt} ${(k.name ?? k.isin).slice(0, 22).padEnd(22)}`
  const t0 = Date.now()
  const anfrage = {
    isin: k.isin,
    name: k.name,
    symbolYahoo: k.symbolYahoo ?? (tickerVon(k) || null),
    symbolCandidates: k.symbolCandidates,
    frequenz: 'jahr' as const,
    segmentNurCloud: true,
    cacheModus: erneuern ? ('erneuern' as const) : ('immer' as const),
  }
  try {
    const paket = await mitTimeout(ladeFundamentaldaten(anfrage), timeoutMs, k.name)
    const key = fundamentaldatenCacheKey(anfrage)
    const cached = key ? await ladeFundamentaldatenPaketCache(key) : null
    const roiic = paket.keyMetrics.find((m) => m.id === 'incremental_roic')
    const sek = Math.round((Date.now() - t0) / 1000)
    const quelle = k.quelle === 'watchlist' ? 'WL' : 'WLST'
    if (paket.ok && cached) {
      console.log(
        `OK   ${label} ${quelle} zeilen=${String(paket.zeilen.length).padStart(3)} roiic=${(roiic?.wert ?? '–').padEnd(18)} ${sek}s`,
      )
      return { ok: true, imCache: true }
    }
    console.warn(
      `FAIL ${label} ${quelle} ok=${paket.ok} cache=${Boolean(cached)} ${paket.fehler ?? ''} ${sek}s`,
    )
    return { ok: false, imCache: Boolean(cached) }
  } catch (e) {
    const sek = Math.round((Date.now() - t0) / 1000)
    console.warn(`FAIL ${label} ${e instanceof Error ? e.message : String(e)} ${sek}s`)
    return { ok: false, imCache: false }
  }
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local')
    process.exit(1)
  }

  const args = process.argv.slice(2)
  const erneuern = args.includes('--erneuern')
  const filter = new Set(args.filter((a) => !a.startsWith('--')).map((a) => a.toUpperCase()))

  const { error: tabellenFehler } = await createSupabaseAdmin()
    .from(TABLE)
    .select('cache_key')
    .limit(1)
  if (tabellenFehler) {
    console.error('Cache-Tabelle nicht erreichbar:', tabellenFehler.message)
    console.error('Migration 20260823220000_fundamentaldaten_paket_cache.sql in Supabase ausführen.')
    process.exit(1)
  }

  const radar = await ladeNachkaufKandidaten()
  const depot = await ladeDepotAktieAnfragen()
  const gesehen = new Set(radar.map((k) => k.isin.toUpperCase()))
  const extra: WhitelistPosition[] = []
  for (const d of depot) {
    const isin = d.isin?.trim().toUpperCase()
    if (!isin || gesehen.has(isin)) continue
    gesehen.add(isin)
    extra.push({
      isin,
      name: d.name ?? isin,
      symbolYahoo: d.symbolYahoo,
      symbolCandidates: d.symbolCandidates,
      quelle: 'watchlist',
    })
  }
  const kandidaten = [...radar, ...extra]
  const liste = kandidaten.filter((k) => {
    if (filter.size === 0) return true
    const t = tickerVon(k)
    return (
      filter.has(k.isin.toUpperCase()) ||
      filter.has(k.name.toUpperCase()) ||
      (t ? filter.has(t) || filter.has(t.split('.')[0]!) : false)
    )
  })

  const schnell = liste.filter((k) => !istEuIsin(k.isin))
  const langsam = liste.filter((k) => istEuIsin(k.isin))
  console.log(
    `Warmup ${liste.length} Titel (Whitelist+Watchlist+Depot)${erneuern ? ', erneuern' : ''} — ${schnell.length} parallel, ${langsam.length} EU nacheinander`,
  )

  let ok = 0
  let fail = 0
  const fehlgeschlagen: WhitelistPosition[] = []

  const lauf = async (
    ziele: WhitelistPosition[],
    parallel: number,
    timeoutMs: number,
    startIndex: number,
  ) => {
    for (let i = 0; i < ziele.length; i += parallel) {
      const batch = ziele.slice(i, i + parallel)
      const res = await Promise.all(
        batch.map((k, j) =>
          warmEinen(k, startIndex + i + j, liste.length, erneuern, timeoutMs),
        ),
      )
      for (let j = 0; j < res.length; j++) {
        if (res[j]!.ok) ok++
        else {
          fail++
          fehlgeschlagen.push(batch[j]!)
        }
      }
      if (i + parallel < ziele.length) await sleep(PAUSE_MS)
    }
  }

  await lauf(schnell, PARALLEL, TIMEOUT_SCHNELL_MS, 0)
  await lauf(langsam, 1, TIMEOUT_EU_MS, schnell.length)

  if (fehlgeschlagen.length > 0) {
    console.log(`\nRetry ${fehlgeschlagen.length} Fehler…`)
    await sleep(2000)
    for (const k of fehlgeschlagen) {
      const timeoutMs = istEuIsin(k.isin) ? TIMEOUT_EU_MS : TIMEOUT_SCHNELL_MS
      const r = await warmEinen(k, ok + fail, liste.length, false, timeoutMs)
      if (r.ok) {
        ok++
        fail--
      }
    }
  }

  const { count } = await createSupabaseAdmin()
    .from(TABLE)
    .select('cache_key', { count: 'exact', head: true })
    .eq('frequenz', 'jahr')

  console.log(`\nFertig: ${ok} im Cache, ${fail} fehlgeschlagen, Tabelle jahr=${count ?? '?'}`)
  if (fail > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
