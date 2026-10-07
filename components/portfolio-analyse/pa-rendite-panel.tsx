'use client'

import { PaBadge, PaCard, PaStatRow } from '@/components/portfolio-analyse/pa-ui'
import { formatEur, formatProzent } from '@/lib/portfolio-analyse/berechnung'
import type { ParqetRenditeKennzahlen } from '@/lib/portfolio-analyse/parqet-rendite-kennzahlen'

function wertMitBadge(
  betrag: number,
  prozent: number | null,
  opts?: { vorzeichen?: boolean },
) {
  const farbe = betrag >= 0 ? 'text-emerald-400' : 'text-rose-400'
  const vor = opts?.vorzeichen && betrag > 0 ? '+' : ''
  return (
    <div className="flex flex-col items-end gap-1.5">
      <span className={`text-sm font-medium tabular-nums ${farbe}`}>
        {vor}
        {formatEur(betrag)}
      </span>
      {prozent != null ? (
        <PaBadge variant={prozent >= 0 ? 'positive' : 'negative'}>
          {prozent >= 0 ? '↑' : '↓'}{' '}
          {Math.abs(prozent).toLocaleString('de-DE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          %
        </PaBadge>
      ) : null}
    </div>
  )
}

export function PaRenditePanel({
  kennzahlen,
  startDatum,
}: {
  kennzahlen: ParqetRenditeKennzahlen
  startDatum: string | null
}) {
  const k = kennzahlen

  return (
    <PaCard variant="elevated" className="p-5">
      <h2 className="text-sm font-semibold tracking-tight text-[var(--app-text)]">Rendite</h2>
      {startDatum ? (
        <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">seit {startDatum} · in EUR</p>
      ) : null}

      <div className="mt-4 divide-y divide-white/[0.04]">
        <PaStatRow label="Portfoliowert" value={formatEur(k.portfoliowertEur)} />
        <PaStatRow label="Investiert" value={formatEur(k.investiertEur)} />

        <PaStatRow
          label="IZF"
          value={
            k.izfProzent != null ? (
              <PaBadge variant={k.izfProzent >= 0 ? 'positive' : 'negative'}>
                {k.izfProzent >= 0 ? '↑' : '↓'}{' '}
                {Math.abs(k.izfProzent).toLocaleString('de-DE', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                %
              </PaBadge>
            ) : (
              '—'
            )
          }
        />

        <div className="py-2.5">
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.04] pb-2.5">
            <p className="text-[13px] text-[var(--app-text-muted)]">Kursgewinn</p>
            {wertMitBadge(k.kursgewinnEur, k.kursgewinnProzent, { vorzeichen: true })}
          </div>
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.04] py-2.5">
            <p className="text-[13px] text-[var(--app-text-muted)]">Realisiert (Brutto)</p>
            {wertMitBadge(k.realisiertBruttoEur, k.realisiertProzent, { vorzeichen: true })}
          </div>
          <div className="flex items-start justify-between gap-4 pt-2.5">
            <p className="text-[13px] text-[var(--app-text-muted)]">Dividenden (Brutto)</p>
            {wertMitBadge(k.dividendenBruttoEur, k.dividendenProzent, { vorzeichen: true })}
          </div>
        </div>

        <PaStatRow
          label="Gewinn"
          value={
            <span
              className={`text-sm font-medium tabular-nums ${k.gewinnEur >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {k.gewinnEur > 0 ? '+' : ''}
              {formatEur(k.gewinnEur)}
            </span>
          }
        />
        <PaStatRow label="Steuern" value={formatEur(k.steuernEur)} />
        <PaStatRow label="Gebühren" value={formatEur(k.gebuehrenEur)} />
        <PaStatRow
          label="Nettogewinn"
          value={
            <span
              className={`text-sm font-semibold tabular-nums ${k.nettogewinnEur >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {k.nettogewinnEur > 0 ? '+' : ''}
              {formatEur(k.nettogewinnEur)}
            </span>
          }
        />
      </div>
    </PaCard>
  )
}
