'use client'

import { useEffect, useMemo, useState } from 'react'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  berechneDcf,
  berechneSensitivitaet,
  defaultDcfEingaben,
  formatDcfKurs,
  formatDcfUsd,
  schaetzeWaccAusCapm,
  type DcfEingaben,
} from '@/lib/portfolio-analyse/fundamentaldaten-dcf'
import type { FundamentalDcfKontext } from '@/lib/portfolio-analyse/fundamentaldaten-types'

function EingabeZeile({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string
  hint?: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  suffix?: string
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-zinc-300">{label}</span>
        <span className="text-xs tabular-nums text-teal-300">
          {value.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
          {suffix ?? '%'}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-teal-500"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
        className="w-full rounded-lg border border-zinc-700/70 bg-zinc-950/80 px-2.5 py-1.5 text-xs tabular-nums text-zinc-200 outline-none focus:border-teal-500/40"
      />
      {hint ? <p className="text-[10px] text-zinc-600">{hint}</p> : null}
    </label>
  )
}

function WertBruecke({
  pvExplizit,
  pvTerminal,
  netDebt,
  aktien,
  fairValue,
}: {
  pvExplizit: number
  pvTerminal: number
  netDebt: number
  aktien: number
  fairValue: number | null
}) {
  const ev = pvExplizit + pvTerminal
  const max = Math.max(pvExplizit, pvTerminal, ev, 1)
  const bars = [
    { label: 'PV explizit', wert: pvExplizit, farbe: '#2dd4bf' },
    { label: 'PV Terminal', wert: pvTerminal, farbe: '#818cf8' },
    { label: 'Enterprise Value', wert: ev, farbe: '#f59e0b' },
  ]

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Wertbrücke</p>
      {bars.map((b) => (
        <div key={b.label}>
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="text-zinc-500">{b.label}</span>
            <span className="tabular-nums text-zinc-300">{formatDcfUsd(b.wert)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800/80">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (b.wert / max) * 100)}%`, background: b.farbe }}
            />
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2 border-t border-white/[0.05] pt-3 text-[11px]">
        <div>
          <span className="text-zinc-600">− Nettoverschuldung</span>
          <p className="tabular-nums text-zinc-300">{formatDcfUsd(netDebt)}</p>
        </div>
        <div>
          <span className="text-zinc-600">÷ Aktien</span>
          <p className="tabular-nums text-zinc-300">
            {aktien > 0 ? `${(aktien / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio.` : '–'}
          </p>
        </div>
        <div className="col-span-2 rounded-lg bg-teal-500/[0.08] px-3 py-2 ring-1 ring-teal-500/20">
          <span className="text-[10px] uppercase tracking-wide text-teal-400/80">Fair Value / Aktie</span>
          <p className="text-lg font-semibold tabular-nums text-teal-100">{formatDcfKurs(fairValue)}</p>
        </div>
      </div>
    </div>
  )
}

function FcfChart({ jahre, pvTerminal }: { jahre: { jahr: number; fcfUsd: number; pvUsd: number }[]; pvTerminal: number }) {
  const max = Math.max(...jahre.map((j) => j.fcfUsd), pvTerminal, 1)
  const w = 100
  const h = 120
  const pad = 8

  const pts = jahre.map((j, i) => {
    const x = pad + ((w - 2 * pad) * i) / Math.max(1, jahre.length - 1)
    const y = h - pad - ((h - 2 * pad) * j.fcfUsd) / max
    return { x, y, ...j }
  })
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="FCF-Prognose">
      <defs>
        <linearGradient id="dcf-fcf-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
        </linearGradient>
      </defs>
      {pts.length > 1 ? (
        <path
          d={`${line} L ${pts[pts.length - 1]!.x} ${h - pad} L ${pts[0]!.x} ${h - pad} Z`}
          fill="url(#dcf-fcf-grad)"
        />
      ) : null}
      <path d={line} fill="none" stroke="#2dd4bf" strokeWidth={2} strokeLinecap="round" />
      {pts.map((p) => (
        <circle key={p.jahr} cx={p.x} cy={p.y} r={3} fill="#09090b" stroke="#2dd4bf" strokeWidth={1.5} />
      ))}
    </svg>
  )
}

function SensitivitaetsMatrix({
  zellen,
  basisWacc,
  basisTerminal,
  aktuellerKurs,
}: {
  zellen: ReturnType<typeof berechneSensitivitaet>
  basisWacc: number
  basisTerminal: number
  aktuellerKurs: number | null
}) {
  const waccs = [...new Set(zellen.map((z) => z.waccPct))].sort((a, b) => a - b)
  const terms = [...new Set(zellen.map((z) => z.terminalPct))].sort((a, b) => a - b)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[280px] border-collapse text-center text-[11px]">
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left text-zinc-600">WACC ↓ / g ∞ →</th>
            {terms.map((t) => (
              <th key={t} className="px-2 py-1.5 font-medium text-zinc-500">
                {t.toFixed(1)}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {waccs.map((w) => (
            <tr key={w}>
              <td className="px-2 py-1.5 text-left font-medium text-zinc-500">{w.toFixed(1)}%</td>
              {terms.map((t) => {
                const hit = zellen.find((z) => z.waccPct === w && z.terminalPct === t)
                const fv = hit?.fairValueUsd ?? null
                const istBasis = w === basisWacc && t === basisTerminal
                const ueber =
                  fv != null && aktuellerKurs != null && aktuellerKurs > 0 && fv > aktuellerKurs * 1.05
                const unter =
                  fv != null && aktuellerKurs != null && aktuellerKurs > 0 && fv < aktuellerKurs * 0.95
                return (
                  <td
                    key={t}
                    className={`px-2 py-2 tabular-nums ${
                      istBasis
                        ? 'bg-teal-500/15 font-semibold text-teal-200 ring-1 ring-inset ring-teal-500/30'
                        : ueber
                          ? 'bg-emerald-500/[0.07] text-emerald-200/90'
                          : unter
                            ? 'bg-rose-500/[0.07] text-rose-200/90'
                            : 'text-zinc-400'
                    }`}
                  >
                    {formatDcfKurs(fv)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PaFundamentalDcf({
  kontext,
  ticker,
  selectionKey,
}: {
  kontext: FundamentalDcfKontext | null
  ticker: string
  selectionKey?: string
}) {
  const basisEingaben = useMemo(() => (kontext ? defaultDcfEingaben(kontext) : null), [kontext])

  const [eingaben, setEingaben] = useState<DcfEingaben | null>(null)
  const [risikofrei, setRisikofrei] = useState(4.25)
  const [erp, setErp] = useState(5.5)

  useEffect(() => {
    if (!basisEingaben || !kontext) {
      setEingaben(null)
      return
    }
    setEingaben(basisEingaben)
    setRisikofrei(kontext.risikofreierZinsPct)
    setErp(kontext.marktrisikopraemiePct)
  }, [selectionKey, basisEingaben, kontext])

  const ergebnis = useMemo(() => (eingaben ? berechneDcf(eingaben) : null), [eingaben])
  const sensitivitaet = useMemo(
    () => (eingaben && ergebnis?.ok ? berechneSensitivitaet(eingaben) : []),
    [eingaben, ergebnis?.ok],
  )

  if (!kontext) {
    return (
      <PaCard variant="glass" className="p-10 text-center text-sm text-zinc-500">
        Keine DCF-Daten verfügbar.
      </PaCard>
    )
  }

  if (!basisEingaben || !eingaben) {
    return (
      <PaCard variant="glass" className="space-y-3 p-8">
        <h3 className="text-base font-medium text-zinc-200">DCF-Modell nicht möglich</h3>
        <p className="text-sm text-zinc-500">
          Für {ticker} fehlt ein positiver Free Cashflow oder die Aktienanzahl — ein klassisches DCF ist hier nicht
          sinnvoll (z. B. bei stark verlustbringenden oder hoch wachsenden Tech-Titeln).
        </p>
        <ul className="text-left text-xs text-zinc-600">
          <li>Basis-FCF: {kontext.basisFcfUsd != null ? formatDcfUsd(kontext.basisFcfUsd) : '–'}</li>
          <li>Aktien: {kontext.aktienAnzahl != null ? `${(kontext.aktienAnzahl / 1e6).toFixed(2)} Mio.` : '–'}</li>
        </ul>
      </PaCard>
    )
  }

  if (!ergebnis?.ok) {
    return (
      <PaCard variant="glass" className="p-8 text-sm text-amber-200/90">
        {ergebnis?.fehler ?? 'DCF-Berechnung fehlgeschlagen.'}
      </PaCard>
    )
  }

  const fair = ergebnis.fairValueProAktieUsd ?? null
  const kurs = eingaben.aktuellerKursUsd
  const upside = ergebnis.upsidePct
  const ueberbewertet = upside != null && upside < -5
  const unterbewertet = upside != null && upside > 5

  const patch = (p: Partial<DcfEingaben>) => setEingaben((prev) => (prev ? { ...prev, ...p } : prev))

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="grid gap-3 lg:grid-cols-3">
        <PaCard
          variant="glass"
          className="relative overflow-hidden p-5 lg:col-span-1"
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal-500/10 blur-2xl" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Fair Value (DCF)</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-teal-100">
            {formatDcfKurs(fair)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">pro Aktie · unlevered FCF-Modell</p>
        </PaCard>

        <PaCard variant="glass" className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Aktueller Kurs</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-100">{formatDcfKurs(kurs)}</p>
          <p className="mt-1 text-xs text-zinc-500">Yahoo Finance</p>
        </PaCard>

        <PaCard
          variant="glass"
          className={`p-5 ${
            unterbewertet
              ? 'ring-1 ring-emerald-500/25'
              : ueberbewertet
                ? 'ring-1 ring-rose-500/25'
                : ''
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Abweichung</p>
          <p
            className={`mt-1 text-3xl font-semibold tabular-nums ${
              unterbewertet ? 'text-emerald-300' : ueberbewertet ? 'text-rose-300' : 'text-zinc-300'
            }`}
          >
            {upside != null ? `${upside > 0 ? '+' : ''}${upside.toFixed(1)}%` : '–'}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {unterbewertet ? 'unter Fair Value' : ueberbewertet ? 'über Fair Value' : 'nahe Fair Value'}
          </p>
        </PaCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,320px)_1fr]">
        {/* Annahmen */}
        <PaCard variant="glass" className="h-fit space-y-4 p-4">
          <div>
            <h3 className="text-sm font-medium text-zinc-100">Annahmen</h3>
            <p className="mt-0.5 text-[11px] text-zinc-500">Schieberegler oder exakte Eingabe</p>
          </div>

          <div className="rounded-lg border border-white/[0.05] bg-zinc-950/40 p-3 text-[11px] text-zinc-500">
            <p>
              Basis-FCF ({kontext.basisFcfQuelle ?? '—'}):{' '}
              <span className="font-medium text-zinc-300">{formatDcfUsd(kontext.basisFcfUsd)}</span>
            </p>
            {kontext.fcfCagr3yPct != null ? (
              <p className="mt-1">FCF-CAGR 3J: {kontext.fcfCagr3yPct.toFixed(1)}%</p>
            ) : null}
            {kontext.beta != null ? <p className="mt-1">Beta: {kontext.beta.toFixed(2)}</p> : null}
          </div>

          <EingabeZeile
            label="WACC"
            hint={`CAPM-Vorschlag: ${schaetzeWaccAusCapm(kontext.beta, risikofrei, erp).toFixed(1)}%`}
            value={eingaben.waccPct}
            onChange={(v) => patch({ waccPct: v })}
            min={5}
            max={18}
            step={0.1}
          />
          <EingabeZeile
            label="FCF-Wachstum (Prognosephase)"
            hint={`Vorschlag aus Historie/Konsens: ${kontext.wachstumVorschlagPct.toFixed(1)}%`}
            value={eingaben.wachstumExplizitPct}
            onChange={(v) => patch({ wachstumExplizitPct: v })}
            min={-10}
            max={30}
            step={0.5}
          />
          <EingabeZeile
            label="Terminales Wachstum (g∞)"
            value={eingaben.terminalWachstumPct}
            onChange={(v) => patch({ terminalWachstumPct: v })}
            min={0}
            max={5}
            step={0.1}
          />
          <EingabeZeile
            label="Prognosejahre"
            value={eingaben.prognoseJahre}
            onChange={(v) => patch({ prognoseJahre: Math.round(v) })}
            min={3}
            max={15}
            step={1}
            suffix=" J."
          />

          <details className="rounded-lg border border-zinc-800/80 bg-zinc-950/30 px-3 py-2">
            <summary className="cursor-pointer text-[11px] font-medium text-zinc-400">CAPM-Parameter (WACC)</summary>
            <div className="mt-3 space-y-3">
              <EingabeZeile
                label="Risikofreier Zins"
                value={risikofrei}
                onChange={(v) => {
                  setRisikofrei(v)
                  patch({ waccPct: schaetzeWaccAusCapm(kontext.beta, v, erp) })
                }}
                min={1}
                max={8}
                step={0.1}
              />
              <EingabeZeile
                label="Marktrisikoprämie"
                value={erp}
                onChange={(v) => {
                  setErp(v)
                  patch({ waccPct: schaetzeWaccAusCapm(kontext.beta, risikofrei, v) })
                }}
                min={3}
                max={9}
                step={0.1}
              />
            </div>
          </details>
        </PaCard>

        {/* Ergebnis */}
        <div className="space-y-4">
          <PaCard variant="glass" className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-zinc-100">FCF-Prognose & Barwerte</h3>
              <span className="text-[10px] text-zinc-600">{eingaben.prognoseJahre} Jahre explizit + Terminal</span>
            </div>
            <FcfChart jahre={ergebnis.jahre ?? []} pvTerminal={ergebnis.pvTerminalUsd ?? 0} />
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="py-2 text-left font-medium">Jahr</th>
                    <th className="py-2 text-right font-medium">FCF</th>
                    <th className="py-2 text-right font-medium">Barwert</th>
                  </tr>
                </thead>
                <tbody>
                  {ergebnis.jahre?.map((j) => (
                    <tr key={j.jahr} className="border-b border-zinc-800/50 text-zinc-300">
                      <td className="py-2">{j.jahr}</td>
                      <td className="py-2 text-right tabular-nums">{formatDcfUsd(j.fcfUsd)}</td>
                      <td className="py-2 text-right tabular-nums text-teal-300/90">{formatDcfUsd(j.pvUsd)}</td>
                    </tr>
                  ))}
                  <tr className="text-zinc-400">
                    <td className="py-2 font-medium">Terminal</td>
                    <td className="py-2 text-right tabular-nums">{formatDcfUsd(ergebnis.terminalFcfUsd)}</td>
                    <td className="py-2 text-right tabular-nums text-violet-300/90">
                      {formatDcfUsd(ergebnis.pvTerminalUsd)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </PaCard>

          <div className="grid gap-4 md:grid-cols-2">
            <PaCard variant="glass" className="p-4">
              <WertBruecke
                pvExplizit={ergebnis.pvExplizitUsd ?? 0}
                pvTerminal={ergebnis.pvTerminalUsd ?? 0}
                netDebt={eingaben.nettoverschuldungUsd}
                aktien={eingaben.aktienAnzahl}
                fairValue={fair}
              />
            </PaCard>

            <PaCard variant="glass" className="p-4">
              <h3 className="mb-2 text-sm font-medium text-zinc-100">Sensitivität Fair Value</h3>
              <p className="mb-3 text-[10px] text-zinc-600">WACC ±1% · g∞ ±0,5% · Highlight = deine Annahmen</p>
              <SensitivitaetsMatrix
                zellen={sensitivitaet}
                basisWacc={eingaben.waccPct}
                basisTerminal={eingaben.terminalWachstumPct}
                aktuellerKurs={kurs}
              />
            </PaCard>
          </div>
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-zinc-600">
        Vereinfachtes unlevered DCF auf Basis Macrotrends-FCF und Yahoo-Kapitalstruktur. Keine Anlageberatung — Annahmen
        prüfen (WACC, Wachstum, Terminalwert). Nettoverschuldung = Schulden − Cash (Yahoo).
      </p>
    </div>
  )
}
