/** Persistente KI-Zusammenfassungen — spart Tokens bei erneutem Abruf. */

import 'server-only'

import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

const DATEIPFAD = path.join(process.cwd(), 'data', 'portfolio-earnings-call-ki.json')
const CACHE_VERSION = 1

export type EarningsCallKiCacheEintrag = {
  ticker: string
  quartalId: string
  transcriptUrl: string
  zusammenfassung: string
  erstelltAm: string
  aktualisiertAm: string
}

type KiCacheDatei = {
  version: number
  byKey: Record<string, EarningsCallKiCacheEintrag>
}

function cacheKey(ticker: string, quartalId: string): string {
  return `${ticker.trim().toUpperCase()}|${quartalId.trim()}`
}

async function leseDatei(): Promise<KiCacheDatei | null> {
  try {
    const raw = await fs.readFile(DATEIPFAD, 'utf8')
    const j = JSON.parse(raw) as KiCacheDatei
    if (j.version !== CACHE_VERSION || !j.byKey || typeof j.byKey !== 'object') return null
    return j
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as NodeJS.ErrnoException).code : ''
    if (code === 'ENOENT') return null
    console.error('Earnings-Call-KI-Cache: Lesen', e)
    return null
  }
}

async function schreibeDatei(data: KiCacheDatei): Promise<void> {
  await fs.mkdir(path.dirname(DATEIPFAD), { recursive: true })
  await fs.writeFile(DATEIPFAD, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export async function ladeEarningsCallKiCacheFuerTicker(ticker: string): Promise<Map<string, EarningsCallKiCacheEintrag>> {
  const t = ticker.trim().toUpperCase()
  const datei = await leseDatei()
  const out = new Map<string, EarningsCallKiCacheEintrag>()
  if (!datei) return out
  for (const e of Object.values(datei.byKey)) {
    if (e.ticker === t) out.set(e.quartalId, e)
  }
  return out
}

export async function ladeEarningsCallKiCacheEintrag(
  ticker: string,
  quartalId: string,
): Promise<EarningsCallKiCacheEintrag | null> {
  const datei = await leseDatei()
  if (!datei) return null
  return datei.byKey[cacheKey(ticker, quartalId)] ?? null
}

export async function speichereEarningsCallKiCache(
  eintrag: Omit<EarningsCallKiCacheEintrag, 'erstelltAm' | 'aktualisiertAm'> & { erstelltAm?: string },
): Promise<void> {
  const key = cacheKey(eintrag.ticker, eintrag.quartalId)
  const now = new Date().toISOString()
  let datei = await leseDatei()
  if (!datei) {
    datei = { version: CACHE_VERSION, byKey: {} }
  }
  const prev = datei.byKey[key]
  datei.byKey[key] = {
    ...eintrag,
    ticker: eintrag.ticker.trim().toUpperCase(),
    erstelltAm: prev?.erstelltAm ?? eintrag.erstelltAm ?? now,
    aktualisiertAm: now,
  }
  await schreibeDatei(datei)
}

export async function loescheEarningsCallKiCacheEintrag(ticker: string, quartalId: string): Promise<void> {
  const datei = await leseDatei()
  if (!datei) return
  delete datei.byKey[cacheKey(ticker, quartalId)]
  await schreibeDatei(datei)
}

/** Hash für Client-Sync (optional). */
export function earningsCallKiFingerprint(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}
