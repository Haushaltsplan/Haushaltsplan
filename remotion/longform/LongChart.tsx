/** 10.000-$-Chart: Aktie (Total + Price), S&P, Sektor-ETF — Zahlen erst beim gesprochenen Fakt. */
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

/** Relativer Frame, an dem ein Fakt erstmals gesprochen wird (Betonung des Satzes). */
function faktBetonungFrame(sp: SzeneProps, faktId: string): number | null {
  for (const i of sp.block.saetze) {
    const s = sp.p.saetze[i]!
    if (!s.faktIds.includes(faktId)) continue
    const z = sp.t.saetze[i]!
    return (z.betonungFrame ?? z.from + 8) - sp.block.from
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

type HudZeile = { id: string; label: string; text: string; art: 'haupt' | 'neben' | 'pct' }

function hudAusSatz(sp: SzeneProps, satzIndex: number): HudZeile[] {
  const s = sp.p.saetze[satzIndex]!
  const ids = s.faktIds.length ? s.faktIds : []
  const zeilen: HudZeile[] = []
  const push = (id: string, art: HudZeile['art'] = 'haupt') => {
    const f = sp.p.fakten[id]
    if (!f || zeilen.some((z) => z.id === id)) return
    zeilen.push({ id, label: f.label, text: f.text, art })
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

/** Gestaffelter Stack: einmal gesprochene Kernzahlen bleiben sichtbar und bauen sich auf. */
function stackAusBlock(sp: SzeneProps, frame: number): {
  nurKurs: string | null
  div: string | null
  total: string | null
  rendite: string | null
  spy: string | null
  sektor: string | null
} {
  const gesehen = (id: string) => {
    const f = faktBetonungFrame(sp, id)
    return f != null && frame >= f
  }
  return {
    nurKurs: gesehen('k10.nur_kurs') ? sp.p.fakten['k10.nur_kurs']?.text ?? null : null,
    div: gesehen('k10.dividenden_usd') ? sp.p.fakten['k10.dividenden_usd']?.text ?? null : null,
    total: gesehen('k10.endwert') ? sp.p.fakten['k10.endwert']?.text ?? null : null,
    rendite: gesehen('k10.rendite')
      ? sp.p.fakten['k10.rendite']?.text ?? null
      : gesehen('k10.cagr')
        ? sp.p.fakten['k10.cagr']?.text ?? null
        : null,
    spy: gesehen('k10.spy_endwert')
      ? sp.p.fakten['k10.spy_endwert']?.text ?? null
      : gesehen('k10.spy_rendite')
        ? sp.p.fakten['k10.spy_rendite']?.text ?? null
        : null,
    sektor: gesehen('k10.sektor_endwert')
      ? sp.p.fakten['k10.sektor_endwert']?.text ?? null
      : gesehen('k10.sektor_rendite')
        ? sp.p.fakten['k10.sektor_rendite']?.text ?? null
        : null,
  }
}

export function LongChart(sp: SzeneProps) {
  const frame = useCurrentFrame()
  const c = sp.p.chart
  const akzent = sp.p.varianten.akzent
  const flaeche = sp.p.varianten.chartStil === 'linie_flaeche'

  const geo = useMemo(() => {
    if (!c || c.punkte.length < 2) return null
    const max = Math.max(
      ...c.punkte.map((q) => Math.max(q.aktie, q.kursOhneDiv ?? 0, q.spy ?? 0, q.sektor ?? 0)),
    ) * 1.08
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
      kursOhneDiv: c.punkte.some((q) => q.kursOhneDiv != null) ? pfad((i) => c.punkte[i]!.kursOhneDiv) : null,
      spy: c.punkte.some((q) => q.spy != null) ? pfad((i) => c.punkte[i]!.spy) : null,
      sektor: c.punkte.some((q) => q.sektor != null) ? pfad((i) => c.punkte[i]!.sektor) : null,
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

  const stack = stackAusBlock(sp, frame)
  const satzHud = hudAusSatz(sp, i)
  const zSatz = sp.t.saetze[i]!
  const betonRel = (zSatz.betonungFrame ?? zSatz.from + 8) - sp.block.from
  const hudEin = frame >= betonRel ? ein(frame, betonRel, 12) : 0

  const sektLabel = c.sektorEtf ?? 'Sector'
  const ddLabelX = geo.dd ? Math.min(Math.max(LONG_RAND_X, geo.x(geo.dd.b) - 40), 1920 - LONG_RAND_X - 280) : LONG_RAND_X
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
            {pct(c.drawdown.pct, { vorzeichen: true })}
            <span style={{ marginLeft: 12, fontFamily: LONG_MONO, fontWeight: 500, fontSize: 16, color: LONG_MUTED }}>
              {monatJahr(c.drawdown.hochDatum)} → {monatJahr(c.drawdown.tiefDatum)}
            </span>
          </div>
        ) : null}
      </AbsoluteFill>

      {(stack.nurKurs || stack.total || stack.div || stack.rendite || stack.spy || stack.sektor || (satzHud.length > 0 && hudEin > 0)) ? (
        <div style={{ position: 'absolute', right: LONG_RAND_X, top: 72, textAlign: 'right', maxWidth: 520 }}>
          {stack.nurKurs && !stack.total ? (
            <>
              <div style={{ fontFamily: LONG_MONO, fontSize: 16, letterSpacing: 2, color: LONG_MUTED }}>PRICE ONLY</div>
              <div style={{ fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 92, letterSpacing: -3, color: LONG_TEXT, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {zaehleText(stack.nurKurs, 1)}
              </div>
            </>
          ) : null}
          {stack.div ? (
            <div style={{ marginTop: stack.nurKurs && !stack.total ? 8 : 0, fontFamily: LONG_MONO, fontSize: 28, color: LONG_GRUEN }}>
              + dividends {stack.div}
            </div>
          ) : null}
          {stack.total ? (
            <>
              <div style={{ fontFamily: LONG_MONO, fontSize: 16, letterSpacing: 2, color: LONG_MUTED, marginTop: stack.div || stack.nurKurs ? 10 : 0 }}>
                {sp.p.ticker} TOTAL
              </div>
              <div style={{ fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 100, letterSpacing: -4, color: LONG_TEXT, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {zaehleText(stack.total, 1)}
              </div>
            </>
          ) : null}
          {stack.rendite ? (
            <div
              style={{
                display: 'inline-block',
                marginTop: 12,
                padding: '6px 16px',
                borderRadius: 999,
                background: mitAlpha(LONG_GRUEN, 0.16),
                color: LONG_GRUEN,
                fontFamily: LONG_MONO,
                fontWeight: 700,
                fontSize: 26,
              }}
            >
              {stack.rendite.startsWith('+') || stack.rendite.startsWith('-') ? stack.rendite : `+${stack.rendite}`}
            </div>
          ) : null}
          {stack.spy ? (
            <div style={{ marginTop: 14, fontFamily: LONG_MONO, fontSize: 22, color: LONG_SPY }}>S&P 500 {stack.spy}</div>
          ) : null}
          {stack.sektor ? (
            <div style={{ marginTop: 8, fontFamily: LONG_MONO, fontSize: 22, color: LONG_SEKTOR }}>
              {sektLabel} {stack.sektor}
            </div>
          ) : null}
          {!stack.nurKurs && !stack.total && satzHud[0] && hudEin > 0 ? (
            <div style={{ opacity: hudEin }}>
              <div style={{ fontFamily: LONG_MONO, fontSize: 16, letterSpacing: 2, color: LONG_MUTED }}>{satzHud[0].label.toUpperCase()}</div>
              <div
                style={{
                  fontFamily: LONG_DISPLAY,
                  fontWeight: 900,
                  fontSize: satzHud[0].art === 'pct' ? 84 : 96,
                  letterSpacing: -3,
                  color: satzHud[0].art === 'pct' ? LONG_ROT : LONG_TEXT,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {zaehleText(satzHud[0].text, hudEin)}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </AbsoluteFill>
  )
}
