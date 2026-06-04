import { berichtszeitKurz, berichtszeitLabel } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import { ladeAnkuendigtesEarningsTermin } from '@/lib/portfolio-analyse/divvydiary-ankuendigte-earnings-server'
import type { EarningsTerminQuelle } from '@/lib/portfolio-analyse/earnings-termine'
import { isinAusYahooSymbol, isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { DepotPositionAnfrage } from '@/lib/portfolio-analyse/ankuendigte-dividenden'
import type { Berichtszeit } from '@/lib/portfolio-analyse/earnings-berichtszeit'

export type AnkuendigtesEarningsQuelle = EarningsTerminQuelle

export type AnkuendigtesEarningsEintrag = {
  isin: string | null
  name: string
  stueck: number
  terminDatumIso: string
  symbol: string
  quelle: AnkuendigtesEarningsQuelle
  bestaetigt: boolean
  berichtszeit: Berichtszeit | null
  berichtszeitAnzeige: string | null
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
    yahoo: number
    finnhub: number
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

const QUELLE_LABEL: Record<AnkuendigtesEarningsQuelle, string> = {
  yahoo: 'Yahoo Finance',
  finnhub: 'Finnhub',
  divvydiary: 'DivvyDiary',
  'divvydiary-prognose': 'geschätzt',
}

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

export function earningsTerminUnterzeile(e: AnkuendigtesEarningsEintrag): string {
  const teile = [formatDatumDeInline(e.terminDatumIso)]
  if (e.berichtszeitAnzeige) teile.push(e.berichtszeitAnzeige)
  teile.push(e.bestaetigt ? QUELLE_LABEL[e.quelle] : 'geschätzt')
  return teile.join(' · ')
}

function formatDatumDeInline(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export async function berechneAnkuendigteEarningsDepot(
  positionen: DepotPositionAnfrage[],
): Promise<AnkuendigteEarningsErgebnis> {
  const hinweise: string[] = []
  const aktiv = positionen.filter((p) => p.stueck > 0 && positionHatIsin(p))
  const stat = { yahoo: 0, finnhub: 0, divvydiary: 0, prognose: 0, ohneTreffer: 0 }

  const eintraege = (
    await mapPool(aktiv, 1, async (pos) => {
      const isin = isinFuerPosition(pos)
      const k = isinKenntnis(isin)
      const hit = await ladeAnkuendigtesEarningsTermin(
        isin,
        k?.name ?? pos.name,
        pos.symbolYahoo,
        pos.symbolCandidates,
      )
      if (!hit) {
        stat.ohneTreffer++
        return null
      }

      if (hit.quelle === 'yahoo') stat.yahoo++
      else if (hit.quelle === 'finnhub') stat.finnhub++
      else if (hit.quelle === 'divvydiary') stat.divvydiary++
      else stat.prognose++

      const eintrag: AnkuendigtesEarningsEintrag = {
        isin: pos.isin ?? isin,
        name: k?.name ?? pos.name,
        stueck: pos.stueck,
        terminDatumIso: hit.terminDatumIso,
        symbol: symbolAnzeige(pos),
        quelle: hit.quelle,
        bestaetigt: hit.bestaetigt,
        berichtszeit: hit.berichtszeit,
        berichtszeitAnzeige: berichtszeitKurz(hit.berichtszeit) ?? berichtszeitLabel(hit.berichtszeit),
      }
      return eintrag
    })
  )
    .filter((e) => e != null)
    .sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))

  if (aktiv.length === 0) {
    hinweise.push('Keine offenen Positionen mit ISIN — Quartalstermine brauchen eine ISIN.')
  } else if (eintraege.length === 0) {
    hinweise.push('Keine Quartalstermine im Zeitraum heute bis +1 Jahr gefunden.')
  } else {
    const teile: string[] = []
    if (stat.yahoo + stat.finnhub + stat.divvydiary > 0) {
      teile.push(`${stat.yahoo + stat.finnhub + stat.divvydiary} bestätigt`)
    }
    if (stat.prognose > 0) teile.push(`${stat.prognose} geschätzt`)
    hinweise.push(
      `${eintraege.length} Termin(e) für ${eintraege.length} von ${aktiv.length} Position(en): ${teile.join(', ')}.`,
    )
  }

  hinweise.push(
    'Termine: Finnhub- und Yahoo-Kalender (bestätigt), DivvyDiary (Scrape). Berichtszeit (vor/nach Börse) von Finnhub. Geschätzte Termine nur wenn keine Quelle einen künftigen Termin liefert.',
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
