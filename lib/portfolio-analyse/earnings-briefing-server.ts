import 'server-only'

import type { DepotPositionAnfrage } from '@/lib/portfolio-analyse/ankuendigte-dividenden'
import { berechneAnkuendigteEarningsDepot } from '@/lib/portfolio-analyse/ankuendigte-earnings-server'
import { berichtszeitLabel } from '@/lib/portfolio-analyse/earnings-berichtszeit'
import { ladeEarningsBeatMissHistorie } from '@/lib/portfolio-analyse/earnings-beat-miss-historie-server'
import { guidanceRichtungAusText } from '@/lib/portfolio-analyse/earnings-call-sentiment'
import { ladeEarningsCallKiCacheFuerTicker } from '@/lib/portfolio-analyse/earnings-call-unternehmen-cache-server'
import type {
  EarningsBriefingEintrag,
  EarningsBriefingErgebnis,
} from '@/lib/portfolio-analyse/earnings-briefing-types'
import { leereRevisionMeta } from '@/lib/portfolio-analyse/earnings-revision-meta'
import { ladeEarningsSchaetzungen } from '@/lib/portfolio-analyse/earnings-schaetzungen'
import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

export type { EarningsBriefingEintrag, EarningsBriefingErgebnis } from '@/lib/portfolio-analyse/earnings-briefing-types'

function plusTageIso(iso: string, tage: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + tage)
  return d.toISOString().slice(0, 10)
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => worker()))
  return results
}

function kiKurz(text: string | null | undefined, max = 280): string | null {
  if (!text) return null
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return null
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1)}…`
}

/**
 * Bundle für Earnings-Tag/Wochen-Briefing: Termine im Horizont + Schätzungen + Beat-Rate + Call-KI.
 */
export async function baueEarningsBriefingDepot(
  positionen: DepotPositionAnfrage[],
  opts?: { horizonTage?: number },
): Promise<EarningsBriefingErgebnis> {
  const heute = heuteIsoUtc()
  const horizonTage = opts?.horizonTage ?? 7
  const bis = plusTageIso(heute, horizonTage)
  const hinweise: string[] = []

  const kalender = await berechneAnkuendigteEarningsDepot(positionen)
  const kandidaten = kalender.eintraege.filter(
    (e) => e.terminDatumIso >= heute && e.terminDatumIso <= bis,
  )

  if (kandidaten.length === 0) {
    hinweise.push(`Keine Earnings-Termine in den nächsten ${horizonTage} Tagen.`)
    return { heuteIso: heute, horizonTage, eintraege: [], hinweise }
  }

  const eintraege = await mapPool(kandidaten, 2, async (e) => {
    const k = e.isin ? isinKenntnis(e.isin) : undefined
    const symbol = e.symbol || k?.symbolYahoo || ''
    const ticker = (symbol.split('.')[0] || symbol).toUpperCase()
    const [schaetz, beat, callMap] = await Promise.all([
      ladeEarningsSchaetzungen({
        isin: e.isin,
        name: e.name,
        symbolYahoo: symbol,
        symbolCandidates: k?.symbolCandidates,
        terminDatumIso: e.terminDatumIso,
        berichtszeit: e.berichtszeit,
      }),
      ticker
        ? ladeEarningsBeatMissHistorie({
            ticker,
            symbolYahoo: symbol,
            isin: e.isin,
          }).catch(() => null)
        : null,
      ticker ? ladeEarningsCallKiCacheFuerTicker(ticker).catch(() => null) : null,
    ])

    let letzterCall: string | null = null
    if (callMap && callMap.size > 0) {
      const rows = [...callMap.values()]
      rows.sort((a, b) => (b.aktualisiertAm ?? '').localeCompare(a.aktualisiertAm ?? ''))
      letzterCall = rows[0]?.zusammenfassung ?? null
    }

    const berichtszeit = e.berichtszeit ?? schaetz?.berichtszeitTyp ?? null

    return {
      isin: e.isin,
      name: e.name,
      symbol,
      terminDatumIso: e.terminDatumIso,
      tageBis: tageZwischenIso(heute, e.terminDatumIso),
      berichtszeit,
      berichtszeitAnzeige: berichtszeitLabel(berichtszeit) ?? e.berichtszeitAnzeige,
      bestaetigt: e.bestaetigt,
      eps: schaetz?.eps ?? { low: null, high: null, average: null, averageAnzeige: null },
      umsatz: schaetz?.umsatz ?? { low: null, high: null, average: null, averageAnzeige: null },
      revisionMeta: schaetz?.revisionMeta ?? leereRevisionMeta(),
      epsBeatRatePct: beat?.epsBeatRatePct ?? null,
      umsatzBeatRatePct: beat?.umsatzBeatRatePct ?? null,
      guidanceRichtung: guidanceRichtungAusText(letzterCall),
      letzterCallKiKurz: kiKurz(letzterCall),
    } satisfies EarningsBriefingEintrag
  })

  eintraege.sort((a, b) => a.terminDatumIso.localeCompare(b.terminDatumIso) || a.name.localeCompare(b.name))
  hinweise.push(...kalender.hinweise.slice(0, 2))
  hinweise.push(`${eintraege.length} Titel mit Earnings in den nächsten ${horizonTage} Tagen.`)

  return { heuteIso: heute, horizonTage, eintraege, hinweise }
}
