/** Earnings Call — Transkripte & KI pro Unternehmen (Ticker) dauerhaft. */

import 'server-only'

import { dateiCachePfad } from '@/lib/datei-cache-pfad'
import {
  ladeEarningsCallKiAusCloud,
  loescheEarningsCallKiCloudEintrag,
  speichereEarningsCallKiInCloud,
} from '@/lib/portfolio-analyse/portfolio-ki-cache-cloud-server'
import { sentimentScoreAusZusammenfassung } from '@/lib/portfolio-analyse/earnings-call-sentiment'
import type { EarningsCallQuelle } from '@/lib/portfolio-analyse/earnings-call-types'
import { promises as fs } from 'fs'
import path from 'path'

const DATEIPFAD = dateiCachePfad('portfolio-earnings-call-unternehmen.json')
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
  /** Management-Optimismus −100…+100 (aus KI oder Heuristik). */
  sentimentScore?: number | null
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
    console.error('Earnings-Call-Unternehmen-Cache: Lesen', e)
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
    console.warn('Earnings-Call-Unternehmen-Cache: Schreiben übersprungen (nur RAM)', e)
  }
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
): Promise<
  Map<
    string,
    {
      zusammenfassung: string
      transcriptUrl: string
      aktualisiertAm: string
      sentimentScore: number | null
    }
  >
> {
  const t = tickerNorm(ticker)
  const cloud = await ladeEarningsCallKiAusCloud(t)
  const hit = await ladeUnternehmenCache(ticker)
  const out = new Map<
    string,
    {
      zusammenfassung: string
      transcriptUrl: string
      aktualisiertAm: string
      sentimentScore: number | null
    }
  >()
  if (hit) {
    for (const [quartalId, row] of Object.entries(hit.summaries)) {
      out.set(quartalId, {
        zusammenfassung: row.zusammenfassung,
        transcriptUrl: row.transcriptUrl,
        aktualisiertAm: row.aktualisiertAm,
        sentimentScore:
          row.sentimentScore ?? sentimentScoreAusZusammenfassung(row.zusammenfassung),
      })
    }
  }
  for (const [quartalId, row] of cloud) {
    const prev = out.get(quartalId)
    const fileRow = hit?.summaries[quartalId]
    if (!prev || row.aktualisiertAm >= (fileRow?.aktualisiertAm ?? '')) {
      out.set(quartalId, {
        zusammenfassung: row.zusammenfassung,
        transcriptUrl: row.transcriptUrl,
        aktualisiertAm: row.aktualisiertAm,
        sentimentScore:
          row.sentimentScore ?? sentimentScoreAusZusammenfassung(row.zusammenfassung),
      })
    }
  }
  return out
}

export async function ladeEarningsCallKiCacheEintrag(
  ticker: string,
  quartalId: string,
): Promise<{
  zusammenfassung: string
  transcriptUrl: string
  aktualisiertAm: string
  sentimentScore: number | null
} | null> {
  const map = await ladeEarningsCallKiCacheFuerTicker(ticker)
  return map.get(quartalId.trim()) ?? null
}

export async function speichereEarningsCallKiCache(eintrag: {
  ticker: string
  quartalId: string
  transcriptUrl: string
  zusammenfassung: string
  sentimentScore?: number | null
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

  const sentimentScore =
    eintrag.sentimentScore ?? sentimentScoreAusZusammenfassung(eintrag.zusammenfassung)

  prev.summaries[eintrag.quartalId.trim()] = {
    zusammenfassung: eintrag.zusammenfassung,
    transcriptUrl: eintrag.transcriptUrl,
    aktualisiertAm: now,
    sentimentScore,
  }

  datei.byTicker[t] = prev
  await schreibeDatei(datei)
  await speichereEarningsCallKiInCloud({
    ...eintrag,
    sentimentScore,
  })
}

export async function loescheEarningsCallKiCacheEintrag(ticker: string, quartalId: string): Promise<void> {
  const t = tickerNorm(ticker)
  const datei = await ladeDateiMitMigration()
  const prev = datei.byTicker[t]
  if (!prev) return
  delete prev.summaries[quartalId.trim()]
  await schreibeDatei(datei)
  await loescheEarningsCallKiCloudEintrag(ticker, quartalId)
}

let dateiNachCloudMigriert = false

/** Bestehende Datei-Caches (Laptop/Dev-Server) einmalig nach Supabase hochladen. */
export async function migriereEarningsCallKiDateiNachCloud(): Promise<number> {
  if (dateiNachCloudMigriert) return 0
  dateiNachCloudMigriert = true
  const datei = await ladeDateiMitMigration()
  let hochgeladen = 0
  for (const [ticker, hit] of Object.entries(datei.byTicker)) {
    for (const [quartalId, row] of Object.entries(hit.summaries ?? {})) {
      if (!row.zusammenfassung?.trim()) continue
      await speichereEarningsCallKiInCloud({
        ticker,
        quartalId,
        transcriptUrl: row.transcriptUrl,
        zusammenfassung: row.zusammenfassung,
      })
      hochgeladen += 1
    }
  }
  return hochgeladen
}
