/**
 * Konflikt-Auflösung: Long vs. Short am selben Symbol, globales Ranking.
 */

import 'server-only'

import {
  KONFLIKT_MIN_DIFF_PCT,
  TRADE_TOP_MIN_PCT,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import { MOMENTUM_TRADE_PLAYBOOKS } from '@/lib/portfolio-analyse/momentum-trader/momentum-playbook-registry'
import type {
  MomentumRichtung,
  MomentumScanEintrag,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

function alsZahl(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function erfolgPct(e: MomentumScanEintrag): number {
  return alsZahl(e.indikatoren.erfolgWahrscheinlichkeitPct)
}

function richtung(e: MomentumScanEintrag): MomentumRichtung | null {
  const r = e.indikatoren.richtung ?? e.indikatoren.erfolgRichtung
  return r === 'long' || r === 'short' ? r : null
}

function istAktivesTradeSetup(e: MomentumScanEintrag): boolean {
  return (
    MOMENTUM_TRADE_PLAYBOOKS.includes(e.playbook) &&
    e.indikatoren.erfolgIstAktiv === true &&
    (e.ampel === 'gruen' || e.ampel === 'gelb')
  )
}

/**
 * Pro Symbol: widersprüchliche aktive Setups markieren.
 * Bei Score-Differenz unter Schwellwert → beide auf „warten“ setzen.
 */
export function loeseScanKonflikte(ergebnisse: MomentumScanEintrag[]): MomentumScanEintrag[] {
  const bySymbol = new Map<string, MomentumScanEintrag[]>()
  for (const e of ergebnisse) {
    const arr = bySymbol.get(e.symbol) ?? []
    arr.push(e)
    bySymbol.set(e.symbol, arr)
  }

  const konfliktKeys = new Set<string>()

  for (const arr of bySymbol.values()) {
    const aktiv = arr.filter(istAktivesTradeSetup)
    const longs = aktiv.filter((e) => richtung(e) === 'long')
    const shorts = aktiv.filter((e) => richtung(e) === 'short')
    if (longs.length === 0 || shorts.length === 0) continue

    const bestLong = longs.sort((a, b) => erfolgPct(b) - erfolgPct(a))[0]
    const bestShort = shorts.sort((a, b) => erfolgPct(b) - erfolgPct(a))[0]
    if (!bestLong || !bestShort) continue

    const diff = Math.abs(erfolgPct(bestLong) - erfolgPct(bestShort))
    if (diff < KONFLIKT_MIN_DIFF_PCT) {
      konfliktKeys.add(bestLong.symbol + bestLong.playbook)
      konfliktKeys.add(bestShort.symbol + bestShort.playbook)
    }
  }

  return ergebnisse.map((e) => {
    const key = e.symbol + e.playbook
    if (!konfliktKeys.has(key)) return e
    return {
      ...e,
      indikatoren: {
        ...e.indikatoren,
        erfolgIstAktiv: false,
        konflikt: true,
        konfliktHinweis: 'Long und Short gleichzeitig — warten bis klar',
        handlungKurz: 'Konflikt — Setup widerspricht sich, nicht handeln',
      },
    }
  })
}

/** Global nach Erfolgswahrscheinlichkeit sortieren, schwache ausblenden optional. */
export function sortiereScanGlobal(
  ergebnisse: MomentumScanEintrag[],
  minPct = 0,
): MomentumScanEintrag[] {
  return [...ergebnisse]
    .filter((e) => erfolgPct(e) >= minPct || e.ampel === 'grau')
    .sort((a, b) => {
      const pa = erfolgPct(a)
      const pb = erfolgPct(b)
      if (pb !== pa) return pb - pa
      return b.score - a.score
    })
}

/** Top-N handelbare Signale (für Briefing / UI). */
export function topTradeSetups(
  ergebnisse: MomentumScanEintrag[],
  max = 5,
): MomentumScanEintrag[] {
  return sortiereScanGlobal(ergebnisse, TRADE_TOP_MIN_PCT)
    .filter((e) => e.indikatoren.erfolgIstAktiv === true && !e.indikatoren.konflikt)
    .slice(0, max)
}
