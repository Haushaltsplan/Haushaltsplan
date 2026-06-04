import { berichtszeitKurz, berichtszeitLabel } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { ladeDivvydiaryEarningsRohdaten } from '@/lib/portfolio-analyse/divvydiary-scraper-server'
import {
  depotKeyAusPositionen,
  ladeEarningsIsinAusDepotCache,
  speichereEarningsIsinImDepotCache,
} from '@/lib/portfolio-analyse/earnings-depot-cache-server'
import type { FinnhubEarningsKalenderTermin } from '@/lib/portfolio-analyse/finnhub-earnings-kalender-server'
import { ladeAlleEarningsTermineFuerSymbole, earningsZeitraum } from '@/lib/portfolio-analyse/earnings-termine-alle'
import type { EarningsTerminQuelle } from '@/lib/portfolio-analyse/earnings-termine'
import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { portfolioLogoQuellen } from '@/lib/portfolio-analyse/portfolio-logos'
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
    wallstreet: number
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
  wallstreet: 'Wallstreet Online',
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

function symboleFuerPosition(pos: DepotPositionAnfrage, isin: string): string[] {
  const out: string[] = []
  const add = (s: string | null | undefined) => {
    for (const t of brokerSymbolKandidaten(s ?? '')) {
      if (t && !out.includes(t)) out.push(t)
    }
  }
  add(pos.symbolYahoo)
  for (const c of pos.symbolCandidates ?? []) add(c)
  const k = isinKenntnis(isin)
  add(k?.symbolYahoo)
  for (const c of k?.symbolCandidates ?? []) add(c)
  const logo = portfolioLogoQuellen(isin, k?.symbolYahoo, k?.name ?? pos.name)
  if (logo.finnhubSlug) {
    const slug = logo.finnhubSlug.trim().toUpperCase()
    if (slug && !out.includes(slug)) out.push(slug)
  }
  return out
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

/** Nächster Termin ab heute, sonst der jüngste vergangene. */
export function bevorzugterEarningsEintrag(
  eintraege: AnkuendigtesEarningsEintrag[],
  heuteIso: string = heuteIsoUtc(),
): AnkuendigtesEarningsEintrag | null {
  if (eintraege.length === 0) return null
  const zukunft = eintraege.find((e) => e.terminDatumIso >= heuteIso)
  return zukunft ?? eintraege[eintraege.length - 1]
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
  const stat = { yahoo: 0, finnhub: 0, divvydiary: 0, wallstreet: 0, prognose: 0, ohneTreffer: 0 }

  const { von, bis } = earningsZeitraum()
  const depotKey = depotKeyAusPositionen(aktiv)
  const finnhubCache = new Map<string, FinnhubEarningsKalenderTermin[]>()

  const eintraegeNested = await mapPool(aktiv, 3, async (pos) => {
    const isin = isinFuerPosition(pos)
    const k = isinKenntnis(isin)
    const name = k?.name ?? pos.name
    const symbole = symboleFuerPosition(pos, isin)
    const symbol = symbolAnzeige(pos)
    const lokalStat = { yahoo: 0, finnhub: 0, divvydiary: 0, wallstreet: 0, prognose: 0 }

    const cached = await ladeEarningsIsinAusDepotCache(isin, von, bis)
    let merged = cached?.termine ?? []

    if (merged.length === 0) {
      const [ddRoh, termine] = await Promise.all([
        ladeDivvydiaryEarningsRohdaten(isin, name),
        ladeAlleEarningsTermineFuerSymbole(symbole, null, isin, name, von, bis, finnhubCache),
      ])
      merged =
        termine.length > 0
          ? termine
          : await ladeAlleEarningsTermineFuerSymbole(
              symbole,
              ddRoh?.earnings ?? null,
              isin,
              name,
              von,
              bis,
              finnhubCache,
            )

      if (merged.length > 0) {
        await speichereEarningsIsinImDepotCache(depotKey, von, bis, isin, {
          name,
          symbol,
          stueck: pos.stueck,
          termine: merged,
        })
      }
    }

    if (merged.length === 0) {
      stat.ohneTreffer++
      return []
    }

    const rows = merged.map((hit) => {
      if (hit.quelle === 'yahoo') lokalStat.yahoo++
      else if (hit.quelle === 'finnhub') lokalStat.finnhub++
      else if (hit.quelle === 'divvydiary') lokalStat.divvydiary++
      else if (hit.quelle === 'wallstreet') lokalStat.wallstreet++
      else lokalStat.prognose++

      return {
        isin: pos.isin ?? isin,
        name,
        stueck: pos.stueck,
        terminDatumIso: hit.terminDatumIso,
        symbol,
        quelle: hit.quelle,
        bestaetigt: hit.bestaetigt,
        berichtszeit: hit.berichtszeit,
        berichtszeitAnzeige: berichtszeitKurz(hit.berichtszeit) ?? berichtszeitLabel(hit.berichtszeit),
      } satisfies AnkuendigtesEarningsEintrag
    })

    stat.yahoo += lokalStat.yahoo
    stat.finnhub += lokalStat.finnhub
    stat.divvydiary += lokalStat.divvydiary
    stat.wallstreet += lokalStat.wallstreet
    stat.prognose += lokalStat.prognose
    return rows
  })

  const eintraege = eintraegeNested
    .flat()
    .sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso))

  if (aktiv.length === 0) {
    hinweise.push('Keine offenen Positionen mit ISIN — Quartalstermine brauchen eine ISIN.')
  } else if (eintraege.length === 0) {
    hinweise.push(`Keine Quartalstermine im Zeitraum ${von} bis ${bis} gefunden.`)
  } else {
    const teile: string[] = []
    if (stat.yahoo + stat.finnhub + stat.divvydiary + stat.wallstreet > 0) {
      teile.push(`${stat.yahoo + stat.finnhub + stat.divvydiary + stat.wallstreet} bestätigt`)
    }
    if (stat.prognose > 0) teile.push(`${stat.prognose} geschätzt`)
    const positionenMitTermin = new Set(
      eintraege.map((e) => (e.isin ?? e.symbol).toUpperCase()),
    ).size
    hinweise.push(
      `${eintraege.length} Termin(e) für ${positionenMitTermin} von ${aktiv.length} Position(en): ${teile.join(', ')}.`,
    )
  }

  hinweise.push(
    `Zeitraum: vorheriges Quartal + nächste Quartale. Quellen: Yahoo, DivvyDiary, Finnhub, Wallstreet (1 Termin/Quartal). Cache: data/portfolio-earnings-kalender.json.`,
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
