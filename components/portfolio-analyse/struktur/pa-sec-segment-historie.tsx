'use client'

import { useMemo, useState } from 'react'

import { appTableScrollClassName } from '@/components/page-shell'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  PaStrukturKennzahl,
  PaStrukturSectionHeader,
  PaStrukturSegmentDonut,
} from '@/components/portfolio-analyse/struktur/pa-struktur-visuals'
import type {
  SecBacklogHistorie,
  SecKennzahlJahr,
  SecKennzahlenHistorie,
  SecSegmentHistorie,
  SecSegmentHistoriePaket,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { segmentFarben } from '@/lib/portfolio-analyse/fundamentaldaten-struktur-hilfen'
import { begrenzeSegmentHistorie } from '@/lib/portfolio-analyse/sec-segment-historie-hilfen'

function alleSegmentNamen(hist: SecSegmentHistorie): string[] {
  const namen = new Set<string>()
  for (const j of hist.jahre) {
    for (const s of j.segmente) namen.add(s.name)
  }
  return [...namen].sort()
}

function anteilFuerSegment(hist: SecSegmentHistorie, jahr: number, name: string): number | null {
  return hist.jahre.find((j) => j.jahr === jahr)?.segmente.find((s) => s.name === name)?.anteilPct ?? null
}

function umsatzFuerSegment(hist: SecSegmentHistorie, jahr: number, name: string): number | null {
  return hist.jahre.find((j) => j.jahr === jahr)?.segmente.find((s) => s.name === name)?.umsatzMio ?? null
}

function umsatzWachstumPct(aktuell: number | null, vorjahr: number | null): number | null {
  if (aktuell == null || vorjahr == null || vorjahr === 0) return null
  return Math.round(((aktuell - vorjahr) / Math.abs(vorjahr)) * 1000) / 10
}

function wachstumClass(pct: number): string {
  if (pct > 0.5) return 'text-emerald-400'
  if (pct < -0.5) return 'text-red-300'
  return 'text-[var(--app-text-muted)]'
}

function barBreite(anzahl: number): number {
  if (anzahl > 12) return 20
  if (anzahl > 8) return 26
  if (anzahl > 6) return 32
  return 40
}

function PaSecSegmentStackedChart({ hist, farben }: { hist: SecSegmentHistorie; farben: string[] }) {
  const namen = useMemo(() => alleSegmentNamen(hist), [hist])
  const jahre = hist.jahre.map((j) => j.jahr)
  const barW = barBreite(jahre.length)
  const gap = jahre.length > 10 ? 6 : 12
  const chartH = 220
  const padL = 4
  const padB = 28
  const width = Math.max(360, padL + jahre.length * (barW + gap) + 12)

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={chartH + padB} viewBox={`0 0 ${width} ${chartH + padB}`} className="block min-w-full">
        {jahre.map((jahr, ji) => {
          const x = padL + ji * (barW + gap)
          const segmente = [...(hist.jahre.find((j) => j.jahr === jahr)?.segmente ?? [])]
            .filter((s) => (s.anteilPct ?? 0) > 0)
            .sort((a, b) => namen.indexOf(a.name) - namen.indexOf(b.name))
          let yAcc = chartH
          return (
            <g key={jahr}>
              {segmente.map((s) => {
                const pct = s.anteilPct ?? 0
                const h = (pct / 100) * chartH
                yAcc -= h
                const farbe = farben[namen.indexOf(s.name) % farben.length]!
                return (
                  <rect key={s.name} x={x} y={yAcc} width={barW} height={h} fill={farbe} opacity={0.9} rx={1}>
                    <title>
                      {jahr}: {s.name} — {pct.toFixed(1)} % ({s.umsatzMio?.toLocaleString('de-DE')} Mio.)
                    </title>
                  </rect>
                )
              })}
              <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" className="fill-[var(--app-text-muted)]" style={{ fontSize: 9 }}>
                {jahr}
              </text>
            </g>
          )
        })}
        <line x1={padL} y1={chartH} x2={width - 8} y2={chartH} stroke="var(--app-border-strong)" strokeOpacity={0.5} />
      </svg>
    </div>
  )
}

function formatMitarbeiterZahl(n: number): string {
  return n.toLocaleString('de-DE')
}

function formatBacklogMio(mio: number): string {
  if (mio >= 1_000) {
    const mrd = mio / 1_000
    return `${mrd.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mrd. $`
  }
  return `${mio.toLocaleString('de-DE', { maximumFractionDigits: 0 })} Mio. $`
}

function backlogYTicks(minV: number, maxV: number): number[] {
  const span = maxV - minV || maxV * 0.1 || 1
  const yMin = Math.max(0, minV - span * 0.08)
  const yMax = maxV + span * 0.08
  const mid = Math.round((yMin + yMax) / 2)
  return [...new Set([Math.round(yMin), mid, Math.round(yMax)])].sort((a, b) => a - b)
}

function umsatzMioFuerJahr(kz: SecKennzahlenHistorie | null | undefined, jahr: number): number | null {
  return kz?.umsatzMio.find((e) => e.jahr === jahr)?.wert ?? null
}

function PaSecBacklogHistorie({
  backlog,
  kennzahlen,
}: {
  backlog: SecBacklogHistorie
  kennzahlen?: SecKennzahlenHistorie | null
}) {
  const sorted = [...backlog.eintraege].sort((a, b) => a.jahr - b.jahr)
  if (sorted.length < 2) return null

  const jahre = sorted.map((e) => e.jahr)
  const werte = sorted.map((e) => e.wertMio)
  const minV = Math.min(...werte)
  const maxV = Math.max(...werte)
  const yTicks = backlogYTicks(minV, maxV)
  const yMin = yTicks[0]!
  const yMax = yTicks[yTicks.length - 1]!
  const ySpan = yMax - yMin || 1

  const pad = { l: 62, r: 12, t: 22, b: 28 }
  const chartH = 160
  const w = Math.max(360, jahre.length * 52 + pad.l + pad.r)
  const h = chartH + pad.t + pad.b
  const chartW = w - pad.l - pad.r
  const yAchse =
    maxV >= 1_000 ? 'Mrd. USD' : 'Mio. USD'

  const xFor = (ji: number) => pad.l + (ji / Math.max(1, jahre.length - 1)) * chartW
  const yFor = (v: number) => pad.t + chartH - ((v - yMin) / ySpan) * chartH
  const farbe = '#38bdf8'

  const punkte = sorted.map((e, ji) => ({ ...e, x: xFor(ji), y: yFor(e.wertMio) }))
  const neueste = sorted[sorted.length - 1]!

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <PaStrukturKennzahl label={backlog.label} wert={formatBacklogMio(neueste.wertMio)} hinweis={`GJ ${neueste.jahr} · ${backlog.quelleTag}`} />
        {(() => {
          const vor = sorted[sorted.length - 2]
          if (!vor) return null
          const yoy = umsatzWachstumPct(neueste.wertMio, vor.wertMio)
          return yoy != null ? (
            <PaStrukturKennzahl
              label="YoY Backlog"
              wert={`${yoy > 0 ? '+' : ''}${yoy.toLocaleString('de-DE')}%`}
              accent={yoy > 0 ? 'emerald' : yoy < -0.5 ? 'red' : 'default'}
            />
          ) : null
        })()}
        {(() => {
          const umsatz = umsatzMioFuerJahr(kennzahlen, neueste.jahr)
          if (umsatz == null || umsatz <= 0) return null
          const ratio = Math.round((neueste.wertMio / umsatz) * 1000) / 10
          return (
            <PaStrukturKennzahl
              label="Backlog / Umsatz"
              wert={`${ratio.toLocaleString('de-DE')}×`}
              hinweis="RPO/Backlog geteilt durch Jahresumsatz"
            />
          )
        })()}
      </div>

      <div className="overflow-x-auto">
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block min-w-full">
          <text
            x={12}
            y={pad.t + chartH / 2}
            textAnchor="middle"
            transform={`rotate(-90, 12, ${pad.t + chartH / 2})`}
            className="fill-[var(--app-text-muted)]"
            style={{ fontSize: 9 }}
          >
            {yAchse}
          </text>

          {yTicks.map((tick) => {
            const y = yFor(tick)
            return (
              <g key={tick}>
                <line
                  x1={pad.l}
                  y1={y}
                  x2={w - pad.r}
                  y2={y}
                  stroke="var(--app-border-strong)"
                  strokeOpacity={0.35}
                  strokeDasharray="3 3"
                />
                <text x={pad.l - 6} y={y + 3} textAnchor="end" className="fill-[var(--app-text-muted)]" style={{ fontSize: 9 }}>
                  {tick >= 1_000 ? `${(tick / 1_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}` : tick.toLocaleString('de-DE')}
                </text>
              </g>
            )
          })}

          <line x1={pad.l} y1={pad.t + chartH} x2={w - pad.r} y2={pad.t + chartH} stroke="var(--app-border-strong)" strokeOpacity={0.6} />
          <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + chartH} stroke="var(--app-border-strong)" strokeOpacity={0.6} />

          <polyline fill="none" stroke={farbe} strokeWidth={2} points={punkte.map((p) => `${p.x},${p.y}`).join(' ')} />

          {punkte.map((p) => (
            <g key={p.jahr}>
              <circle cx={p.x} cy={p.y} r={3.5} fill={farbe} />
              <text x={p.x} y={p.y - 8} textAnchor="middle" className="fill-[var(--app-text)]" style={{ fontSize: 9, fontWeight: 600 }}>
                {formatBacklogMio(p.wertMio)}
              </text>
            </g>
          ))}

          {jahre.map((j, ji) => (
            <text key={j} x={xFor(ji)} y={h - 6} textAnchor="middle" className="fill-[var(--app-text-muted)]" style={{ fontSize: 9 }}>
              {j}
            </text>
          ))}
        </svg>
      </div>

      <div className={appTableScrollClassName}>
        <table className="app-data-table min-w-full text-left text-xs">
          <thead className="text-[var(--app-text-muted)]">
            <tr>
              <th className="px-2 py-1.5 font-medium">Jahr</th>
              <th className="px-2 py-1.5 font-medium text-right">{backlog.label}</th>
              <th className="px-2 py-1.5 font-medium text-right">YoY</th>
              <th className="px-2 py-1.5 font-medium text-right">├À Umsatz</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => {
              const vor = i > 0 ? sorted[i - 1] : null
              const yoy = vor ? umsatzWachstumPct(e.wertMio, vor.wertMio) : null
              const umsatz = umsatzMioFuerJahr(kennzahlen, e.jahr)
              const ratio = umsatz != null && umsatz > 0 ? Math.round((e.wertMio / umsatz) * 1000) / 10 : null
              return (
                <tr key={e.jahr} className="border-t border-[var(--app-border)]/40">
                  <td className="px-2 py-1.5 tabular-nums">{e.jahr}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium">{formatBacklogMio(e.wertMio)}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${yoy != null ? wachstumClass(yoy) : ''}`}>
                    {yoy != null ? `${yoy > 0 ? '+' : ''}${yoy.toLocaleString('de-DE')}%` : '–'}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-[var(--app-text-muted)]">
                    {ratio != null ? `${ratio.toLocaleString('de-DE')}×` : '–'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function mitarbeiterYTicks(minV: number, maxV: number): number[] {
  const span = maxV - minV || maxV * 0.1 || 1
  const yMin = Math.max(0, Math.floor((minV - span * 0.06) / 1000) * 1000)
  const yMax = Math.ceil((maxV + span * 0.06) / 1000) * 1000
  const mid = Math.round((yMin + yMax) / 2)
  return [...new Set([yMin, mid, yMax])].sort((a, b) => a - b)
}

function PaSecMitarbeiterHistorie({ eintraege }: { eintraege: { jahr: number; anzahl: number }[] }) {
  const sorted = [...eintraege].sort((a, b) => a.jahr - b.jahr)
  if (sorted.length < 2) return null

  const jahre = sorted.map((e) => e.jahr)
  const werte = sorted.map((e) => e.anzahl)
  const minV = Math.min(...werte)
  const maxV = Math.max(...werte)
  const yTicks = mitarbeiterYTicks(minV, maxV)
  const yMin = yTicks[0]!
  const yMax = yTicks[yTicks.length - 1]!
  const ySpan = yMax - yMin || 1

  const pad = { l: 58, r: 12, t: 22, b: 28 }
  const chartH = 160
  const w = Math.max(360, jahre.length * 52 + pad.l + pad.r)
  const h = chartH + pad.t + pad.b
  const chartW = w - pad.l - pad.r

  const xFor = (ji: number) => pad.l + (ji / Math.max(1, jahre.length - 1)) * chartW
  const yFor = (v: number) => pad.t + chartH - ((v - yMin) / ySpan) * chartH
  const farbe = '#a78bfa'

  const punkte = sorted.map((e, ji) => ({ ...e, x: xFor(ji), y: yFor(e.anzahl) }))

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block min-w-full">
          <text
            x={12}
            y={pad.t + chartH / 2}
            textAnchor="middle"
            transform={`rotate(-90, 12, ${pad.t + chartH / 2})`}
            className="fill-[var(--app-text-muted)]"
            style={{ fontSize: 9 }}
          >
            Mitarbeiter
          </text>

          {yTicks.map((tick) => {
            const y = yFor(tick)
            return (
              <g key={tick}>
                <line
                  x1={pad.l}
                  y1={y}
                  x2={w - pad.r}
                  y2={y}
                  stroke="var(--app-border-strong)"
                  strokeOpacity={0.35}
                  strokeDasharray="3 3"
                />
                <text
                  x={pad.l - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-[var(--app-text-muted)]"
                  style={{ fontSize: 9 }}
                >
                  {formatMitarbeiterZahl(tick)}
                </text>
              </g>
            )
          })}

          <line
            x1={pad.l}
            y1={pad.t + chartH}
            x2={w - pad.r}
            y2={pad.t + chartH}
            stroke="var(--app-border-strong)"
            strokeOpacity={0.6}
          />
          <line
            x1={pad.l}
            y1={pad.t}
            x2={pad.l}
            y2={pad.t + chartH}
            stroke="var(--app-border-strong)"
            strokeOpacity={0.6}
          />

          <polyline
            fill="none"
            stroke={farbe}
            strokeWidth={2}
            points={punkte.map((p) => `${p.x},${p.y}`).join(' ')}
          />

          {punkte.map((p) => (
            <g key={p.jahr}>
              <circle cx={p.x} cy={p.y} r={3.5} fill={farbe} />
              <text
                x={p.x}
                y={p.y - 8}
                textAnchor="middle"
                className="fill-[var(--app-text)]"
                style={{ fontSize: 9, fontWeight: 600 }}
              >
                {formatMitarbeiterZahl(p.anzahl)}
              </text>
            </g>
          ))}

          {jahre.map((j, ji) => (
            <text
              key={j}
              x={xFor(ji)}
              y={h - 6}
              textAnchor="middle"
              className="fill-[var(--app-text-muted)]"
              style={{ fontSize: 9 }}
            >
              {j}
            </text>
          ))}
        </svg>
      </div>

      <div className={appTableScrollClassName}>
        <table className="app-data-table min-w-full text-left text-xs">
          <thead className="text-[var(--app-text-muted)]">
            <tr>
              <th className="pb-2 pr-3 font-medium">Jahr</th>
              <th className="pb-2 pr-3 text-right font-medium">Mitarbeiter</th>
              <th className="pb-2 text-right font-medium">Veränderung</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => {
              const vor = i > 0 ? sorted[i - 1]!.anzahl : null
              const deltaPct =
                vor != null && vor > 0 ? Math.round(((e.anzahl - vor) / vor) * 1000) / 10 : null
              return (
                <tr key={e.jahr} className="border-t border-[var(--app-border)]/40">
                  <td className="py-2 pr-3 font-medium text-[var(--app-text)]">{e.jahr}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--app-text)]">
                    {formatMitarbeiterZahl(e.anzahl)}
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums font-medium ${
                      deltaPct == null
                        ? 'text-[var(--app-text-muted)]'
                        : deltaPct > 0.5
                          ? 'text-emerald-400'
                          : deltaPct < -0.5
                            ? 'text-red-300'
                            : 'text-[var(--app-text-muted)]'
                    }`}
                  >
                    {deltaPct == null
                      ? '–'
                      : (deltaPct > 0 ? '+' : '') + deltaPct.toLocaleString('de-DE') + ' %'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PaSecLinienChart({
  reihen,
  jahre,
  height = 140,
}: {
  reihen: { label: string; farbe: string; werte: Map<number, number> }[]
  jahre: number[]
  height?: number
}) {
  if (jahre.length < 2 || reihen.length === 0) return null
  const pad = { l: 8, r: 8, t: 8, b: 24 }
  const w = Math.max(320, jahre.length * 40 + pad.l + pad.r)
  const h = height
  const chartW = w - pad.l - pad.r
  const chartH = h - pad.t - pad.b
  const alleWerte = reihen.flatMap((r) => jahre.map((j) => r.werte.get(j)).filter((v): v is number => v != null))
  const minV = Math.min(...alleWerte)
  const maxV = Math.max(...alleWerte)
  const span = maxV - minV || 1
  const xFor = (ji: number) => pad.l + (ji / Math.max(1, jahre.length - 1)) * chartW
  const yFor = (v: number) => pad.t + chartH - ((v - minV) / span) * chartH

  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block min-w-full">
        {reihen.map((r) => {
          const pts = jahre.map((j, ji) => { const v = r.werte.get(j); return v != null ? `${xFor(ji)},${yFor(v)}` : null }).filter(Boolean)
          if (pts.length < 2) return null
          return (
            <g key={r.label}>
              <polyline fill="none" stroke={r.farbe} strokeWidth={2} points={pts.join(' ')} />
              {jahre.map((j, ji) => { const v = r.werte.get(j); return v != null ? <circle key={j} cx={xFor(ji)} cy={yFor(v)} r={2.5} fill={r.farbe} /> : null })}
            </g>
          )
        })}
        {jahre.map((j, ji) => (
          <text key={j} x={xFor(ji)} y={h - 4} textAnchor="middle" className="fill-[var(--app-text-muted)]" style={{ fontSize: 9 }}>{j}</text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3">
        {reihen.map((r) => (
          <span key={r.label} className="flex items-center gap-1.5 text-[10px] text-[var(--app-text-muted)]">
            <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: r.farbe }} />
            {r.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function reiheZuMap(arr: SecKennzahlJahr[]): Map<number, number> {
  return new Map(arr.map((e) => [e.jahr, e.wert]))
}

function gemeinsameJahre(...arrays: SecKennzahlJahr[][]): number[] {
  const s = new Set<number>()
  for (const a of arrays) for (const e of a) s.add(e.jahr)
  return [...s].sort((a, b) => a - b)
}

function formatMio(mio: number): string {
  if (Math.abs(mio) >= 1_000) {
    return `${(mio / 1_000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mrd. $`
  }
  return `${mio.toLocaleString('de-DE', { maximumFractionDigits: 0 })} Mio. $`
}

function PaSecSegmentTabelle({ hist, farben }: { hist: SecSegmentHistorie; farben: string[] }) {
  const namen = alleSegmentNamen(hist)
  const jahre = hist.jahre.map((j) => j.jahr)

  return (
    <div className={appTableScrollClassName}>
      <table className="app-data-table min-w-full text-left text-xs">
        <thead className="text-[var(--app-text-muted)]">
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--app-surface)] pb-2 pr-3 font-medium">Segment</th>
            {jahre.map((j) => (
              <th key={j} className="min-w-[7.5rem] pb-2 px-2 text-right font-medium">
                <span className="block tabular-nums">{j}</span>
                <span className="mt-0.5 block text-[10px] font-normal text-[var(--app-text-muted)]">
                  Umsatz · YoY
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {namen.map((name, i) => (
            <tr key={name} className="border-t border-[var(--app-border)]/40">
              <td className="sticky left-0 z-10 bg-[var(--app-surface)] py-2.5 pr-3 align-top">
                <span className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: farben[i % farben.length] }} />
                <span className="font-medium text-[var(--app-text)]">{name}</span>
              </td>
              {jahre.map((j, ji) => {
                const mio = umsatzFuerSegment(hist, j, name)
                const anteil = anteilFuerSegment(hist, j, name)
                const vorjahr = ji > 0 ? jahre[ji - 1]! : null
                const wachstum =
                  vorjahr != null ? umsatzWachstumPct(mio, umsatzFuerSegment(hist, vorjahr, name)) : null
                return (
                  <td key={j} className="px-2 py-2.5 align-top text-right tabular-nums">
                    {mio != null ? (
                      <span className="block font-semibold text-[var(--app-text)]">{formatMio(mio)}</span>
                    ) : (
                      <span className="block text-[var(--app-text-muted)]">–</span>
                    )}
                    {anteil != null ? (
                      <span className="block text-[10px] text-[var(--app-text-muted)]">
                        {anteil.toLocaleString('de-DE', { maximumFractionDigits: 1 })} % Mix
                      </span>
                    ) : null}
                    {wachstum != null ? (
                      <span className={`mt-0.5 block text-[11px] font-semibold ${wachstumClass(wachstum)}`}>
                        {wachstum > 0 ? '+' : ''}
                        {wachstum.toLocaleString('de-DE')} % vs. VJ
                      </span>
                    ) : ji > 0 ? (
                      <span className="mt-0.5 block text-[10px] text-[var(--app-text-muted)]">–</span>
                    ) : null}
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

function PaSecKennzahlenPanel({ kz }: { kz: SecKennzahlenHistorie }) {
  const [tab, setTab] = useState<'umsatz' | 'margen' | 'invest' | 'bilanz' | 'personal'>('umsatz')
  const jahreUmsatz = kz.umsatzMio.map((e) => e.jahr)

  return (
    <div className="space-y-4 border-t border-[var(--app-border)]/60 pt-4">
      <div>
        <p className="text-sm font-medium text-white">XBRL-Kennzahlen (SEC Company Facts)</p>
        <p className="text-xs text-[var(--app-text-muted)]">{kz.aeltestesJahr}–{kz.juengstesJahr} · {kz.anzahlJahre} Geschäftsjahre · US-GAAP</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {([
          ['umsatz', 'Umsatz & Gewinn'],
          ['margen', 'Margen & R&D'],
          ['invest', 'CapEx & FCF'],
          ['bilanz', 'Bilanz'],
          ['personal', 'Mitarbeiter'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${tab === id ? 'bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40' : 'bg-[var(--app-surface-muted)]/50 text-[var(--app-text-muted)]'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'umsatz' && <PaSecLinienChart jahre={jahreUmsatz} reihen={[{ label: 'Umsatz', farbe: '#2dd4bf', werte: reiheZuMap(kz.umsatzMio) }, { label: 'EBIT', farbe: '#34d399', werte: reiheZuMap(kz.ebitMio) }, { label: 'Nettogewinn', farbe: '#60a5fa', werte: reiheZuMap(kz.nettogewinnMio) }]} />}
      {tab === 'margen' && <PaSecLinienChart jahre={gemeinsameJahre(kz.ebitMargePct, kz.rndAnteilPct)} reihen={[{ label: 'EBIT-Marge %', farbe: '#34d399', werte: reiheZuMap(kz.ebitMargePct) }, { label: 'Netto-Marge %', farbe: '#60a5fa', werte: reiheZuMap(kz.nettoMargePct) }, { label: 'R&D/Umsatz %', farbe: '#f472b6', werte: reiheZuMap(kz.rndAnteilPct) }]} />}
      {tab === 'invest' && <PaSecLinienChart jahre={gemeinsameJahre(kz.capexMio, kz.fcfMio)} reihen={[{ label: 'CapEx', farbe: '#fbbf24', werte: reiheZuMap(kz.capexMio) }, { label: 'R&D', farbe: '#f472b6', werte: reiheZuMap(kz.rndMio) }, { label: 'FCF', farbe: '#2dd4bf', werte: reiheZuMap(kz.fcfMio) }]} />}
      {tab === 'bilanz' && <PaSecLinienChart jahre={gemeinsameJahre(kz.assetsMio, kz.eigenkapitalMio)} reihen={[{ label: 'Assets', farbe: '#94a3b8', werte: reiheZuMap(kz.assetsMio) }, { label: 'Eigenkapital', farbe: '#34d399', werte: reiheZuMap(kz.eigenkapitalMio) }, { label: 'LT-Schulden', farbe: '#f87171', werte: reiheZuMap(kz.langfristigeSchuldenMio) }]} />}
      {tab === 'personal' && (
        <PaSecMitarbeiterHistorie eintraege={kz.mitarbeiter.map((e) => ({ jahr: e.jahr, anzahl: e.wert }))} />
      )}
      <div className={appTableScrollClassName}>
        <table className="app-data-table min-w-full text-left text-[10px]">
          <thead><tr><th className="sticky left-0 bg-[var(--app-surface)] pb-1 pr-2">Kennzahl</th>{jahreUmsatz.slice(-14).map((j) => <th key={j} className="px-1 text-right">{j}</th>)}</tr></thead>
          <tbody>
            {[
              { label: 'Umsatz (Mio.)', arr: kz.umsatzMio },
              { label: 'EBIT (Mio.)', arr: kz.ebitMio },
              { label: 'EBIT-Marge %', arr: kz.ebitMargePct },
              { label: 'R&D %', arr: kz.rndAnteilPct },
              { label: 'CapEx %', arr: kz.capexAnteilPct },
              { label: 'FCF (Mio.)', arr: kz.fcfMio },
              { label: 'Mitarbeiter', arr: kz.mitarbeiter },
            ].map((row) => {
              const map = reiheZuMap(row.arr)
              const cols = jahreUmsatz.slice(-14)
              if (cols.every((j) => map.get(j) == null)) return null
              return (
                <tr key={row.label} className="border-t border-[var(--app-border)]/40">
                  <td className="sticky left-0 bg-[var(--app-surface)] py-1 pr-2 text-[var(--app-text-muted)]">{row.label}</td>
                  {cols.map((j) => <td key={j} className="px-1 py-1 text-right tabular-nums">{map.get(j)?.toLocaleString('de-DE') ?? '–'}</td>)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PaSecSegmentEinzeljahr({
  hist,
  titel,
}: {
  hist: SecSegmentHistorie
  titel: string
}) {
  const jahr = hist.juengstesJahr
  const segmente = hist.jahre.find((j) => j.jahr === jahr)?.segmente ?? []
  const farben = segmentFarben(segmente.length)
  const donut = segmente.map((s, i) => ({
    name: s.name,
    anteilPct: s.anteilPct,
    farbe: farben[i]!,
  }))

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--app-text-muted)]">
        Geschäftsjahr {jahr} · Marketscreener
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <PaStrukturSegmentDonut segmente={donut} titel={titel} />
        <div className={appTableScrollClassName}>
          <table className="app-data-table min-w-full text-left text-xs">
            <thead className="text-[var(--app-text-muted)]">
              <tr>
                <th className="pb-2 pr-3 font-medium">Segment</th>
                <th className="pb-2 pr-3 text-right font-medium">Umsatz (Mio.)</th>
                <th className="pb-2 text-right font-medium">Anteil</th>
              </tr>
            </thead>
            <tbody>
              {segmente.map((s, i) => (
                <tr key={s.name} className="border-t border-[var(--app-border)]/40">
                  <td className="py-2 pr-3">
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-sm"
                      style={{ backgroundColor: farben[i] }}
                    />
                    <span className="text-[var(--app-text)]">{s.name}</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--app-text-muted)]">
                    {s.umsatzMio != null ? s.umsatzMio.toLocaleString('de-DE') : '–'}
                  </td>
                  <td className="py-2 text-right tabular-nums font-medium text-[var(--app-text)]">
                    {s.anteilPct != null ? `${s.anteilPct.toFixed(1)} %` : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PaUmsatzmixBlock({ hist, quelleLabel }: { hist: SecSegmentHistorie; quelleLabel: string }) {
  const farben = segmentFarben(alleSegmentNamen(hist).length)

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--app-text-muted)]">
        {hist.anzahlJahre} Jahre ({hist.aeltestesJahr}–{hist.juengstesJahr}) · {quelleLabel}
      </p>
      <PaSecSegmentStackedChart hist={hist} farben={farben} />
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {alleSegmentNamen(hist).map((name, i) => (
          <span key={name} className="flex items-center gap-1 text-[10px] text-[var(--app-text-muted)]">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: farben[i % farben.length] }} />
            {name}
          </span>
        ))}
      </div>
      <PaSecSegmentTabelle hist={hist} farben={farben} />
    </div>
  )
}

export function PaSecSegmentHistorie({ paket }: { paket: SecSegmentHistoriePaket }) {
  const produkt = useMemo(
    () => (paket.produkt ? begrenzeSegmentHistorie(paket.produkt) : null),
    [paket.produkt],
  )
  const geo = useMemo(
    () => (paket.geo ? begrenzeSegmentHistorie(paket.geo) : null),
    [paket.geo],
  )
  const hatProdukt = (produkt?.anzahlJahre ?? 0) >= 1 && (produkt?.segmentNamen.length ?? 0) >= 1
  const hatGeo = (geo?.anzahlJahre ?? 0) >= 1 && (geo?.segmentNamen.length ?? 0) >= 1
  const hatProduktTabs = (produkt?.segmentNamen.length ?? 0) >= 2
  const hatGeoTabs = (geo?.segmentNamen.length ?? 0) >= 2
  const hatUmsatzmix = hatProdukt || hatGeo
  const zusatz = paket.zusatz

  const [umsatzmixTab, setUmsatzmixTab] = useState<'produkt' | 'geo'>(() =>
    hatProdukt ? 'produkt' : 'geo',
  )

  const aktiverMix =
    umsatzmixTab === 'produkt' && hatProdukt && produkt
      ? { titel: 'Produkt', hist: produkt }
      : umsatzmixTab === 'geo' && hatGeo && geo
        ? { titel: 'Geo', hist: geo }
        : hatProdukt && produkt
          ? { titel: 'Produkt', hist: produkt }
          : hatGeo && geo
            ? { titel: 'Geo', hist: geo }
            : null

  const jahresSpanne = useMemo(() => {
    const alle = [
      ...(produkt ? [produkt.aeltestesJahr, produkt.juengstesJahr] : []),
      ...(geo ? [geo.aeltestesJahr, geo.juengstesJahr] : []),
    ]
    if (alle.length === 0) return null
    return { min: Math.min(...alle), max: Math.max(...alle) }
  }, [produkt, geo])

  if (!hatUmsatzmix) return null

  const maxJahre = Math.max(produkt?.anzahlJahre ?? 0, geo?.anzahlJahre ?? 0)
  const headerTitel = 'Geschäftsstruktur — Segment & Region'
  const headerUntertitel =
    maxJahre >= 2 && jahresSpanne
      ? `${maxJahre} Jahre (${jahresSpanne.min}–${jahresSpanne.max}) · Marketscreener`
      : 'Umsatzmix nach Produktgruppe und Region · Marketscreener'

  const quelleLabel = 'Marketscreener'

  return (
    <PaCard variant="elevated" className="space-y-5 p-5 sm:p-6">
      <PaStrukturSectionHeader titel={headerTitel} untertitel={headerUntertitel} />

      <div className="space-y-4">
        {hatProduktTabs && hatGeoTabs ? (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setUmsatzmixTab('geo')}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                umsatzmixTab === 'geo'
                  ? 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/40'
                  : 'bg-[var(--app-surface-muted)]/50 text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              Geografie ({geo!.anzahlJahre}J)
            </button>
            <button
              type="button"
              onClick={() => setUmsatzmixTab('produkt')}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                umsatzmixTab === 'produkt'
                  ? 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/40'
                  : 'bg-[var(--app-surface-muted)]/50 text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              Produkt ({produkt!.anzahlJahre}J)
            </button>
          </div>
        ) : null}

        {aktiverMix ? (
          aktiverMix.hist.anzahlJahre >= 2 ? (
            <PaUmsatzmixBlock hist={aktiverMix.hist} quelleLabel={quelleLabel} />
          ) : (
            <PaSecSegmentEinzeljahr hist={aktiverMix.hist} titel={aktiverMix.titel} />
          )
        ) : null}
      </div>

      {(zusatz.mitarbeiterAnzahl != null || zusatz.auslandsumsatzAnteilPct != null || zusatz.hauptkunden.length > 0) && (
        <div className="grid gap-2 border-t border-[var(--app-border)]/60 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <PaStrukturKennzahl label="Auslandsanteil Umsatz" wert={zusatz.auslandsumsatzAnteilPct != null ? `${zusatz.auslandsumsatzAnteilPct} %` : null} />
        </div>
      )}
    </PaCard>
  )
}
