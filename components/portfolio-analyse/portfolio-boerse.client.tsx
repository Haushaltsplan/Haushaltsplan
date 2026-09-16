'use client'

import { useEffect, useMemo, useState } from 'react'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PA_TABLE } from '@/components/portfolio-analyse/pa-ui'
import { formatProzent } from '@/lib/portfolio-analyse/berechnung'
import type {
  BoersenSaisonIndex,
  BoersenSaisonMonat,
  BoersenSaisonPaket,
} from '@/lib/portfolio-analyse/boersen-saison-types'

function SaisonBalken({ monate }: { monate: BoersenSaisonMonat[] }) {
  const werte = monate.map((m) => m.durchschnittPct)
  const maxAbs = Math.max(0.5, ...werte.map((v) => Math.abs(v)))
  const w = 720
  const h = 220
  const pad = { l: 36, r: 12, t: 16, b: 28 }
  const plotW = w - pad.l - pad.r
  const plotH = h - pad.t - pad.b
  const zeroY = pad.t + plotH / 2
  const gap = 8
  const barW = (plotW - gap * 11) / 12

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Durchschnittliche Monatsrendite">
      <line
        x1={pad.l}
        x2={w - pad.r}
        y1={zeroY}
        y2={zeroY}
        stroke="currentColor"
        className="text-[var(--app-border-strong)]"
        strokeWidth={1}
      />
      {monate.map((m, i) => {
        const x = pad.l + i * (barW + gap)
        const hBar = (Math.abs(m.durchschnittPct) / maxAbs) * (plotH / 2 - 4)
        const y = m.durchschnittPct >= 0 ? zeroY - hBar : zeroY
        const fill = m.durchschnittPct >= 0 ? 'rgb(52 211 153)' : 'rgb(251 113 133)'
        return (
          <g key={m.monat}>
            <rect x={x} y={y} width={barW} height={Math.max(hBar, 1)} rx={3} fill={fill} opacity={0.9}>
              <title>{`${m.label}: ${formatProzent(m.durchschnittPct)}`}</title>
            </rect>
            <text
              x={x + barW / 2}
              y={h - 8}
              textAnchor="middle"
              className="fill-[var(--app-text-muted)]"
              style={{ fontSize: 11 }}
            >
              {m.kurz}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function PortfolioBoerseClient() {
  const [paket, setPaket] = useState<BoersenSaisonPaket | null>(null)
  const [laden, setLaden] = useState(true)
  const [indexId, setIndexId] = useState('sp500')

  useEffect(() => {
    const ac = new AbortController()
    void fetch('/api/portfolio-analyse/boerse-saison', { signal: ac.signal })
      .then(async (res) => {
        const json = (await res.json()) as BoersenSaisonPaket
        if (ac.signal.aborted) return
        setPaket(json)
        const first = json.indezes[0]?.id
        if (first) setIndexId((prev) => (json.indezes.some((i) => i.id === prev) ? prev : first))
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setPaket({
            ok: false,
            indezes: [],
            geladenAm: new Date().toISOString(),
            fehler: 'Saisondaten konnten nicht geladen werden.',
          })
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setLaden(false)
      })
    return () => ac.abort()
  }, [])

  const aktiv = useMemo(
    () => paket?.indezes.find((i) => i.id === indexId) ?? paket?.indezes[0] ?? null,
    [paket, indexId],
  )

  const ranking = useMemo(() => {
    if (!aktiv) return { best: null as BoersenSaisonMonat | null, worst: null as BoersenSaisonMonat | null }
    const sortiert = [...aktiv.monate].sort((a, b) => b.durchschnittPct - a.durchschnittPct)
    return { best: sortiert[0] ?? null, worst: sortiert[sortiert.length - 1] ?? null }
  }, [aktiv])

  return (
    <PortfolioAnalyseShell
      title="Börse"
      description="Langfristige Saisoneffekte: durchschnittliche Rendite je Kalendermonat — positiv und negativ."
    >
      <PaCard className="space-y-5 p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold text-[var(--app-text)]">Monatsrenditen im Schnitt</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--app-text-muted)]">
            Jeder Balken ist der arithmetische Durchschnitt aller abgeschlossenen {aktiv?.name ?? 'Index'}-Monate in
            der Historie. Das ist keine Prognose — nur was der Kalender bisher geliefert hat.
          </p>
        </div>

        {paket && paket.indezes.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {paket.indezes.map((idx) => {
              const an = idx.id === aktiv?.id
              return (
                <button
                  key={idx.id}
                  type="button"
                  onClick={() => setIndexId(idx.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    an
                      ? 'bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/30'
                      : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]'
                  }`}
                >
                  {idx.name}
                </button>
              )
            })}
          </div>
        ) : null}

        {laden ? (
          <p className="py-10 text-center text-sm text-[var(--app-text-muted)]">Historie wird geladen …</p>
        ) : null}

        {!laden && paket && !aktiv ? (
          <p className="py-10 text-center text-sm text-amber-200/90">{paket.fehler ?? 'Keine Daten.'}</p>
        ) : null}

        {aktiv ? (
          <>
            <p className="text-[11px] text-[var(--app-text-muted)]">
              {aktiv.name} ({aktiv.symbol})
              {aktiv.vonJahr && aktiv.bisJahr ? ` · ${aktiv.vonJahr}–${aktiv.bisJahr}` : ''} · {aktiv.hinweis}
            </p>

            {ranking.best && ranking.worst ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
                    Stärkster Monat
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--app-text)]">
                    {ranking.best.label}{' '}
                    <span className="tabular-nums text-emerald-300">{formatProzent(ranking.best.durchschnittPct)}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-400/90">Schwächster Monat</p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--app-text)]">
                    {ranking.worst.label}{' '}
                    <span className="tabular-nums text-rose-300">{formatProzent(ranking.worst.durchschnittPct)}</span>
                  </p>
                </div>
              </div>
            ) : null}

            <SaisonBalken monate={aktiv.monate} />

            <div className="overflow-x-auto">
              <table className={PA_TABLE}>
                <thead>
                  <tr>
                    <th className="text-left">Monat</th>
                    <th className="text-right">Ø Rendite</th>
                    <th className="text-right">Median</th>
                    <th className="text-right">Positiv</th>
                    <th className="text-right">Jahre</th>
                    <th className="text-right">Min</th>
                    <th className="text-right">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {aktiv.monate.map((m) => {
                    const pos = m.durchschnittPct >= 0
                    return (
                      <tr key={m.monat}>
                        <td className="font-medium text-[var(--app-text)]">{m.label}</td>
                        <td
                          className={`text-right tabular-nums font-semibold ${pos ? 'text-emerald-300' : 'text-rose-300'}`}
                        >
                          {formatProzent(m.durchschnittPct)}
                        </td>
                        <td className="text-right tabular-nums text-[var(--app-text-muted)]">
                          {formatProzent(m.medianPct)}
                        </td>
                        <td className="text-right tabular-nums text-[var(--app-text-muted)]">
                          {m.trefferquotePct.toLocaleString('de-DE', { maximumFractionDigits: 0 })} %
                        </td>
                        <td className="text-right tabular-nums text-[var(--app-text-muted)]">{m.anzahl}</td>
                        <td className="text-right tabular-nums text-rose-300/80">{formatProzent(m.minPct)}</td>
                        <td className="text-right tabular-nums text-emerald-300/80">{formatProzent(m.maxPct)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </PaCard>
    </PortfolioAnalyseShell>
  )
}
