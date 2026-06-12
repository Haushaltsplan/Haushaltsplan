import 'server-only'

import { promises as fs } from 'fs'
import path from 'path'
import { dateiCachePfad } from '@/lib/datei-cache-pfad'

const DATEIPFAD = dateiCachePfad('portfolio-dividenden-isin.json')
const CACHE_VERSION = 1
/** Fest angekündigte Termine — länger gültig. */
export const DIVIDENDEN_BESTAETIGT_CACHE_MS = 7 * 24 * 60 * 60 * 1000
/** Gemischt mit Prognosen. */
export const DIVIDENDEN_MIX_CACHE_MS = 6 * 60 * 60 * 1000

export type DividendenIsinCacheTreffer = {
  zahlungsdatumIso: string
  exDatumIso: string | null
  dividendeProStueckEur: number
  symbol: string
  quelle: string
  bestaetigt: boolean
}

export type DividendenIsinCacheEintrag = {
  at: number
  isin: string
  treffer: DividendenIsinCacheTreffer[]
}

type DividendenIsinCacheDatei = {
  version: number
  stand: string
  byIsin: Record<string, DividendenIsinCacheEintrag>
}

function ttlFuerEintrag(e: DividendenIsinCacheEintrag): number {
  const nurBestaetigt = e.treffer.length > 0 && e.treffer.every((t) => t.bestaetigt)
  return nurBestaetigt ? DIVIDENDEN_BESTAETIGT_CACHE_MS : DIVIDENDEN_MIX_CACHE_MS
}

export function dividendenIsinCacheFrisch(e: DividendenIsinCacheEintrag): boolean {
  return Date.now() - e.at < ttlFuerEintrag(e)
}

async function leseDatei(): Promise<DividendenIsinCacheDatei | null> {
  try {
    const raw = await fs.readFile(DATEIPFAD, 'utf8')
    const j = JSON.parse(raw) as DividendenIsinCacheDatei
    if (j.version !== CACHE_VERSION || !j.byIsin) return null
    return j
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as NodeJS.ErrnoException).code : ''
    if (code === 'ENOENT') return null
    console.error('Dividenden-ISIN-Cache: Lesen', e)
    return null
  }
}

async function schreibeDatei(data: DividendenIsinCacheDatei): Promise<void> {
  await fs.mkdir(path.dirname(DATEIPFAD), { recursive: true })
  await fs.writeFile(DATEIPFAD, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export async function ladeDividendenIsinAusCache(
  isin: string,
): Promise<DividendenIsinCacheTreffer[] | null> {
  const isinNorm = isin.trim().toUpperCase()
  if (isinNorm.length < 10) return null
  const datei = await leseDatei()
  const hit = datei?.byIsin[isinNorm]
  if (!hit || !dividendenIsinCacheFrisch(hit)) return null
  return hit.treffer
}

export async function speichereDividendenIsinImCache(
  isin: string,
  treffer: DividendenIsinCacheTreffer[],
): Promise<void> {
  const isinNorm = isin.trim().toUpperCase()
  if (isinNorm.length < 10 || treffer.length === 0) return
  const datei = (await leseDatei()) ?? {
    version: CACHE_VERSION,
    stand: new Date().toISOString(),
    byIsin: {},
  }
  datei.stand = new Date().toISOString()
  datei.byIsin[isinNorm] = {
    at: Date.now(),
    isin: isinNorm,
    treffer,
  }
  await schreibeDatei(datei)
}
