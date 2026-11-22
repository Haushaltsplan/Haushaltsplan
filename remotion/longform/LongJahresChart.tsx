/** Eine Kennzahl, eine Linie, ein Bild. Umsatz, Marge, Gewinn oder Free Cashflow. */
import { useMemo } from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { pct, usd } from '../../lib/youtube/longform/longform-format'
import type { LongformJahresreihe } from '../../lib/youtube/longform/longform-types'
import { aktiverSatz, ein, zaehleText, type SzeneProps } from './long-bausteine'
import { LONG_DISPLAY, LONG_LINIE, LONG_MONO, LONG_MUTED, LONG_RAND_X, LONG_ROT, LONG_SERIF, LONG_TEXT, mitAlpha } from './long-look'

const X0 = 220
const X1 = 1500
const Y0 = 280
const Y1 = 860

function reiheVon(sp: SzeneProps, index: number): LongformJahresreihe | null {
  const fokus = sp.p.saetze[index]!.visual.fokus ?? sp.p.saetze[index]!.faktIds.find((id) => id.startsWith('reihe.'))?.slice(6) ?? ''
  const id = fokus.replace(/^reihe\./, '')
  if (!id) return null
  return sp.p.reihen.find((r) => r.id === id) ?? null
}

function ausreisser(punkte: { jahr: number; wert: number }[]): number | null {
  if (punkte.length < 4) return null
  const deltas: number[] = []
  for (let i = 1; i < punkte.length; i++) deltas.push(Math.abs(punkte[i]!.wert - punkte[i - 1]!.wert))
  const sortiert = [...deltas].sort((a, b) => a - b)
  const med = sortiert[Math.floor(sortiert.length / 2)] ?? 0
  if (!(med > 0)) return null
  let best = 0
  let jahr: number | null = null
  deltas.forEach((d, i) => {
    if (d > med * 2.5 && d > best) {
      best = d
      jahr = punkte[i + 1]!.jahr
    }
  })
  return jahr
}

export function LongJahresChart(sp: SzeneProps) {
  const frame = useCurrentFrame()
  const i = aktiverSatz(sp, frame)
  const reihe = reiheVon(sp, i)
  const akzent = sp.p.varianten.akzent
  const geo = useMemo(() => {
    if (!reihe || reihe.punkte.length < 2) return null
    const werte = reihe.punkte.map((p) => p.wert)
    const min = Math.min(0, ...werte)
    const max = Math.max(...werte) * 1.12
    const span = max - min || 1
    const n = reihe.punkte.length
    const x = (k: number) => X0 + ((X1 - X0) * k) / (n - 1)
    const y = (v: number) => Y1 - ((Y1 - Y0) * (v - min)) / span
    let d = ''
    reihe.punkte.forEach((p, k) => {
      d += `${d ? 'L' : 'M'}${x(k).toFixed(1)},${y(p.wert).toFixed(1)}`
    })
    return { d, x, y, knick: ausreisser(reihe.punkte) }
  }, [reihe])

  if (!reihe || !geo) {
    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', fontFamily: LONG_SERIF, fontSize: 56, color: LONG_MUTED }}>
        No yearly series
      </AbsoluteFill>
    )
  }

  const letzter = reihe.punkte[reihe.punkte.length - 1]!
  const text = reihe.einheit === 'pct' ? pct(letzter.wert) : usd(letzter.wert * 1_000_000)
  const z = sp.t.saetze[i]!
  const beton = (z.betonungFrame ?? z.from + 8) - sp.block.from
  const fort = frame >= beton ? ein(frame, beton, 16) : 0
  const zeichnen = ein(frame, 10, 36)

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: LONG_RAND_X, top: 88 }}>
        <div style={{ fontFamily: LONG_SERIF, fontSize: 72, color: LONG_TEXT }}>{reihe.label}</div>
        <div style={{ fontFamily: LONG_MONO, fontSize: 20, letterSpacing: 2, color: LONG_MUTED, marginTop: 8 }}>
          {reihe.punkte[0]!.jahr} – {letzter.jahr}
        </div>
      </div>
      <div style={{ position: 'absolute', right: LONG_RAND_X, top: 88, textAlign: 'right', opacity: fort }}>
        <div style={{ fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 84, color: LONG_TEXT, letterSpacing: -2 }}>{zaehleText(text, fort || 0.01)}</div>
      </div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <clipPath id="lf-reihe">
            <rect x={0} y={0} width={X0 + (X1 - X0) * zeichnen} height={1080} />
          </clipPath>
        </defs>
        {reihe.punkte.map((p, k) => (
          <text key={p.jahr} x={geo.x(k)} y={Y1 + 42} textAnchor="middle" fill={LONG_MUTED} fontFamily={LONG_MONO} fontSize={20}>
            {p.jahr}
          </text>
        ))}
        <line x1={X0} x2={X1} y1={Y1} y2={Y1} stroke={LONG_LINIE} strokeWidth={1.5} />
        <g clipPath="url(#lf-reihe)">
          <path d={geo.d} fill="none" stroke={akzent} strokeWidth={2.5} strokeLinejoin="round" />
        </g>
        {geo.knick != null
          ? reihe.punkte.map((p, k) =>
              p.jahr === geo.knick ? (
                <g key={p.jahr}>
                  <circle cx={geo.x(k)} cy={geo.y(p.wert)} r={8} fill={LONG_ROT} />
                  <text x={geo.x(k)} y={Math.max(Y0 - 8, geo.y(p.wert) - 36)} textAnchor="middle" fill={LONG_ROT} fontFamily={LONG_MONO} fontSize={18}>
                    {p.jahr}
                  </text>
                </g>
              ) : null,
            )
          : null}
      </svg>
      <div style={{ position: 'absolute', left: LONG_RAND_X, bottom: 48, fontFamily: LONG_MONO, fontSize: 16, color: mitAlpha(LONG_TEXT, 0.45) }}>
        Company filings
      </div>
    </AbsoluteFill>
  )
}
