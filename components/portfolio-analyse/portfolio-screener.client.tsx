'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { appTableScrollClassName } from '@/components/page-shell'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PA_SCROLL_ELEGANT, PA_TABLE_COMPACT, PA_TABLE_FRAME } from '@/components/portfolio-analyse/pa-ui'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import {
  findeWatchlistIdx,
  fuegeZurWatchlistHinzu,
  ladeWatchlist,
  WATCHLIST_CHANGED_EVENT,
} from '@/lib/portfolio-analyse/watchlist-client'
import type { ScreenerBoerse, ScreenerSort, ScreenerZeile } from '@/lib/portfolio-analyse/screener/screener-types'

type ApiAntwort = {
  ok: boolean
  leer?: boolean
  periode?: string | null
  aktualisiertAm?: string | null
  n?: number
  zeilen?: ScreenerZeile[]
  message?: string
}

function fmtMio(v: number | null): string {
  if (v == null) return '–'
  const abs = Math.abs(v)
  if (abs >= 1000) return `${(v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mrd`
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })} Mio`
}

function fmtZahl(v: number | null, stellen = 1): string {
  if (v == null) return '–'
  return v.toLocaleString('de-DE', { maximumFractionDigits: stellen })
}

function fmtPct(v: number | null): string {
  if (v == null) return '–'
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
}

function pctTon(v: number | null): string {
  if (v == null) return 'text-[var(--app-text-muted)]'
  if (v > 0) return 'text-emerald-400'
  if (v < 0) return 'text-rose-400'
  return 'text-[var(--app-text)]'
}

function sortWert(z: ScreenerZeile, sort: ScreenerSort): number | string {
  if (sort === 'name') return z.name.toLowerCase()
  if (sort === 'roe') return z.roePct ?? -999
  if (sort === 'niMarge') return z.niMargePct ?? -999
  if (sort === 'wachstum') return z.umsatzWachstumPct ?? -999
  if (sort === 'cagr5') return z.umsatzCagr5y ?? -999
  if (sort === 'fcfMarge') return z.fcfMargePct ?? -999
  if (sort === 'kgv') return z.kgv ?? 9999
  return z.umsatzMio ?? -1
}

export function PortfolioScreenerClient() {
  const [zeilen, setZeilen] = useState<ScreenerZeile[]>([])
  const [periode, setPeriode] = useState<string | null>(null)
  const [aktualisiertAm, setAktualisiertAm] = useState<string | null>(null)
  const [laden, setLaden] = useState(true)
  const [erneuern, setErneuern] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const [suche, setSuche] = useState('')
  const [boerse, setBoerse] = useState<'alle' | ScreenerBoerse>('alle')
  const [minUmsatz, setMinUmsatz] = useState(500)
  const [minRoe, setMinRoe] = useState(0)
  const [minMarge, setMinMarge] = useState(0)
  const [minWachstum, setMinWachstum] = useState<number | null>(null)
  const [minCagr5, setMinCagr5] = useState<number | null>(5)
  const [minJahre, setMinJahre] = useState(8)
  const [maxKgv, setMaxKgv] = useState<number | null>(null)
  const [nurGewinn, setNurGewinn] = useState(true)
  const [sort, setSort] = useState<ScreenerSort>('roe')
  const [watchKeys, setWatchKeys] = useState<Set<string>>(new Set())

  const uebernehme = useCallback((j: ApiAntwort) => {
    setZeilen(j.zeilen ?? [])
    setPeriode(j.periode ?? null)
    setAktualisiertAm(j.aktualisiertAm ?? null)
  }, [])

  const lade = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    try {
      const res = await fetch('/api/portfolio-analyse/screener', { cache: 'no-store' })
      const j = (await res.json()) as ApiAntwort
      if (!res.ok || !j.ok) throw new Error(j.message ?? 'Screener konnte nicht geladen werden.')
      uebernehme(j)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Screener konnte nicht geladen werden.')
    } finally {
      setLaden(false)
    }
  }, [uebernehme])

  useEffect(() => {
    void lade()
  }, [lade])

  useEffect(() => {
    const sync = () => {
      setWatchKeys(new Set(ladeWatchlist().map((e) => e.symbolYahoo?.trim().toUpperCase()).filter(Boolean) as string[]))
    }
    sync()
    window.addEventListener(WATCHLIST_CHANGED_EVENT, sync)
    return () => window.removeEventListener(WATCHLIST_CHANGED_EVENT, sync)
  }, [])

  const baueUniversum = useCallback(async () => {
    setErneuern(true)
    setFehler(null)
    try {
      const res = await fetch('/api/portfolio-analyse/screener', { method: 'POST' })
      const j = (await res.json()) as ApiAntwort
      if (!res.ok || !j.ok) throw new Error(j.message ?? 'Universum konnte nicht geladen werden.')
      uebernehme(j)
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Universum konnte nicht geladen werden.')
    } finally {
      setErneuern(false)
    }
  }, [uebernehme])

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase()
    const out = zeilen.filter((z) => {
      if (boerse !== 'alle' && z.boerse !== boerse) return false
      if (z.umsatzMio != null && z.umsatzMio < minUmsatz) return false
      if (z.umsatzMio == null && minUmsatz > 0) return false
      if (nurGewinn && !(z.niMio != null && z.niMio > 0)) return false
      if (minRoe > 0 && (z.roePct == null || z.roePct < minRoe)) return false
      if (minMarge > 0 && (z.niMargePct == null || z.niMargePct < minMarge)) return false
      if (minWachstum != null && (z.umsatzWachstumPct == null || z.umsatzWachstumPct < minWachstum)) return false
      if (minCagr5 != null && (z.umsatzCagr5y == null || z.umsatzCagr5y < minCagr5)) return false
      if (minJahre > 0 && z.jahreAnzahl < minJahre) return false
      if (maxKgv != null && (z.kgv == null || z.kgv > maxKgv)) return false
      if (q && !z.ticker.toLowerCase().includes(q) && !z.name.toLowerCase().includes(q)) return false
      return true
    })
    out.sort((a, b) => {
      const av = sortWert(a, sort)
      const bv = sortWert(b, sort)
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv, 'de')
      return sort === 'kgv' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return out
  }, [zeilen, suche, boerse, minUmsatz, minRoe, minMarge, minWachstum, minCagr5, minJahre, maxKgv, nurGewinn, sort])

  const sichtbar = gefiltert.slice(0, 250)

  const merke = useCallback((z: ScreenerZeile) => {
    if (findeWatchlistIdx(ladeWatchlist(), { symbol: z.ticker }) >= 0) return
    fuegeZurWatchlistHinzu({
      isin: null,
      name: z.name,
      symbolYahoo: z.ticker,
      symbolCandidates: [z.ticker],
      hinzugefuegtAm: new Date().toISOString(),
    })
  }, [])

  const stand = aktualisiertAm
    ? new Date(aktualisiertAm).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
    : null

  return (
    <PortfolioAnalyseShell
      title="Aktienscreener"
      description="US-gelistete SEC-Filer (Nasdaq, NYSE, CBOE) nach Qualität filtern — Daten aus EDGAR-Frames, unabhängig vom Depot."
    >
      <PaCard className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--app-text-muted)]">
            {zeilen.length > 0
              ? `${zeilen.length.toLocaleString('de-DE')} Titel · ${periode ?? '–'} · ${gefiltert.length.toLocaleString('de-DE')} Treffer`
              : 'Noch kein Universum im Cache.'}
            {stand ? ` · Stand ${stand}` : ''}
          </p>
          <button
            type="button"
            onClick={() => void baueUniversum()}
            disabled={erneuern}
            className="rounded-md border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-500/30 disabled:opacity-50"
          >
            {erneuern ? 'Lade SEC-Universum …' : zeilen.length > 0 ? 'Universum erneuern' : 'Universum laden'}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs text-[var(--app-text-muted)]">
            Suche
            <input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Ticker oder Name"
              className="mt-1 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-sm text-[var(--app-text)]"
            />
          </label>
          <label className="block text-xs text-[var(--app-text-muted)]">
            Börse
            <select
              value={boerse}
              onChange={(e) => setBoerse(e.target.value as 'alle' | ScreenerBoerse)}
              className="mt-1 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-sm text-[var(--app-text)]"
            >
              <option value="alle">Nasdaq + NYSE + CBOE</option>
              <option value="Nasdaq">Nasdaq</option>
              <option value="NYSE">NYSE</option>
              <option value="CBOE">CBOE</option>
            </select>
          </label>
          <label className="block text-xs text-[var(--app-text-muted)]">
            Min. Umsatz
            <select
              value={minUmsatz}
              onChange={(e) => setMinUmsatz(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-sm text-[var(--app-text)]"
            >
              <option value={0}>keine Untergrenze</option>
              <option value={100}>100 Mio $</option>
              <option value={500}>500 Mio $</option>
              <option value={1000}>1 Mrd $</option>
              <option value={5000}>5 Mrd $</option>
            </select>
          </label>
          <label className="block text-xs text-[var(--app-text-muted)]">
            Sortierung
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ScreenerSort)}
              className="mt-1 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-sm text-[var(--app-text)]"
            >
              <option value="roe">ROE</option>
              <option value="niMarge">Nettomarge</option>
              <option value="fcfMarge">FCF-Marge</option>
              <option value="cagr5">Umsatz-CAGR 5J</option>
              <option value="wachstum">Umsatzwachstum 1J</option>
              <option value="kgv">KGV (günstig zuerst)</option>
              <option value="umsatz">Umsatz</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs text-[var(--app-text-muted)]">
            Min. ROE {minRoe} %
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={minRoe}
              onChange={(e) => setMinRoe(Number(e.target.value))}
              className="mt-1 block w-40"
            />
          </label>
          <label className="text-xs text-[var(--app-text-muted)]">
            Min. Nettomarge {minMarge} %
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={minMarge}
              onChange={(e) => setMinMarge(Number(e.target.value))}
              className="mt-1 block w-40"
            />
          </label>
          <label className="text-xs text-[var(--app-text-muted)]">
            Min. Wachstum
            <select
              value={minWachstum ?? ''}
              onChange={(e) => setMinWachstum(e.target.value === '' ? null : Number(e.target.value))}
              className="mt-1 block rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-sm text-[var(--app-text)]"
            >
              <option value="">egal</option>
              <option value={0}>≥ 0 %</option>
              <option value={5}>≥ 5 %</option>
              <option value={10}>≥ 10 %</option>
              <option value={15}>≥ 15 %</option>
            </select>
          </label>
          <label className="text-xs text-[var(--app-text-muted)]">
            Min. CAGR 5J
            <select
              value={minCagr5 ?? ''}
              onChange={(e) => setMinCagr5(e.target.value === '' ? null : Number(e.target.value))}
              className="mt-1 block rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-sm text-[var(--app-text)]"
            >
              <option value="">egal</option>
              <option value={0}>≥ 0 %</option>
              <option value={5}>≥ 5 %</option>
              <option value={10}>≥ 10 %</option>
              <option value={15}>≥ 15 %</option>
            </select>
          </label>
          <label className="text-xs text-[var(--app-text-muted)]">
            Min. Historie
            <select
              value={minJahre}
              onChange={(e) => setMinJahre(Number(e.target.value))}
              className="mt-1 block rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-sm text-[var(--app-text)]"
            >
              <option value={0}>egal</option>
              <option value={5}>≥ 5 Jahre</option>
              <option value={8}>≥ 8 Jahre</option>
              <option value={10}>≥ 10 Jahre</option>
              <option value={15}>≥ 15 Jahre</option>
            </select>
          </label>
          <label className="text-xs text-[var(--app-text-muted)]">
            Max. KGV
            <select
              value={maxKgv ?? ''}
              onChange={(e) => setMaxKgv(e.target.value === '' ? null : Number(e.target.value))}
              className="mt-1 block rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-sm text-[var(--app-text)]"
            >
              <option value="">egal</option>
              <option value={15}>≤ 15</option>
              <option value={20}>≤ 20</option>
              <option value={25}>≤ 25</option>
              <option value={35}>≤ 35</option>
            </select>
          <label className="flex items-center gap-2 text-xs text-[var(--app-text)]">
            <input type="checkbox" checked={nurGewinn} onChange={(e) => setNurGewinn(e.target.checked)} />
            nur Gewinn
          </label>
        </div>

        {fehler ? <p className="text-sm text-rose-300">{fehler}</p> : null}
        {laden ? <p className="text-sm text-[var(--app-text-muted)]">Lade Snapshot …</p> : null}

        <div className={`${PA_TABLE_FRAME} ${PA_SCROLL_ELEGANT}`}>
          <div className={appTableScrollClassName}>
            <table className={PA_TABLE_COMPACT}>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Name</th>
                  <th>Börse</th>
                  <th className="text-right">Jahre</th>
                  <th className="text-right">Umsatz</th>
                  <th className="text-right">CAGR 5J</th>
                  <th className="text-right">NI-Marge</th>
                  <th className="text-right">ROE</th>
                  <th className="text-right">KGV</th>
                  <th className="text-right">KUV</th>
                  <th className="text-right">Kurs</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sichtbar.map((z) => (
                  <tr key={`${z.cik}-${z.ticker}`}>
                    <td>
                      <Link
                        href={fundamentaldatenHref({ symbol: z.ticker })}
                        className="font-semibold text-teal-300 hover:underline"
                      >
                        {z.ticker}
                      </Link>
                    </td>
                    <td className="max-w-[14rem] truncate text-[var(--app-text)]" title={z.name}>
                      {z.name}
                    </td>
                    <td className="text-[var(--app-text-muted)]">{z.boerse}</td>
                    <td className="text-right tabular-nums text-[var(--app-text-muted)]">
                      {z.jahreAnzahl}
                      {z.vonJahr && z.bisJahr ? (
                        <span className="ml-1 text-[10px]">
                          {z.vonJahr}–{z.bisJahr}
                        </span>
                      ) : null}
                    </td>
                    <td className="text-right tabular-nums">{fmtMio(z.umsatzMio)}</td>
                    <td className={`text-right tabular-nums ${pctTon(z.umsatzCagr5y)}`}>{fmtPct(z.umsatzCagr5y)}</td>
                    <td className={`text-right tabular-nums ${pctTon(z.niMargePct)}`}>{fmtPct(z.niMargePct)}</td>
                    <td className={`text-right tabular-nums ${pctTon(z.roePct)}`}>{fmtPct(z.roePct)}</td>
                    <td className="text-right tabular-nums">{fmtZahl(z.kgv)}</td>
                    <td className="text-right tabular-nums">{fmtZahl(z.kuv)}</td>
                    <td className="text-right tabular-nums">{fmtZahl(z.kurs, 2)}</td>
                    <td>
                      <button
                        type="button"
                        disabled={watchKeys.has(z.ticker)}
                        onClick={() => merke(z)}
                        className="text-[11px] text-amber-200/90 hover:underline disabled:text-[var(--app-text-muted)]"
                      >
                        {watchKeys.has(z.ticker) ? 'gemerkt' : 'Watchlist'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {gefiltert.length > sichtbar.length ? (
          <p className="text-xs text-[var(--app-text-muted)]">
            Zeige 250 von {gefiltert.length.toLocaleString('de-DE')} Treffern — Filter enger setzen.
          </p>
        ) : null}
        <p className="text-xs leading-relaxed text-[var(--app-text-muted)]">
          GuV/Bilanz: SEC EDGAR Frames, Kalenderjahre ab 2009 soweit gemeldet. Kurs, KGV und KUV: Yahoo Finance (derselbe
          Quote-Pfad wie im Depot). OTC entfällt. Off-calendar-GJ kann im Nachbarjahr liegen.
        </p>
      </PaCard>
    </PortfolioAnalyseShell>
  )
}
