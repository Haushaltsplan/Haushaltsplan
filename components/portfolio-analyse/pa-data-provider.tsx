'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import toast from 'react-hot-toast'
import { syncAlleKiZusammenfassungenAusLocalStorage } from '@/lib/portfolio-analyse/portfolio-ki-cache-sync-client'
import { positionenFuerBewertung } from '@/lib/portfolio-analyse/bestand'
import { sammleIsins } from '@/lib/portfolio-analyse/auswertungen'
import {
  berechneLivePortfolio,
  ladeLiveKurseClient,
  symboleAusMeta,
  type LivePortfolio,
} from '@/lib/portfolio-analyse/live-bewertung'
import { ladeIsinMetadaten } from '@/lib/portfolio-analyse/isin-metadata-client'
import { PORTFOLIO_MAX_BUCHUNGEN } from '@/lib/portfolio-analyse/limits'
import { ladePortfolioAnalyseDaten } from '@/lib/portfolio-analyse/portfolio-analyse-db'
import { parqetReportAusDepot } from '@/lib/portfolio-analyse/parqet-adapter'
import { ladeEtfBreakdownsFuerPositionen } from '@/lib/portfolio-analyse/etf-breakdown-client'
import type { EtfBreakdown } from '@/lib/portfolio-analyse/parqet-core/types'
import type { SinglePortfolioReport } from '@/lib/portfolio-analyse/parqet-core/types'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import type { PortfolioDbBuchung, PortfolioDbSnapshot } from '@/lib/portfolio-analyse/types'

type PaContextValue = {
  laden: boolean
  schemaFehlt: boolean
  dbFehler: string | null
  buchungenLimit: boolean
  buchungen: PortfolioDbBuchung[]
  snapshot: PortfolioDbSnapshot | null
  meta: Map<string, IsinMetadata>
  live: LivePortfolio | null
  liveLaden: boolean
  kursFehler: boolean
  report: SinglePortfolioReport | null
  etfBreakdowns: Map<string, EtfBreakdown>
  etfBreakdownLaden: boolean
  hatDaten: boolean
  neuLaden: () => Promise<void>
}

const PaContext = createContext<PaContextValue | null>(null)

export function usePortfolioAnalyse() {
  const ctx = useContext(PaContext)
  if (!ctx) throw new Error('usePortfolioAnalyse nur innerhalb von PaDataProvider')
  return ctx
}

export function PaDataProvider({ children }: { children: ReactNode }) {
  const [laden, setLaden] = useState(true)
  const [schemaFehlt, setSchemaFehlt] = useState(false)
  const [dbFehler, setDbFehler] = useState<string | null>(null)
  const [buchungenLimit, setBuchungenLimit] = useState(false)
  const [buchungen, setBuchungen] = useState<PortfolioDbBuchung[]>([])
  const [snapshot, setSnapshot] = useState<PortfolioDbSnapshot | null>(null)
  const [meta, setMeta] = useState<Map<string, IsinMetadata>>(new Map())
  const [metaLaden, setMetaLaden] = useState(true)
  const [live, setLive] = useState<LivePortfolio | null>(null)
  const [liveLaden, setLiveLaden] = useState(false)
  const [kursFehler, setKursFehler] = useState(false)
  const [etfBreakdowns, setEtfBreakdowns] = useState<Map<string, EtfBreakdown>>(new Map())
  const [etfBreakdownLaden, setEtfBreakdownLaden] = useState(false)

  const neuLaden = useCallback(async () => {
    setLaden(true)
    const res = await ladePortfolioAnalyseDaten()
    setSchemaFehlt(res.schemaFehlt)
    setDbFehler(res.schemaFehlt ? null : res.message ?? null)
    setBuchungenLimit(Boolean(res.limitErreicht))
    if (res.ok) {
      setBuchungen(res.buchungen)
      setSnapshot(res.snapshot)
      setDbFehler(null)
      if (res.limitErreicht) {
        toast(
          `Es werden maximal ${PORTFOLIO_MAX_BUCHUNGEN.toLocaleString('de-DE')} Buchungen geladen.`,
          { duration: 6000 },
        )
      }
    } else if (!res.schemaFehlt) {
      toast.error(res.message ?? 'Daten konnten nicht geladen werden.')
    }
    setLaden(false)
  }, [])

  useEffect(() => {
    void neuLaden()
  }, [neuLaden])

  useEffect(() => {
    syncAlleKiZusammenfassungenAusLocalStorage()
  }, [])

  const isins = useMemo(() => sammleIsins(buchungen, snapshot), [buchungen, snapshot])
  const isinKey = isins.join('|')

  useEffect(() => {
    let cancelled = false
    async function run() {
      setMetaLaden(true)
      const m = isins.length > 0 ? await ladeIsinMetadaten(isins) : new Map()
      if (!cancelled) {
        setMeta(m)
        setMetaLaden(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [isinKey, isins.length])

  useEffect(() => {
    if (buchungen.length === 0) {
      setLive(null)
      return
    }
    let cancelled = false
    async function run() {
      setLiveLaden(true)
      setKursFehler(false)
      const sym = symboleAusMeta(positionenFuerBewertung(buchungen, snapshot), meta)
      const { kurse, stand, fx, stooqEur } = await ladeLiveKurseClient(sym)
      if (cancelled) return
      if (sym.length > 0 && kurse.size === 0) setKursFehler(true)
      setLive(berechneLivePortfolio(buchungen, snapshot, meta, kurse, stand, fx, stooqEur))
      setLiveLaden(false)
    }
    void run()
    const t = setInterval(() => void run(), 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [buchungen, snapshot, meta])

  const etfIsinKey = useMemo(() => {
    if (!live?.positionen.length) return ''
    return live.positionen
      .filter((p) => p.assetKlasse === 'etf' && p.isin)
      .map((p) => p.isin!.trim().toUpperCase())
      .sort()
      .join('|')
  }, [live?.positionen])

  useEffect(() => {
    if (!etfIsinKey) {
      setEtfBreakdowns(new Map())
      setEtfBreakdownLaden(false)
      return
    }
    let cancelled = false
    setEtfBreakdownLaden(true)
    void ladeEtfBreakdownsFuerPositionen(live!.positionen, meta).then((m) => {
      if (!cancelled) {
        setEtfBreakdowns(m)
        setEtfBreakdownLaden(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [etfIsinKey, live, meta])

  const report = useMemo(() => {
    if (!live || live.positionen.length === 0) return null
    try {
      return parqetReportAusDepot(
        buchungen,
        live.positionen,
        live.kennzahlen.depotwertEur,
        live.kennzahlen.cashEur,
        { etfBreakdowns, meta },
      )
    } catch {
      return null
    }
  }, [buchungen, live, etfBreakdowns, meta])

  const hatDaten = buchungen.length > 0 || (snapshot?.positionen.length ?? 0) > 0

  const value: PaContextValue = {
    laden: laden || metaLaden,
    schemaFehlt,
    dbFehler,
    buchungenLimit,
    buchungen,
    snapshot,
    meta,
    live,
    liveLaden,
    kursFehler,
    report,
    etfBreakdowns,
    etfBreakdownLaden,
    hatDaten,
    neuLaden,
  }

  return <PaContext.Provider value={value}>{children}</PaContext.Provider>
}
