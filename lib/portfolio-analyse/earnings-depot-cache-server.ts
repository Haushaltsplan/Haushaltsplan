import 'server-only'

import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import type { EarningsTerminKandidat } from '@/lib/portfolio-analyse/earnings-termine'
import type { DepotPositionAnfrage } from '@/lib/portfolio-analyse/ankuendigte-dividenden'

const DATEIPFAD = path.join(process.cwd(), 'data', 'portfolio-earnings-kalender.json')
const CACHE_VERSION = 10

/** Gültigkeit pro ISIN — danach erneut laden. */
export const EARNINGS_ISIN_CACHE_MS = 6 * 60 * 60 * 1000

export type EarningsIsinCacheEintrag = {
  at: number
  von: string
  bis: string
  name: string
  symbol: string
  stueck: number
  termine: EarningsTerminKandidat[]
}

type DepotCacheDatei = {
  version: number
  depotKey: string
  von: string
  bis: string
  stand: string
  at: number
  byIsin: Record<string, EarningsIsinCacheEintrag>
}

export function depotKeyAusPositionen(positionen: DepotPositionAnfrage[]): string {
  const teile = positionen
    .filter((p) => p.stueck > 0)
    .map((p) => `${(p.isin ?? '').trim().toUpperCase()}:${p.stueck}`)
    .sort()
  return createHash('sha256').update(teile.join('|')).digest('hex').slice(0, 24)
}

async function leseCacheDatei(): Promise<DepotCacheDatei | null> {
  try {
    const raw = await fs.readFile(DATEIPFAD, 'utf8')
    const j = JSON.parse(raw) as DepotCacheDatei
    if (j.version !== CACHE_VERSION || !j.byIsin || typeof j.byIsin !== 'object') return null
    return j
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as NodeJS.ErrnoException).code : ''
    if (code === 'ENOENT') return null
    console.error('Earnings-Depot-Cache: Lesen', e)
    return null
  }
}

async function schreibeCacheDatei(data: DepotCacheDatei): Promise<void> {
  await fs.mkdir(path.dirname(DATEIPFAD), { recursive: true })
  await fs.writeFile(DATEIPFAD, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export function earningsIsinCacheFrisch(e: EarningsIsinCacheEintrag, von: string, bis: string): boolean {
  return Date.now() - e.at < EARNINGS_ISIN_CACHE_MS && e.von === von && e.bis === bis
}

export async function ladeEarningsIsinAusDepotCache(
  isin: string,
  von: string,
  bis: string,
): Promise<EarningsIsinCacheEintrag | null> {
  const datei = await leseCacheDatei()
  if (!datei || datei.von !== von || datei.bis !== bis) return null
  const hit = datei.byIsin[isin.trim().toUpperCase()]
  if (!hit || !earningsIsinCacheFrisch(hit, von, bis)) return null
  return hit
}

export async function speichereEarningsIsinImDepotCache(
  depotKey: string,
  von: string,
  bis: string,
  isin: string,
  eintrag: Omit<EarningsIsinCacheEintrag, 'at' | 'von' | 'bis'>,
): Promise<void> {
  const isinNorm = isin.trim().toUpperCase()
  let datei = await leseCacheDatei()
  if (!datei || datei.depotKey !== depotKey || datei.von !== von || datei.bis !== bis) {
    datei = {
      version: CACHE_VERSION,
      depotKey,
      von,
      bis,
      stand: new Date().toISOString(),
      at: Date.now(),
      byIsin: datei?.byIsin ?? {},
    }
  }
  datei.stand = new Date().toISOString()
  datei.at = Date.now()
  datei.byIsin[isinNorm] = {
    at: Date.now(),
    von,
    bis,
    ...eintrag,
  }
  await schreibeCacheDatei(datei)
}

/** Alte Multi-Quellen-Caches entfernen. */
export async function loescheEarningsDepotCacheDatei(): Promise<void> {
  try {
    await fs.unlink(DATEIPFAD)
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as NodeJS.ErrnoException).code : ''
    if (code !== 'ENOENT') console.error('Earnings-Depot-Cache: Löschen', e)
  }
}
