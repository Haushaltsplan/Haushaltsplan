import 'server-only'

import {
  berichtszeitAusKalenderListe,
  berichtszeitLabel,
  type Berichtszeit,
} from '@/lib/portfolio-analyse/earnings-berichtszeit'
import { brokerSymbolKandidaten } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  earningsZeitraum,
  ladeAlleEarningsTermineFuerIsin,
} from '@/lib/portfolio-analyse/earnings-termine-alle'
import { ladeFinnhubEarningsKalenderAlleImZeitraum } from '@/lib/portfolio-analyse/finnhub-earnings-kalender-server'
import { isinAusYahooSymbol, isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import type { DepotPositionAnfrage } from '@/lib/portfolio-analyse/ankuendigte-dividenden'
import {
  gruppiereEarningsNachMonat,
  type AnkuendigteEarningsErgebnis,
  type AnkuendigtesEarningsEintrag,
} from '@/lib/portfolio-analyse/ankuendigte-earnings'
import { loescheEarningsDepotCacheDatei } from '@/lib/portfolio-analyse/earnings-depot-cache-server'
import { ladeYahooEarningsKalenderTerminKandidaten } from '@/lib/portfolio-analyse/yahoo-earnings-schaetzungen-server'

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

function istEtfOderFonds(isin: string, name: string): boolean {
  const k = isinKenntnis(isin)
  const label = `${k?.name ?? name} ${isin}`
  return /\b(ETF|UCITS|Index\s+Solutions|Fonds)\b/i.test(label)
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
  const aktiv = positionen.filter((p) => {
    if (p.stueck <= 0 || !positionHatIsin(p)) return false
    const isin = isinFuerPosition(p)
    const k = isinKenntnis(isin)
    return !istEtfOderFonds(isin, k?.name ?? p.name)
  })
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

    const symbole = [
      ...brokerSymbolKandidaten(pos.symbolYahoo ?? k?.symbolYahoo ?? ''),
      ...(pos.symbolCandidates ?? []).flatMap((s) => brokerSymbolKandidaten(s)),
      ...(k?.symbolCandidates ?? []).flatMap((s) => brokerSymbolKandidaten(s)),
    ].filter((s, i, a) => s && a.indexOf(s) === i)

    const [yahooTermin, finnhubKalender] = await Promise.all([
      symbole.length > 0 ? ladeYahooEarningsKalenderTerminKandidaten(symbole) : null,
      symbole.length > 0 ? ladeFinnhubEarningsKalenderAlleImZeitraum(symbole, von, bis) : [],
    ])

    const rows = merged.map((hit) => {
      if (hit.quelle === 'divvydiary') lokalStat.divvydiary++
      else lokalStat.prognose++

      let berichtszeit: Berichtszeit | null =
        berichtszeitAusKalenderListe(finnhubKalender, hit.terminDatumIso) ??
        (yahooTermin &&
        Math.abs(
          (Date.parse(yahooTermin.terminDatumIso) - Date.parse(hit.terminDatumIso)) / 86_400_000,
        ) <= 1
          ? yahooTermin.berichtszeit
          : null)

      return {
        isin: pos.isin ?? isin,
        name,
        stueck: pos.stueck,
        terminDatumIso: hit.terminDatumIso,
        symbol,
        quelle: hit.quelle,
        bestaetigt: hit.bestaetigt,
        berichtszeit,
        berichtszeitAnzeige: berichtszeitLabel(berichtszeit),
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

  const etfUebersprungen = positionen.filter((p) => {
    if (p.stueck <= 0 || !positionHatIsin(p)) return false
    const isin = isinFuerPosition(p)
    const k = isinKenntnis(isin)
    return istEtfOderFonds(isin, k?.name ?? p.name)
  }).length
  if (etfUebersprungen > 0) {
    hinweise.push(`${etfUebersprungen} ETF/Fonds-Position(en) ohne Earnings-Termin (nicht relevant).`)
  }

  if (aktiv.length === 0) {
    hinweise.push('Keine offenen Aktien-Positionen mit ISIN — Quartalstermine brauchen eine ISIN.')
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
    'Termine von DivvyDiary; BMO/AMC nach Möglichkeit von Finnhub/Yahoo. Konsens beim Klick oder im Tages-Briefing.',
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
