import 'server-only'

import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  earningsZeitraum,
  ladeAlleEarningsTermineFuerIsin,
} from '@/lib/portfolio-analyse/earnings-termine-alle'
import { isinAusYahooSymbol, isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { DepotPositionAnfrage } from '@/lib/portfolio-analyse/ankuendigte-dividenden'
import {
  gruppiereEarningsNachMonat,
  type AnkuendigteEarningsErgebnis,
  type AnkuendigtesEarningsEintrag,
} from '@/lib/portfolio-analyse/ankuendigte-earnings'
import { loescheEarningsDepotCacheDatei } from '@/lib/portfolio-analyse/earnings-depot-cache-server'

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

export async function berechneAnkuendigteEarningsDepot(
  positionen: DepotPositionAnfrage[],
): Promise<AnkuendigteEarningsErgebnis> {
  const hinweise: string[] = []
  const aktiv = positionen.filter((p) => p.stueck > 0 && positionHatIsin(p))
  const stat = { divvydiary: 0, prognose: 0, ohneTreffer: 0 }

  const { von, bis, heute } = earningsZeitraum()

  const eintraegeNested = await mapPool(aktiv, 1, async (pos) => {
    const isin = isinFuerPosition(pos)
    const k = isinKenntnis(isin)
    const name = k?.name ?? pos.name
    const symbol = symbolAnzeige(pos)
    const lokalStat = { divvydiary: 0, prognose: 0 }

    const merged = await ladeAlleEarningsTermineFuerIsin(isin, name, von, bis)

    if (merged.length === 0) {
      stat.ohneTreffer++
      return []
    }

    const rows = merged.map((hit) => {
      if (hit.quelle === 'divvydiary') lokalStat.divvydiary++
      else lokalStat.prognose++

      return {
        isin: pos.isin ?? isin,
        name,
        stueck: pos.stueck,
        terminDatumIso: hit.terminDatumIso,
        symbol,
        quelle: hit.quelle,
        bestaetigt: hit.bestaetigt,
        berichtszeit: null,
        berichtszeitAnzeige: null,
      } satisfies AnkuendigtesEarningsEintrag
    })

    stat.divvydiary += lokalStat.divvydiary
    stat.prognose += lokalStat.prognose
    return rows
  })

  const eintraege = eintraegeNested
    .flat()
    .filter((e) => e.terminDatumIso >= heute)
    .sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))

  if (aktiv.length === 0) {
    hinweise.push('Keine offenen Positionen mit ISIN — Quartalstermine brauchen eine ISIN.')
  } else if (eintraege.length === 0) {
    hinweise.push(`Keine kommenden Quartalstermine bis ${bis} gefunden (DivvyDiary).`)
  } else {
    const teile: string[] = []
    if (stat.divvydiary > 0) teile.push(`${stat.divvydiary} bestätigt`)
    if (stat.prognose > 0) teile.push(`${stat.prognose} geschätzt`)
    const positionenMitTermin = new Set(
      eintraege.map((e) => (e.isin ?? e.symbol).toUpperCase()),
    ).size
    hinweise.push(
      `${eintraege.length} Termin(e) für ${positionenMitTermin} von ${aktiv.length} Position(en): ${teile.join(', ')}.`,
    )
  }

  hinweise.push(
    'Termine nur von DivvyDiary — jeweils der nächste Quartalsbericht (~1 Quartal voraus). Konsens beim Klick.',
  )

  return {
    monate: gruppiereEarningsNachMonat(eintraege),
    eintraege,
    hinweise,
    abgefragtePositionen: aktiv.length,
    treffer: eintraege.length,
    statistik: stat,
  }
}

export async function leereAnkuendigteEarningsCaches(): Promise<void> {
  await loescheEarningsDepotCacheDatei()
}
