import 'server-only'

import { dateiCachePfad } from '@/lib/datei-cache-pfad'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { promises as fs } from 'fs'
import path from 'path'

const DATEIPFAD = dateiCachePfad('portfolio-quartals-ki-diff.json')
const TABLE = 'portfolio_quartals_ki_diff'

type DiffZeile = {
  diff: string
  aktualisiertAm: string
}

type CacheDatei = {
  version: 1
  byKey: Record<string, DiffZeile>
}

function diffKey(ticker: string, typ: string, aktuellId: string, vorherId: string): string {
  return [ticker.trim().toUpperCase(), typ, aktuellId.trim(), vorherId.trim()].join('|')
}

function istCloudOk(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

let memory: CacheDatei | null = null

async function leseDatei(): Promise<CacheDatei> {
  if (memory) return memory
  try {
    const raw = await fs.readFile(DATEIPFAD, 'utf8')
    const j = JSON.parse(raw) as CacheDatei
    if (j.version === 1 && j.byKey) {
      memory = j
      return j
    }
  } catch {
    /* neu */
  }
  memory = { version: 1, byKey: {} }
  return memory
}

async function schreibeDatei(data: CacheDatei): Promise<void> {
  memory = data
  try {
    await fs.mkdir(path.dirname(DATEIPFAD), { recursive: true })
    await fs.writeFile(DATEIPFAD, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  } catch (e) {
    console.warn('Quartals-KI-Diff Cache: Schreiben fehlgeschlagen', e)
  }
}

export async function ladeQuartalsKiDiffCache(
  ticker: string,
  typ: string,
  aktuellId: string,
  vorherId: string,
): Promise<string | null> {
  const key = diffKey(ticker, typ, aktuellId, vorherId)

  if (istCloudOk()) {
    try {
      const { data, error } = await createSupabaseAdmin()
        .from(TABLE)
        .select('diff')
        .eq('cache_key', key)
        .maybeSingle()
      if (!error && data?.diff) return data.diff as string
    } catch {
      /* fallback Datei */
    }
  }

  const datei = await leseDatei()
  return datei.byKey[key]?.diff ?? null
}

let dateiNachCloudMigriert = false

/** Bestehende Datei-Caches einmalig nach Supabase hochladen. */
export async function migriereQuartalsKiDiffDateiNachCloud(): Promise<number> {
  if (dateiNachCloudMigriert) return 0
  dateiNachCloudMigriert = true
  const datei = await leseDatei()
  let hochgeladen = 0
  for (const [key, row] of Object.entries(datei.byKey)) {
    if (!row.diff?.trim()) continue
    const parts = key.split('|')
    if (parts.length < 4) continue
    const [ticker, typ, aktuellId, vorherId] = parts
    await speichereQuartalsKiDiffCache({ ticker, typ, aktuellId, vorherId, diff: row.diff })
    hochgeladen += 1
  }
  return hochgeladen
}

export async function speichereQuartalsKiDiffCache(opts: {
  ticker: string
  typ: string
  aktuellId: string
  vorherId: string
  diff: string
}): Promise<void> {
  const key = diffKey(opts.ticker, opts.typ, opts.aktuellId, opts.vorherId)
  const now = new Date().toISOString()

  const datei = await leseDatei()
  datei.byKey[key] = { diff: opts.diff, aktualisiertAm: now }
  await schreibeDatei(datei)

  if (!istCloudOk()) return
  try {
    await createSupabaseAdmin()
      .from(TABLE)
      .upsert(
        {
          cache_key: key,
          ticker: opts.ticker.trim().toUpperCase(),
          typ: opts.typ,
          aktuell_id: opts.aktuellId,
          vorher_id: opts.vorherId,
          diff: opts.diff,
          aktualisiert_am: now,
        },
        { onConflict: 'cache_key' },
      )
  } catch (e) {
    console.warn('Quartals-KI-Diff Cloud: Speichern fehlgeschlagen', e)
  }
}

export type QuartalsKiDiffCloudZeile = {
  ticker: string
  typ: string
  aktuellId: string
  vorherId: string
  diff: string
  aktualisiertAm: string
}

/** Alle gespeicherten Quartals-KI-Diffs (Cloud + Datei-Fallback). */
export async function ladeAlleQuartalsKiDiffAusCloud(): Promise<QuartalsKiDiffCloudZeile[]> {
  const out = new Map<string, QuartalsKiDiffCloudZeile>()

  if (istCloudOk()) {
    try {
      const { data, error } = await createSupabaseAdmin()
        .from(TABLE)
        .select('cache_key, ticker, typ, aktuell_id, vorher_id, diff, aktualisiert_am')
      if (!error && data) {
        for (const row of data) {
          const r = row as {
            cache_key: string
            ticker: string
            typ: string
            aktuell_id: string
            vorher_id: string
            diff: string
            aktualisiert_am: string
          }
          if (!r.diff?.trim()) continue
          out.set(r.cache_key, {
            ticker: r.ticker,
            typ: r.typ,
            aktuellId: r.aktuell_id,
            vorherId: r.vorher_id,
            diff: r.diff,
            aktualisiertAm: r.aktualisiert_am,
          })
        }
      }
    } catch (e) {
      console.warn('Quartals-KI-Diff Cloud: Alle laden fehlgeschlagen', e)
    }
  }

  const datei = await leseDatei()
  for (const [key, row] of Object.entries(datei.byKey)) {
    if (!row.diff?.trim() || out.has(key)) continue
    const parts = key.split('|')
    if (parts.length < 4) continue
    const [ticker, typ, aktuellId, vorherId] = parts
    out.set(key, {
      ticker,
      typ,
      aktuellId,
      vorherId,
      diff: row.diff,
      aktualisiertAm: row.aktualisiertAm,
    })
  }

  return [...out.values()].sort((a, b) => b.aktualisiertAm.localeCompare(a.aktualisiertAm))
}
