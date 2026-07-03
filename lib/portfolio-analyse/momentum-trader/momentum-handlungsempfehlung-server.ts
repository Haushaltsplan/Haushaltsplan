import 'server-only'

import { heuteIsoUtc, tageZwischenIso } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import {
  EARNINGS_VORLAUF_MAX,
  EARNINGS_VORLAUF_MIN,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import { istMomentumPreIpoEintrag } from '@/lib/portfolio-analyse/momentum-trader/momentum-pseudo-isin'
import { berechneRegimeGates } from '@/lib/portfolio-analyse/momentum-trader/momentum-regime-server'
import {
  MOMENTUM_TRADE_PLAYBOOKS,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-registry'
import { sammleHandlungssignale } from '@/lib/portfolio-analyse/momentum-trader/momentum-handlungssignal-server'
import type {
  MomentumDatenStatus,
  MomentumHandlungAktion,
  MomentumHandlungsempfehlung,
  MomentumMarketRegime,
  MomentumScanPaket,
  MomentumTrade,
  MomentumWatchlistEintragAngereichert,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const TRADE_PLAYBOOKS = new Set(MOMENTUM_TRADE_PLAYBOOKS)

function regimeText(regime: MomentumMarketRegime | null): string {
  if (!regime) return 'Regime unbekannt — Pipeline ausführen.'
  const gates = berechneRegimeGates(regime)
  const parts: string[] = []
  if (gates.longBias) parts.push('Long-Bias (SPY über MA20, VIX moderat)')
  if (gates.shortBias) parts.push('Short-Bias möglich')
  if (regime.spyClose != null) parts.push('S&P ' + regime.spyClose.toLocaleString('de-DE'))
  if (regime.vixClose != null) parts.push('VIX ' + regime.vixClose.toFixed(1))
  if (regime.spyReturn5dPct != null) {
    parts.push('SPY 5T ' + (regime.spyReturn5dPct >= 0 ? '+' : '') + regime.spyReturn5dPct + '%')
  }
  return parts.join(' · ') || 'Neutral'
}

function tradeSetupsAusScan(scan: MomentumScanPaket | null) {
  return (
    scan?.ergebnisse.filter(
      (e) =>
        TRADE_PLAYBOOKS.has(e.playbook) &&
        e.indikatoren.erfolgIstAktiv === true &&
        (e.ampel === 'gruen' || e.ampel === 'gelb'),
    ) ?? []
  )
}

/**
 * Regelbasierte Handlungsempfehlung — was jetzt tun, auch ohne aktives Trade-Setup.
 */
export function generiereMomentumHandlungsempfehlung(input: {
  watchlist: MomentumWatchlistEintragAngereichert[]
  status: MomentumDatenStatus
  scan: MomentumScanPaket | null
  trades: MomentumTrade[]
}): MomentumHandlungsempfehlung {
  const heute = heuteIsoUtc()
  const regime = input.status.regime
  const gates = regime ? berechneRegimeGates(regime) : null
  const setups = tradeSetupsAusScan(input.scan)
  const positionen: MomentumHandlungsempfehlung['positionen'] = []
  const datenHinweise: string[] = []

  if (input.watchlist.length === 0) {
    return {
      generiertAm: heute,
      zusammenfassung: 'Watchlist leer — Titel hinzufügen und Pipeline starten.',
      regimeText: regimeText(regime),
      longBias: gates?.longBias ?? false,
      shortBias: gates?.shortBias ?? false,
      datenHinweise: ['Keine Titel in der Watchlist'],
      positionen: [],
      tradeSetups: [],
      hatAktivesTradeSetup: false,
      topSignal: null,
      signale: [],
    }
  }

  if (!input.status.barsNeuesterTag) {
    datenHinweise.push('Keine Kursdaten — „Alles aktualisieren“ ausführen.')
  } else if (tageZwischenIso(input.status.barsNeuesterTag, heute) > 2) {
    datenHinweise.push('Kurse veraltet (letzter Tag ' + input.status.barsNeuesterTag + ').')
  }

  if (input.status.earningsEventsAnzahl === 0) {
    datenHinweise.push(
      'Gap-Historie leer — „Alles aktualisieren“ lädt Earnings-Events (MarketBeat/Yahoo) für Median-Gap & Momentum.',
    )
  }

  if (!input.scan || input.scan.ergebnisse.length === 0) {
    datenHinweise.push('Kein Scan vorhanden — nach Sync „Scan“ oder „Alles aktualisieren“.')
  }

  for (const e of input.watchlist) {
    const sym = e.symbolYahoo ?? e.symbolCandidates[0] ?? e.isin
    const preIpo = istMomentumPreIpoEintrag(e)
    const n = e.naechstesEarnings
    let aktion: MomentumHandlungAktion = 'beobachten'
    let prioritaet = 30
    let text = sym + ': '

    if (preIpo) {
      aktion = 'beobachten'
      prioritaet = 35
      if (e.ipoDatum) {
        const tageBis = tageZwischenIso(heute, e.ipoDatum)
        if (tageBis > 0 && tageBis <= 30) {
          aktion = 'vorbereiten'
          prioritaet = 70
          text +=
            'Pre-IPO — geplantes IPO in ' +
            tageBis +
            ' Tagen (' +
            e.ipoDatum +
            '). Nach Listung: Kurse syncen, IPO-Fade-Setup prüfen.'
        } else if (tageBis > 0) {
          text += 'Pre-IPO — IPO geplant am ' + e.ipoDatum + ' (in ' + tageBis + ' Tagen). Beobachten.'
        } else {
          text += 'Pre-IPO — IPO-Datum vergangen oder unklar. Ticker prüfen / Datum aktualisieren.'
          aktion = 'sync'
          prioritaet = 55
        }
      } else {
        text +=
          'Pre-IPO (noch nicht gelistet). IPO-Datum in der Watchlist eintragen — dann Scan & Erinnerungen.'
        prioritaet = 40
      }
      positionen.push({ symbol: sym, name: e.name, aktion, prioritaet, text })
      continue
    }

    const symbolSetup = setups.find((s) => s.symbol === sym)
    if (symbolSetup) {
      const pct =
        typeof symbolSetup.indikatoren.erfolgWahrscheinlichkeitPct === 'number'
          ? symbolSetup.indikatoren.erfolgWahrscheinlichkeitPct
          : null
      const r = symbolSetup.indikatoren.richtung
      positionen.push({
        symbol: sym,
        name: e.name,
        aktion: 'trade_pruefen',
        prioritaet: 98,
        text:
          sym +
          ': JETZT — ' +
          String(symbolSetup.indikatoren.playbookLabel ?? symbolSetup.playbook) +
          ' ' +
          (r === 'long' ? 'LONG' : r === 'short' ? 'SHORT' : '') +
          (pct != null ? ' · ' + pct + '%' : '') +
          '. Stop ' +
          String(symbolSetup.indikatoren.stopPrice ?? '—') +
          ', Ziel ' +
          String(symbolSetup.indikatoren.targetPrice ?? '—') +
          '. Stop/Ziel aus Scan übernehmen.',
      })
      continue
    }

    if (!n || n.tageBis == null) {
      text += 'Tages-Scan läuft — Filter „Top-Trades“ für handelbare Signale.'
      aktion = 'beobachten'
      prioritaet = 25
    } else if (n.tageBis === 0) {
      aktion = 'beobachten'
      prioritaet = 40
      text += 'Earnings heute — optional; Tages-Signale haben Vorrang wenn „Jetzt“-Badge aktiv.'
    } else if (n.tageBis === 1) {
      aktion = 'beobachten'
      prioritaet = 35
      text += 'Earnings morgen — nur handeln wenn Top-Trade aktiv, sonst warten.'
    } else if (n.tageBis >= EARNINGS_VORLAUF_MIN && n.tageBis <= EARNINGS_VORLAUF_MAX) {
      aktion = 'beobachten'
      prioritaet = 30
      text +=
        'Earnings in ' +
        n.tageBis +
        ' Tagen (optional). Fokus: tägliche Signale — Filter Top-Trades.'
    } else if (n.tageBis >= 0 && n.tageBis < EARNINGS_VORLAUF_MIN) {
      aktion = 'beobachten'
      prioritaet = 35
      text += 'Earnings bald — Tages-Setup bevorzugen, Earnings nur bei aktivem Scan-Signal.'
    } else if (n.tageBis > EARNINGS_VORLAUF_MAX) {
      aktion = 'beobachten'
      prioritaet = 20
      text += 'Earnings in ' + n.tageBis + ' Tagen (' + n.datum + ').'
    } else {
      text += 'Earnings-Termin veraltet — Sync optional.'
      aktion = 'beobachten'
      prioritaet = 20
    }

    positionen.push({ symbol: sym, name: e.name, aktion, prioritaet, text })
  }

  positionen.sort((a, b) => b.prioritaet - a.prioritaet)

  let zusammenfassung: string
  if (setups.length > 0) {
    zusammenfassung =
      setups.length +
      ' Top-Trade(s) JETZT handelbar — Stop/Ziel aus Scan übernehmen. Kein Trade ohne „Jetzt“-Badge.'
  } else if (datenHinweise.length > 0) {
    zusammenfassung =
      'Noch kein Trade-Setup über Schwelle — „Alles aktualisieren“ für frische Kurse und Scan. ' +
      datenHinweise[0]
  } else {
    zusammenfassung =
      'Kein Top-Trade aktiv — nur handeln wenn Badge „Jetzt“ erscheint. Täglicher Scan prüft Gap, Trend, Momentum.'
  }

  const offen = input.trades.filter((t) => t.exitPrice == null)
  if (offen.length > 0) {
    zusammenfassung = offen.length + ' offene(r) Trade(s) — Exit prüfen. ' + zusammenfassung
  }

  const signale = sammleHandlungssignale(input.scan?.ergebnisse ?? [], gates)
  const topSignal = signale[0] ?? null

  if (topSignal?.istAktiv) {
    zusammenfassung =
      topSignal.symbol +
      ': ' +
      (topSignal.richtung === 'long' ? 'LONG' : 'SHORT') +
      ' jetzt (' +
      topSignal.planungsScore +
      '/100 Planung) — ' +
      topSignal.kurztext
  }

  return {
    generiertAm: heute,
    zusammenfassung,
    regimeText: regimeText(regime),
    longBias: gates?.longBias ?? false,
    shortBias: gates?.shortBias ?? false,
    datenHinweise,
    positionen,
    tradeSetups: setups,
    hatAktivesTradeSetup: setups.length > 0,
    topSignal,
    signale: signale.slice(0, 6),
  }
}
