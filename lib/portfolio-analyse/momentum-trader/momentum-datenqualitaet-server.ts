import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { gapVolatilitaetSchaetzung } from '@/lib/portfolio-analyse/momentum-trader/momentum-earnings-events-server'
import { ladeMomentumBars } from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'
import { istMomentumPseudoIsin } from '@/lib/portfolio-analyse/momentum-trader/momentum-pseudo-isin'
import { primaeresAnzeigeSymbol } from '@/lib/portfolio-analyse/momentum-trader/momentum-symbol-hilfen'
import type {
  MomentumDatenqualitaet,
  MomentumDatenqualitaetCheck,
  MomentumEarningsEvent,
  MomentumWatchlistEintrag,
  MomentumWatchlistEintragAngereichert,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const MIN_GAP_EVENTS = 4
const IDEAL_GAP_EVENTS = 8

function check(id: string, label: string, ok: boolean, detail: string): MomentumDatenqualitaetCheck {
  return { id, label, ok, detail }
}

export function berechneDatenqualitaetAusEvents(
  eintrag: MomentumWatchlistEintrag,
  events: MomentumEarningsEvent[],
  angereichert: Pick<
    MomentumWatchlistEintragAngereichert,
    'naechstesEarnings' | 'medianGapPct' | 'earningsEventsAnzahl'
  >,
  barsNeuesterTag: string | null,
): MomentumDatenqualitaet {
  if (istMomentumPseudoIsin(eintrag.isin)) {
    const ipoOk = Boolean(eintrag.ipoDatum)
    const checks = [
      check('pre_ipo', 'Pre-IPO', true, eintrag.name),
      check('ipo_datum', 'IPO-Datum', ipoOk, ipoOk ? eintrag.ipoDatum! : 'Manuell eintragen'),
    ]
    return {
      score: ipoOk ? 70 : 35,
      status: ipoOk ? 'teilweise' : 'schwach',
      checks,
      empfehlung: ipoOk ? 'Nach Börsengang: Sync für Earnings & Gap-Historie.' : 'IPO-Datum in der Zeile eintragen.',
    }
  }

  const heute = heuteIsoUtc()
  const mitGap = events.filter((e) => e.gapPct != null && Number.isFinite(e.gapPct))
  const mitSurprise = events.filter((e) => e.surpriseEpsPct != null)
  const mitRevenue = events.filter((e) => e.revenueActual != null)
  const bmoAmcBekannt = events.filter((e) => e.timeBmoAmc !== 'unknown').length
  const gapStat = gapVolatilitaetSchaetzung(events)

  const barsOk =
    barsNeuesterTag != null &&
    tageZwischenIso(barsNeuesterTag, heute) <= 3 &&
    barsNeuesterTag <= heute

  const kalenderOk = angereichert.naechstesEarnings != null
  const gapOk = mitGap.length >= MIN_GAP_EVENTS
  const gapIdeal = mitGap.length >= IDEAL_GAP_EVENTS
  const surpriseOk = mitSurprise.length >= Math.min(4, Math.max(2, mitGap.length - 1))
  const revenueOk = mitRevenue.length >= Math.min(4, mitSurprise.length)
  const zeitOk =
    (angereichert.naechstesEarnings?.timeBmoAmc !== 'unknown' &&
      angereichert.naechstesEarnings?.timeBmoAmc != null) ||
    (events.length > 0 && bmoAmcBekannt >= Math.ceil(events.length * 0.5))
  const medianOk = gapStat.medianGapPct != null && gapStat.medianGapPct >= 0.3

  const checks = [
    check(
      'earnings_kalender',
      'Earnings-Termin',
      kalenderOk,
      kalenderOk
        ? angereichert.naechstesEarnings!.datum + ' (' + angereichert.naechstesEarnings!.zeitLabel + ')'
        : 'Kein Termin — Earnings-Sync',
    ),
    check(
      'bars_aktuell',
      'Kurse aktuell',
      barsOk,
      barsNeuesterTag ? 'Stand ' + barsNeuesterTag : 'Keine Bars — Kurs-Sync',
    ),
    check(
      'gap_historie',
      'Gap-Historie',
      gapOk,
      mitGap.length + ' Events' + (gapIdeal ? ' (gut)' : gapOk ? ' (Minimum)' : ', min. ' + MIN_GAP_EVENTS),
    ),
    check(
      'eps_surprise',
      'EPS Surprise',
      surpriseOk,
      mitSurprise.length + ' Quartale (MarketBeat/Yahoo)',
    ),
    check(
      'revenue_daten',
      'Umsatz Beat/Miss',
      revenueOk,
      mitRevenue.length + ' Quartale mit Umsatz',
    ),
    check(
      'bmo_amc',
      'BMO/AMC',
      zeitOk,
      zeitOk ? 'Berichtszeit bekannt' : 'Zeit unbekannt — Backfill',
    ),
    check(
      'median_gap',
      'Median-Gap',
      medianOk,
      medianOk ? gapStat.medianGapPct!.toFixed(1) + '%' : 'Zu wenig Historie',
    ),
  ]

  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100)

  let status: MomentumDatenqualitaet['status'] = 'schwach'
  if (score >= 85) status = 'gut'
  else if (score >= 55) status = 'teilweise'

  let empfehlung: string | null = null
  if (!barsOk) empfehlung = '„Nachsyncen“ oder „Alles aktualisieren“ für Kurse.'
  else if (!gapOk) empfehlung = 'Gap-Backfill fehlt — Nachsyncen (2–3 Jahre MarketBeat + DivvyDiary).'
  else if (!surpriseOk) empfehlung = 'EPS-Historie unvollständig — MarketBeat-Enrichment läuft beim Sync.'
  else if (!kalenderOk) empfehlung = 'Earnings-Kalender leer — DivvyDiary/MarketBeat-Sync.'
  else if (!zeitOk) empfehlung = 'BMO/AMC unbekannt — erneut syncen (Yahoo + MarketBeat).'

  return { score, status, checks, empfehlung }
}

export async function ladeNeuesterBarTag(symbol: string | null): Promise<string | null> {
  if (!symbol) return null
  const heute = heuteIsoUtc()
  const von = heute.slice(0, 4) + '-01-01'
  const bars = await ladeMomentumBars(symbol, von, heute)
  if (bars.length === 0) return null
  return bars[bars.length - 1].handelstag
}

export async function berechneDatenqualitaetFuerEintrag(
  eintrag: MomentumWatchlistEintrag,
  events: MomentumEarningsEvent[],
  angereichert: Pick<
    MomentumWatchlistEintragAngereichert,
    'naechstesEarnings' | 'medianGapPct' | 'earningsEventsAnzahl'
  >,
): Promise<MomentumDatenqualitaet> {
  const sym = primaeresAnzeigeSymbol(eintrag)
  const barsNeuesterTag = await ladeNeuesterBarTag(sym)
  return berechneDatenqualitaetAusEvents(eintrag, events, angereichert, barsNeuesterTag)
}
