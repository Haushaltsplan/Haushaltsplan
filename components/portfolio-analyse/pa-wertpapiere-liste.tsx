'use client'

import { appTableScrollClassName } from '@/components/page-shell'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  dividendenJeIsin,
  dividendenRenditeProzentParqet,
  kaufVolumenJeIsin,
} from '@/lib/portfolio-analyse/auswertungen'
import { formatDatumDe, formatEur, formatProzent, formatStueck, rundePositionStueck } from '@/lib/portfolio-analyse/berechnung'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import {
  erstelleManuelleBuchung,
  parseManuelleZahl,
  validiereManuelleBuchungInput,
} from '@/lib/portfolio-analyse/manuelle-buchung'
import { speicherePortfolioImport } from '@/lib/portfolio-analyse/portfolio-analyse-db'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import type { PositionPeriodPerf } from '@/lib/portfolio-analyse/position-period-performance'
import { spaltenLabelKursgewinn } from '@/lib/portfolio-analyse/position-period-performance'
import type { PeriodPerformance } from '@/lib/portfolio-analyse/parqet-core/types'
import type { AssetKlasse, PortfolioBuchung } from '@/lib/portfolio-analyse/types'

function assetZeileLabel(klasse: AssetKlasse): string {
  switch (klasse) {
    case 'etf':
      return 'ETF'
    case 'aktie':
      return 'Aktie'
    case 'anleihe':
      return 'Anleihe'
    case 'crypto':
      return 'Krypto'
    default:
      return 'Wertpapier'
  }
}

function formatKursKompakt(n: number): string {
  return `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
}

function heuteIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatGewinnEur(n: number): string {
  const s = formatEur(Math.abs(n))
  return n >= 0 ? `+${s}` : `−${s}`
}

function CopyIsinButton({ isin }: { isin: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      title="ISIN kopieren"
      onClick={(e) => {
        e.stopPropagation()
        void navigator.clipboard.writeText(isin).then(() => {
          setOk(true)
          setTimeout(() => setOk(false), 1500)
        })
      }}
      className="inline-flex text-[var(--app-text-muted)] hover:text-[var(--app-text-muted)]"
      aria-label="ISIN kopieren"
    >
      {ok ? (
        <span className="text-[10px] text-teal-500">✓</span>
      ) : (
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  )
}

function VerkaufsDialog({
  position,
  onClose,
  onSaved,
}: {
  position: LivePosition
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const [datum, setDatum] = useState(heuteIso())
  const [mengeStr, setMengeStr] = useState(formatStueck(position.stueck))
  const [kursStr, setKursStr] = useState(
    position.kursLiveEur != null && position.kursLiveEur > 0
      ? position.kursLiveEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
      : position.kursEur != null && position.kursEur > 0
        ? position.kursEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
        : '',
  )
  const [busy, setBusy] = useState(false)

  const menge = useMemo(() => parseManuelleZahl(mengeStr), [mengeStr])
  const kurs = useMemo(() => parseManuelleZahl(kursStr), [kursStr])
  const betrag = useMemo(() => {
    if (menge == null || kurs == null || menge <= 0 || kurs <= 0) return null
    return Math.round(menge * kurs * 100) / 100
  }, [menge, kurs])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function speichern(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (menge == null || menge <= 0) {
      toast.error('Bitte eine gültige Menge eingeben.')
      return
    }
    const mengeGerundet = rundePositionStueck(menge)
    if (mengeGerundet - position.stueck > 1e-8) {
      toast.error('Die Verkaufsmenge ist größer als der aktuelle Bestand.')
      return
    }
    if (kurs == null || kurs <= 0 || betrag == null || betrag <= 0) {
      toast.error('Bitte einen gültigen Kurs eingeben.')
      return
    }

    const input = {
      datum,
      typ: 'verkauf' as const,
      isin: position.isin,
      wertpapierName: position.anzeigeName || position.name,
      stueck: mengeGerundet,
      betragEur: betrag,
      kursEur: kurs,
      assetKlasse: position.assetKlasse,
    }
    const fehler = validiereManuelleBuchungInput(input)
    if (fehler) {
      toast.error(fehler)
      return
    }

    setBusy(true)
    try {
      const buchung = await erstelleManuelleBuchung(input)
      const res = await speicherePortfolioImport([buchung], [], null)
      if (!res.ok) {
        toast.error(res.message ?? 'Verkauf konnte nicht gespeichert werden.')
        return
      }
      if (res.hinweis) {
        toast(res.hinweis, { icon: '⚠️', duration: 12000 })
      }
      toast.success('Verkauf gebucht.')
      await onSaved()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Verkauf konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Verkauf buchen"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--app-text)]">Verkauf buchen</p>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">
              {position.anzeigeName} · Bestand {formatStueck(position.stueck)} Stk.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[var(--app-text-muted)] hover:bg-white/[0.04] hover:text-[var(--app-text)]"
            aria-label="Dialog schließen"
          >
            ×
          </button>
        </div>

        <form onSubmit={(e) => void speichern(e)} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[var(--app-text-muted)]">Menge</span>
              <input
                type="text"
                inputMode="decimal"
                value={mengeStr}
                onChange={(e) => setMengeStr(e.target.value)}
                className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)]"
                placeholder="z. B. 3"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[var(--app-text-muted)]">Datum</span>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)]"
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--app-text-muted)]">Kurs (EUR)</span>
            <input
              type="text"
              inputMode="decimal"
              value={kursStr}
              onChange={(e) => setKursStr(e.target.value)}
              className="w-full rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)]"
              placeholder="z. B. 17,89"
            />
          </label>

          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/40 px-3 py-2.5 text-xs text-[var(--app-text-muted)]">
            <p>ISIN: {position.isin ?? '—'}</p>
            <p className="mt-1">
              Erwarteter Verkaufserlös: <span className="font-medium text-[var(--app-text)]">{betrag != null ? formatEur(betrag) : '—'}</span>
            </p>
            <p className="mt-1">Gebühren oder Steuern kannst du bei Bedarf zusätzlich über den manuellen Import erfassen.</p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--app-border-strong)] px-4 py-2 text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg border border-amber-600/50 bg-amber-950/40 px-4 py-2 text-xs font-medium text-amber-100 hover:bg-amber-950/60 disabled:opacity-50"
            >
              {busy ? 'Speichert …' : 'Verkauf buchen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function WertpapierZeile({
  p,
  meta,
  dividendenEur,
  kaufVolumenEur,
  perf,
  onOeffnen,
  onVerkaufen,
}: {
  p: LivePosition
  meta: Map<string, IsinMetadata>
  dividendenEur: number
  kaufVolumenEur: number
  perf: PositionPeriodPerf
  onOeffnen?: () => void
  onVerkaufen?: (position: LivePosition) => void
}) {
  const isin = p.isin?.toUpperCase() ?? ''
  const kurs = p.kursLiveEur ?? p.kursEur
  const gv = perf.gewinnVerlustEur
  const gvPct = perf.gewinnVerlustProzent
  const positiv = gv >= 0
  const divPositiv = dividendenEur > 0
  const divPct = dividendenRenditeProzentParqet(dividendenEur, kaufVolumenEur, p.einstandEur)
  const [menuOffen, setMenuOffen] = useState(false)

  useEffect(() => {
    if (!menuOffen) return
    function onDocClick() {
      setMenuOffen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [menuOffen])

  return (
    <tr
      className={`border-b border-white/[0.04] last:border-0 ${onOeffnen ? 'cursor-pointer hover:bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}
      onClick={onOeffnen}
      onKeyDown={
        onOeffnen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOeffnen()
              }
            }
          : undefined
      }
      tabIndex={onOeffnen ? 0 : undefined}
      role={onOeffnen ? 'link' : undefined}
      aria-label={onOeffnen ? `${p.anzeigeName} — Fundamentaldaten öffnen` : undefined}
    >
      <td className="py-4 pl-4 pr-3 sm:pl-5">
        <div className="flex gap-3">
          <PortfolioIsinLogo isin={p.isin} fallbackName={p.name} meta={meta} groesse="md" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1 text-[11px] text-[var(--app-text-muted)]">
              <span>{assetZeileLabel(p.assetKlasse)}</span>
              {isin ? (
                <>
                  <span className="text-[var(--app-text-muted)]">·</span>
                  <span className="font-mono">{isin}</span>
                  <CopyIsinButton isin={isin} />
                </>
              ) : null}
              {p.wkn ? (
                <>
                  <span className="text-[var(--app-text-muted)]">·</span>
                  <span className="font-mono">{p.wkn}</span>
                </>
              ) : null}
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug text-[var(--app-text)]">{p.anzeigeName}</p>
          </div>
        </div>
      </td>
      <td className="hidden py-4 pr-4 text-right sm:table-cell">
        <p className="text-sm font-semibold tabular-nums text-[var(--app-text)]">{formatEur(p.wertLiveEur)}</p>
        {p.stueck > 0 && kurs != null && kurs > 0 ? (
          <p className="mt-0.5 text-[11px] tabular-nums text-[var(--app-text-muted)]">
            {formatStueck(p.stueck)} x {formatKursKompakt(kurs)}
          </p>
        ) : null}
      </td>
      <td className="hidden py-4 pr-4 text-right md:table-cell">
        {gvPct != null ? (
          <>
            <p className={`text-sm font-medium tabular-nums ${positiv ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatGewinnEur(gv)}
            </p>
            <p className={`mt-0.5 text-[11px] tabular-nums ${positiv ? 'text-emerald-400/90' : 'text-rose-400/90'}`}>
              {positiv ? '↑ ' : '↓ '}
              {formatProzent(gvPct)}
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--app-text-muted)]">—</p>
        )}
      </td>
      <td className="hidden py-4 pr-4 text-right lg:table-cell">
        {divPositiv ? (
          <>
            <p className="text-sm font-medium tabular-nums text-emerald-400">{formatGewinnEur(dividendenEur)}</p>
            {divPct != null ? (
              <p className="mt-0.5 text-[11px] tabular-nums text-emerald-400/90">↑ {formatProzent(divPct)}</p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-sm tabular-nums text-[var(--app-text-muted)]">{formatEur(0)}</p>
            <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">—</p>
          </>
        )}
      </td>
      <td className="hidden py-4 pr-4 text-right xl:table-cell">
        <div className="inline-flex items-center justify-end gap-2">
          <span className="h-2 w-2 rounded-full border border-[var(--app-border-strong)]" aria-hidden />
          <span className="text-sm tabular-nums text-[var(--app-text)]">
            {p.gewichtProzent.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %
          </span>
        </div>
      </td>
      <td className="py-4 pr-3 sm:hidden">
        <div className="space-y-2 text-right text-[11px]">
          <p className="text-sm font-semibold tabular-nums text-[var(--app-text)]">{formatEur(p.wertLiveEur)}</p>
          {gvPct != null ? (
            <p className={positiv ? 'text-emerald-400' : 'text-rose-400'}>
              {formatGewinnEur(gv)} · {formatProzent(gvPct)}
            </p>
          ) : null}
        </div>
      </td>
      <td className="py-4 pr-2 text-right sm:pr-3">
        <div className="relative inline-flex">
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-[var(--app-text-muted)] hover:bg-white/[0.05] hover:text-[var(--app-text)]"
            aria-label={`${p.anzeigeName} Aktionen`}
            aria-haspopup="menu"
            aria-expanded={menuOffen}
            onClick={(e) => {
              e.stopPropagation()
              setMenuOffen((v) => !v)
            }}
          >
            ⋯
          </button>
          {menuOffen ? (
            <div
              className="absolute right-0 top-9 z-20 min-w-[170px] rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-1 shadow-xl"
              role="menu"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[var(--app-text)] hover:bg-white/[0.04]"
                role="menuitem"
                onClick={() => {
                  setMenuOffen(false)
                  onVerkaufen?.(p)
                }}
              >
                Verkauf buchen
              </button>
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

export function PaWertpapiereListe({
  positionen,
  buchungen,
  meta,
  laden,
  periodKey = 'MAX',
  positionPerfMap,
  onVerkaufGebucht,
}: {
  positionen: LivePosition[]
  buchungen: PortfolioBuchung[]
  meta: Map<string, IsinMetadata>
  laden?: boolean
  periodKey?: PeriodPerformance['periodKey']
  positionPerfMap?: Map<string, PositionPeriodPerf>
  onVerkaufGebucht?: () => void | Promise<void>
}) {
  const router = useRouter()
  const [offen, setOffen] = useState(true)
  const [verkaufPosition, setVerkaufPosition] = useState<LivePosition | null>(null)

  const sortiert = useMemo(
    () => [...positionen].sort((a, b) => b.wertLiveEur - a.wertLiveEur),
    [positionen],
  )

  const divMap = useMemo(() => dividendenJeIsin(buchungen), [buchungen])
  const kaufVolMap = useMemo(() => kaufVolumenJeIsin(buchungen), [buchungen])

  /** Seit Kauf: Kursgewinn + erhaltene Dividenden (wie Parqet „im Plus/Minus“). */
  const { gewinner, verlierer } = useMemo(() => {
    let g = 0
    let v = 0
    for (const p of positionen) {
      if (p.stueck <= 0) continue
      const key = p.isin?.toUpperCase() ?? p.name
      const perf = positionPerfMap?.get(key)
      const kursPerf = perf?.gewinnVerlustEur ?? p.gewinnVerlustEur
      if (periodKey === 'MAX') {
        const div = p.isin ? (divMap.get(p.isin.toUpperCase()) ?? 0) : 0
        if (kursPerf + div >= 0) g++
        else v++
      } else if (perf?.gewinnVerlustProzent != null) {
        if (perf.gewinnVerlustProzent >= 0) g++
        else v++
      } else if (kursPerf >= 0) g++
      else v++
    }
    return { gewinner: g, verlierer: v }
  }, [positionen, divMap, positionPerfMap, periodKey])

  if (positionen.length === 0) {
    return (
      <PaCard variant="elevated" className="p-8 text-center text-sm text-[var(--app-text-muted)]">
        Keine offenen Positionen.
      </PaCard>
    )
  }

  return (
    <PaCard variant="elevated" className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="flex w-full items-center gap-3 border-b border-white/[0.04] px-4 py-3.5 text-left sm:px-5"
      >
        <svg
          className={`h-4 w-4 shrink-0 text-[var(--app-text-muted)] transition-transform ${offen ? 'rotate-0' : '-rotate-90'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        <h2 className="text-sm font-semibold text-[var(--app-text)]">Wertpapiere</h2>
        <span className="flex items-center gap-2 text-[11px] tabular-nums">
          <span className="text-emerald-400">↑ {gewinner}</span>
          <span className="text-rose-400">↓ {verlierer}</span>
        </span>
        {laden ? <span className="ml-auto text-[11px] text-[var(--app-text-muted)]">Kurse …</span> : null}
      </button>

      {offen ? (
        <div className={appTableScrollClassName}>
          <table className="app-data-table w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/[0.04] text-[10px] font-medium uppercase tracking-wider text-[var(--app-text-muted)]">
                <th className="py-3 pl-4 pr-3 font-medium sm:pl-5">Name</th>
                <th className="hidden py-3 pr-4 text-right font-medium sm:table-cell">Position / Kurs</th>
                <th className="hidden py-3 pr-4 text-right font-medium md:table-cell">
                  {spaltenLabelKursgewinn(periodKey)}
                </th>
                <th className="hidden py-3 pr-4 text-right font-medium lg:table-cell">Dividenden / in %</th>
                <th className="hidden py-3 pr-4 text-right font-medium xl:table-cell">Allokation</th>
                <th className="py-3 pr-3 sm:hidden" aria-hidden />
                <th className="w-10 py-3 pr-2 text-right font-medium sm:pr-3">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {sortiert.map((p) => {
                const fundamentalHref =
                  p.assetKlasse === 'aktie' && p.isin
                    ? fundamentaldatenHref({ isin: p.isin })
                    : null
                const perfKey = p.isin?.toUpperCase() ?? p.name
                const perf = positionPerfMap?.get(perfKey) ?? {
                  gewinnVerlustEur: p.gewinnVerlustEur,
                  gewinnVerlustProzent: p.gewinnVerlustProzent,
                }
                return (
                  <WertpapierZeile
                    key={p.isin ?? p.name}
                    p={p}
                    meta={meta}
                    perf={perf}
                    dividendenEur={p.isin ? (divMap.get(p.isin.toUpperCase()) ?? 0) : 0}
                    kaufVolumenEur={p.isin ? (kaufVolMap.get(p.isin.toUpperCase()) ?? 0) : 0}
                    onOeffnen={fundamentalHref ? () => router.push(fundamentalHref) : undefined}
                    onVerkaufen={setVerkaufPosition}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {verkaufPosition ? (
        <VerkaufsDialog
          position={verkaufPosition}
          onClose={() => setVerkaufPosition(null)}
          onSaved={async () => {
            await onVerkaufGebucht?.()
          }}
        />
      ) : null}
    </PaCard>
  )
}
