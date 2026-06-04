import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import type { EarningsTerminQuelle } from '@/lib/portfolio-analyse/earnings-termine'

export type AnkuendigtesEarningsQuelle = EarningsTerminQuelle

export type AnkuendigtesEarningsEintrag = {
  isin: string | null
  name: string
  stueck: number
  terminDatumIso: string
  symbol: string
  quelle: AnkuendigtesEarningsQuelle
  bestaetigt: boolean
  berichtszeit: null
  berichtszeitAnzeige: null
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

const QUELLE_LABEL: Record<'divvydiary' | 'divvydiary-prognose', string> = {
  divvydiary: 'DivvyDiary',
  'divvydiary-prognose': 'geschätzt',
}

function monatLabel(monatKey: string): string {
  const m = Number(monatKey.slice(5, 7))
  return MONAT_LABEL[m - 1] ?? monatKey
}

/** Nächster kommender Termin. */
export function bevorzugterEarningsEintrag(
  eintraege: AnkuendigtesEarningsEintrag[],
  heuteIso: string = heuteIsoUtc(),
): AnkuendigtesEarningsEintrag | null {
  return eintraege.find((e) => e.terminDatumIso >= heuteIso) ?? null
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
  const quelle = e.quelle === 'divvydiary' || e.quelle === 'divvydiary-prognose' ? e.quelle : 'divvydiary'
  teile.push(e.bestaetigt ? QUELLE_LABEL[quelle] : 'geschätzt (DD)')
  return teile.join(' · ')
}

function formatDatumDeInline(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}
