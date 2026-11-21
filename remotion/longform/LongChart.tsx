/** 10.000-$-Chart: Aktie + S&P 500 von Anfang an, Zoom auf Drawdown, Endwert und Vergleich. */
import { useMemo } from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { monatJahr, pct, usd } from '../../lib/youtube/longform/longform-format'
import { LONGFORM_INVEST_USD } from '../../lib/youtube/longform/longform-types'
import { aktiverSatz, ein, zaehleText, type SzeneProps } from './long-bausteine'
import {
  LONG_DISPLAY,
  LONG_GRUEN,
  LONG_LINIE,
  LONG_MONO,
  LONG_MUTED,
  LONG_RAND_X,
  LONG_ROT,
  LONG_SERIF,
  LONG_SPY,
  LONG_TEXT,
  mitAlpha,
} from './long-look'

const X0 = LONG_RAND_X + 90
const X1 = 1920 - LONG_RAND_X - 260
const Y0 = 300
const Y1 = 900

function ersterFrame(sp: SzeneProps, szene: string): number | null {
  for (const i of sp.block.saetze) {
    if (sp.p.saetze[i]!.visual.szene === szene) {
      const z = sp.t.saetze[i]!
      return (z.betonungFrame ?? z.from + 6) - sp.block.from
    }
  }
  return null
}

function schoeneSchritte(max: number): number[] {
  const roh = max / 4
  const p = Math.pow(10, Math.floor(Math.log10(roh || 1)))
  const schritt = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= roh) ?? roh
  const out: number[] = []
  for (let v = 0; v <= max * 1.001; v += schritt) out.push(v)
  return out
}

export function LongChart(sp: SzeneProps) {
  const frame = useCurrentFrame()
  const c = sp.p.chart
  const akzent = sp.p.varianten.akzent
  const flaeche = sp.p.varianten.chartStil === 'linie_flaeche'

  const geo = useMemo(() => {
    if (!c || c.punkte.length < 2) return null
    const max = Math.max(...c.punkte.map((q) => Math.max(q.aktie, q.spy ?? 0))) * 1.08
    const n = c.punkte.length
    const x = (i: number) => X0 + ((X1 - X0) * i) / (n - 1)
    const y = (v: number) => Y1 - ((Y1 - Y0) * v) / max
    const pfad = (wert: (i: number) => number | null) => {
      let d = ''
      c.punkte.forEach((_, i) => {
        const v = wert(i)
        if (v == null) return
        d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
      })
      return d
    }
    const jahre: { x: number; label: string }[] = []
    let letztesJahr = ''
    c.punkte.forEach((q, i) => {
      const j = q.d.slice(0, 4)
      if (j !== letztesJahr && i > 0) jahre.push({ x: x(i), label: j })
      letztesJahr = j
    })
    const idx = (d: string) => {
      const i = c.punkte.findIndex((q) => q.d >= d)
      return i < 0 ? n - 1 : i
    }
    return {
      max,
      x,
      y,
      aktie: pfad((i) => c.punkte[i]!.aktie),
      spy: c.punkte.some((q) => q.spy != null) ? pfad((i) => c.punkte[i]!.spy) : null,
      jahre: jahre.filter((_, k) => jahre.length <= 12 || k % 2 === 0),
      schritte: schoeneSchritte(max),
      dd: c.drawdown ? { a: idx(c.drawdown.hochDatum), b: idx(c.drawdown.tiefDatum) } : null,
    }
  }, [c])

  if (!c || !geo) {
    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', fontFamily: LONG_SERIF, fontSize: 64, color: LONG_MUTED }}>
        No price history available
      </AbsoluteFill>
    )
  }

  const i = aktiverSatz(sp, frame)
  const szene = sp.p.saetze[i]!.visual.szene
  const ersterSatz = sp.t.saetze[sp.block.saetze[0]!]!
  const zeichenDauer = Math.max(75, Math.min(200, ersterSatz.dauer))
  const zeichnen = ein(frame, 12, zeichenDauer)

  const fEnd = ersterFrame(sp, 'chart_endwert')
  const fDd = ersterFrame(sp, 'chart_drawdown')
  const fSpy = ersterFrame(sp, 'chart_vergleich')
  const ddAktiv = szene === 'chart_drawdown' && geo.dd
  const vergleichAktiv = szene === 'chart_vergleich'
  const endFort = fEnd != null ? ein(frame, fEnd, 30) : 0
  const spyBeton = fSpy != null ? ein(frame, fSpy, 40) : vergleichAktiv ? 1 : 0

  const ddMitte = geo.dd ? (geo.x(geo.dd.a) + geo.x(geo.dd.b)) / 2 : 960
  const ddIdx = sp.block.saetze.findIndex((k) => sp.p.saetze[k]!.visual.szene === 'chart_drawdown')
  const ddNaechster = ddIdx >= 0 ? sp.block.saetze[ddIdx + 1] : undefined
  const ddEnde = ddNaechster != null ? sp.t.saetze[ddNaechster]!.from - sp.block.from : sp.block.dauer
  const zoom =
    geo.dd && fDd != null && ddEnde > fDd + 30
      ? interpolate(frame, [fDd, fDd + 20, ddEnde - 6, ddEnde + 14], [1, 1.18, 1.18, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 1

  const ende = c.punkte[c.punkte.length - 1]!
  const endX = geo.x(c.punkte.length - 1)
  const plus = c.endwertGesamt / LONGFORM_INVEST_USD - 1
  const spyPlus = c.endwertSpy != null ? c.endwertSpy / LONGFORM_INVEST_USD - 1 : null

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: LONG_RAND_X, top: 72 }}>
        <div style={{ fontFamily: LONG_SERIF, fontSize: 68, color: LONG_TEXT, opacity: ein(frame, 0, 18) }}>
          {usd(LONGFORM_INVEST_USD)} in {sp.p.ticker}
          {geo.spy ? <span style={{ color: LONG_MUTED, fontSize: 48 }}> vs S&P 500</span> : null}
        </div>
        <div style={{ fontFamily: LONG_MONO, fontSize: 22, color: LONG_MUTED, marginTop: 10, letterSpacing: 1, opacity: ein(frame, 8, 18) }}>
          {monatJahr(c.startDatum).toUpperCase()} – {monatJahr(c.endDatum).toUpperCase()} · DIVIDENDS REINVESTED · USD
        </div>
      </div>

      {geo.spy ? (
        <div
          style={{
            position: 'absolute',
            left: LONG_RAND_X,
            top: 210,
            display: 'flex',
            gap: 28,
            opacity: ein(frame, 10, 16),
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: akzent }} />
            <span style={{ fontFamily: LONG_MONO, fontSize: 22, color: LONG_TEXT, letterSpacing: 1 }}>{sp.p.ticker}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 0, borderTop: `3px dashed ${LONG_SPY}` }} />
            <span style={{ fontFamily: LONG_MONO, fontSize: 22, color: LONG_MUTED, letterSpacing: 1 }}>S&P 500</span>
          </div>
        </div>
      ) : null}

      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: `${ddMitte}px ${(Y0 + Y1) / 2}px` }}>
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <linearGradient id="lf-flaeche" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={akzent} stopOpacity={0.28} />
              <stop offset="100%" stopColor={akzent} stopOpacity={0} />
            </linearGradient>
            <clipPath id="lf-zeichnen">
              <rect x={0} y={0} width={X0 + (X1 - X0) * zeichnen + 2} height={1080} />
            </clipPath>
          </defs>
          {geo.schritte.map((v) => (
            <g key={v} opacity={ein(frame, 4, 20)}>
              <line x1={X0} x2={X1} y1={geo.y(v)} y2={geo.y(v)} stroke={LONG_LINIE} strokeWidth={1.5} />
              <text x={X0 - 18} y={geo.y(v) + 8} textAnchor="end" fill={LONG_MUTED} fontFamily={LONG_MONO} fontSize={20}>
                {v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${v}`}
              </text>
            </g>
          ))}
          {geo.jahre.map((j) => (
            <text key={j.label} x={j.x} y={Y1 + 40} textAnchor="middle" fill={LONG_MUTED} fontFamily={LONG_MONO} fontSize={20} opacity={ein(frame, 6, 20)}>
              {j.label}
            </text>
          ))}
          <line x1={X0} x2={X1} y1={geo.y(LONGFORM_INVEST_USD)} y2={geo.y(LONGFORM_INVEST_USD)} stroke={mitAlpha('#F3F1EC', 0.35)} strokeDasharray="6 8" strokeWidth={2} />

          {geo.dd && fDd != null && frame >= fDd ? (
            <g opacity={ddAktiv ? ein(frame, fDd, 12) : 0.35}>
              <rect
                x={geo.x(geo.dd.a)}
                y={Y0}
                width={Math.max(4, geo.x(geo.dd.b) - geo.x(geo.dd.a))}
                height={Y1 - Y0}
                fill={mitAlpha(LONG_ROT, 0.14)}
              />
              <line x1={geo.x(geo.dd.b)} x2={geo.x(geo.dd.b)} y1={Y0} y2={Y1} stroke={LONG_ROT} strokeWidth={2} />
            </g>
          ) : null}

          <g clipPath="url(#lf-zeichnen)">
            {geo.spy ? (
              <path
                d={geo.spy}
                fill="none"
                stroke={LONG_SPY}
                strokeWidth={2.8 + spyBeton * 1.4}
                strokeDasharray="10 9"
                strokeLinejoin="round"
                opacity={0.55 + spyBeton * 0.4}
              />
            ) : null}
            {flaeche ? <path d={`${geo.aktie}L${X1},${Y1}L${X0},${Y1}Z`} fill="url(#lf-flaeche)" /> : null}
            <path d={geo.aktie} fill="none" stroke={akzent} strokeWidth={flaeche ? 5 : 4} strokeLinejoin="round" />
          </g>
          {zeichnen > 0.02 ? (
            <circle
              cx={X0 + (X1 - X0) * zeichnen}
              cy={geo.y(c.punkte[Math.min(c.punkte.length - 1, Math.round(zeichnen * (c.punkte.length - 1)))]!.aktie)}
              r={9}
              fill={akzent}
            />
          ) : null}
        </svg>

        {geo.dd && ddAktiv && c.drawdown ? (
          <div
            style={{
              position: 'absolute',
              left: geo.x(geo.dd.b) + 18,
              top: geo.y(c.punkte[geo.dd.b]!.aktie) + 10,
              fontFamily: LONG_DISPLAY,
              fontWeight: 800,
              fontSize: 54,
              color: LONG_ROT,
              opacity: ein(frame, (fDd ?? 0) + 10, 12),
            }}
          >
            {pct(c.drawdown.pct, { vorzeichen: true })}
            <div style={{ fontFamily: LONG_MONO, fontWeight: 500, fontSize: 18, color: LONG_MUTED }}>
              {monatJahr(c.drawdown.hochDatum)} → {monatJahr(c.drawdown.tiefDatum)}
            </div>
          </div>
        ) : null}

        {geo.spy && zeichnen > 0.92 && c.endwertSpy != null ? (
          <div
            style={{
              position: 'absolute',
              left: Math.min(endX + 16, 1920 - LONG_RAND_X - 220),
              top: Math.max(Y0 + 8, Math.min(Y1 - 48, geo.y(ende.spy ?? 0) - 22)),
              fontFamily: LONG_MONO,
              fontSize: 22,
              color: LONG_SPY,
              opacity: 0.55 + spyBeton * 0.45,
              textShadow: '0 1px 8px rgba(0,0,0,0.65)',
            }}
          >
            S&P {usd(c.endwertSpy)}
          </div>
        ) : null}
      </AbsoluteFill>

      {fEnd != null && frame >= fEnd ? (
        <div style={{ position: 'absolute', right: LONG_RAND_X, top: 72, textAlign: 'right' }}>
          <div style={{ fontFamily: LONG_MONO, fontSize: 18, letterSpacing: 2, color: LONG_MUTED, opacity: ein(frame, fEnd, 10) }}>{sp.p.ticker}</div>
          <div style={{ fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 110, letterSpacing: -4, color: LONG_TEXT, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {zaehleText(usd(c.endwertGesamt), endFort)}
          </div>
          <div
            style={{
              display: 'inline-block',
              marginTop: 12,
              padding: '6px 16px',
              borderRadius: 999,
              background: mitAlpha(plus >= 0 ? LONG_GRUEN : LONG_ROT, 0.16),
              color: plus >= 0 ? LONG_GRUEN : LONG_ROT,
              fontFamily: LONG_MONO,
              fontWeight: 700,
              fontSize: 26,
              opacity: ein(frame, fEnd + 24, 10),
            }}
          >
            {pct(plus * 100, { vorzeichen: true })}
          </div>
          {spyPlus != null && (vergleichAktiv || spyBeton > 0.4) ? (
            <div style={{ marginTop: 18, fontFamily: LONG_MONO, fontSize: 22, color: LONG_MUTED, opacity: ein(frame, (fSpy ?? fEnd) + 20, 14) }}>
              S&P 500 {pct(spyPlus * 100, { vorzeichen: true })}
            </div>
          ) : null}
        </div>
      ) : null}
    </AbsoluteFill>
  )
}
