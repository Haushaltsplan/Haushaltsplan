'use client'

import { useMemo } from 'react'
import { formatFundamentalWert } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import {
  berechneHistorischenSchnitt,
  historischeChartPerioden,
  jahrAusPeriode,
  jahreImSchnitt,
  prozentAbweichung,
} from '@/lib/portfolio-analyse/fundamentaldaten-chart-hilfen'
import {
  FUNDAMENTAL_NTM_KEY,
  FUNDAMENTAL_TTM_KEY,
  type FundamentalMetrikZeile,
  type FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

const FARBEN = ['#f59e0b', '#2dd4bf', '#818cf8', '#f472b6', '#a3e635', '#38bdf8']
const AKTUELL_FARBE = '#fafafa'

const VIEW_W = 1000
const HOEHE = 300
const PAD_LINKS = 56
const PAD_RECHTS = 20
const PAD_OBEN = 36
const PAD_UNTEN = 44

type ChartPunkt = { x: number; y: number; label: string; wert: number; aktuell?: boolean }

type ChartSerie = {
  id: string
  label: string
  farbe: string
  einheit: FundamentalMetrikZeile['einheit']
  historisch: ChartPunkt[]
  aktuell: ChartPunkt | null
  schnitt: number | null
  jahreSchnitt: number
  abweichungPct: number | null
  pathD: string
  areaD: string
}

function aktuellerKeyFuerZeile(z: FundamentalMetrikZeile, variant: 'standard' | 'bewertung'): string | null {
  if (variant !== 'bewertung') return null
  if (z.gruppe === 'bewertung_forward') return FUNDAMENTAL_NTM_KEY
  if (z.gruppe === 'bewertung_trailing') return FUNDAMENTAL_TTM_KEY
  return FUNDAMENTAL_TTM_KEY
}

function yAusWert(wert: number, min: number, span: number, plotH: number): number {
  return PAD_OBEN + plotH - ((wert - min) / span) * plotH
}

function formatAchse(wert: number, einheit: FundamentalMetrikZeile['einheit']): string {
  if (einheit === 'multiple') return `${wert.toFixed(1)}x`
  if (einheit === 'prozent') return `${wert.toFixed(0)}%`
  if (Math.abs(wert) >= 1000) return `${(wert / 1000).toFixed(1)}k`
  return wert.toFixed(1)
}

function SchnittBadge({
  label,
  schnitt,
  aktuell,
  abweichungPct,
  jahre,
  einheit,
}: {
  label: string
  schnitt: number | null
  aktuell: number | null
  abweichungPct: number | null
  jahre: number
  einheit: FundamentalMetrikZeile['einheit']
}) {
  if (schnitt == null) return null
  const ueber = abweichungPct != null && abweichungPct > 0
  const unter = abweichungPct != null && abweichungPct < 0
  return (
    <div className="rounded-lg border border-white/[0.06] bg-zinc-900/70 px-3 py-2">
      <p className="truncate text-[10px] font-medium text-zinc-400">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[11px] text-zinc-500">
          {jahre}J-Schnitt{' '}
          <span className="font-semibold text-zinc-300">{formatFundamentalWert(schnitt, einheit)}</span>
        </span>
        {aktuell != null ? (
          <>
            <span className="text-zinc-600">·</span>
            <span className="text-[11px] text-zinc-500">
              Aktuell{' '}
              <span className="font-semibold text-zinc-100">{formatFundamentalWert(aktuell, einheit)}</span>
            </span>
            {abweichungPct != null ? (
              <span
                className={`text-[10px] font-semibold tabular-nums ${
                  ueber ? 'text-rose-400/90' : unter ? 'text-emerald-400/90' : 'text-zinc-500'
                }`}
              >
                {ueber ? '▲' : unter ? '▼' : '●'}{' '}
                {abweichungPct > 0 ? '+' : ''}
                {abweichungPct.toFixed(0)}% {ueber ? 'über' : unter ? 'unter' : 'am'} Schnitt
              </span>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

export function PaFundamentalMetrikChart({
  perioden,
  zeilen,
  aktivIds,
  labelsAnzeigen,
  onClear,
  onToggleLabels,
  variant = 'standard',
}: {
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  aktivIds: Set<string>
  labelsAnzeigen: boolean
  onClear: () => void
  onToggleLabels: () => void
  variant?: 'standard' | 'bewertung'
}) {
  const histPerioden = useMemo(() => historischeChartPerioden(perioden), [perioden])
  const plotW = VIEW_W - PAD_LINKS - PAD_RECHTS
  const plotH = HOEHE - PAD_OBEN - PAD_UNTEN

  const serien = useMemo((): ChartSerie[] => {
    const ausgewaehlt = zeilen.filter((z) => aktivIds.has(z.id))
    if (ausgewaehlt.length === 0) return []

    const roh = ausgewaehlt.map((z, i) => {
      const aktKey = aktuellerKeyFuerZeile(z, variant)
      const histWerte = histPerioden
        .map((p) => ({ label: jahrAusPeriode(p.iso), wert: z.werte[p.iso] }))
        .filter((pt): pt is { label: string; wert: number } => pt.wert != null && Number.isFinite(pt.wert))

      const aktWert = aktKey ? z.werte[aktKey] : null
      const aktuell =
        aktWert != null && Number.isFinite(aktWert)
          ? { label: aktKey === FUNDAMENTAL_NTM_KEY ? 'NTM' : 'TTM', wert: aktWert }
          : null

      const schnitt = variant === 'bewertung' ? berechneHistorischenSchnitt(histWerte.map((p) => p.wert)) : null
      const jahreSchnitt = variant === 'bewertung' ? jahreImSchnitt(histWerte.map((p) => p.wert)) : 0
      const abweichungPct =
        variant === 'bewertung' && aktuell && schnitt != null
          ? prozentAbweichung(aktuell.wert, schnitt)
          : null

      return {
        id: z.id,
        label: z.label,
        farbe: FARBEN[i % FARBEN.length]!,
        einheit: z.einheit,
        histWerte,
        aktuell,
        schnitt,
        jahreSchnitt,
        abweichungPct,
      }
    })

    const alleWerte = roh.flatMap((s) => [
      ...s.histWerte.map((p) => p.wert),
      ...(s.aktuell ? [s.aktuell.wert] : []),
      ...(s.schnitt != null ? [s.schnitt] : []),
    ])
    const min = Math.min(...alleWerte, 0)
    const max = Math.max(...alleWerte, 1)
    const pad = (max - min) * 0.08 || 1
    const minY = min - pad
    const maxY = max + pad
    const span = maxY - minY || 1
    const n = Math.max(...roh.map((s) => s.histWerte.length + (s.aktuell ? 1 : 0)), 1)

    return roh.map((s) => {
      const allePunkte = [...s.histWerte]
      if (s.aktuell) allePunkte.push(s.aktuell)

      const pts: ChartPunkt[] = allePunkte.map((p, idx) => {
        const x = PAD_LINKS + (plotW * idx) / Math.max(1, n - 1)
        const y = yAusWert(p.wert, minY, span, plotH)
        return {
          x,
          y,
          label: p.label,
          wert: p.wert,
          aktuell: s.aktuell != null && idx === allePunkte.length - 1 && p === s.aktuell,
        }
      })

      const histPts = pts.filter((p) => !p.aktuell)
      const pathD = histPts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
      const baseY = PAD_OBEN + plotH
      const areaD =
        histPts.length > 0
          ? `${pathD} L ${histPts[histPts.length - 1]!.x.toFixed(1)} ${baseY} L ${histPts[0]!.x.toFixed(1)} ${baseY} Z`
          : ''

      return {
        id: s.id,
        label: s.label,
        farbe: s.farbe,
        einheit: s.einheit,
        historisch: histPts,
        aktuell: pts.find((p) => p.aktuell) ?? null,
        schnitt: s.schnitt,
        jahreSchnitt: s.jahreSchnitt,
        abweichungPct: s.abweichungPct,
        pathD,
        areaD,
      }
    })
  }, [zeilen, aktivIds, histPerioden, variant, plotW, plotH])

  const { minY, maxY, yTicks } = useMemo(() => {
    const alle = serien.flatMap((s) => [
      ...s.historisch.map((p) => p.wert),
      ...(s.aktuell ? [s.aktuell.wert] : []),
      ...(s.schnitt != null ? [s.schnitt] : []),
    ])
    if (alle.length === 0) return { minY: 0, maxY: 1, yTicks: [] as number[] }
    const min = Math.min(...alle, 0)
    const max = Math.max(...alle, 1)
    const pad = (max - min) * 0.08 || 1
    const minY = min - pad
    const maxY = max + pad
    const span = maxY - minY
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => minY + span * t)
    return { minY, maxY, yTicks }
  }, [serien])

  const spanY = maxY - minY || 1
  const xLabels = useMemo(() => {
    if (serien.length === 0) return []
    const ref = serien[0]!
    const labels = ref.historisch.map((p) => jahrAusPeriode(p.label))
    if (ref.aktuell) labels.push(ref.aktuell.label)
    const n = labels.length
    return labels.map((label, i) => ({
      label,
      x: PAD_LINKS + (plotW * i) / Math.max(1, n - 1),
    }))
  }, [serien, plotW])

  if (serien.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800/80 bg-gradient-to-b from-zinc-950/80 to-zinc-900/30 px-4 py-12 text-center">
        <p className="text-sm text-zinc-500">
          {variant === 'bewertung'
            ? 'Klicke auf eine Bewertungskennzahl, um den Verlauf mit 10-Jahres-Schnitt anzuzeigen.'
            : 'Klicke auf eine Kennzahl in der Tabelle, um den Verlauf anzuzeigen.'}
        </p>
      </div>
    )
  }

  const einheitRef = serien[0]!.einheit

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-gradient-to-br from-zinc-950 via-zinc-950/95 to-zinc-900/50 shadow-lg shadow-black/20">
      <div className="border-b border-white/[0.05] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-zinc-200">
              {variant === 'bewertung' ? 'Bewertungsverlauf' : 'Historischer Kennzahlenverlauf'}
            </p>
            {variant === 'bewertung' ? (
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Gestrichelt = Schnitt der letzten 10 Jahre (oder kürzere Historie) · Punkt = aktuell (TTM/NTM)
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onToggleLabels}
              className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2.5 py-1 text-[11px] text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
            >
              {labelsAnzeigen ? 'Labels aus' : 'Labels an'}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 px-2.5 py-1 text-[11px] text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
            >
              Leeren
            </button>
          </div>
        </div>

        {variant === 'bewertung' ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {serien.map((s) => (
              <SchnittBadge
                key={s.id}
                label={s.label}
                schnitt={s.schnitt}
                aktuell={s.aktuell?.wert ?? null}
                abweichungPct={s.abweichungPct}
                jahre={s.jahreSchnitt}
                einheit={s.einheit}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="px-2 pb-3 pt-1 sm:px-4">
        <svg viewBox={`0 0 ${VIEW_W} ${HOEHE}`} className="w-full" role="img" aria-label="Kennzahlen-Chart">
          <defs>
            {serien.map((s) => (
              <linearGradient key={`grad-${s.id}`} id={`area-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.farbe} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.farbe} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>

          {yTicks.map((tick, i) => {
            const y = yAusWert(tick, minY, spanY, plotH)
            return (
              <g key={i}>
                <line
                  x1={PAD_LINKS}
                  y1={y}
                  x2={VIEW_W - PAD_RECHTS}
                  y2={y}
                  stroke="#27272a"
                  strokeDasharray={i === 0 ? undefined : '4 6'}
                />
                <text x={PAD_LINKS - 8} y={y + 4} textAnchor="end" fill="#52525b" style={{ fontSize: 10 }}>
                  {formatAchse(tick, einheitRef)}
                </text>
              </g>
            )
          })}

          <line
            x1={PAD_LINKS}
            y1={PAD_OBEN + plotH}
            x2={VIEW_W - PAD_RECHTS}
            y2={PAD_OBEN + plotH}
            stroke="#3f3f46"
            strokeWidth={1.2}
          />

          {serien.map((s) =>
            s.schnitt != null ? (
              <line
                key={`avg-${s.id}`}
                x1={PAD_LINKS}
                y1={yAusWert(s.schnitt, minY, spanY, plotH)}
                x2={VIEW_W - PAD_RECHTS}
                y2={yAusWert(s.schnitt, minY, spanY, plotH)}
                stroke={s.farbe}
                strokeWidth={1.5}
                strokeDasharray="8 6"
                opacity={0.55}
              />
            ) : null,
          )}

          {serien.map((s) => (
            <g key={s.id}>
              {s.areaD ? <path d={s.areaD} fill={`url(#area-${s.id})`} /> : null}
              {s.pathD ? (
                <path
                  d={s.pathD}
                  fill="none"
                  stroke={s.farbe}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              {s.historisch.map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r={3.5} fill="#09090b" stroke={s.farbe} strokeWidth={2} />
              ))}
              {s.aktuell ? (
                <>
                  <circle cx={s.aktuell.x} cy={s.aktuell.y} r={9} fill={s.farbe} opacity={0.2} />
                  <circle
                    cx={s.aktuell.x}
                    cy={s.aktuell.y}
                    r={5.5}
                    fill={AKTUELL_FARBE}
                    stroke={s.farbe}
                    strokeWidth={2.5}
                  />
                </>
              ) : null}
              {labelsAnzeigen
                ? [...s.historisch, ...(s.aktuell ? [s.aktuell] : [])].map((pt, i) => (
                    <text
                      key={i}
                      x={pt.x}
                      y={pt.y - 10}
                      textAnchor="middle"
                      fill={pt.aktuell ? AKTUELL_FARBE : s.farbe}
                      style={{ fontSize: 9, fontWeight: pt.aktuell ? 600 : 400 }}
                    >
                      {formatFundamentalWert(pt.wert, s.einheit)}
                    </text>
                  ))
                : null}
            </g>
          ))}

          {xLabels.map((xl, i) =>
            i % Math.max(1, Math.floor(xLabels.length / 8)) === 0 || i === xLabels.length - 1 ? (
              <text
                key={i}
                x={xl.x}
                y={HOEHE - 14}
                textAnchor="middle"
                fill={xl.label === 'TTM' || xl.label === 'NTM' ? '#a1a1aa' : '#52525b'}
                style={{ fontSize: 10, fontWeight: xl.label === 'TTM' || xl.label === 'NTM' ? 600 : 400 }}
              >
                {xl.label.length > 6 ? jahrAusPeriode(xl.label) : xl.label}
              </text>
            ) : null,
          )}
        </svg>

        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[10px] text-zinc-500">
          {serien.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full" style={{ background: s.farbe }} />
              <span className="text-zinc-400">{s.label}</span>
              {variant === 'bewertung' && s.schnitt != null ? (
                <span className="text-zinc-600">
                  · Schnitt {formatFundamentalWert(s.schnitt, s.einheit)}
                </span>
              ) : null}
            </li>
          ))}
          {variant === 'bewertung' ? (
            <li className="flex items-center gap-1.5 text-zinc-600">
              <span className="h-0 w-4 border-t border-dashed border-zinc-500" />
              10-Jahres-Schnitt
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}
