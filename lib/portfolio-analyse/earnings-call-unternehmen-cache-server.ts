/** Earnings Call — Transkripte & KI pro Unternehmen (Ticker) dauerhaft. */

import 'server-only'

import type { EarningsCallQuelle } from '@/lib/portfolio-analyse/earnings-call-types'
import { promises as fs } from 'fs'
import path from 'path'

const DATEIPFAD = path.join(process.cwd(), 'data', 'portfolio-earnings-call-unternehmen.json')
const LEGACY_KI_PFAD = path.join(process.cwd(), 'data', 'portfolio-earnings-call-ki.json')
const CACHE_VERSION = 1

export type PersistiertesTranskript = {
  titel: string
  url: string
  callDatum: string | null
  text: string
  quelle: EarningsCallQuelle
}

export type PersistierteKiZeile = {
  zusammenfassung: string
  transcriptUrl: string
  aktualisiertAm: string
}

export type UnternehmenCacheEintrag = {
  ticker: string
  isin: string | null
  firmenname: string | null
  investorRelationsUrl: string | null
  geladenAm: string
  roh: PersistiertesTranskript[]
  summaries: Record<string, PersistierteKiZeile>
}

type CacheDatei = {
  version: number
  byTicker: Record<string, UnternehmenCacheEintrag>
}

function tickerNorm(ticker: string): string {
  return ticker.trim().toUpperCase()
}

async function leseDatei(): Promise<CacheDatei | null> {
  try {
    const raw = await fs.readFile(DATEIPFAD, 'utf8')
    const j = JSON.parse(raw) as CacheDatei
    if (j.version !== CACHE_VERSION || !j.byTicker || typeof j.byTicker !== 'object') return null
    return j
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as NodeJS.ErrnoException).code : ''
    if (code === 'ENOENT') return null
    console.error('Earnings-Call-Unternehmen-Cache: Lesen', e)
    return null
  }
}

async function schreibeDatei(data: CacheDatei): Promise<void> {
  await fs.mkdir(path.dirname(DATEIPFAD), { recursive: true })
  await fs.writeFile(DATEIPFAD, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function migriereLegacyKi(datei: CacheDatei): Promise<CacheDatei> {
  try {
    const raw = await fs.readFile(LEGACY_KI_PFAD, 'utf8')
    const legacy = JSON.parse(raw) as {
      byKey?: Record<string, { ticker: string; quartalId: string; transcriptUrl: string; zusammenfassung: string; aktualisiertAm: string }>
    }
    if (!legacy.byKey) return datei
    for (const row of Object.values(legacy.byKey)) {
      const t = tickerNorm(row.ticker)
      if (!datei.byTicker[t]) {
        datei.byTicker[t] = {
          ticker: t,
          isin: null,
          firmenname: null,
          investorRelationsUrl: null,
          geladenAm: row.aktualisiertAm,
          roh: [],
          summaries: {},
        }
      }
      datei.byTicker[t].summaries[row.quartalId] = {
        zusammenfassung: row.zusammenfassung,
        transcriptUrl: row.transcriptUrl,
        aktualisiertAm: row.aktualisiertAm,
      }
    }
    await schreibeDatei(datei)
  } catch {
    /* kein Legacy */
  }
  return datei
}

async function ladeDateiMitMigration(): Promise<CacheDatei> {
  let datei = await leseDatei()
  if (!datei) {
    datei = { version: CACHE_VERSION, byTicker: {} }
    return migriereLegacyKi(datei)
  }
  return datei
}

export async function ladeUnternehmenCache(ticker: string): Promise<UnternehmenCacheEintrag | null> {
  const datei = await ladeDateiMitMigration()
  return datei.byTicker[tickerNorm(ticker)] ?? null
}

export async function speichereUnternehmenTranskripte(
  ticker: string,
  meta: {
    isin?: string | null
    firmenname?: string | null
    investorRelationsUrl?: string | null
  },
  roh: PersistiertesTranskript[],
): Promise<void> {
  const t = tickerNorm(ticker)
  const datei = await ladeDateiMitMigration()
  const prev = datei.byTicker[t] ?? {
    ticker: t,
    isin: null,
    firmenname: null,
    investorRelationsUrl: null,
    geladenAm: new Date().toISOString(),
    roh: [],
    summaries: {},
  }

  datei.byTicker[t] = {
    ...prev,
    ticker: t,
    isin: meta.isin?.trim() || prev.isin,
    firmenname: meta.firmenname?.trim() || prev.firmenname,
    investorRelationsUrl: meta.investorRelationsUrl ?? prev.investorRelationsUrl,
    geladenAm: new Date().toISOString(),
    roh,
  }

  await schreibeDatei(datei)
}

export async function ladeEarningsCallKiCacheFuerTicker(
  ticker: string,
): Promise<Map<string, { zusammenfassung: string; transcriptUrl: string }>> {
  const hit = await ladeUnternehmenCache(ticker)
  const out = new Map<string, { zusammenfassung: string; transcriptUrl: string }>()
  if (!hit) return out
  for (const [quartalId, row] of Object.entries(hit.summaries)) {
    out.set(quartalId, { zusammenfassung: row.zusammenfassung, transcriptUrl: row.transcriptUrl })
  }
  return out
}

export async function ladeEarningsCallKiCacheEintrag(
  ticker: string,
  quartalId: string,
): Promise<{ zusammenfassung: string; transcriptUrl: string } | null> {
  const hit = await ladeUnternehmenCache(ticker)
  const row = hit?.summaries[quartalId.trim()]
  if (!row) return null
  return { zusammenfassung: row.zusammenfassung, transcriptUrl: row.transcriptUrl }
}

export async function speichereEarningsCallKiCache(eintrag: {
  ticker: string
  quartalId: string
  transcriptUrl: string
  zusammenfassung: string
}): Promise<void> {
  const t = tickerNorm(eintrag.ticker)
  const datei = await ladeDateiMitMigration()
  const now = new Date().toISOString()
  const prev = datei.byTicker[t] ?? {
    ticker: t,
    isin: null,
    firmenname: null,
    investorRelationsUrl: null,
    geladenAm: now,
    roh: [],
    summaries: {},
  }

  prev.summaries[eintrag.quartalId.trim()] = {
    zusammenfassung: eintrag.zusammenfassung,
    transcriptUrl: eintrag.transcriptUrl,
    aktualisiertAm: now,
  }

  datei.byTicker[t] = prev
  await schreibeDatei(datei)
}

export async function loescheEarningsCallKiCacheEintrag(ticker: string, quartalId: string): Promise<void> {
  const t = tickerNorm(ticker)
  const datei = await ladeDateiMitMigration()
  const prev = datei.byTicker[t]
  if (!prev) return
  delete prev.summaries[quartalId.trim()]
  await schreibeDatei(datei)
}
