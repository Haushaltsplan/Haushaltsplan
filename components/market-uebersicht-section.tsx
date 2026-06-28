import type { MarktUebersicht, MarktKennzahl } from '@/lib/market-uebersicht'

function formatWert(z: MarktKennzahl): string {
  if (z.wert == null) return '—'
  if (z.symbolYahoo === 'EURUSD=X')
    return z.wert.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  if (z.symbolYahoo === '^VIX')
    return z.wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return z.wert.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function KennzahlKarte({ z }: { z: MarktKennzahl }) {
  const pct = z.aenderungProzent
  const pctCls =
    pct == null ? 'text-[var(--app-text-muted)]' : pct > 0 ? 'text-teal-400' : pct < 0 ? 'text-red-400/90' : 'text-[var(--app-text-muted)]'
  const suffix =
    z.symbolYahoo === 'EURUSD=X' ? 'USD/EUR' : z.symbolYahoo === '^VIX' ? 'Pkt.' : 'Pkt.'

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">{z.kurzlabel}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--app-text-muted)]">{z.titel}</p>
        <p className="mt-2 font-mono text-lg font-semibold tabular-nums tracking-tight text-white">
          {formatWert(z)}
          {z.wert != null ? (
            <span className="ml-1.5 text-xs font-normal text-[var(--app-text-muted)]">{suffix}</span>
          ) : null}
        </p>
      </div>
      {pct != null ? (
        <p className={`text-sm font-semibold tabular-nums ${pctCls}`}>
          {pct >= 0 ? '+' : ''}
          {pct.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
        </p>
      ) : (
        <p className="text-xs text-[var(--app-text-muted)]">—</p>
      )}
    </div>
  )
}

export function MarketUebersichtSection({
  uebersicht,
  embedded = false,
}: {
  uebersicht: MarktUebersicht
  embedded?: boolean
}) {
  const shell = embedded
    ? 'space-y-2'
    : 'rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4 shadow-sm shadow-black/20'

  return (
    <section className={shell}>
      {embedded ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Indizes &amp; FX</h3>
          <span className="text-xs text-[var(--app-text-muted)]">Yahoo · US-Sitzung</span>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Marktüberblick</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">S&amp;P 500 · EUR/USD · VIX</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--app-text-muted)]">Letzte reguläre US-Handelszeit · Yahoo Finance</p>
        </>
      )}

      {uebersicht.fehler ? (
        <p className="mt-3 rounded-lg border border-orange-900/40 bg-orange-950/20 px-3 py-2.5 text-sm leading-relaxed text-orange-50">
          {uebersicht.fehler}
        </p>
      ) : null}

      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-3 ${embedded ? '' : 'mt-4'}`}>
        {uebersicht.zeilen.map((z) => (
          <KennzahlKarte key={z.symbolYahoo} z={z} />
        ))}
      </div>
    </section>
  )
}
