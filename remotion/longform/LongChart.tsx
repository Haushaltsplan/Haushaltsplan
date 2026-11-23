/** 10.000-$-Chart: Aktie (Total + Price), S&P, Sektor-ETF — Zahlen erst beim gesprochenen Fakt. */
import { useMemo } from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { dollarImText, monatJahr, pct, usd } from '../../lib/youtube/longform/longform-format'
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
const LONG_SEKTOR = 'rgba(120, 200, 180, 0.9)'
const LONG_PRICE = 'rgba(243, 241, 236, 0.55)'

function ersterFrame(sp: SzeneProps, szene: string): number | null {
  for (const i of sp.block.saetze) {
    if (sp.p.saetze[i]!.visual.szene === szene) {
      const z = sp.t.saetze[i]!
      return (z.betonungFrame ?? z.from + 6) - sp.block.from
    }
  }
  return null
}

function logSchritte(boden: number, max: number): number[] {
  const out: number[] = []
  const start = Math.pow(10, Math.floor(Math.log10(Math.max(boden, 1))))
  for (let v = start; v <= max * 1.05; v *= 10) {
    for (const m of [1, 2, 5]) {
      const t = v * m
      if (t >= boden * 0.98 && t <= max * 1.02) out.push(t)
    }
  }
  return out.length ? out : [boden, max]
}

type HudZeile = { id: string; label: string; text: string; art: 'haupt' | 'neben' | 'pct' }

function pctFarbe(sp: SzeneProps, id: string): string {
  if (id === 'k10.drawdown') return LONG_ROT
  const wert = sp.p.fakten[id]?.wert
  return wert != null && wert < 0 ? LONG_ROT : LONG_GRUEN
}

function hudAusSatz(sp: SzeneProps, satzIndex: number): HudZeile[] {
  const s = sp.p.saetze[satzIndex]!
  const ids = s.faktIds.length ? s.faktIds : []
  const zeilen: HudZeile[] = []
  const push = (id: string, art: HudZeile['art'] = 'haupt') => {
    const f = sp.p.fakten[id]
    if (!f || zeilen.some((z) => z.id === id)) return
    zeilen.push({ id, label: f.label, text: dollarImText(f.text, f.wert), art })
  }
  // Priorität: Betonung → explizite Kern-IDs → erstes $-/%-Fakt
  const kern = ['k10.nur_kurs', 'k10.dividenden_usd', 'k10.endwert', 'k10.rendite', 'k10.cagr', 'k10.spy_endwert', 'k10.spy_rendite', 'k10.vs_spy', 'k10.sektor_endwert', 'k10.sektor_rendite', 'k10.vs_sektor', 'k10.drawdown', 'k10.drawdown_wert']
  for (const id of ids) {
    if (kern.includes(id)) {
      const art: HudZeile['art'] = id.includes('rendite') || id.includes('cagr') || id === 'k10.drawdown' ? 'pct' : id.includes('dividenden') || id.startsWith('k10.vs_') ? 'neben' : 'haupt'
      push(id, art)
    }
  }
  if (!zeilen.length) {
    for (const id of ids) {
      const f = sp.p.fakten[id]
      if (!f) continue
      if (/[$%]/.test(f.text) || f.wert != null) {
        push(id, /%/.test(f.text) ? 'pct' : 'haupt')
        break
      }
    }
  }
  return zeilen
}

export function LongChart(sp: SzeneProps) {
  const frame = useCurrentFrame()
  const c = sp.p.chart
  const akzent = sp.p.varianten.akzent
  const flaeche = sp.p.varianten.chartStil === 'linie_flaeche'

  const geo = useMemo(() => {
    if (!c || c.punkte.length < 2) return null
    const werte = c.punkte.flatMap((q) => [q.aktie, q.kursOhneDiv, q.spy, q.sektor].filter((v): v is number => v != null && v > 0))
    const max = Math.max(...werte, LONGFORM_INVEST_USD) * 1.08
    const kleinst = Math.min(...werte, LONGFORM_INVEST_USD)
    const boden = Math.max(100, kleinst * 0.72)
    const log = (v: number) => Math.log(Math.max(v, boden))
    const n = c.punkte.length
    const x = (i: number) => X0 + ((X1 - X0) * i) / (n - 1)
    const y = (v: number) => Y1 - ((Y1 - Y0) * (log(v) - log(boden))) / (log(max) - log(boden))
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
      kursOhneDiv: c.punkte.some((q) => q.kursOhneDiv != null) ? pfad((i) => c.punkte[i]!.kursOhneDiv) : null,
      spy: c.punkte.some((q) => q.spy != null) ? pfad((i) => c.punkte[i]!.spy) : null,
      sektor: c.punkte.some((q) => q.sektor != null) ? pfad((i) => c.punkte[i]!.sektor) : null,
      jahre: jahre.filter((_, k) => jahre.length <= 12 || k % 2 === 0),
      schritte: logSchritte(boden, max),
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
  const zeichnen = ein(frame, 8, 360)

  const fDd = ersterFrame(sp, 'chart_drawdown')
  const fSpy = ersterFrame(sp, 'chart_vergleich')
  const ddAktiv = szene === 'chart_drawdown' && geo.dd
  const spyBeton = fSpy != null ? ein(frame, fSpy, 40) : szene === 'chart_vergleich' ? 1 : 0

  const ddMitte = geo.dd ? (geo.x(geo.dd.a) + geo.x(geo.dd.b)) / 2 : 960
  const ddIdx = sp.block.saetze.findIndex((k) => sp.p.saetze[k]!.visual.szene === 'chart_drawdown')
  const ddNaechster = ddIdx >= 0 ? sp.block.saetze[ddIdx + 1] : undefined
  const ddEnde = ddNaechster != null ? sp.t.saetze[ddNaechster]!.from - sp.block.from : sp.block.dauer
  const zoom =
    geo.dd && fDd != null && ddEnde > fDd + 30
      ? interpolate(frame, [fDd, fDd + 20, ddEnde - 6, ddEnde + 14], [1, 1.18, 1.18, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 1

  const satzHud = hudAusSatz(sp, i)
  const zSatz = sp.t.saetze[i]!
  const betonRel = (zSatz.betonungFrame ?? zSatz.from + 8) - sp.block.from
  const hudEin = frame >= betonRel ? ein(frame, betonRel, 12) : 0

  const sektLabel = c.sektorEtf ?? 'Sector'
  const ddLabelX = geo.dd ? Math.min(Math.max(LONG_RAND_X, geo.x(geo.dd.b) - 40), 1180) : LONG_RAND_X
  const ddLabelY = 220

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: LONG_RAND_X, top: 72 }}>
        <div style={{ fontFamily: LONG_SERIF, fontSize: 64, color: LONG_TEXT, opacity: ein(frame, 0, 18) }}>
          {usd(LONGFORM_INVEST_USD)} in {sp.p.ticker}
          {geo.spy ? <span style={{ color: LONG_MUTED, fontSize: 44 }}> vs S&P{geo.sektor ? ` · ${sektLabel}` : ''}</span> : null}
        </div>
        <div style={{ fontFamily: LONG_MONO, fontSize: 20, color: LONG_MUTED, marginTop: 10, letterSpacing: 1, opacity: ein(frame, 8, 18) }}>
          {monatJahr(c.startDatum).toUpperCase()} – {monatJahr(c.endDatum).toUpperCase()} · USD
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: LONG_RAND_X,
          top: 200,
          display: 'flex',
          gap: 22,
          flexWrap: 'wrap',
          opacity: ein(frame, 10, 16),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 4, borderRadius: 2, background: akzent }} />
          <span style={{ fontFamily: LONG_MONO, fontSize: 20, color: LONG_TEXT, letterSpacing: 1 }}>{sp.p.ticker}</span>
        </div>
        {geo.kursOhneDiv ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 0, borderTop: `2px dashed ${LONG_PRICE}` }} />
            <span style={{ fontFamily: LONG_MONO, fontSize: 20, color: LONG_MUTED, letterSpacing: 1 }}>Price only</span>
          </div>
        ) : null}
        {geo.spy ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 0, borderTop: `3px dashed ${LONG_SPY}` }} />
            <span style={{ fontFamily: LONG_MONO, fontSize: 20, color: LONG_MUTED, letterSpacing: 1 }}>S&P 500</span>
          </div>
        ) : null}
        {geo.sektor ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 0, borderTop: `3px dotted ${LONG_SEKTOR}` }} />
            <span style={{ fontFamily: LONG_MONO, fontSize: 20, color: LONG_MUTED, letterSpacing: 1 }}>{sektLabel}</span>
          </div>
        ) : null}
      </div>

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
            {geo.sektor ? (
              <path d={geo.sektor} fill="none" stroke={LONG_SEKTOR} strokeWidth={2.4} strokeDasharray="3 7" strokeLinejoin="round" opacity={0.7} />
            ) : null}
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
            {geo.kursOhneDiv ? (
              <path d={geo.kursOhneDiv} fill="none" stroke={LONG_PRICE} strokeWidth={3} strokeDasharray="7 8" strokeLinejoin="round" opacity={0.75} />
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
              left: ddLabelX,
              top: ddLabelY,
              padding: '10px 18px',
              borderRadius: 999,
              background: 'rgba(12,12,14,0.88)',
              border: `1px solid ${mitAlpha(LONG_ROT, 0.45)}`,
              fontFamily: LONG_DISPLAY,
              fontWeight: 800,
              fontSize: 42,
              color: LONG_ROT,
              opacity: ein(frame, (fDd ?? 0) + 10, 12),
              pointerEvents: 'none',
            }}
          >
            <span style={{ display: 'block', marginBottom: 4, fontFamily: LONG_MONO, fontWeight: 500, fontSize: 14, letterSpacing: 2, color: LONG_MUTED }}>
              {(sp.p.fakten['k10.drawdown']?.label ?? 'Drop from the high').toUpperCase()}
            </span>
            {pct(c.drawdown.pct, { vorzeichen: true })}
            <span style={{ marginLeft: 12, fontFamily: LONG_MONO, fontWeight: 500, fontSize: 16, color: LONG_MUTED }}>
              {monatJahr(c.drawdown.hochDatum)} → {monatJahr(c.drawdown.tiefDatum)}
            </span>
          </div>
        ) : null}
      </AbsoluteFill>

      {satzHud[0] && hudEin > 0 ? (
        <div style={{ position: 'absolute', right: LONG_RAND_X, top: 88, textAlign: 'right', width: 520 }}>
          <div style={{ fontFamily: LONG_MONO, fontSize: 16, letterSpacing: 2, color: LONG_MUTED }}>{satzHud[0].label.toUpperCase()}</div>
          <div
            style={{
              marginTop: 12,
              fontFamily: LONG_DISPLAY,
              fontWeight: 900,
              fontSize: satzHud[0].text.length > 10 ? 56 : satzHud[0].text.length > 8 ? 64 : 72,
              letterSpacing: -2,
              color: satzHud[0].art === 'pct' ? pctFarbe(sp, satzHud[0].id) : LONG_TEXT,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              opacity: hudEin,
            }}
          >
            {zaehleText(satzHud[0].text, hudEin)}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  )
}
