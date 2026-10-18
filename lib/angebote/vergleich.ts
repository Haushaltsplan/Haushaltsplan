import 'server-only'

import { DIREKT_ADAPTERS } from '@/lib/angebote/adapters'
import {
  ladeSnapshot,
  speichereSnapshot,
  snapshotZuFrisch,
  ladeEinstellung,
} from '@/lib/angebote/db'
import { isoWoche, normalisierePlz } from '@/lib/angebote/http'
import { filterUndSortiere } from '@/lib/angebote/normalisierung'
import { marktguruRegionaleAngebote } from '@/lib/angebote/marktguru'
import { ladeMaerkteFuerPlz } from '@/lib/angebote/plz-maerkte'
import type {
  Angebot,
  HaendlerId,
  QuellenStatus,
  VergleichRequest,
  VergleichResponse,
} from '@/lib/angebote/types'
import {
  HAENDLER_IDS,
  MARKTGURU_FALLBACK_HAENDLER,
} from '@/lib/angebote/types'

const DEFAULT_SCAN_HAENDLER: HaendlerId[] = [
  'rewe',
  'aldi_sued',
  'aldi_nord',
  'edeka',
  'lidl',
  'penny',
  'netto',
  'kaufland',
  'globus',
]

export async function fuehreVergleichAus(
  ownerUserId: string,
  req: VergleichRequest,
): Promise<VergleichResponse> {
  const plz = normalisierePlz(req.plz)
  if (!plz) throw new Error('Ungültige PLZ (5 Ziffern).')

  const woche = isoWoche()
  const force = Boolean(req.force)

  if (!force) {
    const cached = await ladeSnapshot(plz, woche, ownerUserId)
    const cacheOk =
      cached &&
      snapshotZuFrisch(cached.erstelltAm, 15) &&
      cached.angebote.some((a) => Boolean(a.marke || a.bildUrl))
    if (cacheOk && cached) {
      const gefiltert = filterUndSortiere(cached.angebote, {
        q: req.q,
        haendler: req.haendler,
        sort: req.sort,
      })
      return {
        ok: true,
        plz,
        woche,
        ausCache: true,
        angebote: gefiltert,
        quellen: cached.quellen,
        maerkte: cached.maerkte,
        erstelltAm: cached.erstelltAm,
      }
    }
  }

  const einstellung = await ladeEinstellung(ownerUserId)
  const maerkte = await ladeMaerkteFuerPlz(plz, einstellung?.marktIds)
  const zielHaendler = (req.haendler?.length
    ? req.haendler
    : DEFAULT_SCAN_HAENDLER
  ).filter((h): h is HaendlerId => (HAENDLER_IDS as readonly string[]).includes(h))

  const quellen: QuellenStatus[] = []
  const angebote: Angebot[] = []
  const direktErfolg = new Set<HaendlerId>()

  const adapters = DIREKT_ADAPTERS.filter((a) => zielHaendler.includes(a.haendler))

  await Promise.all(
    adapters.map(async (adapter) => {
      const t0 = Date.now()
      try {
        const marktId = maerkte.find((m) => m.haendler === adapter.haendler)?.marktId
        const res = await adapter.fetchAngebote({ plz, maerkte, marktId })
        if (!res.angebote.length) throw new Error('Leere Angebotsliste')
        angebote.push(...res.angebote)
        direktErfolg.add(adapter.haendler)
        quellen.push({
          haendler: adapter.haendler,
          status: res.quelle === 'marktguru' ? 'fallback' : 'ok',
          quelle: res.quelle,
          anzahl: res.angebote.length,
          dauerMs: Date.now() - t0,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const skipped = /übersprungen/i.test(msg)
        quellen.push({
          haendler: adapter.haendler,
          status: skipped ? 'skipped' : 'failed',
          quelle: 'keine',
          anzahl: 0,
          fehler: msg,
          dauerMs: Date.now() - t0,
        })
        console.warn(`[angebote:${adapter.haendler}] Direkt fehlgeschlagen:`, msg)
      }
    }),
  )

  const fallbackBedarf = zielHaendler.filter(
    (h) =>
      MARKTGURU_FALLBACK_HAENDLER.includes(h) &&
      !direktErfolg.has(h) &&
      !quellen.some((q) => q.haendler === h && q.status === 'skipped'),
  )

  if (fallbackBedarf.length) {
    const t0 = Date.now()
    try {
      const mg = await marktguruRegionaleAngebote(plz, fallbackBedarf)
      const byH = new Map<HaendlerId, Angebot[]>()
      for (const a of mg) {
        if (!fallbackBedarf.includes(a.haendler)) continue
        const list = byH.get(a.haendler) ?? []
        list.push(a)
        byH.set(a.haendler, list)
      }
      for (const h of fallbackBedarf) {
        const list = byH.get(h) ?? []
        if (list.length) {
          angebote.push(...list)
          const idx = quellen.findIndex((q) => q.haendler === h)
          const entry: QuellenStatus = {
            haendler: h,
            status: 'fallback',
            quelle: 'marktguru',
            anzahl: list.length,
            dauerMs: Date.now() - t0,
          }
          if (idx >= 0) quellen[idx] = entry
          else quellen.push(entry)
        } else if (!quellen.some((q) => q.haendler === h)) {
          quellen.push({
            haendler: h,
            status: 'failed',
            quelle: 'keine',
            anzahl: 0,
            fehler: 'Marktguru: keine Treffer',
            dauerMs: Date.now() - t0,
          })
        } else {
          const idx = quellen.findIndex((q) => q.haendler === h && q.status === 'failed')
          if (idx >= 0) {
            quellen[idx] = {
              ...quellen[idx]!,
              fehler: `${quellen[idx]!.fehler ?? ''} | Marktguru: keine Treffer`.trim(),
            }
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[angebote:marktguru] Fallback fehlgeschlagen:', msg)
      for (const h of fallbackBedarf) {
        if (!quellen.some((q) => q.haendler === h)) {
          quellen.push({
            haendler: h,
            status: 'failed',
            quelle: 'keine',
            anzahl: 0,
            fehler: msg,
          })
        }
      }
    }
  }

  // Ketten ohne Adapter und ohne Fallback-Versuch markieren
  for (const h of zielHaendler) {
    if (!quellen.some((q) => q.haendler === h)) {
      quellen.push({
        haendler: h,
        status: 'failed',
        quelle: 'keine',
        anzahl: 0,
        fehler: 'Keine Quelle konfiguriert',
      })
    }
  }

  let erstelltAm = new Date().toISOString()
  try {
    const snap = await speichereSnapshot({
      ownerUserId,
      plz,
      woche,
      angebote,
      quellen,
      maerkte,
    })
    erstelltAm = snap.erstelltAm
  } catch (e) {
    console.warn('[angebote:vergleich] Snapshot nicht gespeichert:', e)
  }

  const gefiltert = filterUndSortiere(angebote, {
    q: req.q,
    haendler: req.haendler,
    sort: req.sort,
  })

  return {
    ok: true,
    plz,
    woche,
    ausCache: false,
    angebote: gefiltert,
    quellen,
    maerkte,
    erstelltAm,
  }
}
