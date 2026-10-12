'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { appTableScrollClassName } from '@/components/page-shell'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import { CHART } from '@/lib/chart-theme'
import { formatEur } from '@/lib/portfolio-analyse/berechnung'
import {
  berechneZinseszins,
  sparrateFuerZiel,
  type ZinsFrequenz,
} from '@/lib/portfolio-analyse/zinseszins-rechner'

const FREQUENZEN: { id: ZinsFrequenz; label: string }[] = [
  { id: 'monatlich', label: 'Monatlich' },
  { id: 'quartalsweise', label: 'Quartal' },
  { id: 'jaehrlich', label: 'Jährlich' },
]

const RENDITE_PRESETS = [
  { label: '3 %', value: 3 },
  { label: '5 %', value: 5 },
  { label: '7 %', value: 7 },
  { label: '9 %', value: 9 },
]

function formatKompaktEur(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio. €`
  }
  if (abs >= 10_000) {
    return `${Math.round(n).toLocaleString('de-DE')} €`
  }
  return formatEur(n)
}

function Feld({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-[var(--app-text)]">{label}</span>
        {hint ? <span className="text-[10px] text-[var(--app-text-muted)]">{hint}</span> : null}
      </span>
      {children}
    </label>
  )
}

function ZahlInput({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2.5 focus-within:border-teal-500/50">
      <input
        type="number"
        inputMode="decimal"
        className="min-w-0 flex-1 bg-transparent py-2 text-sm tabular-nums text-[var(--app-text)] outline-none"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isFinite(n)) return
          let v = n
          if (min != null) v = Math.max(min, v)
          if (max != null) v = Math.min(max, v)
          onChange(v)
        }}
      />
      {suffix ? <span className="shrink-0 text-xs text-[var(--app-text-muted)]">{suffix}</span> : null}
    </div>
  )
}

function SliderZeile({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  step: number
}) {
  return (
    <input
      type="range"
      className="w-full accent-teal-400"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

function Kennzahl({
  label,
  wert,
  accent,
  sub,
}: {
  label: string
  wert: string
  accent?: 'teal' | 'emerald' | 'muted'
  sub?: string
}) {
  const wertClass =
    accent === 'teal'
      ? 'text-teal-300'
      : accent === 'emerald'
        ? 'text-emerald-300'
        : 'text-[var(--app-text)]'
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/60 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold tabular-nums sm:text-xl ${wertClass}`}>{wert}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">{sub}</p> : null}
    </div>
  )
}

type Props = {
  /** Optional: Depotwert als Startkapital vorbelegen */
  depotwertEur?: number | null
}

export function PaZinseszinsRechner({ depotwertEur }: Props) {
  const [startkapital, setStartkapital] = useState(10_000)
  const [sparrate, setSparrate] = useState(500)
  const [rendite, setRendite] = useState(7)
  const [laufzeit, setLaufzeit] = useState(20)
  const [frequenz, setFrequenz] = useState<ZinsFrequenz>('monatlich')
  const [steigern, setSteigern] = useState(0)
  const [inflation, setInflation] = useState(2)
  const [zielkapital, setZielkapital] = useState(0)
  const [tabelleOffen, setTabelleOffen] = useState(false)

  const ergebnis = useMemo(
    () =>
      berechneZinseszins({
        startkapitalEur: startkapital,
        sparrateMonatEur: sparrate,
        jahresRenditePct: rendite,
        laufzeitJahre: laufzeit,
        frequenz,
        sparrateSteigerungPct: steigern,
        inflationPct: inflation,
      }),
    [startkapital, sparrate, rendite, laufzeit, frequenz, steigern, inflation],
  )

  const bedarfRate = useMemo(() => {
    if (zielkapital <= 0) return null
    return sparrateFuerZiel({
      startkapitalEur: startkapital,
      zielEur: zielkapital,
      jahresRenditePct: rendite,
      laufzeitJahre: laufzeit,
      frequenz,
    })
  }, [zielkapital, startkapital, rendite, laufzeit, frequenz])

  const chartData = useMemo(
    () =>
      ergebnis.verlauf.map((p) => ({
        jahr: p.jahrLabel,
        Endwert: Math.round(p.endwertEur),
        Eingezahlt: Math.round(p.eingezahltEur),
      })),
    [ergebnis.verlauf],
  )

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-[var(--app-text)]">Zinseszinsrechner</h2>
        <p className="mt-1 text-xs text-[var(--app-text-muted)]">
          Startkapital, Sparplan und Rendite — Endwert, Zinsertrag und Kaufkraft inkl. optionaler
          Inflation.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <PaCard className="space-y-4 p-4 sm:p-5">
          <Feld label="Startkapital">
            <ZahlInput value={startkapital} onChange={setStartkapital} step={100} suffix="€" />
          </Feld>
          {depotwertEur != null && depotwertEur > 0 ? (
            <button
              type="button"
              onClick={() => setStartkapital(Math.round(depotwertEur))}
              className="text-xs text-teal-400 hover:underline"
            >
              Depotwert übernehmen ({formatKompaktEur(depotwertEur)})
            </button>
          ) : null}

          <Feld label="Monatliche Sparrate">
            <ZahlInput value={sparrate} onChange={setSparrate} step={50} suffix="€" />
            <SliderZeile value={sparrate} onChange={setSparrate} min={0} max={5000} step={50} />
          </Feld>

          <Feld label="Erwartete Rendite p.a." hint="nominal">
            <ZahlInput value={rendite} onChange={setRendite} min={0} max={30} step={0.1} suffix="%" />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {RENDITE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setRendite(p.value)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                    rendite === p.value
                      ? 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/40'
                      : 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Feld>

          <Feld label="Laufzeit" hint={`${laufzeit} Jahre`}>
            <ZahlInput value={laufzeit} onChange={setLaufzeit} min={1} max={60} step={1} suffix="Jahre" />
            <SliderZeile value={laufzeit} onChange={setLaufzeit} min={1} max={60} step={1} />
          </Feld>

          <Feld label="Zinsgutschrift">
            <div className="flex rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-0.5">
              {FREQUENZEN.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFrequenz(f.id)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition sm:text-xs ${
                    frequenz === f.id
                      ? 'bg-[var(--app-surface)] text-teal-300 shadow-sm'
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Feld>

          <div className="grid grid-cols-2 gap-3">
            <Feld label="Sparrate +/Jahr" hint="optional">
              <ZahlInput value={steigern} onChange={setSteigern} min={0} max={20} step={0.5} suffix="%" />
            </Feld>
            <Feld label="Inflation p.a." hint="Kaufkraft">
              <ZahlInput value={inflation} onChange={setInflation} min={0} max={15} step={0.1} suffix="%" />
            </Feld>
          </div>

          <div className="border-t border-[var(--app-border)] pt-4">
            <Feld label="Zielkapital" hint="optional · rückwärts rechnen">
              <ZahlInput value={zielkapital} onChange={setZielkapital} step={1000} suffix="€" />
            </Feld>
            {bedarfRate != null && zielkapital > 0 ? (
              <p className="mt-2 text-xs text-[var(--app-text-muted)]">
                Dafür brauchst du ca.{' '}
                <button
                  type="button"
                  className="font-medium text-teal-300 hover:underline"
                  onClick={() => setSparrate(Math.round(bedarfRate))}
                >
                  {formatEur(bedarfRate)} / Monat
                </button>{' '}
                (ohne Sparratensteigerung).
              </p>
            ) : null}
          </div>
        </PaCard>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kennzahl
              label="Endkapital"
              wert={formatKompaktEur(ergebnis.endwertEur)}
              accent="teal"
              sub={formatEur(ergebnis.endwertEur)}
            />
            <Kennzahl
              label="Eingezahlt"
              wert={formatKompaktEur(ergebnis.eingezahltEur)}
              sub={`${laufzeit} Jahre · Start + Sparplan`}
            />
            <Kennzahl
              label="Zinsertrag"
              wert={formatKompaktEur(ergebnis.zinsenEur)}
              accent="emerald"
              sub={`${ergebnis.zinsenAnteilPct.toLocaleString('de-DE', { maximumFractionDigits: 0 })} % vom Endwert`}
            />
            <Kennzahl
              label="Kaufkraft heute"
              wert={formatKompaktEur(ergebnis.realEndwertEur)}
              sub={
                inflation > 0
                  ? `bei ${inflation.toLocaleString('de-DE')} % Inflation`
                  : 'ohne Inflationsabzug'
              }
            />
          </div>

          <PaCard className="p-4 sm:p-5">
            <p className="mb-3 text-xs font-medium text-[var(--app-text-muted)]">
              Vermögensverlauf über {laufzeit} Jahre
            </p>
            <div className="h-[260px] w-full min-w-0 sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%" debounce={50}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="zzEndwert" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART.primary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="jahr"
                    tick={{ fill: 'var(--app-text-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v} J`}
                  />
                  <YAxis
                    tick={{ fill: 'var(--app-text-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tickFormatter={(v: number) => formatKompaktEur(v).replace(' €', '')}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--app-surface)',
                      border: '1px solid var(--app-border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(l) => `Jahr ${l}`}
                    formatter={(value, name) => [
                      formatEur(typeof value === 'number' ? value : Number(value)),
                      String(name),
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="Endwert"
                    stroke={CHART.primary}
                    fill="url(#zzEndwert)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Eingezahlt"
                    stroke={CHART.sky}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </PaCard>

          <PaCard className="p-4 sm:p-5">
            <button
              type="button"
              onClick={() => setTabelleOffen((o) => !o)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-sm font-medium text-[var(--app-text)]">Jahresübersicht</span>
              <span className="text-xs text-[var(--app-text-muted)]">
                {tabelleOffen ? 'Ausblenden' : 'Anzeigen'}
              </span>
            </button>
            {tabelleOffen ? (
              <div className={`mt-3 ${appTableScrollClassName}`}>
                <table className="app-data-table w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--app-border)] text-xs text-[var(--app-text-muted)]">
                      <th className="py-2 pr-3 text-left font-medium">Jahr</th>
                      <th className="px-3 py-2 text-right font-medium">Eingezahlt</th>
                      <th className="px-3 py-2 text-right font-medium">Zinsen</th>
                      <th className="px-3 py-2 text-right font-medium">Endwert</th>
                      <th className="px-3 py-2 text-right font-medium">Kaufkraft</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ergebnis.jahre.map((z) => (
                      <tr key={z.jahr} className="border-b border-[var(--app-border)]/50">
                        <td className="py-2 pr-3 font-medium tabular-nums text-[var(--app-text)]">
                          {z.jahr}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[var(--app-text)]">
                          {formatEur(z.eingezahltEur)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-300/90">
                          {formatEur(z.zinsenEur)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-teal-300">
                          {formatEur(z.endwertEur)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-[var(--app-text-muted)]">
                          {formatEur(z.realEndwertEur)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </PaCard>
        </div>
      </div>
    </div>
  )
}
