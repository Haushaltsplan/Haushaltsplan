/** Jahreschart des Zahlen-Kapitels. Balken, Linien oder zwei Reihen, Schätzjahre blasser. */
import { useMemo } from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { pct } from '../../lib/youtube/longform/longform-format'
import type { LongformJahresGross, LongformJahreslinie, LongformJahrespunkt, LongformJahresreihe } from '../../lib/youtube/longform/longform-types'
import { aktiverSatz, ein, zaehleText, type SzeneProps } from './long-bausteine'
import { LONG_DISPLAY, LONG_GRUEN, LONG_LINIE, LONG_MONO, LONG_MUTED, LONG_RAND_X, LONG_ROT, LONG_SERIF, LONG_TEXT, mitAlpha } from './long-look'

const X0 = 150
const X1 = 1780
const Y0 = 310
const Y1 = 820

const GOLD = '#E8C36A'
const GOLD_EST = 'rgba(232, 195, 106, 0.4)'
const CASH = '#7DDCB0'
const CASH_EST = 'rgba(125, 220, 176, 0.4)'
const BLAU = '#8EB6F2'
const LILA = '#D7B4F5'
const ROT_EST = 'rgba(239, 106, 90, 0.42)'
const LINIEN_FARBEN = [GOLD, BLAU, LILA]

const FOKUS = ['umsatz', 'gewinn', 'fcf', 'marge', 'roic', 'capex', 'schulden', 'aktien']

type AltReihe = LongformJahresreihe & { punkte?: { jahr: number; wert: number }[] }

function reiheVon(sp: SzeneProps, index: number): LongformJahresreihe | null {
  const satz = sp.p.saetze[index]
  if (!satz) return null
  const roh = (satz.visual.fokus ?? satz.faktIds.find((id) => id.startsWith('reihe.')) ?? '').replace(/^reihe\./, '')
  const id = FOKUS.find((f) => roh === f || roh.startsWith(`${f}.`))
  if (!id) return null
  const treffer = sp.p.reihen.find((r) => r.id === id) as AltReihe | undefined
  if (!treffer) return null
  if (treffer.linien?.length && treffer.art) return treffer
  const alt = treffer.punkte ?? []
  return {
    ...treffer,
    art: treffer.art ?? 'balken',
    linien: [{ id: treffer.id, label: treffer.label, punkte: alt.map((p) => ({ ...p, schaetzung: false })) }],
    wacc: treffer.wacc ?? null,
    quelle: treffer.quelle ?? 'Company filings',
    gross: treffer.gross ?? null,
  }
}

function jahreAus(linien: LongformJahreslinie[]): { jahr: number; schaetzung: boolean }[] {
  const map = new Map<number, boolean>()
  for (const l of linien) {
    for (const p of l.punkte) {
      const alt = map.get(p.jahr)
      map.set(p.jahr, alt == null ? p.schaetzung : alt && p.schaetzung)
    }
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([jahr, schaetzung]) => ({ jahr, schaetzung }))
}

function zeigeJahr(jahre: { schaetzung: boolean }[], index: number): boolean {
  if (jahre.length <= 14) return true
  const p = jahre[index]
  if (!p) return false
  return p.schaetzung || index === 0 || index === jahre.length - 1 || index % 2 === 0
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
    const min = Math.min(0, ...werte)
    const max = Math.max(0, ...werte)
    const span = (max - min) * 1.12 || 1
    const oben = max + (span - (max - min))
    const n = jahre.length
    const inset = 36
    const x = (jahr: number) => {
      const k = jahre.findIndex((j) => j.jahr === jahr)
      return X0 + inset + ((X1 - X0 - inset * 2) * k) / (n - 1)
    }
    const y = (v: number) => Y1 - ((Y1 - Y0) * (v - min)) / (oben - min || 1)
    return { jahre, x, y, nullLinie: y(0) }
  }, [reihe])

  if (!reihe || !geo) return null

  const z = sp.t.saetze[i]
  const start = z ? z.from - sp.block.from : 0
  const fort = ein(frame, start, 14)
  const zeichnen = ein(frame, 8, 32)
  const istJahre = reihe.linien.flatMap((l) => l.punkte.filter((p) => !p.schaetzung).map((p) => p.jahr))
  const von = istJahre.length ? Math.min(...istJahre) : geo.jahre[0]!.jahr
  const bis = istJahre.length ? Math.max(...istJahre) : geo.jahre[geo.jahre.length - 1]!.jahr
  const hatSchaetzung = reihe.linien.some((l) => l.punkte.some((p) => p.schaetzung))
  const slot = geo.jahre.length > 1 ? (X1 - X0) / (geo.jahre.length - 1) : 80
  const balkenBreite = Math.max(8, Math.min(reihe.art === 'doppel' ? 22 : 36, slot * (reihe.art === 'doppel' ? 0.34 : 0.62)))

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: LONG_RAND_X, top: 88 }}>
        <div style={{ fontFamily: LONG_SERIF, fontSize: 68, color: LONG_TEXT }}>{reihe.label}</div>
        <div style={{ fontFamily: LONG_MONO, fontSize: 20, letterSpacing: 2, color: LONG_MUTED, marginTop: 8 }}>
          {von}–{bis}
          {hatSchaetzung ? ' · estimates marked' : ''}
        </div>
      </div>
      {reihe.gross ? (
        <div style={{ position: 'absolute', right: LONG_RAND_X, top: 88, textAlign: 'right', opacity: fort }}>
          <div style={{ fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 80, color: grossFarbe(reihe.gross), letterSpacing: -2 }}>
            {zaehleText(reihe.gross.text, fort || 0.01)}
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
        <line x1={X0} x2={X1} y1={geo.nullLinie} y2={geo.nullLinie} stroke={LONG_LINIE} strokeWidth={1.5} />
        {geo.jahre.map((j, k) =>
          zeigeJahr(geo.jahre, k) ? (
            <g key={j.jahr}>
              <text x={geo.x(j.jahr)} y={Y1 + 36} textAnchor="middle" fill={j.schaetzung ? GOLD : LONG_MUTED} fontFamily={LONG_MONO} fontSize={geo.jahre.length > 18 ? 15 : 18}>
                {j.jahr}
              </text>
              {j.schaetzung ? (
                <text x={geo.x(j.jahr)} y={Y1 + 56} textAnchor="middle" fill={GOLD_EST} fontFamily={LONG_MONO} fontSize={12}>
                  estimate
                </text>
              ) : null}
            </g>
          ) : null,
        )}
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
                    st.punkte.length < 2 ? (
                      <circle key={`${linie.id}-${si}`} cx={geo.x(st.punkte[0]!.jahr)} cy={geo.y(st.punkte[0]!.wert)} r={5} fill={farbe} opacity={st.schaetzung ? 0.55 : 1} />
                    ) : (
                      <path
                        key={`${linie.id}-${si}`}
                        d={pfad(st.punkte, geo.x, geo.y)}
                        fill="none"
                        stroke={farbe}
                        strokeWidth={3}
                        strokeLinejoin="round"
                        strokeDasharray={st.schaetzung ? '7 6' : undefined}
                        opacity={st.schaetzung ? 0.7 : 1}
                      />
                    ),
                  )}
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
