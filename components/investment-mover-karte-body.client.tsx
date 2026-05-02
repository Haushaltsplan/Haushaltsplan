'use client'

import type { ReactNode } from 'react'
import type { InvestmentMoverKarteDaten } from '@/components/investment-mover-karte-types'
import { StockLogo } from '@/components/stock-logo'

function farbeUndStringProzent(p: number | null | undefined): { cls: string; s: string } {
  const ok = p != null && Number.isFinite(p)
  if (!ok) return { cls: 'text-zinc-500', s: '—' }
  const v = p as number
  return {
    cls: v >= 0 ? 'text-teal-400' : 'text-red-400/90',
    s: `${v >= 0 ? '+' : ''}${v}%`,
  }
}

/** Rechte Kennzahlenspalte (Tag … ATH). */
export function InvestmentMoverKarteMetrikSpalte({ z }: { z: InvestmentMoverKarteDaten }) {
  const zeigeLangfrist =
    z.portfolioKarte === true ||
    z.ytdProzent !== undefined ||
    z.fuenfJahreProzent !== undefined ||
    z.zehnJahreProzent !== undefined ||
    z.athAbstandProzent !== undefined
  const tag = farbeUndStringProzent(z.aenderungProzent)
  const ytd = farbeUndStringProzent(z.ytdProzent)
  const z5 = farbeUndStringProzent(z.fuenfJahreProzent)
  const z10 = farbeUndStringProzent(z.zehnJahreProzent)
  const ath = farbeUndStringProzent(z.athAbstandProzent)

  if (zeigeLangfrist) {
    return (
      <dl className="shrink-0 space-y-1 text-right">
        <div className="flex items-baseline justify-end gap-3">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Tag</dt>
          <dd className={`text-sm font-semibold tabular-nums ${tag.cls}`}>{tag.s}</dd>
        </div>
        <div className="flex items-baseline justify-end gap-3">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">YTD</dt>
          <dd className={`text-sm font-semibold tabular-nums ${ytd.cls}`}>{ytd.s}</dd>
        </div>
        <div className="flex items-baseline justify-end gap-3">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">5 J.</dt>
          <dd className={`text-sm font-semibold tabular-nums ${z5.cls}`}>{z5.s}</dd>
        </div>
        <div className="flex items-baseline justify-end gap-3">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">10 J.</dt>
          <dd className={`text-sm font-semibold tabular-nums ${z10.cls}`}>{z10.s}</dd>
        </div>
        <div className="flex items-baseline justify-end gap-3">
          <dt className="max-w-[5.5rem] text-right text-[11px] font-medium uppercase leading-snug tracking-wide text-zinc-500">
            ATH
          </dt>
          <dd className={`text-sm font-semibold tabular-nums ${ath.cls}`}>{ath.s}</dd>
        </div>
      </dl>
    )
  }

  return <p className={`text-base font-semibold tabular-nums ${tag.cls}`}>{tag.s}</p>
}

export function InvestmentMoverKarteBodyClient({
  z,
  kopfExtrasObenRechts,
}: {
  z: InvestmentMoverKarteDaten
  kopfExtrasObenRechts?: ReactNode
}) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <StockLogo symbol={z.symbol} />
          <div className="min-w-0 max-w-xl flex-1">
            <p className="font-mono text-sm font-semibold text-white">{z.symbol}</p>
            <p className="truncate text-xs leading-snug text-zinc-400">{z.name}</p>
            {z.notiz?.trim() ? (
              <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-snug text-zinc-500">
                {z.notiz.trim()}
              </p>
            ) : null}
            {z.brancheAnzeige ? (
              <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                <span className="text-zinc-500">Branche: </span>
                <span className="text-zinc-400">{z.brancheAnzeige}</span>
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {kopfExtrasObenRechts}
          <InvestmentMoverKarteMetrikSpalte z={z} />
        </div>
      </div>
      {z.kurs != null ? (
        <p className="mt-2 text-xs tabular-nums text-zinc-400">
          Kurs ca. {z.kurs.toFixed(2)} {z.notierung ?? 'USD'}
        </p>
      ) : null}
    </>
  )
}
