/** SEC-Berichte — KI-Zusammenfassungen pro Ticker & Bericht dauerhaft. */

import 'server-only'

import { dateiCachePfad } from '@/lib/datei-cache-pfad'
import {
  ladeSecBerichtKiAusCloud,
  loescheSecBerichtKiCloudEintrag,
  speichereSecBerichtKiInCloud,
} from '@/lib/portfolio-analyse/portfolio-ki-cache-cloud-server'
import { promises as fs } from 'fs'
import path from 'path'

const DATEIPFAD = dateiCachePfad('portfolio-sec-berichte-ki.json')
const CACHE_VERSION = 1

export type SecBerichtKiZeile = {
  zusammenfassung: string
  accession: string
  aktualisiertAm: string
}

type CacheDatei = {
  version: number
  byTicker: Record<string, Record<string, SecBerichtKiZeile>>
}

let memoryCache: CacheDatei | null = null
let schreibenMoeglich: boolean | null = null

function tickerNorm(ticker: string): string {
  return ticker.trim().toUpperCase()
}

async function stelleSchreibenSicher(): Promise<boolean> {
  if (schreibenMoeglich !== null) return schreibenMoeglich
  try {
    await fs.mkdir(path.dirname(DATEIPFAD), { recursive: true })
    schreibenMoeglich = true
  } catch {
    schreibenMoeglich = false
  }
  return schreibenMoeglich
}

async function leseDatei(): Promise<CacheDatei | null> {
  if (memoryCache) return memoryCache
  try {
    const raw = await fs.readFile(DATEIPFAD, 'utf8')
    const j = JSON.parse(raw) as CacheDatei
    if (j.version !== CACHE_VERSION || !j.byTicker || typeof j.byTicker !== 'object') return null
    memoryCache = j
    return j
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as NodeJS.ErrnoException).code : ''
    if (code === 'ENOENT') return null
    console.error('SEC-Berichte-KI-Cache: Lesen', e)
    return null
  }
}

async function schreibeDatei(data: CacheDatei): Promise<void> {
  memoryCache = data
  if (!(await stelleSchreibenSicher())) return
  try {
    await fs.writeFile(DATEIPFAD, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  } catch (e) {
    schreibenMoeglich = false
    console.warn('SEC-Berichte-KI-Cache: Schreiben übersprungen (nur RAM)', e)
  }
}

async function ladeDatei(): Promise<CacheDatei> {
  const hit = await leseDatei()
  return hit ?? { version: CACHE_VERSION, byTicker: {} }
}

export async function ladeSecBerichtKiCacheFuerTicker(
  ticker: string,
): Promise<Map<string, SecBerichtKiZeile>> {
  const t = tickerNorm(ticker)
  const cloud = await ladeSecBerichtKiAusCloud(t)
  const datei = await ladeDatei()
  const rows = datei.byTicker[t] ?? {}
  const merged = new Map<string, SecBerichtKiZeile>()
  for (const [berichtId, row] of Object.entries(rows)) {
    merged.set(berichtId, row)
  }
  for (const [berichtId, row] of cloud) {
    const prev = merged.get(berichtId)
    if (!prev || row.aktualisiertAm >= prev.aktualisiertAm) {
      merged.set(berichtId, {
        zusammenfassung: row.zusammenfassung,
        accession: row.accession,
        aktualisiertAm: row.aktualisiertAm,
      })
    }
  }
  return merged
}

export async function ladeSecBerichtKiCacheEintrag(
  ticker: string,
  berichtId: string,
): Promise<SecBerichtKiZeile | null> {
  const map = await ladeSecBerichtKiCacheFuerTicker(ticker)
  return map.get(berichtId.trim()) ?? null
}

export async function speichereSecBerichtKiCache(eintrag: {
  ticker: string
  berichtId: string
  accession: string
  zusammenfassung: string
}): Promise<void> {
  const t = tickerNorm(eintrag.ticker)
  const datei = await ladeDatei()
  if (!datei.byTicker[t]) datei.byTicker[t] = {}
  const zeile: SecBerichtKiZeile = {
    zusammenfassung: eintrag.zusammenfassung,
    accession: eintrag.accession,
    aktualisiertAm: new Date().toISOString(),
  }
  datei.byTicker[t][eintrag.berichtId.trim()] = zeile
  await schreibeDatei(datei)
  await speichereSecBerichtKiInCloud(eintrag)
}

export async function loescheSecBerichtKiCacheEintrag(ticker: string, berichtId: string): Promise<void> {
  const t = tickerNorm(ticker)
  const datei = await ladeDatei()
  if (!datei.byTicker[t]) return
  delete datei.byTicker[t][berichtId.trim()]
  await schreibeDatei(datei)
  await loescheSecBerichtKiCloudEintrag(ticker, berichtId)
}
