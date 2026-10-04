'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PaAktienSucheInput, type AktienSucheAuswahl } from '@/components/portfolio-analyse/pa-aktien-suche-input'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import {
  PaBadge,
  PaCard,
  PaHeroKpi,
  PaSectionTitle,
  PaStatRow,
  PA_TABLE_COMPACT,
  PA_TABLE_FRAME,
} from '@/components/portfolio-analyse/pa-ui'
import { appTableScrollClassName } from '@/components/page-shell'
import { berechneDcf, reverseDcfWachstum, sensitivitaetsMatrix } from '@/lib/portfolio-analyse/dcf/dcf-engine'
import {
  annahmenAusPaketInputs,
  dcfInputsAusPaket,
  defaultExitMultipleFuerPaket,
} from '@/lib/portfolio-analyse/dcf/dcf-inputs-aus-paket'
import { DCF_SZENARIO_LABELS, szenarioAnnahmen } from '@/lib/portfolio-analyse/dcf/dcf-szenarien'
import type { DcfAnnahmen, DcfPaketInputs, DcfSzenarioId } from '@/lib/portfolio-analyse/dcf/dcf-types'
import {
  ladeFundamentaldatenAusLocalCache,
  ladeFundamentaldatenClient,
} from '@/lib/portfolio-analyse/fundamentaldaten-client'
import { formatFundamentalWert } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import {
  dcfHref,
  type FundamentalKandidat,
} from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import type { FundamentaldatenAnfrage, FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import {
  ladeWatchlist,
  WATCHLIST_CHANGED_EVENT,
} from '@/lib/portfolio-analyse/watchlist-client'

function fmtUsd(v: number | null | undefined, einheit: 'waehrung_usd' | 'waehrung_usd_aktie' = 'waehrung_usd') {
  return formatFundamentalWert(v, einheit)
}

function fmtPct(v: number | null | undefined, digits = 1) {
  if (v == null || !Number.isFinite(v)) return '–'
  return `${v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`
}

function AssumptionRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2 border-b border-[var(--app-border)]/60 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-center sm:gap-4">
      <div className="min-w-0">
        <p className="text-[13px] text-[var(--app-text)]">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--app-text-muted)]">{hint}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function NumSlider({
  value,
  onChange,
  min,
  max,
  step,
  suffix = '%',
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  suffix?: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        className="min-w-0 flex-1 accent-amber-500 disabled:opacity-40"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        type="number"
        className="w-[5.5rem] rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1 text-right text-sm tabular-nums text-[var(--app-text)] disabled:opacity-40"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-6 text-[11px] text-[var(--app-text-muted)]">{suffix}</span>
    </div>
  )
}

function matrixCellClass(upsidePct: number | null, isBase: boolean): string {
  if (isBase) return 'bg-amber-500/25 text-amber-50 ring-1 ring-inset ring-amber-400/50'
  if (upsidePct == null) return 'bg-[var(--app-surface-muted)]/40 text-[var(--app-text-muted)]'
  if (upsidePct >= 15) return 'bg-emerald-500/35 text-emerald-50'
  if (upsidePct >= 0) return 'bg-emerald-500/18 text-emerald-100'
  if (upsidePct > -15) return 'bg-rose-500/18 text-rose-100'
  return 'bg-rose-500/35 text-rose-50'
}

export function PortfolioDcfClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isinParam = searchParams.get('isin')
  const symbolParam = searchParams.get('symbol')
  const nameParam = searchParams.get('name')
  const { live, meta } = usePortfolioAnalyse()

  const [paket, setPaket] = useState<FundamentaldatenPaket | null>(null)
  const [inputs, setInputs] = useState<DcfPaketInputs | null>(null)
  const [baseAnnahmen, setBaseAnnahmen] = useState<DcfAnnahmen | null>(null)
  const [annahmen, setAnnahmen] = useState<DcfAnnahmen | null>(null)
  const [szenario, setSzenario] = useState<DcfSzenarioId>('base')
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [sucheFehler, setSucheFehler] = useState<string | null>(null)
  const [detailsOffen, setDetailsOffen] = useState(false)
  const [waccDetailsOffen, setWaccDetailsOffen] = useState(false)
  const [watchlistVersion, setWatchlistVersion] = useState(0)

  useEffect(() => {
    const bump = () => setWatchlistVersion((v) => v + 1)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pa-watchlist-v1') bump()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(WATCHLIST_CHANGED_EVENT, bump)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(WATCHLIST_CHANGED_EVENT, bump)
    }
  }, [])

  const kandidaten = useMemo<FundamentalKandidat[]>(() => {
    const depotIsins = new Set<string>()
    const depot: FundamentalKandidat[] = (live?.positionen ?? [])
      .filter((p) => p.stueck > 0 && p.assetKlasse === 'aktie')
      .map((p) => {
        const isinRaw = p.isin?.trim().toUpperCase() ?? ''
        if (isinRaw) depotIsins.add(isinRaw)
        const k = isinRaw ? isinKenntnis(isinRaw) : undefined
        const m = isinRaw ? meta.get(isinRaw) : undefined
        return {
          isin: isinRaw || null,
          name: p.name ?? k?.name ?? m?.name ?? 'Unbekannt',
          symbolYahoo: p.symbolYahoo ?? k?.symbolYahoo ?? m?.symbolYahoo ?? null,
          symbolCandidates: [...(k?.symbolCandidates ?? []), ...(m?.symbolYahoo ? [m.symbolYahoo] : [])],
          quelle: 'depot' as const,
        }
      })

    void watchlistVersion
    const watchlist: FundamentalKandidat[] = ladeWatchlist()
      .filter((w) => !w.isin || !depotIsins.has(w.isin.toUpperCase()))
      .map((w) => ({
        isin: w.isin,
        name: w.name,
        symbolYahoo: w.symbolYahoo,
        symbolCandidates: w.symbolCandidates,
        quelle: 'watchlist' as const,
      }))

    return [...depot, ...watchlist]
  }, [live?.positionen, meta, watchlistVersion])

  const isin = isinParam?.trim().toUpperCase() || null
  const symbol = symbolParam?.trim() || null
  const name = nameParam?.trim() || null
  const hatTitel = Boolean(isin || symbol)
  /** Stabile Auswahl-ID — steuert Laden/Reset beim Titelwechsel. */
  const selectionKey = `${isin ?? ''}|${(symbol ?? '').toUpperCase()}`

  const resetTitelState = useCallback(() => {
    setPaket(null)
    setInputs(null)
    setBaseAnnahmen(null)
    setAnnahmen(null)
    setSzenario('base')
    setFehler(null)
    setDetailsOffen(false)
    setWaccDetailsOffen(false)
  }, [])

  const navigiereZu = useCallback(
    (opts: { isin?: string | null; symbol?: string | null; name?: string | null }) => {
      const nextIsin = opts.isin?.trim().toUpperCase() || null
      const nextSymbol = opts.symbol?.trim() || null
      if (!nextIsin && !nextSymbol) {
        setSucheFehler('Kein Ticker für diesen Treffer.')
        return
      }
      const nextKey = `${nextIsin ?? ''}|${(nextSymbol ?? '').toUpperCase()}`
      if (nextKey === selectionKey) {
        setSucheFehler(null)
        return
      }
      setSucheFehler(null)
      // Sofort leeren — sonst bleibt der alte Titel sichtbar / „klebt“.
      resetTitelState()
      setLaden(true)
      router.push(dcfHref({ isin: nextIsin, symbol: nextSymbol, name: opts.name }))
    },
    [router, selectionKey, resetTitelState],
  )

  const onSucheAuswahl = useCallback(
    (a: AktienSucheAuswahl) => {
      navigiereZu({
        isin: a.isin,
        symbol: a.meta.symbolYahoo ?? a.meta.symbolCandidates?.[0] ?? null,
        name: a.meta.name,
      })
    },
    [navigiereZu],
  )

  const anfrage = useMemo<FundamentaldatenAnfrage | null>(() => {
    if (!hatTitel) return null
    const k = isin ? isinKenntnis(isin) : undefined
    const symbolYahoo = symbol || k?.symbolYahoo || null
    return {
      isin,
      name: name || k?.name || symbolYahoo || isin || undefined,
      symbolYahoo,
      symbolCandidates: [
        ...(symbolYahoo ? [symbolYahoo] : []),
        ...(symbol && symbol !== symbolYahoo ? [symbol] : []),
        ...(k?.symbolCandidates ?? []),
      ],
      frequenz: 'jahr',
    }
  }, [hatTitel, isin, symbol, name])

  useEffect(() => {
    if (!anfrage || !hatTitel) {
      resetTitelState()
      setLaden(false)
      return
    }

    let cancelled = false
    const ac = new AbortController()
    const req = anfrage
    const erwartetKey = selectionKey

    function applyPaket(p: FundamentaldatenPaket) {
      if (cancelled) return
      const inp = dcfInputsAusPaket(p)
      const exitMultiple = defaultExitMultipleFuerPaket(p)
      const base = annahmenAusPaketInputs(inp, { exitMultiple })
      setPaket(p)
      setInputs(inp)
      setBaseAnnahmen(base)
      setAnnahmen(base)
      setSzenario('base')
      setFehler(
        base
          ? null
          : inp.fcf0Usd == null || !(inp.fcf0Usd > 0)
            ? 'Kein positiver Reported FCF im Paket — DCF nicht möglich.'
            : 'Keine gültige Aktienanzahl — DCF nicht möglich.',
      )
    }

    async function run() {
      setLaden(true)
      setFehler(null)
      const cached = ladeFundamentaldatenAusLocalCache(req)
      if (cached?.ok && !cancelled) {
        applyPaket(cached)
      }
      try {
        const live = await ladeFundamentaldatenClient(req, { signal: ac.signal })
        if (cancelled) return
        applyPaket(live)
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return
        setFehler(e instanceof Error ? e.message : 'Laden fehlgeschlagen.')
        // Alten Titel nicht stehen lassen, wenn der neue Fetch scheitert.
        if (!cached?.ok) resetTitelState()
      } finally {
        if (!cancelled && erwartetKey === `${isin ?? ''}|${(symbol ?? '').toUpperCase()}`) {
          setLaden(false)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [selectionKey, anfrage, hatTitel, isin, symbol, resetTitelState])

  const patchAnnahmen = useCallback((patch: Partial<DcfAnnahmen>) => {
    setAnnahmen((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const waehleSzenario = useCallback(
    (id: DcfSzenarioId) => {
      if (!baseAnnahmen) return
      setSzenario(id)
      setAnnahmen(szenarioAnnahmen(baseAnnahmen, id))
    },
    [baseAnnahmen],
  )

  const ergebnis = useMemo(() => (annahmen ? berechneDcf(annahmen) : null), [annahmen])
  const matrix = useMemo(() => (annahmen ? sensitivitaetsMatrix(annahmen) : null), [annahmen])
  const reverse = useMemo(() => (annahmen ? reverseDcfWachstum(annahmen) : null), [annahmen])

  const titelName = inputs?.name || paket?.firmenname || nameParam || symbolParam || 'DCF-Rechner'

  const depotAnzahl = kandidaten.filter((k) => k.quelle === 'depot').length
  const watchlistAnzahl = kandidaten.filter((k) => k.quelle === 'watchlist').length
  const selectValue = useMemo(() => {
    if (!hatTitel) return ''
    const idx = kandidaten.findIndex(
      (k) =>
        (isin && k.isin === isin) ||
        (symbol && k.symbolYahoo?.toUpperCase() === symbol.toUpperCase()),
    )
    return idx >= 0 ? String(idx) : ''
  }, [kandidaten, hatTitel, isin, symbol])

  return (
    <PortfolioAnalyseShell
      title="DCF-Rechner"
      description="Intrinsic Value aus Free Cashflows — Annahmen, Szenarien, Sensitivität."
      ohneDepotErlaubt
    >
      <div className="space-y-6">
        {/* overflow-visible: Such-Dropdown darf aus der Card ragen (app-section-shell clippt sonst) */}
        <PaCard className="!overflow-visible px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--app-text-muted)]">
                Aktie suchen
              </p>
              <PaAktienSucheInput
                kompakt
                fehler={sucheFehler}
                onFehler={setSucheFehler}
                placeholder="Ticker, Name oder ISIN…"
                onAuswahl={onSucheAuswahl}
              />
            </div>
            {kandidaten.length > 0 ? (
              <div className="min-w-0">
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[var(--app-text-muted)]">
                  Oder aus Depot / Watchlist
                </label>
                <select
                  value={selectValue}
                  onChange={(e) => {
                    const idx = Number(e.target.value)
                    const k = kandidaten[idx]
                    if (!k) return
                    navigiereZu({ isin: k.isin, symbol: k.symbolYahoo, name: k.name })
                  }}
                  className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)]"
                >
                  <option value="">Aktie wählen…</option>
                  {depotAnzahl > 0 ? (
                    <optgroup label="Depot">
                      {kandidaten
                        .map((p, i) => ({ p, i }))
                        .filter(({ p }) => p.quelle === 'depot')
                        .map(({ p, i }) => (
                          <option key={`depot-${p.isin ?? p.name}-${i}`} value={i}>
                            {p.name}
                            {p.symbolYahoo ? ` (${p.symbolYahoo})` : ''}
                          </option>
                        ))}
                    </optgroup>
                  ) : null}
                  {watchlistAnzahl > 0 ? (
                    <optgroup label="Watchlist">
                      {kandidaten
                        .map((p, i) => ({ p, i }))
                        .filter(({ p }) => p.quelle === 'watchlist')
                        .map(({ p, i }) => (
                          <option key={`watch-${p.isin ?? p.name}-${i}`} value={i}>
                            {p.name}
                            {p.symbolYahoo ? ` (${p.symbolYahoo})` : ''}
                          </option>
                        ))}
                    </optgroup>
                  ) : null}
                </select>
              </div>
            ) : null}
            {hatTitel ? (
              <p className="text-sm text-[var(--app-text-muted)]">
                {laden ? 'Lade Fundamentaldaten…' : titelName}
                {inputs?.ticker ? (
                  <span className="ml-2 tabular-nums text-[var(--app-text)]">{inputs.ticker}</span>
                ) : null}
              </p>
            ) : null}
          </div>
        </PaCard>

        {!hatTitel ? (
          <PaCard className="px-6 py-12 text-center sm:px-10">
            <p className="text-lg font-semibold tracking-tight text-[var(--app-text)]">Aktie wählen</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--app-text-muted)]">
              Suche nach Ticker/Name/ISIN oder wähle eine Position aus Depot bzw. Watchlist. Kein Portfolio-Import
              nötig.
            </p>
          </PaCard>
        ) : null}

        {fehler && hatTitel ? (
          <PaCard className="px-4 py-3 text-sm text-rose-300 sm:px-6">{fehler}</PaCard>
        ) : null}

        {annahmen && ergebnis && inputs ? (
          <div key={selectionKey} className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <PaHeroKpi
                label="Fair Value / Aktie"
                value={ergebnis.ok ? fmtUsd(ergebnis.fairValuePerShare, 'waehrung_usd_aktie') : '–'}
                sub={
                  ergebnis.ok
                    ? `Buy-Price (MoS ${fmtPct(annahmen.mosPct, 0)}): ${fmtUsd(ergebnis.buyPricePerShare, 'waehrung_usd_aktie')}`
                    : ergebnis.fehler
                }
                trend={
                  ergebnis.ok && ergebnis.upsidePct != null ? (
                    <PaBadge variant={ergebnis.upsidePct >= 0 ? 'positive' : 'negative'}>
                      {ergebnis.upsidePct >= 0 ? '+' : ''}
                      {fmtPct(ergebnis.upsidePct)} vs. Kurs
                    </PaBadge>
                  ) : null
                }
              />
              <PaCard className="px-4 py-3 sm:px-5">
                <PaStatRow label="Aktueller Kurs" value={fmtUsd(annahmen.kursUsd, 'waehrung_usd_aktie')} />
                <PaStatRow
                  label="Reported FCF (Basis)"
                  value={fmtUsd(annahmen.fcf0Usd)}
                  sub={inputs.fcf0Quelle === 'ttm' ? 'TTM' : inputs.fcf0Quelle === 'gj' ? 'letztes GJ' : undefined}
                />
                <PaStatRow label="Net Debt" value={fmtUsd(annahmen.netDebtUsd)} />
                <PaStatRow label="WACC" value={fmtPct(annahmen.waccPct)} />
                <PaStatRow
                  label="Aktien (Start)"
                  value={
                    annahmen.sharesOutstanding >= 1_000_000
                      ? `${(annahmen.sharesOutstanding / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio.`
                      : annahmen.sharesOutstanding.toLocaleString('de-DE')
                  }
                />
              </PaCard>
            </div>

            <PaCard className="px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PaSectionTitle title="Szenario" description="Bear / Base / Bull relativ zu den Paket-Defaults." />
                <div className="inline-flex rounded-lg border border-[var(--app-border)] p-0.5">
                  {(['bear', 'base', 'bull'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => waehleSzenario(id)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        szenario === id
                          ? 'bg-amber-500/20 text-amber-100'
                          : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                      }`}
                    >
                      {DCF_SZENARIO_LABELS[id]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <AssumptionRow label="Prognosejahre" hint="High-Growth-Phase">
                  <div className="flex flex-wrap gap-2">
                    {[5, 7, 10].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => patchAnnahmen({ jahre: n })}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold tabular-nums ${
                          annahmen.jahre === n
                            ? 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/30'
                            : 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]'
                        }`}
                      >
                        {n}J
                      </button>
                    ))}
                  </div>
                </AssumptionRow>

                <AssumptionRow
                  label="FCF-Wachstum (Start)"
                  hint={`Quelle: ${
                    inputs.gStartQuelle === 'fcf_forecast'
                      ? 'FCF-Forecast (StockAnalysis, ggf. via Umsatz-Consensus ergänzt)'
                      : inputs.gStartQuelle === 'umsatz_consensus'
                        ? 'Umsatz-Consensus (Forward)'
                        : inputs.gStartQuelle === 'eps_consensus'
                          ? 'EPS-Consensus (Forward)'
                          : 'Fallback 10 %'
                  }`}
                >
                  <NumSlider
                    value={annahmen.gStartPct}
                    onChange={(v) => patchAnnahmen({ gStartPct: v })}
                    min={-5}
                    max={30}
                    step={0.5}
                  />
                </AssumptionRow>

                <AssumptionRow
                  label="Linearer Fade"
                  hint="g startet bei Wachstum Start und fällt linear auf Terminal-g."
                >
                  <button
                    type="button"
                    onClick={() => patchAnnahmen({ fade: !annahmen.fade })}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                      annahmen.fade
                        ? 'bg-emerald-500/20 text-emerald-100'
                        : 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]'
                    }`}
                  >
                    {annahmen.fade ? 'Fade an' : 'Fade aus'}
                  </button>
                </AssumptionRow>

                <AssumptionRow label="Terminalwachstum g" hint="Gordon Growth / Fade-Ziel">
                  <NumSlider
                    value={annahmen.gTerminalPct}
                    onChange={(v) => patchAnnahmen({ gTerminalPct: v })}
                    min={0}
                    max={5}
                    step={0.1}
                    disabled={annahmen.terminalMethode === 'exit_multiple' && !annahmen.fade}
                  />
                </AssumptionRow>

                <AssumptionRow label="WACC" hint="Override der CAPM-Schätzung">
                  <NumSlider
                    value={annahmen.waccPct}
                    onChange={(v) => patchAnnahmen({ waccPct: v })}
                    min={4}
                    max={16}
                    step={0.1}
                  />
                </AssumptionRow>

                <AssumptionRow label="Terminal-Methode">
                  <div className="inline-flex rounded-lg border border-[var(--app-border)] p-0.5">
                    {(
                      [
                        ['gordon', 'Gordon Growth'],
                        ['exit_multiple', 'Exit Multiple'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => patchAnnahmen({ terminalMethode: id })}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                          annahmen.terminalMethode === id
                            ? 'bg-amber-500/20 text-amber-100'
                            : 'text-[var(--app-text-muted)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </AssumptionRow>

                {annahmen.terminalMethode === 'exit_multiple' ? (
                  <AssumptionRow label="Exit Multiple" hint="TV = FCF_n × Multiple">
                    <NumSlider
                      value={annahmen.exitMultiple}
                      onChange={(v) => patchAnnahmen({ exitMultiple: v })}
                      min={5}
                      max={80}
                      step={0.5}
                      suffix="×"
                    />
                  </AssumptionRow>
                ) : null}

                <AssumptionRow label="Margin of Safety">
                  <NumSlider
                    value={annahmen.mosPct}
                    onChange={(v) => patchAnnahmen({ mosPct: v })}
                    min={0}
                    max={50}
                    step={1}
                  />
                </AssumptionRow>

                <AssumptionRow label="Share-Count CAGR" hint="Wirkt nur auf den Nenner (FV/Aktie)">
                  <NumSlider
                    value={annahmen.shareCagrPct}
                    onChange={(v) => patchAnnahmen({ shareCagrPct: v })}
                    min={-10}
                    max={10}
                    step={0.1}
                  />
                </AssumptionRow>

                <AssumptionRow label="Minorities / NCI" hint="Default 0 — manuell überschreiben">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-right text-sm tabular-nums"
                      step={1_000_000}
                      value={annahmen.minoritiesUsd}
                      onChange={(e) => patchAnnahmen({ minoritiesUsd: Number(e.target.value) || 0 })}
                    />
                    <span className="shrink-0 text-[11px] text-[var(--app-text-muted)]">USD</span>
                  </div>
                </AssumptionRow>

                <AssumptionRow label="Net Debt Override">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-right text-sm tabular-nums"
                      step={1_000_000}
                      value={annahmen.netDebtUsd}
                      onChange={(e) => patchAnnahmen({ netDebtUsd: Number(e.target.value) || 0 })}
                    />
                    <span className="shrink-0 text-[11px] text-[var(--app-text-muted)]">USD</span>
                  </div>
                </AssumptionRow>

                <AssumptionRow label="FCF-Basis Override">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1.5 text-right text-sm tabular-nums"
                      step={1_000_000}
                      value={annahmen.fcf0Usd}
                      onChange={(e) => patchAnnahmen({ fcf0Usd: Number(e.target.value) || 0 })}
                    />
                    <span className="shrink-0 text-[11px] text-[var(--app-text-muted)]">USD</span>
                  </div>
                </AssumptionRow>
              </div>

              <button
                type="button"
                className="mt-3 text-xs font-medium text-sky-300 hover:text-sky-200"
                onClick={() => setWaccDetailsOffen((v) => !v)}
              >
                {waccDetailsOffen ? 'WACC-Baustein ausblenden' : 'WACC-Baustein anzeigen'}
              </button>
              {waccDetailsOffen ? (
                <div className="mt-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)]/40 px-3 py-2 text-[12px] text-[var(--app-text-muted)]">
                  <p>
                    R<sub>e</sub> = {fmtPct(inputs.wacc.riskFreePct)} + β{' '}
                    {inputs.wacc.beta != null ? inputs.wacc.beta.toFixed(2) : '1,00'} ×{' '}
                    {fmtPct(inputs.wacc.equityRiskPremiumPct)} = {fmtPct(inputs.wacc.costEquityPct)}
                  </p>
                  <p className="mt-1">
                    R<sub>d</sub> = {fmtPct(inputs.wacc.costDebtPct)} · Tax = {fmtPct(inputs.wacc.taxRatePct)} · E/V ={' '}
                    {inputs.wacc.equityWeight != null ? fmtPct(inputs.wacc.equityWeight * 100) : '–'} · D/V ={' '}
                    {inputs.wacc.debtWeight != null ? fmtPct(inputs.wacc.debtWeight * 100) : '–'}
                  </p>
                  <p className="mt-1">
                    Geschätzter WACC = {fmtPct(inputs.wacc.waccPct)} (Override aktiv: {fmtPct(annahmen.waccPct)})
                  </p>
                </div>
              ) : null}
            </PaCard>

            <PaCard className="px-4 py-4 sm:px-6">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setDetailsOffen((v) => !v)}
              >
                <PaSectionTitle
                  title="Zwischenschritte"
                  description={
                    ergebnis.ok
                      ? `Σ PV(FCF) ${fmtUsd(ergebnis.summePvFcfUsd)} · PV(TV) ${fmtUsd(ergebnis.pvTerminalUsd)} · TV-Anteil ${fmtPct(ergebnis.tvAnteilPct)}`
                      : 'Berechnung fehlgeschlagen'
                  }
                />
                <span className="text-xs text-[var(--app-text-muted)]">{detailsOffen ? 'Zuklappen' : 'Aufklappen'}</span>
              </button>
              {detailsOffen && ergebnis.ok ? (
                <div className={`mt-4 ${PA_TABLE_FRAME} ${appTableScrollClassName}`}>
                  <table className={PA_TABLE_COMPACT}>
                    <thead>
                      <tr>
                        <th>Jahr</th>
                        <th className="text-right">g</th>
                        <th className="text-right">FCF</th>
                        <th className="text-right">PV(FCF)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ergebnis.jahre.map((z) => (
                        <tr key={z.jahr}>
                          <td className="tabular-nums">{z.jahr}</td>
                          <td className="text-right tabular-nums">{fmtPct(z.wachstumPct)}</td>
                          <td className="text-right tabular-nums">{fmtUsd(z.fcfUsd)}</td>
                          <td className="text-right tabular-nums">{fmtUsd(z.pvFcfUsd)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3} className="font-medium">
                          Terminal Value
                        </td>
                        <td className="text-right tabular-nums">{fmtUsd(ergebnis.terminalValueUsd)}</td>
                      </tr>
                      <tr>
                        <td colSpan={3}>PV(Terminal)</td>
                        <td className="text-right tabular-nums">{fmtUsd(ergebnis.pvTerminalUsd)}</td>
                      </tr>
                      <tr>
                        <td colSpan={3}>Enterprise Value</td>
                        <td className="text-right tabular-nums font-medium">{fmtUsd(ergebnis.enterpriseValueUsd)}</td>
                      </tr>
                      <tr>
                        <td colSpan={3}>− Net Debt − Minorities</td>
                        <td className="text-right tabular-nums">
                          {fmtUsd(-(annahmen.netDebtUsd + annahmen.minoritiesUsd))}
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3}>Equity Value</td>
                        <td className="text-right tabular-nums font-medium">{fmtUsd(ergebnis.equityValueUsd)}</td>
                      </tr>
                      <tr>
                        <td colSpan={3}>
                          Shares End ({(ergebnis.sharesEnd / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 2 })}{' '}
                          Mio.)
                        </td>
                        <td className="text-right tabular-nums">
                          {fmtUsd(ergebnis.fairValuePerShare, 'waehrung_usd_aktie')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : null}
            </PaCard>

            {matrix ? (
              <PaCard className="px-4 py-4 sm:px-6">
                <PaSectionTitle
                  title="Sensitivität"
                  description={
                    matrix.yIstExitMultiple
                      ? 'Zeilen: Exit Multiple · Spalten: WACC · Farbe vs. Kurs'
                      : 'Zeilen: Terminal-g · Spalten: WACC · Farbe vs. Kurs (grün = Unterbewertung)'
                  }
                />
                <div className={`mt-4 ${PA_TABLE_FRAME} ${appTableScrollClassName}`}>
                  <table className={PA_TABLE_COMPACT}>
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-[1] bg-[var(--app-surface)]">
                          {matrix.yIstExitMultiple ? 'Exit ×' : 'gTerm'}
                        </th>
                        {matrix.waccAchse.map((w) => (
                          <th key={w} className="text-right tabular-nums">
                            {fmtPct(w, 1)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.yAchse.map((y, yi) => (
                        <tr key={y}>
                          <td className="sticky left-0 z-[1] bg-[var(--app-surface)] tabular-nums font-medium">
                            {matrix.yIstExitMultiple ? `${y.toLocaleString('de-DE', { maximumFractionDigits: 1 })}×` : fmtPct(y)}
                          </td>
                          {matrix.zellen[yi]!.map((zelle) => {
                            const isBase =
                              Math.abs(zelle.waccPct - annahmen.waccPct) < 0.05 &&
                              (matrix.yIstExitMultiple
                                ? Math.abs(zelle.yPct - annahmen.exitMultiple) < 0.05
                                : Math.abs(zelle.yPct - annahmen.gTerminalPct) < 0.05)
                            return (
                              <td
                                key={`${y}-${zelle.waccPct}`}
                                className={`px-1.5 py-1.5 text-right tabular-nums ${matrixCellClass(zelle.upsidePct, isBase)}`}
                                title={
                                  zelle.fehler ??
                                  (zelle.fairValuePerShare != null
                                    ? `FV ${fmtUsd(zelle.fairValuePerShare, 'waehrung_usd_aktie')}`
                                    : undefined)
                                }
                              >
                                {zelle.fairValuePerShare != null
                                  ? zelle.fairValuePerShare.toLocaleString('de-DE', {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 0,
                                    })
                                  : '–'}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PaCard>
            ) : null}

            <PaCard className="px-4 py-4 sm:px-6">
              <PaSectionTitle
                title="Reverse DCF"
                description="Welches FCF-Wachstum (gStart) ist im aktuellen Kurs eingepreist?"
              />
              <div className="mt-3 flex flex-wrap items-end gap-6">
                <div>
                  <p className="text-[11px] text-[var(--app-text-muted)]">Implizites Wachstum</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[var(--app-text)]">
                    {reverse?.gStartPct != null ? fmtPct(reverse.gStartPct) : '–'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[var(--app-text-muted)]">Kontrolle FV @ impl. g</p>
                  <p className="mt-1 text-sm tabular-nums text-[var(--app-text-muted)]">
                    {reverse?.fairValuePerShare != null
                      ? fmtUsd(reverse.fairValuePerShare, 'waehrung_usd_aktie')
                      : reverse?.fehler ?? '–'}
                  </p>
                </div>
                {ergebnis.ok && ergebnis.upsidePct != null ? (
                  <p className="max-w-md text-[12px] leading-relaxed text-[var(--app-text-muted)]">
                    Base-Annahme {fmtPct(annahmen.gStartPct)} vs. Markt{' '}
                    {reverse?.gStartPct != null ? fmtPct(reverse.gStartPct) : '–'}. Fade und Terminal bleiben wie im
                    aktuellen Modell.
                  </p>
                ) : null}
              </div>
            </PaCard>
          </div>
        ) : null}
      </div>
    </PortfolioAnalyseShell>
  )
}
