'use client'

import { useEffect, useMemo, useState } from 'react'
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

/** Tägliche Wertentwicklung mit historischen Kursen (Basis für TTWROR-Heatmap). */
export function usePaWertentwicklungTimeline(
  buchungen: PortfolioDbBuchung[],
  positionen: LivePosition[],
  meta: Map<string, IsinMetadata>,
  depotwertEur: number,
  aktiv: boolean,
): { timeline: WertentwicklungPunkt[]; laden: boolean } {
  const [historie, setHistorie] = useState<Map<string, Map<string, number>>>(new Map())
  const [historieLaden, setHistorieLaden] = useState(false)

  const vonDatum = useMemo(() => {
    if (buchungen.length === 0) return null
    return [...buchungen].sort((a, b) => a.datum.localeCompare(b.datum))[0]?.datum ?? null
  }, [buchungen])

  const historieKey = useMemo(() => {
    if (!vonDatum || !aktiv) return ''
    const yahoo = yahooSymboleFuerHistorie(buchungen, positionen, meta).sort().join(',')
    const stooq = stooqSymboleFuerHistorie(buchungen, positionen, meta).sort().join(',')
    return `${vonDatum}|${yahoo}|${stooq}`
  }, [aktiv, buchungen, positionen, meta, vonDatum])

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

    void ladeHistorischeKurseClient(yahoo, vonDatum, heuteIso(), stooq)
      .then((h) => {
        if (!cancelled) setHistorie(h)
      })
      .finally(() => {
        if (!cancelled) setHistorieLaden(false)
      })

    return () => {
      cancelled = true
    }
  }, [aktiv, vonDatum, historieKey, buchungen.length, positionen, meta])

  const timeline = useMemo(() => {
    if (!aktiv || buchungen.length === 0 || depotwertEur <= 0) return []
    if (historieLaden || historie.size === 0) return []

    const roh = baueWertentwicklungMitKursen(
      buchungen,
      depotwertEur,
      positionen,
      historie,
      fxKurseAusYahooMap(new Map()),
      meta,
    )
    return sanitiereWertentwicklungTimeline(roh)
  }, [aktiv, buchungen, depotwertEur, positionen, historie, meta, historieLaden])

  return {
    timeline,
    laden: aktiv && (historieLaden || (historie.size === 0 && buchungen.length > 0)),
  }
}
