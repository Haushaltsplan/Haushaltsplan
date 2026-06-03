'use client'

import { useMemo, useState } from 'react'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import { dividendenJeIsin } from '@/lib/portfolio-analyse/auswertungen'
import { formatEur, formatProzent } from '@/lib/portfolio-analyse/berechnung'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
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

function formatStueck(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 4 })
}

function formatKursKompakt(n: number): string {
  return `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`
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
      onClick={() => {
        void navigator.clipboard.writeText(isin).then(() => {
          setOk(true)
          setTimeout(() => setOk(false), 1500)
        })
      }}
      className="inline-flex text-zinc-600 hover:text-zinc-400"
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

function WertpapierZeile({
  p,
  meta,
  dividendenEur,
}: {
  p: LivePosition
  meta: Map<string, IsinMetadata>
  dividendenEur: number
}) {
  const isin = p.isin?.toUpperCase() ?? ''
  const kurs = p.kursLiveEur ?? p.kursEur
  const gv = p.gewinnVerlustEur
  const gvPct = p.gewinnVerlustProzent
  const positiv = gv >= 0
  const divPositiv = dividendenEur > 0
  const divPct = p.einstandEur > 0 && dividendenEur > 0 ? (dividendenEur / p.einstandEur) * 100 : null

  return (
    <tr className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
      <td className="py-4 pl-4 pr-3 sm:pl-5">
        <div className="flex gap-3">
          <PortfolioIsinLogo isin={p.isin} fallbackName={p.name} meta={meta} groesse="md" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1 text-[11px] text-zinc-500">
              <span>{assetZeileLabel(p.assetKlasse)}</span>
              {isin ? (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="font-mono">{isin}</span>
                  <CopyIsinButton isin={isin} />
                </>
              ) : null}
              {p.wkn ? (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="font-mono">{p.wkn}</span>
                </>
              ) : null}
            </p>
            <p className="mt-1 text-sm font-semibold leading-snug text-zinc-100">{p.anzeigeName}</p>
          </div>
        </div>
      </td>
      <td className="hidden py-4 pr-4 text-right sm:table-cell">
        <p className="text-sm font-semibold tabular-nums text-zinc-100">{formatEur(p.wertLiveEur)}</p>
        {p.stueck > 0 && kurs != null && kurs > 0 ? (
          <p className="mt-0.5 text-[11px] tabular-nums text-zinc-500">
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
          <p className="text-sm text-zinc-600">—</p>
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
            <p className="text-sm tabular-nums text-zinc-400">{formatEur(0)}</p>
            <p className="mt-0.5 text-[11px] text-zinc-600">—</p>
          </>
        )}
      </td>
      <td className="hidden py-4 pr-4 text-right xl:table-cell">
        <div className="inline-flex items-center justify-end gap-2">
          <span className="h-2 w-2 rounded-full border border-zinc-600" aria-hidden />
          <span className="text-sm tabular-nums text-zinc-300">
            {p.gewichtProzent.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %
          </span>
        </div>
      </td>
      <td className="py-4 pr-3 sm:hidden">
        <div className="space-y-2 text-right text-[11px]">
          <p className="text-sm font-semibold tabular-nums text-zinc-100">{formatEur(p.wertLiveEur)}</p>
          {gvPct != null ? (
            <p className={positiv ? 'text-emerald-400' : 'text-rose-400'}>
              {formatGewinnEur(gv)} · {formatProzent(gvPct)}
            </p>
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
}: {
  positionen: LivePosition[]
  buchungen: PortfolioBuchung[]
  meta: Map<string, IsinMetadata>
  laden?: boolean
}) {
  const [offen, setOffen] = useState(true)

  const sortiert = useMemo(
    () => [...positionen].sort((a, b) => b.wertLiveEur - a.wertLiveEur),
    [positionen],
  )

  const divMap = useMemo(() => dividendenJeIsin(buchungen), [buchungen])

  /** Seit Kauf: Kursgewinn + erhaltene Dividenden (wie Parqet „im Plus/Minus“). */
  const { gewinner, verlierer } = useMemo(() => {
    let g = 0
    let v = 0
    for (const p of positionen) {
      if (p.stueck <= 0) continue
      const div = p.isin ? (divMap.get(p.isin.toUpperCase()) ?? 0) : 0
      const gesamt = p.gewinnVerlustEur + div
      if (gesamt >= 0) g++
      else v++
    }
    return { gewinner: g, verlierer: v }
  }, [positionen, divMap])

  if (positionen.length === 0) {
    return (
      <PaCard variant="elevated" className="p-8 text-center text-sm text-zinc-500">
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
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${offen ? 'rotate-0' : '-rotate-90'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        <h2 className="text-sm font-semibold text-zinc-100">Wertpapiere</h2>
        <span className="flex items-center gap-2 text-[11px] tabular-nums">
          <span className="text-emerald-400">↑ {gewinner}</span>
          <span className="text-rose-400">↓ {verlierer}</span>
        </span>
        {laden ? <span className="ml-auto text-[11px] text-zinc-600">Kurse …</span> : null}
      </button>

      {offen ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/[0.04] text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                <th className="py-3 pl-4 pr-3 font-medium sm:pl-5">Name</th>
                <th className="hidden py-3 pr-4 text-right font-medium sm:table-cell">Position / Kurs</th>
                <th className="hidden py-3 pr-4 text-right font-medium md:table-cell">Kursgewinn / in %</th>
                <th className="hidden py-3 pr-4 text-right font-medium lg:table-cell">Dividenden / in %</th>
                <th className="hidden py-3 pr-4 text-right font-medium xl:table-cell">Allokation</th>
                <th className="py-3 pr-3 sm:hidden" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {sortiert.map((p) => (
                <WertpapierZeile
                  key={p.isin ?? p.name}
                  p={p}
                  meta={meta}
                  dividendenEur={p.isin ? (divMap.get(p.isin.toUpperCase()) ?? 0) : 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PaCard>
  )
}
