/** Schluss: Like-Satz, großer Disclaimer, Cheers. Alles gesprochen, nichts über einem Foto. */
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion'
import { Blende, ein, satzLaeufe, type SatzLauf, type SzeneProps } from './long-bausteine'
import { LONG_DISPLAY, LONG_MONO, LONG_MUTED, LONG_SERIF, LONG_TEXT } from './long-look'

function Karte({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const frame = useCurrentFrame()
  const s = sp.p.saetze[lauf.saetze[0]!]!
  const o = ein(frame, 4, 14)
  if (s.visual.szene === 'disclaimer') {
    return (
      <AbsoluteFill style={{ background: '#0C0C0E', justifyContent: 'center', paddingLeft: 140, paddingRight: 140 }}>
        <div style={{ fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: 108, letterSpacing: 8, color: LONG_TEXT, opacity: o }}>DISCLAIMER</div>
        <div style={{ marginTop: 28, maxWidth: 1500, fontFamily: LONG_SERIF, fontSize: 52, lineHeight: 1.25, color: LONG_TEXT, opacity: ein(frame, 10, 16) }}>{s.text}</div>
      </AbsoluteFill>
    )
  }
  if (s.visual.szene === 'schluss') {
    return (
      <AbsoluteFill style={{ background: '#0C0C0E', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontFamily: LONG_SERIF, fontSize: 140, color: LONG_TEXT, opacity: o }}>Cheers</div>
        <div style={{ marginTop: 28, fontFamily: LONG_MONO, fontSize: 28, letterSpacing: 4, color: LONG_MUTED, opacity: ein(frame, 12, 14) }}>
          {(sp.p.kanalName ?? 'DailyMoat').toUpperCase()}
        </div>
      </AbsoluteFill>
    )
  }
  return (
    <AbsoluteFill style={{ background: '#0C0C0E', justifyContent: 'center', alignItems: 'center', paddingLeft: 160, paddingRight: 160 }}>
      <div style={{ maxWidth: 1400, textAlign: 'center', fontFamily: LONG_SERIF, fontSize: 72, lineHeight: 1.2, color: LONG_TEXT, opacity: o }}>{s.text}</div>
    </AbsoluteFill>
  )
}

export function LongEnde(sp: SzeneProps) {
  const laeufe = satzLaeufe(sp)
  return (
    <AbsoluteFill>
      {laeufe.map((l, k) => (
        <Blende key={k} von={l.from} bis={l.bis + (k < laeufe.length - 1 ? 3 : 0)}>
          <Sequence from={l.from} layout="none" durationInFrames={Math.max(1, l.bis - l.from + 4)}>
            <Karte sp={sp} lauf={l} />
          </Sequence>
        </Blende>
      ))}
    </AbsoluteFill>
  )
}
