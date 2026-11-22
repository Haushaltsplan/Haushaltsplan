/** Burggraben: Geschäft, Pfeiler (Karten oder Balken), Scorecard-Spalte, Umsatzmix. Nur Zahlen und Labels, kein KI-Fließtext. */
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion'
import { moatTextEnglisch, pct } from '../../lib/youtube/longform/longform-format'
import { Blende, Logo, aktiverSatz, ein, satzLaeufe, zaehleText, type SatzLauf, type SzeneProps } from './long-bausteine'
import {
  LONG_DISPLAY,
  LONG_GRUEN,
  LONG_LINIE,
  LONG_MONO,
  LONG_MUTED,
  LONG_PANEL,
  LONG_RAND_X,
  LONG_ROT,
  LONG_SANS,
  LONG_SERIF,
  LONG_SERIF_KURSIV,
  LONG_TEXT,
  mitAlpha,
} from './long-look'

function farbeFuerScore(score: number, akzent: string): string {
  if (score >= 7) return LONG_GRUEN
  if (score <= 4) return LONG_ROT
  return akzent
}

function Ueberschrift({ titel, unter, frame }: { titel: string; unter?: string | null; frame: number }) {
  return (
    <div style={{ position: 'absolute', left: LONG_RAND_X, top: 92 }}>
      <div style={{ fontFamily: LONG_SERIF, fontSize: 76, color: LONG_TEXT, opacity: ein(frame, 0, 16) }}>{titel}</div>
      {unter ? <div style={{ fontFamily: LONG_MONO, fontSize: 24, letterSpacing: 1, color: LONG_MUTED, marginTop: 10, opacity: ein(frame, 6, 16) }}>{unter}</div> : null}
    </div>
  )
}

function Geschaeft({ sp }: { sp: SzeneProps }) {
  const frame = useCurrentFrame()
  const { p } = sp
  const seg = p.segmente?.eintraege.slice(0, 4) ?? []
  const roh = moatTextEnglisch(p.moat?.geschaeftsmodell)
  const business = roh && roh.length > 140 ? `${roh.slice(0, 137).trim()}…` : roh
  return (
    <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: LONG_RAND_X, paddingRight: LONG_RAND_X }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 44, opacity: ein(frame, 0, 18), transform: `translateY(${(1 - ein(frame, 0, 18)) * 20}px)` }}>
        <Logo url={p.logoUrl} groesse={168} ticker={p.ticker} />
        <div style={{ maxWidth: 1280 }}>
          <div style={{ fontFamily: LONG_SERIF, fontSize: 96, color: LONG_TEXT, lineHeight: 1 }}>{p.firmenname}</div>
          {p.branche ? (
            <div style={{ fontFamily: LONG_MONO, fontSize: 24, letterSpacing: 2, color: LONG_MUTED, marginTop: 14 }}>
              {p.branche.toUpperCase()}
            </div>
          ) : null}
          {business ? (
            <div
              style={{
                fontFamily: LONG_SERIF_KURSIV,
                fontSize: 36,
                color: LONG_TEXT,
                marginTop: 28,
                lineHeight: 1.35,
                maxWidth: 1100,
                opacity: ein(frame, 14, 16),
              }}
            >
              {business}
            </div>
          ) : null}
        </div>
      </div>
      {seg.length ? (
        <div style={{ display: 'flex', gap: 28, marginTop: business ? 64 : 90 }}>
          {seg.map((s, k) => (
            <div key={s.name} style={{ flex: 1, borderTop: `3px solid ${k === 0 ? p.varianten.akzent : LONG_LINIE}`, paddingTop: 22, opacity: ein(frame, 24 + k * 8, 14) }}>
              <div style={{ fontFamily: LONG_DISPLAY, fontWeight: 800, fontSize: 64, color: LONG_TEXT }}>{pct(s.anteilPct)}</div>
              <div style={{ fontFamily: LONG_SANS, fontWeight: 600, fontSize: 28, color: LONG_MUTED, marginTop: 6 }}>{s.name}</div>
            </div>
          ))}
        </div>
      ) : null}
    </AbsoluteFill>
  )
}

function Pfeiler({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const frame = useCurrentFrame()
  const m = sp.p.moat
  if (!m) return null
  const akzent = sp.p.varianten.akzent
  const fokus = sp.p.saetze[aktiverSatz(sp, frame + lauf.from)]!.visual.fokus ?? null
  const nur = fokus != null ? m.pfeiler.find((x) => x.id === fokus) : null
  if (nur) {
    const farbe = farbeFuerScore(nur.score, akzent)
    const f = ein(frame, 8, 18)
    return (
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: LONG_RAND_X, paddingRight: LONG_RAND_X }}>
        <div style={{ fontFamily: LONG_MONO, fontSize: 22, letterSpacing: 4, color: LONG_MUTED, opacity: ein(frame, 0, 12) }}>THE MOAT</div>
        <div style={{ fontFamily: LONG_SERIF, fontSize: 92, color: LONG_TEXT, marginTop: 12, opacity: ein(frame, 4, 14) }}>{nur.label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 28 }}>
          <span style={{ fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 180, color: LONG_TEXT, lineHeight: 0.9 }}>{nur.score}</span>
          <span style={{ fontFamily: LONG_MONO, fontSize: 36, color: LONG_MUTED }}>/ 10</span>
        </div>
        <div style={{ marginTop: 36, height: 10, width: 720, borderRadius: 5, background: 'rgba(243,241,236,0.08)' }}>
          <div style={{ width: `${nur.score * 10 * f}%`, height: '100%', borderRadius: 5, background: farbe }} />
        </div>
        {(() => {
          const roh = moatTextEnglisch(nur.begruendung)
          const zeile = roh && roh.length > 120 ? `${roh.slice(0, 117).trim()}…` : roh
          return zeile ? (
            <div style={{ marginTop: 32, maxWidth: 980, fontFamily: LONG_SERIF_KURSIV, fontSize: 32, lineHeight: 1.35, color: LONG_MUTED }}>{zeile}</div>
          ) : null
        })()}
      </AbsoluteFill>
    )
  }
  const hatFokus = fokus != null && m.pfeiler.some((x) => x.id === fokus)

  if (sp.p.varianten.moatLayout === 'balken') {
    return (
      <AbsoluteFill>
        <Ueberschrift titel="The moat, pillar by pillar" unter={`OVERALL ${m.score} / 10 · ${m.urteil.toUpperCase()}`} frame={frame} />
        <div style={{ position: 'absolute', left: LONG_RAND_X, right: LONG_RAND_X, top: 300, display: 'flex', flexDirection: 'column', gap: 34 }}>
          {m.pfeiler.map((x, k) => {
            const f = ein(frame, 14 + k * 9, 22)
            const dim = hatFokus && x.id !== fokus ? 0.35 : 1
            return (
              <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 36, opacity: ein(frame, 10 + k * 9, 12) * dim }}>
                <div style={{ width: 420, fontFamily: LONG_SANS, fontWeight: 700, fontSize: 34, color: LONG_TEXT }}>{x.label}</div>
                <div style={{ flex: 1, height: 22, borderRadius: 11, background: 'rgba(243,241,236,0.07)', overflow: 'hidden' }}>
                  <div style={{ width: `${(x.score / 10) * 100 * f}%`, height: '100%', borderRadius: 11, background: farbeFuerScore(x.score, akzent) }} />
                </div>
                <div style={{ width: 110, textAlign: 'right', fontFamily: LONG_DISPLAY, fontWeight: 800, fontSize: 46, color: LONG_TEXT }}>{x.score}</div>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
    )
  }

  const spalten = m.pfeiler.length > 4 ? 3 : 2
  return (
    <AbsoluteFill>
      <Ueberschrift titel="Where the moat comes from" unter={`OVERALL ${m.score} / 10 · ${m.urteil.toUpperCase()}`} frame={frame} />
      <div
        style={{
          position: 'absolute',
          left: LONG_RAND_X,
          right: LONG_RAND_X,
          top: 290,
          display: 'grid',
          gridTemplateColumns: `repeat(${spalten}, 1fr)`,
          gap: 28,
        }}
      >
        {m.pfeiler.map((x, k) => {
          const o = ein(frame, 12 + k * 7, 14)
          const aktiv = hatFokus && x.id === fokus
          const dim = hatFokus && !aktiv ? 0.38 : 1
          const farbe = farbeFuerScore(x.score, akzent)
          return (
            <div
              key={x.id}
              style={{
                background: LONG_PANEL,
                borderRadius: 18,
                padding: '28px 32px',
                border: `2px solid ${aktiv ? farbe : LONG_LINIE}`,
                opacity: o * dim,
                transform: `translateY(${(1 - o) * 18}px)`,
                boxShadow: aktiv ? `0 0 0 1px ${farbe}, 0 18px 40px rgba(0,0,0,0.35)` : 'none',
              }}
            >
              <div style={{ fontFamily: LONG_SANS, fontWeight: 700, fontSize: 30, color: LONG_MUTED }}>{x.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 14 }}>
                <span style={{ fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 92, color: LONG_TEXT, lineHeight: 1 }}>{x.score}</span>
                <span style={{ fontFamily: LONG_MONO, fontSize: 28, color: LONG_MUTED }}>/ 10</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(243,241,236,0.07)', marginTop: 20 }}>
                <div style={{ width: `${x.score * 10 * ein(frame, 20 + k * 7, 20)}%`, height: '100%', borderRadius: 4, background: farbe }} />
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

/** Aufbau wie die Scorecard der App: Kopf mit Note, darunter Balken mit Marker und Wert. */
function Scorecard({ sp }: { sp: SzeneProps }) {
  const frame = useCurrentFrame()
  const sc = sp.p.burggraben
  if (!sc) return null
  const akzent = sp.p.varianten.akzent
  const balken = sc.balken.filter((b) => b.position != null || b.wertText !== '–').slice(0, 8)
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 980, background: LONG_PANEL, borderRadius: 28, padding: '44px 56px', border: `1px solid ${LONG_LINIE}`, opacity: ein(frame, 0, 16), transform: `scale(${0.96 + 0.04 * ein(frame, 0, 18)})` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 34 }}>
          <div>
            <div style={{ fontFamily: LONG_SERIF, fontSize: 64, color: LONG_TEXT }}>{sc.titel}</div>
            <div style={{ fontFamily: LONG_MONO, fontSize: 22, color: LONG_MUTED, letterSpacing: 1 }}>QUALITY SCORE 1–10</div>
          </div>
          {sc.score != null ? (
            <div
              style={{
                width: 132,
                height: 132,
                borderRadius: 66,
                border: `5px solid ${farbeFuerScore(sc.score, akzent)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: LONG_DISPLAY,
                fontWeight: 900,
                fontSize: 64,
                color: LONG_TEXT,
                opacity: ein(frame, 10 + balken.length * 6, 12),
              }}
            >
              {sc.score}
            </div>
          ) : null}
        </div>
        {balken.map((b, k) => {
          const f = ein(frame, 8 + k * 6, 18)
          return (
            <div key={b.label} style={{ marginBottom: 24, opacity: ein(frame, 6 + k * 6, 10) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LONG_SANS, fontWeight: 600, fontSize: 26, color: LONG_TEXT, marginBottom: 10 }}>
                <span>{b.label}</span>
                <span style={{ fontFamily: LONG_MONO, color: LONG_MUTED }}>{b.wertText}</span>
              </div>
              <div style={{ position: 'relative', height: 10, borderRadius: 5, background: `linear-gradient(to right, ${mitAlpha(LONG_ROT, 0.5)}, ${mitAlpha(akzent, 0.5)}, ${mitAlpha(LONG_GRUEN, 0.5)})` }}>
                {b.position != null ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: `calc(${b.position * 100 * f}% - 9px)`,
                      top: -6,
                      width: 18,
                      height: 22,
                      borderRadius: 5,
                      background: LONG_TEXT,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    }}
                  />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function segmentIndex(sp: SzeneProps, satzIndex: number, namen: string[]): number | null {
  const s = sp.p.saetze[satzIndex]!
  for (const id of s.faktIds) {
    const m = /^seg\.(\d+)/.exec(id)
    if (m) return Number(m[1])
  }
  const fokus = s.visual.fokus?.trim().toLowerCase()
  if (!fokus) return null
  const alsId = /^seg\.(\d+)/.exec(fokus)
  if (alsId) return Number(alsId[1])
  if (/^\d+$/.test(fokus)) return Number(fokus)
  const name = namen.findIndex((n) => n.toLowerCase() === fokus)
  return name >= 0 ? name : null
}

function Segmente({ sp }: { sp: SzeneProps }) {
  const frame = useCurrentFrame()
  const seg = sp.p.segmente
  if (!seg) return null
  const akzent = sp.p.varianten.akzent
  const stufen = [1, 0.7, 0.5, 0.36, 0.26, 0.18, 0.12]
  const i = aktiverSatz(sp, frame)
  const idx = segmentIndex(sp, i, seg.eintraege.map((e) => e.name))
  const aktiv = idx != null ? seg.eintraege[idx] : null
  const z = sp.t.saetze[i]!
  const beton = (z.betonungFrame ?? z.from + 8) - sp.block.from
  const fokusId = sp.p.saetze[i]!.visual.fokus ?? ''
  const gesprochen = sp.p.saetze[i]!.faktIds.find((id) => id.startsWith('seg.')) ?? (fokusId.startsWith('seg.') ? fokusId : '')
  const modus: 'share' | 'marge' | 'wachstum' | null = gesprochen.endsWith('.marge')
    ? 'marge'
    : gesprochen.endsWith('.wachstum')
      ? 'wachstum'
      : aktiv
        ? 'share'
        : null
  const fort = frame >= beton ? ein(frame, beton, 16) : 0
  return (
    <AbsoluteFill>
      <Ueberschrift
        titel={seg.art === 'geo' ? 'Where the revenue comes from' : 'What they actually sell'}
        unter={`REVENUE MIX${seg.jahr ? ` · FISCAL ${seg.jahr}` : ''}`}
        frame={frame}
      />
      <div style={{ position: 'absolute', left: LONG_RAND_X, right: aktiv ? 760 : LONG_RAND_X, top: 300, height: 72, borderRadius: 16, overflow: 'hidden', display: 'flex', background: 'rgba(243,241,236,0.05)' }}>
        {seg.eintraege.map((s, k) => {
          const w = s.anteilPct * ein(frame, 8, 20)
          const hell = !aktiv || k === idx
          return (
            <div
              key={s.name}
              style={{
                width: `${w}%`,
                height: '100%',
                background: mitAlpha(akzent, (stufen[k] ?? 0.1) * (hell ? 1 : 0.35)),
                borderRight: '2px solid #0C0C0E',
              }}
            />
          )
        })}
      </div>
      <div style={{ position: 'absolute', left: LONG_RAND_X, right: aktiv ? 780 : LONG_RAND_X, top: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {seg.eintraege.map((s, k) => {
          const an = aktiv != null && k === idx
          return (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: aktiv && !an ? 0.35 : ein(frame, 12 + k * 4, 10) }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: mitAlpha(akzent, stufen[k] ?? 0.1), boxShadow: an ? `0 0 0 2px ${akzent}` : undefined }} />
              <div style={{ flex: 1, fontFamily: LONG_SANS, fontWeight: 600, fontSize: an ? 32 : 24, color: LONG_TEXT }}>{s.name}</div>
              <div style={{ fontFamily: LONG_MONO, fontSize: an ? 28 : 22, color: LONG_TEXT }}>{pct(s.anteilPct)}</div>
            </div>
          )
        })}
      </div>
      {aktiv && modus ? (
        <div
          style={{
            position: 'absolute',
            right: LONG_RAND_X,
            top: 280,
            width: 560,
            padding: '32px 36px',
            borderRadius: 24,
            background: 'rgba(20,20,23,0.92)',
            border: `1px solid ${mitAlpha(akzent, 0.35)}`,
            opacity: ein(frame, Math.max(0, beton - 4), 12),
          }}
        >
          <div style={{ fontFamily: LONG_MONO, fontSize: 18, letterSpacing: 3, color: LONG_MUTED }}>{aktiv.name.toUpperCase()}</div>
          <SegmentZeile label="Share" text={pct(aktiv.anteilPct)} breite={aktiv.anteilPct} laut={modus === 'share'} fort={fort} akzent={akzent} />
          {aktiv.margePct != null ? (
            <SegmentZeile
              label="Operating margin"
              text={pct(aktiv.margePct)}
              breite={Math.min(100, (aktiv.margePct / Math.max(40, aktiv.margePct)) * 100)}
              laut={modus === 'marge'}
              fort={fort}
              akzent={aktiv.margePct >= 15 ? LONG_GRUEN : akzent}
            />
          ) : null}
          {aktiv.wachstumPct != null ? (
            <div style={{ marginTop: 22, opacity: modus === 'wachstum' ? 1 : 0.55 }}>
              <div style={{ fontFamily: LONG_MONO, fontSize: 16, letterSpacing: 2, color: LONG_MUTED }}>REVENUE VS LAST YEAR</div>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: LONG_DISPLAY,
                  fontWeight: 800,
                  fontSize: modus === 'wachstum' ? 64 : 28,
                  color: aktiv.wachstumPct >= 0 ? LONG_GRUEN : LONG_ROT,
                }}
              >
                {aktiv.wachstumPct >= 0 ? '▲ ' : '▼ '}
                {modus === 'wachstum' ? zaehleText(pct(aktiv.wachstumPct, { vorzeichen: true }), fort) : pct(aktiv.wachstumPct, { vorzeichen: true })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </AbsoluteFill>
  )
}

function SegmentZeile({
  label,
  text,
  breite,
  laut,
  fort,
  akzent,
}: {
  label: string
  text: string
  breite: number
  laut: boolean
  fort: number
  akzent: string
}) {
  return (
    <div style={{ marginTop: 18, opacity: laut ? 1 : 0.55 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: LONG_MONO, fontSize: 16, letterSpacing: 2, color: LONG_MUTED }}>
        <span>{label.toUpperCase()}</span>
        <span style={{ fontFamily: LONG_DISPLAY, fontWeight: 800, fontSize: laut ? 64 : 28, color: LONG_TEXT, letterSpacing: 0 }}>
          {laut ? zaehleText(text, fort) : text}
        </span>
      </div>
      <div style={{ marginTop: 8, height: laut ? 12 : 6, borderRadius: 6, background: 'rgba(243,241,236,0.08)' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, breite)) * (laut ? fort : 1)}%`, height: '100%', borderRadius: 6, background: akzent }} />
      </div>
    </div>
  )
}

export function LongMoat(sp: SzeneProps) {
  const laeufe = satzLaeufe(sp)
  return (
    <AbsoluteFill>
      {laeufe.map((l, k) => (
        <Blende key={k} von={l.from} bis={l.bis + (k < laeufe.length - 1 ? 3 : 0)}>
          <Sequence from={l.from} layout="none" durationInFrames={Math.max(1, l.bis - l.from + 4)}>
            {l.szene === 'moat_pfeiler' ? (
              <Pfeiler sp={sp} lauf={l} />
            ) : l.szene === 'moat_scorecard' ? (
              <Scorecard sp={sp} />
            ) : l.szene === 'moat_segmente' ? (
              <Segmente sp={sp} />
            ) : (
              <Geschaeft sp={sp} />
            )}
          </Sequence>
        </Blende>
      ))}
    </AbsoluteFill>
  )
}
