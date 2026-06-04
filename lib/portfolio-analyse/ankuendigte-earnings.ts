import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  ladeDivvydiaryAnkuendigtesEarnings,
  vorladeDivvydiaryEarnings,
} from '@/lib/portfolio-analyse/divvydiary-ankuendigte-earnings-server'
import { isinAusYahooSymbol, isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { DepotPositionAnfrage } from '@/lib/portfolio-analyse/ankuendigte-dividenden'

export type AnkuendigtesEarningsQuelle = 'divvydiary' | 'divvydiary-prognose'

export type AnkuendigtesEarningsEintrag = {
  isin: string | null
  name: string
  stueck: number
  terminDatumIso: string
  symbol: string
  quelle: AnkuendigtesEarningsQuelle
  bestaetigt: boolean
}

export type AnkuendigterEarningsMonat = {
  monatKey: string
  monatLabel: string
  anzahl: number
  eintraege: AnkuendigtesEarningsEintrag[]
}

export type AnkuendigteEarningsErgebnis = {
  monate: AnkuendigterEarningsMonat[]
  eintraege: AnkuendigtesEarningsEintrag[]
  hinweise: string[]
  abgefragtePositionen: number
  treffer: number
  statistik: {
    divvydiary: number
    prognose: number
    ohneTreffer: number
  }
}

const MONAT_LABEL = [
  'JANUAR',
  'FEBRUAR',
  'MÄRZ',
  'APRIL',
  'MAI',
  'JUNI',
  'JULI',
  'AUGUST',
  'SEPTEMBER',
  'OKTOBER',
  'NOVEMBER',
  'DEZEMBER',
] as const

function monatLabel(monatKey: string): string {
  const m = Number(monatKey.slice(5, 7))
  return MONAT_LABEL[m - 1] ?? monatKey
}

function isinFuerPosition(pos: DepotPositionAnfrage): string {
  const direkt = pos.isin?.trim().toUpperCase() ?? ''
  if (direkt.length >= 10) return direkt
  for (const sym of [pos.symbolYahoo, ...(pos.symbolCandidates ?? [])]) {
    const ausSym = isinAusYahooSymbol(sym)
    if (ausSym) return ausSym
  }
  return direkt
}

function positionHatIsin(pos: DepotPositionAnfrage): boolean {
  return isinFuerPosition(pos).length >= 10
}

function symbolAnzeige(pos: DepotPositionAnfrage): string {
  return pos.symbolYahoo?.trim() || isinFuerPosition(pos) || '—'
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}

export function gruppiereEarningsNachMonat(eintraege: AnkuendigtesEarningsEintrag[]): AnkuendigterEarningsMonat[] {
  const byMonat = new Map<string, AnkuendigtesEarningsEintrag[]>()
  for (const e of eintraege) {
    const key = e.terminDatumIso.slice(0, 7)
    const list = byMonat.get(key) ?? []
    list.push(e)
    byMonat.set(key, list)
  }
  return [...byMonat.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monatKey, list]) => {
      const sorted = [...list].sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))
      return {
        monatKey,
        monatLabel: monatLabel(monatKey),
        anzahl: sorted.length,
        eintraege: sorted,
      }
    })
}

export async function berechneAnkuendigteEarningsDepot(
  positionen: DepotPositionAnfrage[],
): Promise<AnkuendigteEarningsErgebnis> {
  const hinweise: string[] = []
  const aktiv = positionen.filter((p) => p.stueck > 0 && positionHatIsin(p))
  const stat = { divvydiary: 0, prognose: 0, ohneTreffer: 0 }

  await vorladeDivvydiaryEarnings(
    aktiv.map((p) => {
      const isin = isinFuerPosition(p)
      return { isin, name: isinKenntnis(isin)?.name ?? p.name }
    }),
  )

  const eintraege = (
    await mapPool(aktiv, 2, async (pos) => {
      const isin = isinFuerPosition(pos)
      const k = isinKenntnis(isin)
      const hit = await ladeDivvydiaryAnkuendigtesEarnings(isin, k?.name ?? pos.name)
      if (!hit) {
        stat.ohneTreffer++
        return null
      }
      const quelle: AnkuendigtesEarningsQuelle = hit.bestaetigt ? 'divvydiary' : 'divvydiary-prognose'
      if (quelle === 'divvydiary-prognose') stat.prognose++
      else stat.divvydiary++

      const eintrag: AnkuendigtesEarningsEintrag = {
        isin: pos.isin ?? isin,
        name: k?.name ?? pos.name,
        stueck: pos.stueck,
        terminDatumIso: hit.terminDatumIso,
        symbol: symbolAnzeige(pos),
        quelle,
        bestaetigt: hit.bestaetigt,
      }
      return eintrag
    })
  )
    .filter((e) => e != null)
    .sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))

  if (aktiv.length === 0) {
    hinweise.push('Keine offenen Positionen mit ISIN — Earnings nur über DivvyDiary (ISIN nötig).')
  } else if (eintraege.length === 0) {
    hinweise.push('Keine Quartalstermine im Zeitraum heute bis +1 Jahr gefunden.')
  } else {
    const teile: string[] = []
    if (stat.divvydiary > 0) teile.push(`${stat.divvydiary} angekündigt`)
    if (stat.prognose > 0) teile.push(`${stat.prognose} geschätzt`)
    hinweise.push(
      `${eintraege.length} Termin(e) für ${eintraege.length} von ${aktiv.length} Position(en): ${teile.join(', ')}.`,
    )
  }

  hinweise.push('Daten von DivvyDiary (Scrape). Geschätzte Termine aus letztem Bekannt + Melde-Rhythmus.')

  return {
    monate: gruppiereEarningsNachMonat(eintraege),
    eintraege,
    hinweise,
    abgefragtePositionen: aktiv.length,
    treffer: eintraege.length,
    statistik: stat,
  }
}
