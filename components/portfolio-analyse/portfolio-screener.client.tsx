'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { appTableScrollClassName } from '@/components/page-shell'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PA_SCROLL_ELEGANT, PA_TABLE_COMPACT, PA_TABLE_FRAME } from '@/components/portfolio-analyse/pa-ui'
import { CLIENT_STATE_APPLIED_EVENT, CLIENT_STATE_KEYS } from '@/lib/client-state/client-state-keys'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import {
  filterGleich,
  kloneFilter,
  passtScreenerFilter,
  setzeSpanne,
  sortiereScreenerZeilen,
  sortierungIstAufsteigendDefault,
  zaehleMantraTreffer,
} from '@/lib/portfolio-analyse/screener/screener-filter'
import {
  SCREENER_SCHEMA_VERSION,
  type ScreenerEigeneVorlage,
  type ScreenerFilter,
  type ScreenerKennzahl,
  type ScreenerSort,
  type ScreenerZeile,
} from '@/lib/portfolio-analyse/screener/screener-types'
import { SCREENER_EINGEBAUTE_VORLAGEN, qualityCompounderFilter } from '@/lib/portfolio-analyse/screener/screener-vorlagen'
import {
  leseScreenerVorlagen,
  loescheScreenerVorlage,
  SCREENER_VORLAGEN_EVENT,
  speichereScreenerVorlage,
} from '@/lib/portfolio-analyse/screener/screener-vorlagen-store'
import {
  findeWatchlistIdx,
  fuegeZurWatchlistHinzu,
  ladeWatchlist,
  WATCHLIST_CHANGED_EVENT,
} from '@/lib/portfolio-analyse/watchlist-client'

type ApiAntwort = {
  ok: boolean
  leer?: boolean
  periode?: string | null
  aktualisiertAm?: string | null
  n?: number
  schemaVersion?: number
  zeilen?: ScreenerZeile[]
  message?: string
}

type SpalteId =
  | 'ticker'
  | 'name'
  | 'boerse'
  | 'jahre'
  | 'umsatz'
  | 'cagr5'
  | 'wachstum'
  | 'niMarge'
  | 'roe'
  | 'roic'
  | 'fcfMarge'
  | 'conv'
  | 'verw'
  | 'ndEbitda'
  | 'kgv'
  | 'kuv'
  | 'kbv'
  | 'mantra'
  | 'kurs'
  | 'watch'

const SPALTEN_KEY = 'pa-screener-spalten-v1'
const INPUT =
  'w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1 text-sm text-[var(--app-text)]'
const CHIP =
  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition'
const CHIP_AN = 'border-teal-400/70 bg-teal-500/20 text-teal-100'
const CHIP_AUS = 'border-[var(--app-border)] text-[var(--app-text-muted)] hover:border-teal-500/40'
const CHIP_TWEAK = 'border-amber-400/60 bg-amber-500/15 text-amber-100'

const SPALTEN: {
  id: SpalteId
  label: string
  sort?: ScreenerSort
  defaultOn: boolean
  immer?: boolean
}[] = [
  { id: 'ticker', label: 'Ticker', sort: 'ticker', defaultOn: true, immer: true },
  { id: 'name', label: 'Name', sort: 'name', defaultOn: true },
  { id: 'boerse', label: 'Börse', defaultOn: false },
  { id: 'jahre', label: 'Jahre', sort: 'jahreAnzahl', defaultOn: true },
  { id: 'umsatz', label: 'Umsatz', sort: 'umsatzMio', defaultOn: true },
  { id: 'cagr5', label: 'CAGR 5J', sort: 'umsatzCagr5y', defaultOn: true },
  { id: 'wachstum', label: 'Umsatz 1J', sort: 'umsatzWachstumPct', defaultOn: false },
  { id: 'niMarge', label: 'NI-Marge', sort: 'niMargePct', defaultOn: false },
  { id: 'roe', label: 'ROE', sort: 'roePct', defaultOn: false },
  { id: 'roic', label: 'ROIC', sort: 'roicPct', defaultOn: true },
  { id: 'fcfMarge', label: 'FCF-Marge', sort: 'fcfMargePct', defaultOn: true },
  { id: 'conv', label: 'FCF/NI', sort: 'fcfConversionPct', defaultOn: true },
  { id: 'verw', label: 'Verw. p.a.', sort: 'aktienVerwaesserungJaehrlichPct', defaultOn: false },
  { id: 'ndEbitda', label: 'ND/EBITDA', sort: 'netDebtEbitda', defaultOn: false },
  { id: 'kgv', label: 'KGV', sort: 'kgv', defaultOn: true },
  { id: 'kuv', label: 'KUV', sort: 'kuv', defaultOn: false },
  { id: 'kbv', label: 'KBV', sort: 'kbv', defaultOn: false },
  { id: 'mantra', label: 'Mantra', sort: 'mantra', defaultOn: true },
  { id: 'kurs', label: 'Kurs', defaultOn: false },
  { id: 'watch', label: '', defaultOn: true, immer: true },
]

function fmtMio(v: number | null | undefined): string {
  if (v == null) return '–'
  const abs = Math.abs(v)
  if (abs >= 1000) return `${(v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mrd`
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })} Mio`
}

function fmtZahl(v: number | null | undefined, stellen = 1): string {
  if (v == null) return '–'
  return v.toLocaleString('de-DE', { maximumFractionDigits: stellen })
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '–'
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
}

function pctTon(v: number | null | undefined): string {
  if (v == null) return 'text-[var(--app-text-muted)]'
  if (v > 0) return 'text-emerald-400'
  if (v < 0) return 'text-rose-400'
  return 'text-[var(--app-text)]'
}

function csvZelle(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function leseSpalten(): Set<SpalteId> {
  const basis = new Set(SPALTEN.filter((s) => s.defaultOn || s.immer).map((s) => s.id))
  if (typeof window === 'undefined') return basis
  try {
    const raw = window.localStorage.getItem(SPALTEN_KEY)
    if (!raw) return basis
    const ids = JSON.parse(raw) as unknown
    if (!Array.isArray(ids)) return basis
    const out = new Set<SpalteId>()
    for (const id of ids) {
      if (typeof id === 'string' && SPALTEN.some((s) => s.id === id)) out.add(id as SpalteId)
    }
    for (const s of SPALTEN) if (s.immer) out.add(s.id)
    return out.size >= 3 ? out : basis
  } catch {
    return basis
  }
}

function gleichOhneSuche(a: ScreenerFilter, b: ScreenerFilter): boolean {
  return filterGleich({ ...a, suche: '' }, { ...b, suche: '' })
}

function ZahlInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null | undefined
  onChange: (n: number | null) => void
  placeholder: string
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        const t = e.target.value.trim()
        if (t === '') onChange(null)
        else {
          const n = Number(t)
          onChange(Number.isFinite(n) ? n : null)
        }
      }}
      className={INPUT}
    />
  )
}

function SpanneFeld({
  label,
  kennzahl,
  filter,
  onFilter,
}: {
  label: string
  kennzahl: ScreenerKennzahl
  filter: ScreenerFilter
  onFilter: (f: ScreenerFilter) => void
}) {
  const sp = filter.spannen[kennzahl] ?? {}
  return (
    <label className="block text-[11px] text-[var(--app-text-muted)]">
      {label}
      <div className="mt-1 grid grid-cols-2 gap-1">
        <ZahlInput value={sp.min} placeholder="min" onChange={(min) => onFilter(setzeSpanne(filter, kennzahl, { min }))} />
        <ZahlInput value={sp.max} placeholder="max" onChange={(max) => onFilter(setzeSpanne(filter, kennzahl, { max }))} />
      </div>
    </label>
  )
}

function FilterGruppe({ titel, defaultOpen, children }: { titel: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details defaultOpen={defaultOpen} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)]/35 px-3 py-2">
      <summary className="cursor-pointer select-none text-xs font-medium text-[var(--app-text)]">{titel}</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </details>
  )
}

export function PortfolioScreenerClient() {
  const [zeilen, setZeilen] = useState<ScreenerZeile[]>([])
  const [periode, setPeriode] = useState<string | null>(null)
  const [aktualisiertAm, setAktualisiertAm] = useState<string | null>(null)
  const [schemaVersion, setSchemaVersion] = useState(1)
  const [laden, setLaden] = useState(true)
  const [erneuern, setErneuern] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [filter, setFilter] = useState<ScreenerFilter>(() => qualityCompounderFilter())
  const [aktiveVorlageId, setAktiveVorlageId] = useState<string | null>('quality-compounder')
  const [eigen, setEigen] = useState<ScreenerEigeneVorlage[]>([])
  const [saveName, setSaveName] = useState('')
  const [spalten, setSpalten] = useState<Set<SpalteId>>(() => new Set(SPALTEN.filter((s) => s.defaultOn || s.immer).map((s) => s.id)))
  const [watchKeys, setWatchKeys] = useState<Set<string>>(new Set())

  const uebernehme = useCallback((j: ApiAntwort) => {
    setZeilen(j.zeilen ?? [])
    setPeriode(j.periode ?? null)
    setAktualisiertAm(j.aktualisiertAm ?? null)
    setSchemaVersion(j.schemaVersion ?? 1)
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
    setSpalten(leseSpalten())
  }, [])

  useEffect(() => {
    const sync = () => {
      setWatchKeys(new Set(ladeWatchlist().map((e) => e.symbolYahoo?.trim().toUpperCase()).filter(Boolean) as string[]))
    }
    sync()
    window.addEventListener(WATCHLIST_CHANGED_EVENT, sync)
    return () => window.removeEventListener(WATCHLIST_CHANGED_EVENT, sync)
  }, [])

  useEffect(() => {
    const sync = () => setEigen(leseScreenerVorlagen())
    sync()
    window.addEventListener(SCREENER_VORLAGEN_EVENT, sync)
    const onApplied = (e: Event) => {
      const key = (e as CustomEvent<{ schluessel?: string }>).detail?.schluessel
      if (key === CLIENT_STATE_KEYS.screenerVorlagen) sync()
    }
    window.addEventListener(CLIENT_STATE_APPLIED_EVENT, onApplied)
    return () => {
      window.removeEventListener(SCREENER_VORLAGEN_EVENT, sync)
      window.removeEventListener(CLIENT_STATE_APPLIED_EVENT, onApplied)
    }
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

  const vorlageAktiv = useMemo(() => {
    if (!aktiveVorlageId) return null
    return (
      SCREENER_EINGEBAUTE_VORLAGEN.find((v) => v.id === aktiveVorlageId) ??
      eigen.find((v) => v.id === aktiveVorlageId) ??
      null
    )
  }, [aktiveVorlageId, eigen])

  const angepasst = Boolean(vorlageAktiv && !gleichOhneSuche(filter, vorlageAktiv.filter))

  const gefiltert = useMemo(() => {
    const hit = zeilen.filter((z) => passtScreenerFilter(z, filter))
    return sortiereScreenerZeilen(hit, filter.sort, filter.sortAsc)
  }, [zeilen, filter])

  const sichtbar = gefiltert.slice(0, 250)
  const sichtbareSpalten = SPALTEN.filter((s) => spalten.has(s.id) || s.immer)

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

  const wendeVorlageAn = useCallback((id: string, vorlagenFilter: ScreenerFilter) => {
    setAktiveVorlageId(id)
    setFilter(kloneFilter({ ...vorlagenFilter, suche: filter.suche }))
  }, [filter.suche])

  const toggleSpalte = useCallback((id: SpalteId) => {
    setSpalten((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      for (const s of SPALTEN) if (s.immer) next.add(s.id)
      try {
        window.localStorage.setItem(SPALTEN_KEY, JSON.stringify([...next]))
      } catch {
        /* quota */
      }
      return next
    })
  }, [])

  const exportCsv = useCallback(() => {
    const kopf = ['Ticker', 'Name', 'Börse', 'Jahre', 'Umsatz Mio', 'CAGR 5J', 'ROIC', 'FCF-Marge', 'FCF/NI', 'Verw.', 'ND/EBITDA', 'KGV', 'KUV', 'Mantra']
    const zeilenCsv = gefiltert.map((z) =>
      [
        z.ticker,
        z.name,
        z.boerse,
        z.jahreAnzahl,
        z.umsatzMio,
        z.umsatzCagr5y,
        z.roicPct,
        z.fcfMargePct,
        z.fcfConversionPct,
        z.aktienVerwaesserungJaehrlichPct,
        z.netDebtEbitda,
        z.kgv,
        z.kuv,
        zaehleMantraTreffer(z),
      ]
        .map(csvZelle)
        .join(';'),
    )
    const blob = new Blob([[kopf.join(';'), ...zeilenCsv].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `screener-${periode ?? 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [gefiltert, periode])

  const speichern = useCallback(() => {
    const name = saveName.trim() || vorlageAktiv?.name || 'Meine Vorlage'
    const liste = speichereScreenerVorlage(name, kloneFilter(filter))
    setEigen(liste)
    const neu = liste[0]
    if (neu) {
      setAktiveVorlageId(neu.id)
      setSaveName('')
    }
  }, [filter, saveName, vorlageAktiv?.name])

  const ueberschreiben = useCallback(() => {
    if (!aktiveVorlageId || SCREENER_EINGEBAUTE_VORLAGEN.some((v) => v.id === aktiveVorlageId)) return
    const name = saveName.trim() || eigen.find((v) => v.id === aktiveVorlageId)?.name || 'Meine Vorlage'
    setEigen(speichereScreenerVorlage(name, kloneFilter(filter), aktiveVorlageId))
    setSaveName('')
  }, [aktiveVorlageId, eigen, filter, saveName])

  const stand = aktualisiertAm
    ? new Date(aktualisiertAm).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
    : null
  const schemaAlt = zeilen.length > 0 && schemaVersion < SCREENER_SCHEMA_VERSION
  const eigeneAktiv = Boolean(aktiveVorlageId && eigen.some((v) => v.id === aktiveVorlageId))

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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={gefiltert.length === 0}
              className="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-text)] disabled:opacity-50"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={() => void baueUniversum()}
              disabled={erneuern}
              className="rounded-md border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-500/30 disabled:opacity-50"
            >
              {erneuern ? 'Lade SEC-Universum …' : zeilen.length > 0 ? 'Universum neu aufbauen' : 'Universum laden'}
            </button>
          </div>
        </div>

        {schemaAlt ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Das Universum ist noch ohne ROIC, FCF-Conversion und Verschuldung. Bitte einmal „Universum neu aufbauen“ —
            oder den Wochen-Cron abwarten.
          </p>
        ) : null}

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">Eingebaute Vorlagen</p>
          <div className="flex flex-wrap gap-1.5">
            {SCREENER_EINGEBAUTE_VORLAGEN.map((v) => {
              const an = aktiveVorlageId === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  title={v.hinweis}
                  onClick={() => wendeVorlageAn(v.id, v.filter)}
                  className={`${CHIP} ${an ? (angepasst ? CHIP_TWEAK : CHIP_AN) : CHIP_AUS}`}
                >
                  {v.name}
                  {an && angepasst ? ' · angepasst' : ''}
                </button>
              )
            })}
          </div>
          {eigen.length > 0 ? (
            <>
              <p className="pt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">Eigene</p>
              <div className="flex flex-wrap gap-1.5">
                {eigen.map((v) => {
                  const an = aktiveVorlageId === v.id
                  return (
                    <span key={v.id} className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => wendeVorlageAn(v.id, v.filter)}
                        className={`${CHIP} ${an ? (angepasst ? CHIP_TWEAK : CHIP_AN) : CHIP_AUS}`}
                      >
                        {v.name}
                        {an && angepasst ? ' · angepasst' : ''}
                      </button>
                      <button
                        type="button"
                        aria-label={`${v.name} löschen`}
                        onClick={() => {
                          setEigen(loescheScreenerVorlage(v.id))
                          if (aktiveVorlageId === v.id) setAktiveVorlageId(null)
                        }}
                        className="text-[11px] text-[var(--app-text-muted)] hover:text-rose-300"
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>
            </>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Name für eigene Vorlage"
              className={`${INPUT} max-w-xs`}
            />
            <button
              type="button"
              onClick={speichern}
              className="rounded-md border border-teal-500/40 bg-teal-500/15 px-3 py-1.5 text-xs text-teal-100"
            >
              Speichern
            </button>
            {eigeneAktiv ? (
              <button
                type="button"
                onClick={ueberschreiben}
                className="rounded-md border border-[var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-text)]"
              >
                Überschreiben
              </button>
            ) : null}
          </div>
          {vorlageAktiv && 'hinweis' in vorlageAktiv ? (
            <p className="text-[11px] leading-relaxed text-[var(--app-text-muted)]">{vorlageAktiv.hinweis}</p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <FilterGruppe titel="Universum" defaultOpen>
            <label className="block text-[11px] text-[var(--app-text-muted)]">
              Suche
              <input
                value={filter.suche}
                onChange={(e) => setFilter({ ...filter, suche: e.target.value })}
                placeholder="Ticker, Name, Sektor"
                className={`mt-1 ${INPUT}`}
              />
            </label>
            <label className="block text-[11px] text-[var(--app-text-muted)]">
              Börse
              <select
                value={filter.boerse}
                onChange={(e) => setFilter({ ...filter, boerse: e.target.value as ScreenerFilter['boerse'] })}
                className={`mt-1 ${INPUT}`}
              >
                <option value="alle">Nasdaq + NYSE + CBOE</option>
                <option value="Nasdaq">Nasdaq</option>
                <option value="NYSE">NYSE</option>
                <option value="CBOE">CBOE</option>
              </select>
            </label>
            <SpanneFeld label="Historie (Jahre)" kennzahl="jahreAnzahl" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="Umsatz (Mio $)" kennzahl="umsatzMio" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="Marktkap (Mio $)" kennzahl="marktkapMio" filter={filter} onFilter={setFilter} />
            <label className="flex items-center gap-2 text-xs text-[var(--app-text)]">
              <input
                type="checkbox"
                checked={filter.lueckenErlaubt}
                onChange={(e) => setFilter({ ...filter, lueckenErlaubt: e.target.checked })}
              />
              unvollständige Zeilen behalten
            </label>
          </FilterGruppe>

          <FilterGruppe titel="Profitabilität" defaultOpen>
            <SpanneFeld label="ROE %" kennzahl="roePct" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="ROIC %" kennzahl="roicPct" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="EBIT-Marge %" kennzahl="ebitMargePct" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="NI-Marge %" kennzahl="niMargePct" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="FCF-Marge %" kennzahl="fcfMargePct" filter={filter} onFilter={setFilter} />
            <label className="flex items-center gap-2 text-xs text-[var(--app-text)]">
              <input
                type="checkbox"
                checked={filter.nurGewinn}
                onChange={(e) => setFilter({ ...filter, nurGewinn: e.target.checked })}
              />
              nur Gewinn
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--app-text)]">
              <input
                type="checkbox"
                checked={filter.fcfPositiv}
                onChange={(e) => setFilter({ ...filter, fcfPositiv: e.target.checked })}
              />
              FCF &gt; 0
            </label>
          </FilterGruppe>

          <FilterGruppe titel="Wachstum">
            <SpanneFeld label="Umsatz 1J %" kennzahl="umsatzWachstumPct" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="CAGR 3J %" kennzahl="umsatzCagr3y" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="CAGR 5J %" kennzahl="umsatzCagr5y" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="CAGR 10J %" kennzahl="umsatzCagr10y" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="EPS-CAGR 5J %" kennzahl="epsCagr5y" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="FCF-CAGR 5J %" kennzahl="fcfCagr5y" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="Rule of 40" kennzahl="ruleOf40" filter={filter} onFilter={setFilter} />
          </FilterGruppe>

          <FilterGruppe titel="Cash & Kapital">
            <SpanneFeld label="FCF-Conversion %" kennzahl="fcfConversionPct" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="CapEx/Umsatz %" kennzahl="capexSalesPct" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="Verwässerung p.a. %" kennzahl="aktienVerwaesserungJaehrlichPct" filter={filter} onFilter={setFilter} />
            <label className="flex items-center gap-2 text-xs text-[var(--app-text)]">
              <input
                type="checkbox"
                checked={filter.aktienSinkend}
                onChange={(e) => setFilter({ ...filter, aktienSinkend: e.target.checked })}
              />
              nur sinkende Aktienzahl
            </label>
            {filter.conversionOderRo40 ? (
              <p className="sm:col-span-2 text-[11px] text-teal-200/80">
                ODER-Regel: Conversion ≥ {filter.conversionOderRo40.conversionMin} % oder Rule of 40 ≥{' '}
                {filter.conversionOderRo40.ruleOf40Min}
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => setFilter({ ...filter, conversionOderRo40: null })}
                >
                  entfernen
                </button>
              </p>
            ) : null}
          </FilterGruppe>

          <FilterGruppe titel="Bilanz">
            <SpanneFeld label="Net Debt/EBITDA" kennzahl="netDebtEbitda" filter={filter} onFilter={setFilter} />
            <label className="flex items-center gap-2 text-xs text-[var(--app-text)]">
              <input
                type="checkbox"
                checked={filter.ekPositiv}
                onChange={(e) => setFilter({ ...filter, ekPositiv: e.target.checked })}
              />
              Eigenkapital &gt; 0
            </label>
          </FilterGruppe>

          <FilterGruppe titel="Bewertung">
            <SpanneFeld label="KGV" kennzahl="kgv" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="KUV" kennzahl="kuv" filter={filter} onFilter={setFilter} />
            <SpanneFeld label="KBV" kennzahl="kbv" filter={filter} onFilter={setFilter} />
          </FilterGruppe>
        </div>

        <details className="text-xs text-[var(--app-text-muted)]">
          <summary className="cursor-pointer">Spalten</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {SPALTEN.filter((s) => !s.immer).map((s) => (
              <label key={s.id} className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={spalten.has(s.id)} onChange={() => toggleSpalte(s.id)} />
                {s.label}
              </label>
            ))}
          </div>
        </details>

        {fehler ? <p className="text-sm text-rose-300">{fehler}</p> : null}
        {laden ? <p className="text-sm text-[var(--app-text-muted)]">Lade Snapshot …</p> : null}

        <div className={`${PA_TABLE_FRAME} ${PA_SCROLL_ELEGANT}`}>
          <div className={appTableScrollClassName}>
            <table className={PA_TABLE_COMPACT}>
              <thead>
                <tr>
                  {sichtbareSpalten.map((s) => (
                    <th key={s.id} className={s.id === 'ticker' || s.id === 'name' ? '' : 'text-right'}>
                      {s.sort ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (filter.sort === s.sort) setFilter({ ...filter, sortAsc: !filter.sortAsc })
                            else {
                              setFilter({
                                ...filter,
                                sort: s.sort!,
                                sortAsc: sortierungIstAufsteigendDefault(s.sort!),
                              })
                            }
                          }}
                          className="hover:text-teal-200"
                        >
                          {s.label || '·'}
                          {filter.sort === s.sort ? (filter.sortAsc ? ' ↑' : ' ↓') : ''}
                        </button>
                      ) : (
                        s.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sichtbar.map((z) => {
                  const mantra = zaehleMantraTreffer(z)
                  const zellen: Record<SpalteId, ReactNode> = {
                    ticker: (
                      <Link
                        href={fundamentaldatenHref({ symbol: z.ticker })}
                        className="font-semibold text-teal-300 hover:underline"
                      >
                        {z.ticker}
                      </Link>
                    ),
                    name: (
                      <span className="block max-w-[14rem] truncate text-[var(--app-text)]" title={z.name}>
                        {z.name}
                      </span>
                    ),
                    boerse: <span className="text-[var(--app-text-muted)]">{z.boerse}</span>,
                    jahre: (
                      <span className="text-[var(--app-text-muted)]">
                        {z.jahreAnzahl}
                        {z.vonJahr && z.bisJahr ? (
                          <span className="ml-1 text-[10px]">
                            {z.vonJahr}–{z.bisJahr}
                          </span>
                        ) : null}
                      </span>
                    ),
                    umsatz: fmtMio(z.umsatzMio),
                    cagr5: <span className={pctTon(z.umsatzCagr5y)}>{fmtPct(z.umsatzCagr5y)}</span>,
                    wachstum: <span className={pctTon(z.umsatzWachstumPct)}>{fmtPct(z.umsatzWachstumPct)}</span>,
                    niMarge: <span className={pctTon(z.niMargePct)}>{fmtPct(z.niMargePct)}</span>,
                    roe: <span className={pctTon(z.roePct)}>{fmtPct(z.roePct)}</span>,
                    roic: <span className={pctTon(z.roicPct)}>{fmtPct(z.roicPct)}</span>,
                    fcfMarge: <span className={pctTon(z.fcfMargePct)}>{fmtPct(z.fcfMargePct)}</span>,
                    conv: fmtPct(z.fcfConversionPct),
                    verw: <span className={pctTon(z.aktienVerwaesserungJaehrlichPct != null ? -z.aktienVerwaesserungJaehrlichPct : null)}>{fmtPct(z.aktienVerwaesserungJaehrlichPct)}</span>,
                    ndEbitda: fmtZahl(z.netDebtEbitda, 2),
                    kgv: fmtZahl(z.kgv),
                    kuv: fmtZahl(z.kuv),
                    kbv: fmtZahl(z.kbv),
                    mantra: (
                      <span title="ROIC, Conversion/Ro40, ND/EBITDA, Verwässerung, FCF-Marge">
                        {mantra}/5
                      </span>
                    ),
                    kurs: fmtZahl(z.kurs, 2),
                    watch: (
                      <button
                        type="button"
                        disabled={watchKeys.has(z.ticker)}
                        onClick={() => merke(z)}
                        className="text-[11px] text-amber-200/90 hover:underline disabled:text-[var(--app-text-muted)]"
                      >
                        {watchKeys.has(z.ticker) ? 'gemerkt' : 'Watchlist'}
                      </button>
                    ),
                  }
                  return (
                    <tr key={`${z.cik}-${z.ticker}`}>
                      {sichtbareSpalten.map((s) => (
                        <td
                          key={s.id}
                          className={s.id === 'ticker' || s.id === 'name' || s.id === 'boerse' ? '' : 'text-right tabular-nums'}
                        >
                          {zellen[s.id]}
                        </td>
                      ))}
                    </tr>
                  )
                })}
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
          GuV/Bilanz: SEC EDGAR Frames, Kalenderjahre ab 2009 soweit gemeldet. ROIC brutto (EK + Schulden, ohne Cash-Abzug).
          Kurs und Multiples: Yahoo Finance. Mantra-Spalte zählt fünf quantitative Punkte (ROIC, Conversion oder Rule of 40,
          ND/EBITDA, Verwässerung, FCF-Marge). LTV/CAC und NRR fehlen im Snapshot — Moat bleibt auf der Titelseite.
        </p>
      </PaCard>
    </PortfolioAnalyseShell>
  )
}
