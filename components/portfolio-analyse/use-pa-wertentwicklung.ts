'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FxKurse } from '@/lib/portfolio-analyse/kurs-aufloesung'
import { fxKurseAusYahooMap } from '@/lib/portfolio-analyse/kurs-aufloesung'
import { ladeHistorischeKurseClient } from '@/lib/portfolio-analyse/live-bewertung'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import { sanitiereWertentwicklungTimeline } from '@/lib/portfolio-analyse/portfolio-berechnungen'
import type { PortfolioDbBuchung } from '@/lib/portfolio-analyse/types'
import { heuteIso } from '@/lib/portfolio-analyse/wertentwicklung-tage'
import type { WertentwicklungPunkt } from '@/lib/portfolio-analyse/wertentwicklung'
import {
  baueWertentwicklungMitKursen,
  stooqSymboleFuerHistorie,
  yahooSymboleFuerHistorie,
} from '@/lib/portfolio-analyse/wertentwicklung-kurse'

function isinsAusBuchungen(buchungen: PortfolioDbBuchung[]): string[] {
  const s = new Set<string>()
  for (const b of buchungen) {
    if (!b.isin) continue
    if (b.typ === 'kauf' || b.typ === 'verkauf') s.add(b.isin.toUpperCase())
  }
  return [...s]
}

/** Tägliche Wertentwicklung mit historischen Kursen (Basis für TTWROR-Heatmap). */
export function usePaWertentwicklungTimeline(
  buchungen: PortfolioDbBuchung[],
  positionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
  depotwertEur: number,
  fx: FxKurse,
  aktiv: boolean,
): { timeline: WertentwicklungPunkt[]; laden: boolean } {
  const [historie, setHistorie] = useState<Map<string, Map<string, number>>>(new Map())
  const [historieLaden, setHistorieLaden] = useState(false)

  const isins = useMemo(() => isinsAusBuchungen(buchungen), [buchungen])

  const vonDatum = useMemo(() => {
    if (buchungen.length === 0) return null
    return [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))[0]?.datum ?? null
  }, [buchungen])

  const historieKey = useMemo(() => {
    if (!vonDatum || !aktiv) return ''
    const yahoo = yahooSymboleFuerHistorie(buchungen, positionen, meta).sort().join(',')
    const stooq = stooqSymboleFuerHistorie(buchungen, positionen, meta).sort().join(',')
    return `${vonDatum}|${yahoo}|${stooq}|${isins.sort().join(',')}`
  }, [aktiv, buchungen, positionen, meta, vonDatum, isins])

  useEffect(() => {
    if (!aktiv || !vonDatum || buchungen.length === 0) {
      setHistorie(new Map())
      setHistorieLaden(false)
      return
    }

    let cancelled = false
    setHistorieLaden(true)
    const yahoo = yahooSymboleFuerHistorie(buchungen, positionen, meta)
    const stooq = stooqSymboleFuerHistorie(buchungen, positionen, meta)

    void ladeHistorischeKurseClient(yahoo, vonDatum, heuteIso(), stooq, isins)
      .then((h) => {
        if (!cancelled) setHistorie(h)
      })
      .finally(() => {
        if (!cancelled) setHistorieLaden(false)
      })

    return () => {
      cancelled = true
    }
  }, [aktiv, vonDatum, historieKey, buchungen.length, positionen, meta, isins])

  const fxHeute = fx.eurUsd > 0 ? fx : fxKurseAusYahooMap(new Map())

  const timeline = useMemo(() => {
    if (!aktiv || buchungen.length === 0 || depotwertEur <= 0) return []
    if (historieLaden || historie.size === 0) return []

    const roh = baueWertentwicklungMitKursen(
      buchungen,
      depotwertEur,
      positionen,
      historie,
      fxHeute,
      meta,
    )
    return sanitiereWertentwicklungTimeline(roh)
  }, [aktiv, buchungen, depotwertEur, positionen, historie, meta, historieLaden, fxHeute])

  return {
    timeline,
    laden: aktiv && (historieLaden || (historie.size === 0 && buchungen.length > 0)),
  }
}
