'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { appTableScrollClassName } from '@/components/page-shell'
import { PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  PaStrukturKennzahl,
  PaStrukturSectionHeader,
  PaStrukturSegmentDonut,
} from '@/components/portfolio-analyse/struktur/pa-struktur-visuals'
import type {
  SecBacklogHistorie,
  SecBacklogQuartalEintrag,
  SecKennzahlJahr,
  SecKennzahlenHistorie,
  SecSegmentHistorie,
  SecSegmentHistoriePaket,
  SecSegmentQuartalHistorie,
} from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import { segmentFarben } from '@/lib/portfolio-analyse/fundamentaldaten-struktur-hilfen'
import { begrenzeSegmentHistorie } from '@/lib/portfolio-analyse/sec-segment-historie-hilfen'
import {
  flagCdnUrl,
  segmentVisualFuerName,
  simpleIconUrl,
} from '@/lib/portfolio-analyse/segment-visuals'

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

function margeFuerSegment(hist: SecSegmentHistorie, jahr: number, name: string): number | null {
  return hist.jahre.find((j) => j.jahr === jahr)?.segmente.find((s) => s.name === name)?.margePct ?? null
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

function margeClass(pct: number): string {
  if (pct < 0) return 'text-red-300'
  if (pct >= 25) return 'text-emerald-400'
  return 'text-[var(--app-text-muted)]'
}

const CHART_MAX_SEGMENTE = 6
const ANDERE_NAME = 'Andere'
const ANDERE_FARBE = '#64748b'

/** Top-N Segmente nach jüngstem Mix; Rest als „Andere“ (nur Anzeige). */
function chartSegmentNamen(hist: SecSegmentHistorie, max = CHART_MAX_SEGMENTE): string[] {
  const juengst = hist.jahre.at(-1)?.segmente ?? []
  const ranked = [...juengst]
    .filter((s) => (s.anteilPct ?? 0) > 0)
    .sort((a, b) => (b.anteilPct ?? 0) - (a.anteilPct ?? 0))
  const top = ranked.slice(0, max).map((s) => s.name)
  const hatAndere = ranked.length > top.length
  return hatAndere ? [...top, ANDERE_NAME] : top
}

function chartSegmenteFuerJahr(
  hist: SecSegmentHistorie,
  jahr: number,
  chartNamen: string[],
): { name: string; anteilPct: number; umsatzMio: number | null }[] {
  const raw = hist.jahre.find((j) => j.jahr === jahr)?.segmente ?? []
  const topSet = new Set(chartNamen.filter((n) => n !== ANDERE_NAME))
  const out: { name: string; anteilPct: number; umsatzMio: number | null }[] = []
  let anderePct = 0
  let andereMio = 0
  let andereHatMio = false

  for (const s of raw) {
    const pct = s.anteilPct ?? 0
    if (pct <= 0) continue
    if (topSet.has(s.name)) {
      out.push({ name: s.name, anteilPct: pct, umsatzMio: s.umsatzMio ?? null })
    } else if (chartNamen.includes(ANDERE_NAME)) {
      anderePct += pct
      if (s.umsatzMio != null) {
        andereMio += s.umsatzMio
        andereHatMio = true
      }
    }
  }
  if (chartNamen.includes(ANDERE_NAME) && anderePct > 0.05) {
    out.push({
      name: ANDERE_NAME,
      anteilPct: Math.round(anderePct * 10) / 10,
      umsatzMio: andereHatMio ? andereMio : null,
    })
  }
  return out.sort((a, b) => chartNamen.indexOf(a.name) - chartNamen.indexOf(b.name))
}

function PaSegmentBadge({
  name,
  art,
  farbe,
  size = 14,
}: {
  name: string
  art: 'produkt' | 'geo'
  farbe?: string
  size?: number
}) {
  const v = segmentVisualFuerName(name, art)
  if (art === 'geo') {
    if (v.flagCode) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={flagCdnUrl(v.flagCode, size <= 14 ? 20 : 40)}
          alt=""
          width={size}
          height={Math.round(size * 0.75)}
          className="shrink-0 rounded-[2px] object-cover"
          loading="lazy"
          decoding="async"
        />
      )
    }
    return (
      <span className="inline-flex shrink-0 text-[11px] leading-none" aria-hidden>
        {v.flagEmoji ?? '🌐'}
      </span>
    )
  }
  if (v.iconSlug) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={simpleIconUrl(v.iconSlug, v.iconColor)}
        alt=""
        width={size}
        height={size}
        className="shrink-0 object-contain"
        loading="lazy"
        decoding="async"
      />
    )
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[3px] text-[8px] font-bold leading-none text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: farbe ?? v.iconColor,
      }}
      aria-hidden
    >
      {v.initial}
    </span>
  )
}

function farbeFuerChartSegment(name: string, chartNamen: string[], farben: string[]): string {
  if (name === ANDERE_NAME) return ANDERE_FARBE
  const i = chartNamen.indexOf(name)
  return farben[Math.max(0, i) % farben.length]!
}

function PaSecSegmentStackedChart({
  hist,
  farben,
  chartNamen,
}: {
  hist: SecSegmentHistorie
  farben: string[]
  chartNamen: string[]
}) {
  const jahre = hist.jahre.map((j) => j.jahr).slice(-10)
  const n = jahre.length
  const barW = n > 6 ? 18 : n > 4 ? 22 : 26
  const gap = n > 6 ? 5 : 8
  const chartH = 112
  const padL = 2
  const padB = 22
  const width = padL + n * (barW + gap) - gap + 4

  return (
    <div className="flex justify-center sm:justify-start">
      <svg
        width={width}
        height={chartH + padB}
        viewBox={`0 0 ${width} ${chartH + padB}`}
        className="block max-w-full"
        role="img"
        aria-label="Umsatzmix nach Jahr"
      >
        {jahre.map((jahr, ji) => {
          const x = padL + ji * (barW + gap)
          const segmente = chartSegmenteFuerJahr(hist, jahr, chartNamen)
          let yAcc = chartH
          return (
            <g key={jahr}>
              {segmente.map((s) => {
                const h = Math.max(0.5, (s.anteilPct / 100) * chartH)
                yAcc -= h
                const farbe = farbeFuerChartSegment(s.name, chartNamen, farben)
                return (
                  <rect
                    key={s.name}
                    x={x}
                    y={yAcc}
                    width={barW}
                    height={h}
                    fill={farbe}
                    opacity={0.92}
                    rx={2}
                  >
                    <title>
                      {jahr}: {s.name} — {s.anteilPct.toFixed(1)} %
                      {s.umsatzMio != null ? ` (${s.umsatzMio.toLocaleString('de-DE')} Mio.)` : ''}
                    </title>
                  </rect>
                )
              })}
              <text
                x={x + barW / 2}
                y={chartH + 14}
                textAnchor="middle"
                className="fill-[var(--app-text-muted)]"
                style={{ fontSize: 9 }}
              >
                {String(jahr).slice(2)}
              </text>
            </g>
          )
        })}
        <line
          x1={padL}
          y1={chartH}
          x2={width - 2}
          y2={chartH}
          stroke="var(--app-border-strong)"
          strokeOpacity={0.4}
        />
      </svg>
    </div>
  )
}

function PaAktuellerMixListe({
  hist,
  farben,
  chartNamen,
  art,
  jahr: jahrProp,
}: {
  hist: SecSegmentHistorie
  farben: string[]
  chartNamen: string[]
  art: 'produkt' | 'geo'
  jahr?: number
}) {
  const jahr = jahrProp ?? hist.juengstesJahr
  const segmente = chartSegmenteFuerJahr(hist, jahr, chartNamen).sort(
    (a, b) => b.anteilPct - a.anteilPct,
  )
  if (segmente.length === 0) return null

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
        Mix {jahr}
      </p>
      <ul className="space-y-2">
        {segmente.map((s) => {
          const farbe = farbeFuerChartSegment(s.name, chartNamen, farben)
          return (
            <li key={s.name}>
              <div className="mb-0.5 flex items-center justify-between gap-2 text-[11px]">
                <span className="flex min-w-0 items-center gap-1.5 text-[var(--app-text)]">
                  <PaSegmentBadge name={s.name} art={art} farbe={farbe} size={14} />
                  <span className="truncate">{s.name}</span>
                </span>
                <span className="shrink-0 tabular-nums font-semibold text-[var(--app-text)]">
                  {s.anteilPct.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, s.anteilPct)}%`, backgroundColor: farbe }}
                />
              </div>
            </li>
          )
        })}
      </ul>
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

function PaSecBacklogQuartale({
  quartale,
  label,
}: {
  quartale: SecBacklogQuartalEintrag[]
  label: string
}) {
  const perioden = [...quartale]
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate))
    .slice(-8)
  if (perioden.length < 2) return null
  const neueste = perioden[perioden.length - 1]!
  const vor = perioden[perioden.length - 2]!
  const qoq = umsatzWachstumPct(neueste.wertMio, vor.wertMio)
  const vorJahr = perioden.find(
    (p) => p.jahr === neueste.jahr - 1 && p.quartal === neueste.quartal,
  )
  const yoy = vorJahr ? umsatzWachstumPct(neueste.wertMio, vorJahr.wertMio) : null

  return (
    <div className="space-y-3 rounded-xl border border-[var(--app-border)]/50 bg-[var(--app-surface-muted)]/20 p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
          Quartale · {label} (10-Q + FY)
        </p>
        <p className="text-[10px] text-[var(--app-text-muted)]">
          {perioden[0]!.label}–{neueste.label}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <PaStrukturKennzahl
          label={`Aktuell ${neueste.label}`}
          wert={formatBacklogMio(neueste.wertMio)}
          hinweis={neueste.reportDate}
        />
        {qoq != null ? (
          <PaStrukturKennzahl
            label="QoQ"
            wert={`${qoq > 0 ? '+' : ''}${qoq.toLocaleString('de-DE')}%`}
            accent={qoq > 0 ? 'emerald' : qoq < -0.5 ? 'red' : 'default'}
            hinweis={`vs. ${vor.label}`}
          />
        ) : null}
        {yoy != null ? (
          <PaStrukturKennzahl
            label="YoY Quartal"
            wert={`${yoy > 0 ? '+' : ''}${yoy.toLocaleString('de-DE')}%`}
            accent={yoy > 0 ? 'emerald' : yoy < -0.5 ? 'red' : 'default'}
            hinweis={`vs. ${vorJahr!.label}`}
          />
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[...perioden].reverse().map((p) => (
          <div
            key={`${p.label}-${p.reportDate}`}
            className="rounded-lg border border-[var(--app-border)]/40 bg-[var(--app-surface)]/40 px-3 py-2"
          >
            <p className="text-[11px] font-semibold tabular-nums text-[var(--app-text)]">{p.label}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--app-text)]">
              {formatBacklogMio(p.wertMio)}
            </p>
            <p className="text-[10px] text-[var(--app-text-muted)]">{p.reportDate}</p>
          </div>
        ))}
      </div>
    </div>
  )
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
  const quartale = backlog.quartale ?? []

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

      {quartale.length >= 2 ? (
        <PaSecBacklogQuartale quartale={quartale} label={backlog.label} />
      ) : null}

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
              <th className="px-2 py-1.5 font-medium text-right">÷ Umsatz</th>
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

/** Segmente des aktuellen Reporting-Schemas (jüngstes Jahr); vermeidet leere Alt-Zeilen. */
function aktuelleSchemaNamen(hist: SecSegmentHistorie): string[] {
  const juengst = hist.jahre.at(-1)?.segmente ?? []
  return juengst
    .filter((s) => (s.anteilPct ?? 0) > 0 || (s.umsatzMio ?? 0) > 0)
    .sort((a, b) => (b.anteilPct ?? 0) - (a.anteilPct ?? 0))
    .map((s) => s.name)
}

function jahreMitSchemaDaten(hist: SecSegmentHistorie, namen: string[]): number[] {
  return hist.jahre
    .filter((j) => namen.some((n) => j.segmente.some((s) => s.name === n && (s.umsatzMio != null || s.anteilPct != null))))
    .map((j) => j.jahr)
}

function PaSecSegmentTabelle({
  hist,
  farben,
  art,
}: {
  hist: SecSegmentHistorie
  farben: string[]
  art: 'produkt' | 'geo'
}) {
  const [zeigeAlt, setZeigeAlt] = useState(false)
  const aktuell = useMemo(() => aktuelleSchemaNamen(hist), [hist])
  const alle = useMemo(() => alleSegmentNamen(hist), [hist])
  const altNamen = useMemo(() => alle.filter((n) => !aktuell.includes(n)), [alle, aktuell])
  const namen = zeigeAlt ? alle : aktuell
  const jahre = jahreMitSchemaDaten(hist, namen)
  const tabellenFarben = segmentFarben(namen.length)

  return (
    <div className="space-y-2">
      {altNamen.length > 0 ? (
        <button
          type="button"
          onClick={() => setZeigeAlt((v) => !v)}
          className="text-[10px] text-[var(--app-text-muted)] underline-offset-2 hover:text-[var(--app-text)] hover:underline"
        >
          {zeigeAlt
            ? 'Nur aktuelles Reporting-Schema'
            : `Früheres Schema einblenden (${altNamen.length} Segmente)`}
        </button>
      ) : null}
      <div className={appTableScrollClassName}>
        <table className="app-data-table min-w-full text-left text-xs">
          <thead className="text-[var(--app-text-muted)]">
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--app-surface)] pb-2 pr-3 font-medium">Segment</th>
              {jahre.map((j) => (
                <th key={j} className="min-w-[7rem] px-2 pb-2 text-right font-medium">
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
                <td className="sticky left-0 z-10 bg-[var(--app-surface)] py-2 pr-3 align-top">
                  <span className="mr-1.5 inline-flex align-middle">
                    <PaSegmentBadge
                      name={name}
                      art={art}
                      farbe={
                        (zeigeAlt ? farben : tabellenFarben)[
                          i % (zeigeAlt ? farben.length : tabellenFarben.length)
                        ]
                      }
                      size={14}
                    />
                  </span>
                  <span className="font-medium text-[var(--app-text)]">{name}</span>
                </td>
                {jahre.map((j, ji) => {
                  const mio = umsatzFuerSegment(hist, j, name)
                  const anteil = anteilFuerSegment(hist, j, name)
                  const vorjahr = ji > 0 ? jahre[ji - 1]! : null
                  const wachstum =
                    vorjahr != null ? umsatzWachstumPct(mio, umsatzFuerSegment(hist, vorjahr, name)) : null
                  const marge = margeFuerSegment(hist, j, name)
                  return (
                    <td key={j} className="px-2 py-2 align-top text-right tabular-nums">
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
                      ) : null}
                      {marge != null ? (
                        <span className={`mt-0.5 block text-[10px] font-medium ${margeClass(marge)}`}>
                          {marge.toLocaleString('de-DE', { maximumFractionDigits: 1 })} % Marge
                        </span>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PaQuartalMix({
  quartale,
  titel,
  art,
}: {
  quartale: SecSegmentQuartalHistorie
  titel: string
  art: 'produkt' | 'geo'
}) {
  const perioden = [...quartale.perioden].slice(-8)
  if (perioden.length === 0) return null
  const neueste = perioden[perioden.length - 1]!
  const farben = segmentFarben(neueste.segmente.length)

  return (
    <div className="space-y-3 rounded-xl border border-[var(--app-border)]/50 bg-[var(--app-surface-muted)]/20 p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
          Quartale · {titel} (10-Q + Q4 aus GJ)
        </p>
        <p className="text-[10px] text-[var(--app-text-muted)]">
          {perioden[0]!.label}–{neueste.label}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...perioden].reverse().map((p) => (
          <div
            key={p.label}
            className="rounded-lg border border-[var(--app-border)]/40 bg-[var(--app-surface)]/40 px-3 py-2.5"
          >
            <p className="mb-2 text-[11px] font-semibold tabular-nums text-[var(--app-text)]">{p.label}</p>
            <ul className="space-y-1.5">
              {p.segmente
                .slice()
                .sort((a, b) => (b.anteilPct ?? 0) - (a.anteilPct ?? 0))
                .map((s, i) => (
                  <li key={s.name} className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="flex min-w-0 items-center gap-1.5 text-[var(--app-text-muted)]">
                      <PaSegmentBadge
                        name={s.name}
                        art={art}
                        farbe={farben[i % farben.length]}
                        size={12}
                      />
                      <span className="truncate">{s.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--app-text)]">
                      {s.anteilPct != null
                        ? `${s.anteilPct.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
                        : s.umsatzMio != null
                          ? formatMio(s.umsatzMio)
                          : '–'}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
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
  const alle = [...(hist.jahre.find((j) => j.jahr === jahr)?.segmente ?? [])]
    .filter((s) => (s.anteilPct ?? 0) > 0)
    .sort((a, b) => (b.anteilPct ?? 0) - (a.anteilPct ?? 0))
  const farben = segmentFarben(Math.min(alle.length, CHART_MAX_SEGMENTE))
  const top = alle.slice(0, CHART_MAX_SEGMENTE)
  const rest = alle.slice(CHART_MAX_SEGMENTE)
  const anderePct = rest.reduce((a, s) => a + (s.anteilPct ?? 0), 0)
  const anzeige = [
    ...top.map((s, i) => ({ name: s.name, anteilPct: s.anteilPct, farbe: farben[i]! })),
    ...(anderePct > 0.05
      ? [{ name: ANDERE_NAME, anteilPct: Math.round(anderePct * 10) / 10, farbe: ANDERE_FARBE }]
      : []),
  ]

  return (
    <div className="rounded-xl border border-[var(--app-border)]/50 bg-[var(--app-surface-muted)]/20 p-3 sm:p-4">
      <PaStrukturSegmentDonut segmente={anzeige} titel={titel} />
      <p className="mt-2 text-[10px] text-[var(--app-text-muted)]">Geschäftsjahr {jahr}</p>
    </div>
  )
}

function PaUmsatzmixBlock({
  hist,
  quartale,
  titel,
  art,
}: {
  hist: SecSegmentHistorie
  quartale?: SecSegmentQuartalHistorie | null
  titel: string
  art: 'produkt' | 'geo'
}) {
  const jahre = useMemo(() => hist.jahre.map((j) => j.jahr), [hist])
  const [jahr, setJahr] = useState(() => hist.juengstesJahr)
  useEffect(() => {
    setJahr(hist.juengstesJahr)
  }, [hist.juengstesJahr, hist.art])

  const chartNamen = useMemo(() => chartSegmentNamen(hist), [hist])
  const farben = useMemo(
    () => segmentFarben(chartNamen.filter((n) => n !== ANDERE_NAME).length),
    [chartNamen],
  )
  const tabellenFarben = useMemo(
    () => segmentFarben(alleSegmentNamen(hist).length),
    [hist],
  )
  const [detailsOffen, setDetailsOffen] = useState(false)
  const [sicht, setSicht] = useState<'jahre' | 'quartale'>('jahre')
  const hatQuartale = (quartale?.anzahlPerioden ?? 0) > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-[var(--app-border)]/50 bg-[var(--app-surface-muted)]/35 p-0.5">
          {(
            [
              ['jahre', 'Jahre'],
              ['quartale', 'Quartale'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={id === 'quartale' && !hatQuartale}
              onClick={() => setSicht(id)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-35 ${
                sicht === id
                  ? 'bg-teal-500/25 text-teal-100 shadow-sm ring-1 ring-teal-400/30'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {sicht === 'jahre' && jahre.length > 1 ? (
          <label className="flex items-center gap-2 text-[11px] text-[var(--app-text-muted)]">
            Jahr
            <select
              value={jahr}
              onChange={(e) => setJahr(Number(e.target.value))}
              className="rounded-lg border border-[var(--app-border)]/60 bg-[var(--app-surface)] px-2 py-1 text-[11px] tabular-nums text-[var(--app-text)] outline-none focus:ring-1 focus:ring-teal-400/40"
            >
              {[...jahre].reverse().map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {sicht === 'jahre' ? (
        <div className="grid gap-4 rounded-2xl border border-[var(--app-border)]/45 bg-gradient-to-br from-[var(--app-surface-muted)]/35 via-transparent to-teal-500/[0.05] p-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)] sm:gap-5 sm:p-4">
          <div className="min-w-0 space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
              {titel} · {hist.aeltestesJahr}–{hist.juengstesJahr}
            </p>
            <PaSecSegmentStackedChart hist={hist} farben={farben} chartNamen={chartNamen} />
            <div className="flex flex-wrap gap-x-2.5 gap-y-1.5 pt-0.5">
              {chartNamen.map((name) => (
                <span
                  key={name}
                  className="flex max-w-[10rem] items-center gap-1.5 text-[10px] text-[var(--app-text-muted)]"
                >
                  <PaSegmentBadge
                    name={name}
                    art={art}
                    farbe={farbeFuerChartSegment(name, chartNamen, farben)}
                    size={12}
                  />
                  <span className="truncate">{name}</span>
                </span>
              ))}
            </div>
          </div>
          <PaAktuellerMixListe
            hist={hist}
            farben={farben}
            chartNamen={chartNamen}
            art={art}
            jahr={jahr}
          />
        </div>
      ) : hatQuartale && quartale ? (
        <PaQuartalMix quartale={quartale} titel={titel} art={art} />
      ) : null}

      <button
        type="button"
        onClick={() => setDetailsOffen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-[var(--app-border)]/45 bg-[var(--app-surface-muted)]/25 px-3.5 py-2.5 text-left text-[11px] text-[var(--app-text-muted)] transition-colors hover:border-teal-500/30 hover:text-[var(--app-text)]"
      >
        <span>Jahresdetails (Umsatz, YoY, Marge)</span>
        <span className="tabular-nums">{detailsOffen ? '▾' : '▸'}</span>
      </button>
      {detailsOffen ? (
        <div className="rounded-2xl border border-[var(--app-border)]/40 p-2 sm:p-3">
          <PaSecSegmentTabelle hist={hist} farben={tabellenFarben} art={art} />
        </div>
      ) : null}
    </div>
  )
}

function StrukturKapitelRahmen({
  id,
  titel,
  untertitel,
  children,
}: {
  id: string
  titel: string
  untertitel: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 space-y-4 rounded-2xl border border-[var(--app-border)]/55 bg-[var(--app-surface)]/40 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-5"
    >
      <header className="border-b border-[var(--app-border)]/45 pb-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-teal-300/80">
          Struktur
        </p>
        <h3 className="mt-0.5 text-base font-semibold tracking-tight text-white sm:text-lg">
          {titel}
        </h3>
        <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{untertitel}</p>
      </header>
      {children}
    </section>
  )
}

function MixZusatzLeiste({ zusatz }: { zusatz: SecSegmentHistoriePaket['zusatz'] }) {
  if (
    zusatz.mitarbeiterAnzahl == null &&
    zusatz.auslandsumsatzAnteilPct == null &&
    zusatz.hauptkunden.length === 0
  ) {
    return null
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <PaStrukturKennzahl
        label="Auslandsanteil Umsatz"
        wert={zusatz.auslandsumsatzAnteilPct != null ? `${zusatz.auslandsumsatzAnteilPct} %` : null}
      />
      {zusatz.hauptkunden[0] ? (
        <PaStrukturKennzahl
          label="Top-Kunde Umsatzanteil"
          wert={`${zusatz.hauptkunden[0].anteilPct} %`}
          hinweis={zusatz.hauptkunden[0].name}
        />
      ) : null}
      {zusatz.hauptkunden.length >= 2 ? (
        <PaStrukturKennzahl
          label="Top-3-Kunden Umsatzanteil"
          wert={`${Math.round(
            zusatz.hauptkunden.slice(0, 3).reduce((s, k) => s + k.anteilPct, 0) * 10,
          ) / 10} %`}
          hinweis={zusatz.hauptkunden
            .slice(0, 3)
            .map((k) => k.name)
            .join(', ')}
        />
      ) : null}
      {zusatz.mitarbeiterAnzahl != null ? (
        <PaStrukturKennzahl
          label="Mitarbeiter"
          wert={zusatz.mitarbeiterAnzahl.toLocaleString('de-DE')}
        />
      ) : null}
    </div>
  )
}

function MixSteuerungUndInhalt({
  paket,
  produkt,
  geo,
}: {
  paket: SecSegmentHistoriePaket
  produkt: SecSegmentHistorie | null
  geo: SecSegmentHistorie | null
}) {
  const hatProdukt = (produkt?.anzahlJahre ?? 0) >= 1 && (produkt?.segmentNamen.length ?? 0) >= 1
  const hatGeo = (geo?.anzahlJahre ?? 0) >= 1 && (geo?.segmentNamen.length ?? 0) >= 1
  const hatProduktTabs = (produkt?.segmentNamen.length ?? 0) >= 2
  const hatGeoTabs = (geo?.segmentNamen.length ?? 0) >= 2

  const [umsatzmixTab, setUmsatzmixTab] = useState<'produkt' | 'geo'>(() =>
    hatGeo ? 'geo' : 'produkt',
  )

  const aktiverMix =
    umsatzmixTab === 'produkt' && hatProdukt && produkt
      ? { titel: 'Produkt', hist: produkt, art: 'produkt' as const }
      : umsatzmixTab === 'geo' && hatGeo && geo
        ? { titel: 'Geo', hist: geo, art: 'geo' as const }
        : hatProdukt && produkt
          ? { titel: 'Produkt', hist: produkt, art: 'produkt' as const }
          : hatGeo && geo
            ? { titel: 'Geo', hist: geo, art: 'geo' as const }
            : null

  if (!aktiverMix) return null

  return (
    <div className="space-y-4">
      {hatProduktTabs && hatGeoTabs ? (
        <div
          className="inline-flex rounded-xl border border-[var(--app-border)]/50 bg-[var(--app-surface-muted)]/40 p-0.5"
          role="tablist"
          aria-label="Umsatzmix"
        >
          {(
            [
              ['geo', 'Geografie', geo!.anzahlJahre],
              ['produkt', 'Produkt', produkt!.anzahlJahre],
            ] as const
          ).map(([id, label, jahre]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={umsatzmixTab === id}
              onClick={() => setUmsatzmixTab(id)}
              className={`rounded-lg px-3.5 py-2 text-[11px] font-medium transition-all ${
                umsatzmixTab === id
                  ? 'bg-teal-500/25 text-teal-100 shadow-sm ring-1 ring-teal-400/30'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              {label}
              <span className="ml-1.5 tabular-nums opacity-70">{jahre}J</span>
            </button>
          ))}
        </div>
      ) : null}

      {aktiverMix.hist.anzahlJahre >= 2 ? (
        <PaUmsatzmixBlock
          hist={aktiverMix.hist}
          titel={aktiverMix.titel}
          art={aktiverMix.art}
          quartale={
            aktiverMix.art === 'produkt' ? paket.produktQuartale : paket.geoQuartale
          }
        />
      ) : (
        <PaSecSegmentEinzeljahr hist={aktiverMix.hist} titel={aktiverMix.titel} />
      )}

      <MixZusatzLeiste zusatz={paket.zusatz} />
    </div>
  )
}

export function PaSecSegmentHistorie({
  paket,
  layout = 'default',
}: {
  paket: SecSegmentHistoriePaket
  layout?: 'default' | 'struktur'
}) {
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
  const hatUmsatzmix = hatProdukt || hatGeo

  if (!hatUmsatzmix && !paket.backlog && !paket.kennzahlen) return null

  const jahresSpanne = (() => {
    const alle = [
      ...(produkt ? [produkt.aeltestesJahr, produkt.juengstesJahr] : []),
      ...(geo ? [geo.aeltestesJahr, geo.juengstesJahr] : []),
    ]
    if (alle.length === 0) return null
    return { min: Math.min(...alle), max: Math.max(...alle) }
  })()

  const quelleName =
    paket.quelle === 'sec_edgar'
      ? 'SEC EDGAR'
      : paket.quelle === 'eu_urd'
        ? 'EU-Berichte'
        : paket.quelle === 'stockanalysis'
          ? 'StockAnalysis'
          : paket.quelle === 'mixed'
            ? paket.secErgaenzt
              ? 'SEC EDGAR + Marketscreener/StockAnalysis'
              : 'Marketscreener + StockAnalysis'
            : 'Marketscreener'

  const mixUntertitel =
    jahresSpanne != null
      ? `${jahresSpanne.min}–${jahresSpanne.max} · ${quelleName}`
      : `Geo & Produkt · ${quelleName}`

  const backlogBlock =
    paket.backlog || paket.kennzahlen ? (
      <div className="space-y-5">
        {paket.backlog ? (
          <PaSecBacklogHistorie backlog={paket.backlog} kennzahlen={paket.kennzahlen} />
        ) : null}
        {paket.kennzahlen && paket.kennzahlen.anzahlJahre >= 2 ? (
          <PaSecKennzahlenPanel kz={paket.kennzahlen} />
        ) : null}
      </div>
    ) : null

  if (layout === 'struktur') {
    return (
      <div className="space-y-5">
        {hatUmsatzmix ? (
          <StrukturKapitelRahmen
            id="pa-struktur-umsatzmix"
            titel="Umsatzmix"
            untertitel={mixUntertitel}
          >
            <MixSteuerungUndInhalt paket={paket} produkt={produkt} geo={geo} />
          </StrukturKapitelRahmen>
        ) : null}
        {backlogBlock ? (
          <StrukturKapitelRahmen
            id="pa-struktur-backlog"
            titel="Backlog / RPO"
            untertitel={paket.backlog?.quelleTag ?? 'SEC Company Facts'}
          >
            {backlogBlock}
          </StrukturKapitelRahmen>
        ) : (
          <section id="pa-struktur-backlog" className="scroll-mt-24" aria-hidden />
        )}
      </div>
    )
  }

  return (
    <PaCard variant="elevated" className="space-y-4 p-4 sm:p-5">
      <PaStrukturSectionHeader
        titel={hatUmsatzmix ? 'Geschäftsstruktur — Segment & Region' : 'Backlog / RPO'}
        untertitel={hatUmsatzmix ? mixUntertitel : (paket.backlog?.quelleTag ?? 'Auftragsbestand')}
      />
      {hatUmsatzmix ? <MixSteuerungUndInhalt paket={paket} produkt={produkt} geo={geo} /> : null}
      {backlogBlock ? (
        <div className="border-t border-[var(--app-border)]/60 pt-5">
          <PaStrukturSectionHeader
            titel="Backlog / RPO"
            untertitel={paket.backlog?.quelleTag ?? 'SEC Company Facts'}
          />
          {backlogBlock}
        </div>
      ) : null}
    </PaCard>
  )
}
