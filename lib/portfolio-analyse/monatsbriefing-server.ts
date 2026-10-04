import 'server-only'

import { baueEarningsBriefingDepot } from '@/lib/portfolio-analyse/earnings-briefing-server'
import { ladeLivePortfolioServer } from '@/lib/portfolio-analyse/depot-gewichte-server'
import { ladePortfolioAlerts } from '@/lib/portfolio-analyse/portfolio-alerts-server'
import {
  ladeKaufempfehlungAktuell,
  ladeNachkaufScanAusCloud,
} from '@/lib/portfolio-analyse/nachkauf-radar/nachkauf-radar-db-server'
import type { MonatsbriefingErgebnis } from '@/lib/portfolio-analyse/monatsbriefing-types'

export type { MonatsbriefingErgebnis } from '@/lib/portfolio-analyse/monatsbriefing-types'

function monatKeyJetzt(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function baueMonatsbriefing(): Promise<MonatsbriefingErgebnis> {
  const hinweise: string[] = []
  const scan = await ladeNachkaufScanAusCloud()
  const gruen = scan.filter((e) => e.ampel === 'gruen').length
  const gelb = scan.filter((e) => e.ampel === 'gelb').length
  const topScores = [...scan]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((e) => ({ ticker: e.ticker, name: e.name, score: e.score, ampel: e.ampel }))

  let kaufempfehlungKurz: string | null = null
  try {
    const ke = await ladeKaufempfehlungAktuell()
    if (ke?.kiText) kaufempfehlungKurz = ke.kiText.slice(0, 400)
  } catch {
    /* optional */
  }

  const livePaket = await ladeLivePortfolioServer().catch(() => null)
  const live = livePaket?.live
  const positionen = (live?.positionen ?? [])
    .filter((p) => p.stueck > 0 && p.assetKlasse === 'aktie')
    .map((p) => ({
      isin: p.isin,
      name: p.name,
      stueck: p.stueck,
      symbolYahoo: p.symbolYahoo,
    }))

  let earningsWoche: MonatsbriefingErgebnis['earningsWoche'] = []
  if (positionen.length > 0) {
    const briefing = await baueEarningsBriefingDepot(positionen, { horizonTage: 14 })
    earningsWoche = briefing.eintraege.map((e) => ({
      name: e.name,
      symbol: e.symbol,
      terminDatumIso: e.terminDatumIso,
      tageBis: e.tageBis,
    }))
  }

  const alerts = await ladePortfolioAlerts({ nurUngelesen: true, limit: 50 })

  const klumpen = [...(live?.positionen ?? [])]
    .filter((p) => p.stueck > 0)
    .sort((a, b) => b.gewichtProzent - a.gewichtProzent)
    .slice(0, 5)
    .map((p) => ({ label: p.name, gewichtPct: Math.round(p.gewichtProzent * 10) / 10 }))

  hinweise.push(
    `${gruen} grüne / ${gelb} gelbe Radar-Titel · ${alerts.length} offene Alerts · ${earningsWoche.length} Earnings in 14 Tagen.`,
  )

  return {
    monatKey: monatKeyJetzt(),
    radar: { gruen, gelb, kaufempfehlungKurz, topScores },
    earningsWoche,
    alertsOffen: alerts.length,
    klumpen,
    hinweise,
  }
}
