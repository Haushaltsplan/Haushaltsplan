import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import type {
  MomentumErinnerung,
  MomentumScanPaket,
  MomentumTrade,
  MomentumWatchlistEintragAngereichert,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

function sortiereErinnerungen(a: MomentumErinnerung, b: MomentumErinnerung): number {
  const prio = { aktion: 0, warnung: 1, info: 2 }
  return prio[a.schwere] - prio[b.schwere]
}

/** Kontextuelle Hinweise für die UI — keine Push-Notifications, nur Fakten. */
export function berechneMomentumErinnerungen(input: {
  watchlist: MomentumWatchlistEintragAngereichert[]
  trades: MomentumTrade[]
  scan: MomentumScanPaket | null
  barsNeuesterTag: string | null
}): MomentumErinnerung[] {
  const out: MomentumErinnerung[] = []
  const heute = heuteIsoUtc()

  for (const e of input.watchlist) {
    const sym = e.symbolYahoo ?? e.symbolCandidates[0] ?? e.name
    const n = e.naechstesEarnings
    if (!n || n.tageBis == null) continue

    if (n.tageBis === 0) {
      out.push({
        typ: 'earnings_heute',
        schwere: 'aktion',
        symbol: sym,
        text: sym + ' meldet heute (' + n.zeitLabel + ') — nach Handelsschluss Sync + Scan.',
      })
    } else if (n.tageBis === 1) {
      out.push({
        typ: 'earnings_morgen',
        schwere: 'warnung',
        symbol: sym,
        text: sym + ': Earnings morgen (' + n.zeitLabel + ').',
      })
    } else if (n.tageBis >= 3 && n.tageBis <= 14) {
      out.push({
        typ: 'earnings_bald',
        schwere: 'info',
        symbol: sym,
        text: sym + ': Earnings in ' + n.tageBis + ' Tagen — Pre-Event-Katalysator / Szenario-Plan im Scan.',
      })
    }
  }

  const offen = input.trades.filter((t) => t.exitPrice == null)
  for (const t of offen) {
    out.push({
      typ: 'trade_offen',
      schwere: 'warnung',
      symbol: t.symbol,
      text:
        'Offener Trade ' +
        t.symbol +
        ' (' +
        t.direction +
        ', ' +
        t.riskEur +
        ' € Risiko) — Exit erfassen.',
    })
  }

  if (input.barsNeuesterTag) {
    const alter = tageZwischenIso(input.barsNeuesterTag, heute)
    if (alter > 2) {
      out.push({
        typ: 'daten_veraltet',
        schwere: 'warnung',
        text:
          'Kursdaten älter als 2 Tage (letzter Handelstag ' +
          input.barsNeuesterTag +
          ') — „Alles aktualisieren“ ausführen.',
      })
    }
  } else if (input.watchlist.length > 0) {
    out.push({
      typ: 'daten_veraltet',
      schwere: 'warnung',
      text: 'Noch keine Kursdaten — Pipeline einmal ausführen.',
    })
  }

  const gapSetups =
    input.scan?.ergebnisse.filter(
      (e) =>
        (e.playbook === 'earnings_gap_fade' ||
          e.playbook === 'earnings_momentum' ||
          e.playbook === 'earnings_pre_run' ||
          e.playbook === 'ipo_fade') &&
        (e.ampel === 'gruen' || e.ampel === 'gelb'),
    ) ?? []
  if (gapSetups.length > 0) {
    out.push({
      typ: 'scan_verfuegbar',
      schwere: 'aktion',
      text:
        gapSetups.length +
        ' Trade-Setup(s) aktiv (' +
        gapSetups.map((e) => e.symbol + ' ' + e.playbook.replace('earnings_', '').replace('_', '-')).join(', ') +
        ').',
    })
  }

  for (const e of input.scan?.ergebnisse ?? []) {
    if (e.playbook !== 'earnings_pre_event' || e.ampel !== 'gelb' || e.score < 45) continue
    const wl = input.watchlist.find((w) => {
      const sym = (w.symbolYahoo ?? w.symbolCandidates[0] ?? '').toUpperCase()
      return sym === e.symbol.toUpperCase()
    })
    const tage = wl?.naechstesEarnings?.tageBis
    if (tage == null || tage < 0 || tage > 3) continue
    out.push({
      typ: 'pre_event_aktiv',
      schwere: tage <= 1 ? 'aktion' : 'warnung',
      symbol: e.symbol,
      text:
        e.symbol +
        ': Pre-Event-Katalysator (Score ' +
        e.score +
        ') — Szenario-Plan prüfen, Earnings in ' +
        tage +
        ' Tag(en).',
    })
  }

  return out.sort(sortiereErinnerungen)
}
