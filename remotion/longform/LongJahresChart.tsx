/** Jahreschart des Zahlen-Kapitels. Balken, Linien oder zwei Reihen, Schätzjahre blasser. */
import { useMemo } from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { pct, usd, usdKurz } from '../../lib/youtube/longform/longform-format'
import type { LongformJahresGross, LongformJahreslinie, LongformJahrespunkt, LongformJahresreihe } from '../../lib/youtube/longform/longform-types'
import { aktiverSatz, ein, zaehleText, type SzeneProps } from './long-bausteine'
import { LONG_DISPLAY, LONG_GRUEN, LONG_LINIE, LONG_MONO, LONG_MUTED, LONG_RAND_X, LONG_ROT, LONG_SERIF, LONG_TEXT, mitAlpha } from './long-look'

const X0 = 228
const X1 = 1840
const Y0 = 268
const Y1 = 860

const GOLD = '#E8C36A'
const GOLD_EST = 'rgba(232, 195, 106, 0.4)'
const CASH = '#7DDCB0'
const CASH_EST = 'rgba(125, 220, 176, 0.4)'
const BLAU = '#8EB6F2'
const LILA = '#D7B4F5'
const ROT_EST = 'rgba(239, 106, 90, 0.42)'
const LINIEN_FARBEN = [GOLD, BLAU, LILA]
const ACHSE = 'rgba(243, 241, 236, 0.82)'

const FOKUS = ['umsatz', 'gewinn', 'fcf', 'marge', 'roic', 'capex', 'schulden', 'aktien', 'kgv', 'ev_ebitda', 'ev_rev', 'fcf_rendite']

type AltReihe = LongformJahresreihe & { punkte?: { jahr: number; wert: number }[] }

function reiheVon(sp: SzeneProps, index: number): LongformJahresreihe | null {
  const satz = sp.p.saetze[index]
  if (!satz) return null
  const roh = (satz.visual.fokus ?? satz.faktIds.find((id) => id.startsWith('reihe.')) ?? '').replace(/^reihe\./, '')
  const id = FOKUS.find((f) => roh === f || roh.startsWith(`${f}.`))
  if (!id) return null
  const treffer = sp.p.reihen.find((r) => r.id === id) as AltReihe | undefined
  if (!treffer) return null
  if (treffer.linien?.length && treffer.art) return { ...treffer, wacc: treffer.wacc ?? null, schnitt: treffer.schnitt ?? null }
  const alt = treffer.punkte ?? []
  return {
    ...treffer,
    art: treffer.art ?? 'balken',
    linien: [{ id: treffer.id, label: treffer.label, punkte: alt.map((p) => ({ ...p, schaetzung: false })) }],
    wacc: treffer.wacc ?? null,
    schnitt: treffer.schnitt ?? null,
    quelle: treffer.quelle ?? 'Company filings',
    gross: treffer.gross ?? null,
  }
}

type JahrSlot = { jahr: number; schaetzung: boolean; hatWert: boolean }

/** Jedes Kalenderjahr vom ersten bis zum letzten Punkt. Eine Lücke bleibt leer, kein Jahr wird übersprungen. */
function jahreAus(linien: LongformJahreslinie[]): JahrSlot[] {
  const map = new Map<number, boolean>()
  for (const l of linien) {
    for (const p of l.punkte) {
      const alt = map.get(p.jahr)
      map.set(p.jahr, alt == null ? p.schaetzung : alt && p.schaetzung)
    }
  }
  const vorhanden = [...map.keys()]
  if (!vorhanden.length) return []
  const von = Math.min(...vorhanden)
  const bis = Math.max(...vorhanden)
  const out: JahrSlot[] = []
  for (let jahr = von; jahr <= bis; jahr++) {
    out.push({ jahr, schaetzung: map.get(jahr) ?? false, hatWert: map.has(jahr) })
  }
  return out
}

function schoenerSchritt(rough: number): number {
  if (!(rough > 0) || !Number.isFinite(rough)) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const n = rough / mag
  const nice = n >= 5 ? 5 : n >= 2 ? 2 : 1
  return nice * mag
}

function achsenTicks(min: number, max: number): { ticks: number[]; oben: number } {
  if (!(max > min)) return { ticks: [min], oben: min + 1 }
  const schritt = schoenerSchritt((max - min) / 4)
  const start = Math.ceil(min / schritt - 1e-9) * schritt
  const out: number[] = []
  for (let v = start; v <= max + schritt * 1.01; v += schritt) {
    const rund = Math.round(v / schritt) * schritt
    if (rund < min - schritt * 0.01) continue
    out.push(Number(rund.toPrecision(12)))
    if (out[out.length - 1]! >= max - schritt * 0.05 || out.length > 6) break
  }
  if (!out.length) return { ticks: [min, max], oben: max }
  const oben = Math.max(max, out[out.length - 1]!)
  return { ticks: out, oben }
}

function achseText(wert: number, einheit: LongformJahresreihe['einheit']): string {
  if (Object.is(wert, -0)) wert = 0
  if (einheit === 'pct') {
    const r = Math.abs(wert) >= 100 ? Math.round(wert) : Math.round(wert * 10) / 10
    return `${r}%`
  }
  if (einheit === 'aktien') {
    const r = Math.abs(wert) >= 100 ? Math.round(wert) : Math.round(wert * 10) / 10
    return String(r)
  }
  if (einheit === 'x') {
    const r = Math.abs(wert) >= 100 ? Math.round(wert) : Math.round(wert * 10) / 10
    return `${r}x`
  }
  return usdKurz(wert * 1_000_000)
}

function einheitTitel(einheit: LongformJahresreihe['einheit']): string {
  if (einheit === 'pct') return 'Percent'
  if (einheit === 'aktien') return 'Million shares'
  if (einheit === 'x') return 'Multiple'
  return 'USD'
}

function balkenFarbe(wert: number, schaetzung: boolean, basis: string, basisEst: string): string {
  if (wert < 0) return schaetzung ? ROT_EST : LONG_ROT
  return schaetzung ? basisEst : basis
}

function grossFarbe(g: LongformJahresGross): string {
  if (g.farbig === 'hell') return LONG_TEXT
  if (g.farbig === 'vorzeichen') return g.wert < 0 ? LONG_ROT : LONG_GRUEN
  if (g.farbig === 'deckung') return g.wert >= 100 ? LONG_GRUEN : LONG_TEXT
  return g.wert < 0 ? LONG_ROT : LONG_TEXT
}

function spreadPfad(punkte: LongformJahrespunkt[], wacc: number, x: (jahr: number) => number, y: (wert: number) => number): string {
  const sortiert = [...punkte].sort((a, b) => a.jahr - b.jahr)
  if (sortiert.length < 2) return ''
  let d = `M${x(sortiert[0]!.jahr).toFixed(1)},${y(wacc).toFixed(1)}`
  for (const p of sortiert) d += `L${x(p.jahr).toFixed(1)},${y(p.wert).toFixed(1)}`
  d += `L${x(sortiert[sortiert.length - 1]!.jahr).toFixed(1)},${y(wacc).toFixed(1)}Z`
  return d
}

function pfad(punkte: LongformJahrespunkt[], x: (jahr: number) => number, y: (wert: number) => number): string {
  return punkte.map((p, i) => `${i ? 'L' : 'M'}${x(p.jahr).toFixed(1)},${y(p.wert).toFixed(1)}`).join('')
}

/** Schätzstück beginnt am letzten Ist-Punkt, damit die Linie nicht abreißt. */
function linienStuecke(punkte: LongformJahrespunkt[]): { schaetzung: boolean; punkte: LongformJahrespunkt[] }[] {
  const sortiert = [...punkte].sort((a, b) => a.jahr - b.jahr)
  const out: { schaetzung: boolean; punkte: LongformJahrespunkt[] }[] = []
  for (const p of sortiert) {
    const last = out[out.length - 1]
    if (!last || last.schaetzung !== p.schaetzung) {
      const bruecke = last?.punkte[last.punkte.length - 1]
      out.push({ schaetzung: p.schaetzung, punkte: bruecke ? [bruecke, p] : [p] })
    } else last.punkte.push(p)
  }
  return out
}

export function LongJahresChart(sp: SzeneProps) {
  const frame = useCurrentFrame()
  const i = aktiverSatz(sp, frame)
  const reihe = reiheVon(sp, i)
  const geo = useMemo(() => {
    if (!reihe || !reihe.linien.length) return null
    const jahre = jahreAus(reihe.linien)
    if (jahre.length < 2) return null
    const werte = reihe.linien.flatMap((l) => l.punkte.map((p) => p.wert))
    if (reihe.wacc != null) werte.push(reihe.wacc)
    if (reihe.schnitt) werte.push(reihe.schnitt.wert)
    const min = Math.min(0, ...werte)
    const maxRoh = Math.max(0, ...werte)
    const { ticks, oben } = achsenTicks(min, maxRoh)
    const n = jahre.length
    const band = (X1 - X0) / n
    const x = (jahr: number) => {
      const k = jahre.findIndex((j) => j.jahr === jahr)
      return X0 + band * k + band / 2
    }
    const y = (v: number) => Y1 - ((Y1 - Y0) * (v - min)) / (oben - min || 1)
    return { jahre, x, y, band, nullLinie: y(0), ticks }
  }, [reihe])

  if (!reihe || !geo) return null

  let startRel = 0
  for (const si of sp.block.saetze) {
    if (reiheVon(sp, si)?.id === reihe.id) {
      startRel = Math.max(0, (sp.t.saetze[si]?.from ?? sp.block.from) - sp.block.from)
      break
    }
  }
  const fort = ein(frame, startRel, 22)
  const zeichnen = ein(frame, startRel, 32)
  const einblend = ein(frame, Math.max(0, startRel - 8), 12)
  const istJahre = reihe.linien.flatMap((l) => l.punkte.filter((p) => !p.schaetzung).map((p) => p.jahr))
  const von = istJahre.length ? Math.min(...istJahre) : geo.jahre[0]!.jahr
  const bis = istJahre.length ? Math.max(...istJahre) : geo.jahre[geo.jahre.length - 1]!.jahr
  const hatSchaetzung = reihe.linien.some((l) => l.punkte.some((p) => p.schaetzung))
  const balkenBreite = Math.max(6, Math.min(reihe.art === 'doppel' ? 18 : 28, geo.band * (reihe.art === 'doppel' ? 0.32 : 0.52)))
  const jahrSchrift = geo.jahre.length > 24 ? 12 : geo.jahre.length > 16 ? 14 : 16

  return (
    <AbsoluteFill style={{ opacity: einblend }}>
      <div style={{ position: 'absolute', left: LONG_RAND_X, top: 88 }}>
        <div style={{ fontFamily: LONG_SERIF, fontSize: 68, color: LONG_TEXT }}>{reihe.label}</div>
        <div style={{ fontFamily: LONG_MONO, fontSize: 20, letterSpacing: 2, color: LONG_MUTED, marginTop: 8 }}>
          {von}–{bis}
          {hatSchaetzung ? ' · estimates marked' : ''}
        </div>
      </div>
      {reihe.gross ? (
        <div style={{ position: 'absolute', right: LONG_RAND_X, top: 88, textAlign: 'right', opacity: fort, maxWidth: 720 }}>
          <div style={{ fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: reihe.einheit === 'usd' ? 64 : 80, color: grossFarbe(reihe.gross), letterSpacing: -1, lineHeight: 1, whiteSpace: 'nowrap' }}>
            {zaehleText(reihe.einheit === 'usd' ? usd(reihe.gross.wert * 1_000_000) : reihe.gross.text, fort)}
          </div>
        </div>
      ) : (
        <Legende linien={reihe.linien} fort={fort} werte />
      )}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <clipPath id="lf-zahlen-clip">
            <rect x={0} y={0} width={X0 + (X1 - X0) * zeichnen} height={1080} />
          </clipPath>
        </defs>
        <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill="rgba(243, 241, 236, 0.025)" />
        <text x={X0} y={Y0 - 16} fill={ACHSE} fontFamily={LONG_MONO} fontSize={14} letterSpacing={1.5}>
          {einheitTitel(reihe.einheit)}
        </text>
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={X0} x2={X1} y1={geo.y(t)} y2={geo.y(t)} stroke={t === 0 ? 'rgba(243, 241, 236, 0.28)' : LONG_LINIE} strokeWidth={t === 0 ? 1.5 : 1} />
            <text x={X0 - 14} y={geo.y(t) + 5} textAnchor="end" fill={ACHSE} fontFamily={LONG_MONO} fontSize={15}>
              {achseText(t, reihe.einheit)}
            </text>
          </g>
        ))}
        {geo.jahre.map((j) => (
          <g key={j.jahr}>
            {j.schaetzung ? (
              <rect x={geo.x(j.jahr) - geo.band / 2} y={Y0} width={geo.band} height={Y1 - Y0} fill="rgba(232, 195, 106, 0.06)" />
            ) : null}
            <line x1={geo.x(j.jahr)} x2={geo.x(j.jahr)} y1={Y1} y2={Y1 + 7} stroke={j.schaetzung ? GOLD : 'rgba(243, 241, 236, 0.2)'} strokeWidth={1} />
            <text x={geo.x(j.jahr)} y={Y1 + 28} textAnchor="middle" fill={j.schaetzung ? GOLD : j.hatWert ? ACHSE : 'rgba(243, 241, 236, 0.35)'} fontFamily={LONG_MONO} fontSize={jahrSchrift}>
              {j.schaetzung ? `${j.jahr}e` : j.jahr}
            </text>
          </g>
        ))}
        {reihe.art === 'balken' || reihe.art === 'doppel'
          ? reihe.linien.map((linie, li) => (
              <g key={linie.id}>
              {linie.punkte.map((p) => {
                const farbe =
                  reihe.art === 'doppel' && li === 1
                    ? balkenFarbe(p.wert, p.schaetzung, CASH, CASH_EST)
                    : balkenFarbe(p.wert, p.schaetzung, GOLD, GOLD_EST)
                const h = Math.abs(geo.nullLinie - geo.y(p.wert)) * zeichnen
                const top = p.wert >= 0 ? geo.nullLinie - h : geo.nullLinie
                const versatz = reihe.art === 'doppel' ? (li === 0 ? -balkenBreite - 2 : 2) : -balkenBreite / 2
                return <rect key={`${linie.id}-${p.jahr}`} x={geo.x(p.jahr) + versatz} y={top} width={balkenBreite} height={Math.max(h, 0)} fill={farbe} rx={2} />
              })}
              </g>
            ))
          : null}
        {reihe.art === 'linien' || reihe.art === 'roic' ? (
          <g clipPath="url(#lf-zahlen-clip)">
            {reihe.art === 'roic' && reihe.wacc != null && reihe.linien[0] ? (
              <path d={spreadPfad(reihe.linien[0].punkte, reihe.wacc, geo.x, geo.y)} fill="rgba(232, 195, 106, 0.16)" />
            ) : null}
            {reihe.linien.map((linie, li) => {
              const farbe = LINIEN_FARBEN[li % LINIEN_FARBEN.length]!
              return (
                <g key={linie.id}>
                  {linienStuecke(linie.punkte).map((st, si) =>
                    st.punkte.length < 2 ? null : (
                      <path
                        key={`${linie.id}-${si}`}
                        d={pfad(st.punkte, geo.x, geo.y)}
                        fill="none"
                        stroke={farbe}
                        strokeWidth={3}
                        strokeLinejoin="round"
                        strokeDasharray={st.schaetzung ? '7 6' : undefined}
                        opacity={st.schaetzung ? 0.75 : 1}
                      />
                    ),
                  )}
                  {linie.punkte.map((p) => (
                    <circle
                      key={`${linie.id}-punkt-${p.jahr}`}
                      cx={geo.x(p.jahr)}
                      cy={geo.y(p.wert)}
                      r={4.5}
                      fill={p.schaetzung ? '#0C0C0E' : farbe}
                      stroke={farbe}
                      strokeWidth={2}
                    />
                  ))}
                </g>
              )
            })}
          </g>
        ) : null}
        {reihe.art === 'roic' && reihe.wacc != null ? (
          <g>
            <line x1={X0} x2={X1} y1={geo.y(reihe.wacc)} y2={geo.y(reihe.wacc)} stroke={BLAU} strokeWidth={2} strokeDasharray="10 7" />
            <text x={X1 - 8} y={geo.y(reihe.wacc) - 12} textAnchor="end" fill={BLAU} fontFamily={LONG_MONO} fontSize={16}>
              WACC
            </text>
          </g>
        ) : null}
        {reihe.schnitt ? (
          <g>
            <line x1={X0} x2={X1} y1={geo.y(reihe.schnitt.wert)} y2={geo.y(reihe.schnitt.wert)} stroke={ACHSE} strokeWidth={2} strokeDasharray="8 6" />
            <text
              x={X0 + 10}
              y={geo.y(reihe.schnitt.wert) < Y0 + 36 ? geo.y(reihe.schnitt.wert) + 22 : geo.y(reihe.schnitt.wert) - 12}
              fill={ACHSE}
              fontFamily={LONG_MONO}
              fontSize={16}
            >
              {reihe.schnitt.nurPositiv
                ? `${reihe.schnitt.jahre} positive years of ${reihe.schnitt.fenster}`
                : `${reihe.schnitt.jahre}-year average`}
            </text>
          </g>
        ) : null}
      </svg>
      {reihe.gross && reihe.linien.length > 1 ? (
        <Legende linien={reihe.linien} fort={1} unten farben={reihe.id === 'schulden' ? [GOLD, CASH] : undefined} />
      ) : null}
      <div style={{ position: 'absolute', left: LONG_RAND_X, bottom: 36, fontFamily: LONG_MONO, fontSize: 16, color: mitAlpha(LONG_TEXT, 0.45) }}>
        {reihe.quelle}
      </div>
    </AbsoluteFill>
  )
}

function Legende({
  linien,
  fort,
  unten = false,
  werte = false,
  farben,
}: {
  linien: LongformJahreslinie[]
  fort: number
  unten?: boolean
  werte?: boolean
  farben?: string[]
}) {
  return (
    <div
      style={{
        position: 'absolute',
        right: LONG_RAND_X,
        left: undefined,
        top: unten ? undefined : 108,
        bottom: unten ? 72 : undefined,
        display: 'flex',
        gap: 22,
        opacity: fort,
      }}
    >
      {linien.map((l, i) => {
        const fertig = l.punkte.filter((p) => !p.schaetzung)
        const letzte = fertig[fertig.length - 1]
        const zahl = werte && letzte ? pct(letzte.wert) : null
        const farbe = (farben ?? LINIEN_FARBEN)[i % (farben ?? LINIEN_FARBEN).length]
        return (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: LONG_MONO, fontSize: 16, color: LONG_MUTED }}>
            <span style={{ width: 18, height: 4, background: farbe, display: 'inline-block' }} />
            {l.label}
            {zahl ? <span style={{ color: letzte && letzte.wert < 0 ? LONG_ROT : LONG_GRUEN }}>{zahl}</span> : null}
          </div>
        )
      })}
    </div>
  )
}
