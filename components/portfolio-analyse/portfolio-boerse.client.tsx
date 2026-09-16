'use client'

import { useEffect, useMemo, useState } from 'react'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PA_TABLE } from '@/components/portfolio-analyse/pa-ui'
import { usWahlPhase } from '@/lib/portfolio-analyse/boersen-saison-logik'
import { formatProzent } from '@/lib/portfolio-analyse/berechnung'
import type {
  BoersenSaisonMonat,
  BoersenSaisonPaket,
  BoersenWahlJahrStats,
} from '@/lib/portfolio-analyse/boersen-saison-types'

function formatPctKurz(n: number): string {
  const v = n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return n > 0 ? `+${v}%` : `${v}%`
}

function RenditeBalken({
  eintraege,
  ariaLabel,
}: {
  eintraege: { key: string; label: string; wert: number }[]
  ariaLabel: string
}) {
  const werte = eintraege.map((e) => e.wert)
  const min = Math.min(0, ...werte)
  const max = Math.max(0, ...werte)
  const span = Math.max(0.5, max - min)
  const w = 720
  const h = 248
  const pad = { l: 8, r: 8, t: 28, b: 32 }
  const plotW = w - pad.l - pad.r
  const plotH = h - pad.t - pad.b
  const y = (v: number) => pad.t + ((max - v) / span) * plotH
  const zeroY = y(0)
  const gap = eintraege.length > 6 ? 8 : 16
  const barW = (plotW - gap * Math.max(0, eintraege.length - 1)) / eintraege.length

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
      <line
        x1={pad.l}
        x2={w - pad.r}
        y1={zeroY}
        y2={zeroY}
        stroke="currentColor"
        className="text-[var(--app-border-strong)]"
        strokeWidth={1}
      />
      {eintraege.map((e, i) => {
        const x = pad.l + i * (barW + gap)
        const yBar = y(e.wert)
        const top = Math.min(yBar, zeroY)
        const height = Math.max(1, Math.abs(yBar - zeroY))
        const pos = e.wert >= 0
        const fill = pos ? 'rgb(52 211 153)' : 'rgb(251 113 133)'
        const labelY = pos ? yBar - 6 : yBar + 14
        return (
          <g key={e.key}>
            <rect x={x} y={top} width={barW} height={height} rx={3} fill={fill} opacity={0.9}>
              <title>{`${e.label}: ${formatProzent(e.wert)}`}</title>
            </rect>
            <text
              x={x + barW / 2}
              y={labelY}
              textAnchor="middle"
              className={pos ? 'fill-emerald-300' : 'fill-rose-300'}
              style={{ fontSize: 11, fontWeight: 650 }}
            >
              {formatPctKurz(e.wert)}
            </text>
            <text
              x={x + barW / 2}
              y={h - 8}
              textAnchor="middle"
              className="fill-[var(--app-text-muted)]"
              style={{ fontSize: 11 }}
            >
              {e.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function SaisonBalken({ monate }: { monate: BoersenSaisonMonat[] }) {
  return (
    <RenditeBalken
      ariaLabel="Durchschnittliche Monatsrendite"
      eintraege={monate.map((m) => ({ key: String(m.monat), label: m.kurz, wert: m.durchschnittPct }))}
    />
  )
}

function WahlPhaseKarte({ phase, aktiv }: { phase: BoersenWahlJahrStats; aktiv: boolean }) {
  const pos = phase.durchschnittJahrPct >= 0
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        aktiv
          ? 'border-teal-500/35 bg-teal-500/[0.08]'
          : 'border-[var(--app-border)] bg-[var(--app-surface-muted)]/30'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
        {phase.kurz}
      </p>
      <p className="mt-0.5 text-sm font-medium text-[var(--app-text)]">{phase.label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${pos ? 'text-emerald-300' : 'text-rose-300'}`}>
        {formatProzent(phase.durchschnittJahrPct)}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-[var(--app-text-muted)]">
        {phase.trefferquotePct.toLocaleString('de-DE', { maximumFractionDigits: 0 })} % der Jahre positiv ·{' '}
        {phase.anzahl} Jahre
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--app-text-muted)]">{phase.hinweis}</p>
    </div>
  )
}

function FensterZeile({
  titel,
  vorher,
  danach,
  vorherLabel,
  danachLabel,
}: {
  titel: string
  vorher: { durchschnittPct: number; trefferquotePct: number; anzahl: number }
  danach: { durchschnittPct: number; trefferquotePct: number; anzahl: number }
  vorherLabel: string
  danachLabel: string
}) {
  return (
    <div className="rounded-lg border border-[var(--app-border)] px-3 py-2.5">
      <p className="text-[11px] font-semibold text-[var(--app-text)]">{titel}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">{vorherLabel}</p>
          <p
            className={`mt-0.5 text-sm font-semibold tabular-nums ${
              vorher.durchschnittPct >= 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {formatProzent(vorher.durchschnittPct)}
          </p>
          <p className="text-[11px] text-[var(--app-text-muted)]">
            {vorher.trefferquotePct.toLocaleString('de-DE', { maximumFractionDigits: 0 })} % positiv · {vorher.anzahl}×
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">{danachLabel}</p>
          <p
            className={`mt-0.5 text-sm font-semibold tabular-nums ${
              danach.durchschnittPct >= 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {formatProzent(danach.durchschnittPct)}
          </p>
          <p className="text-[11px] text-[var(--app-text-muted)]">
            {danach.trefferquotePct.toLocaleString('de-DE', { maximumFractionDigits: 0 })} % positiv · {danach.anzahl}×
          </p>
        </div>
      </div>
    </div>
  )
}

export function PortfolioBoerseClient() {
  const [paket, setPaket] = useState<BoersenSaisonPaket | null>(null)
  const [laden, setLaden] = useState(true)
  const [indexId, setIndexId] = useState('sp500')

  useEffect(() => {
    const ac = new AbortController()
    let weg = false
    const timer = window.setTimeout(() => ac.abort(), 25_000)
    void fetch('/api/portfolio-analyse/boerse-saison', { signal: ac.signal })
      .then(async (res) => {
        const json = (await res.json()) as BoersenSaisonPaket
        if (weg) return
        setPaket(json)
        const first = json.indezes[0]?.id
        if (first) setIndexId((prev) => (json.indezes.some((i) => i.id === prev) ? prev : first))
      })
      .catch(() => {
        if (!weg) {
          setPaket({
            ok: false,
            indezes: [],
            geladenAm: new Date().toISOString(),
            fehler: 'Saisondaten konnten nicht geladen werden.',
          })
        }
      })
      .finally(() => {
        window.clearTimeout(timer)
        if (!weg) setLaden(false)
      })
    return () => {
      weg = true
      window.clearTimeout(timer)
      ac.abort()
    }
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

  const staerkstePhase = useMemo(() => {
    const phasen = aktiv?.wahlZyklus?.phasen.filter((p) => p.anzahl > 0) ?? []
    if (!phasen.length) return null
    return [...phasen].sort((a, b) => b.durchschnittJahrPct - a.durchschnittJahrPct)[0] ?? null
  }, [aktiv])

  const aktuellesJahr = new Date().getUTCFullYear()
  const aktuellePhaseLabel =
    {
      nachwahl: 'Nachwahljahr',
      midterm: 'Midterm-Jahr',
      vorwahl: 'Vorwahljahr',
      wahljahr: 'Wahljahr',
    }[usWahlPhase(aktuellesJahr)]

  return (
    <PortfolioAnalyseShell
      title="Börse"
      description="Langfristige Saisoneffekte und der US-Wahlzyklus: durchschnittliche Rendite je Kalendermonat — positiv und negativ."
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

      {aktiv?.wahlZyklus ? (
        <PaCard className="mt-4 space-y-5 p-4 sm:p-5">
          <div>
            <h2 className="text-base font-semibold text-[var(--app-text)]">US-Wahlzyklus</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--app-text-muted)]">
              US-Präsidentschaftswahlen alle vier Jahre, dazwischen die Midterms. {aktuellesJahr} ist ein{' '}
              {aktuellePhaseLabel}. Die Zahlen sind die durchschnittliche Jahresrendite des {aktiv.name} in
              dieser Zyklusphase
              {aktiv.vonJahr && aktiv.bisJahr ? ` (${aktiv.vonJahr}–${aktiv.bisJahr})` : ''}. Kein Fahrplan — 2008 war
              ein Wahljahr und trotzdem ein Crash-Jahr.
              {aktiv.id === 'dax'
                ? ' Beim DAX ist das ein Mitzieheffekt über den US-Risikoappetit, kein eigener deutscher Wahlkalender.'
                : ''}
            </p>
          </div>

          <RenditeBalken
            ariaLabel="Durchschnittliche Jahresrendite im US-Wahlzyklus"
            eintraege={aktiv.wahlZyklus.phasen.map((p) => ({
              key: p.phase,
              label: p.kurz,
              wert: p.durchschnittJahrPct,
            }))}
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {aktiv.wahlZyklus.phasen.map((p) => (
              <WahlPhaseKarte key={p.phase} phase={p} aktiv={p.phase === staerkstePhase?.phase} />
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FensterZeile
              titel="Midterms: oft schwach bis zum Herbst, dann Erholung"
              vorher={aktiv.wahlZyklus.midtermVorher}
              danach={aktiv.wahlZyklus.midtermDanach}
              vorherLabel="Jan–Okt"
              danachLabel="Nov–Dez"
            />
            <FensterZeile
              titel="Wahljahr: oft Rückenwind nach dem Wahltag"
              vorher={aktiv.wahlZyklus.wahljahrVorher}
              danach={aktiv.wahlZyklus.wahljahrDanach}
              vorherLabel="Jan–Okt"
              danachLabel="Nov–Dez"
            />
          </div>
        </PaCard>
      ) : null}
    </PortfolioAnalyseShell>
  )
}
