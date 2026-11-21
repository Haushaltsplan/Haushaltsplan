/** Foto/Clip mit Ken-Burns-Fahrt, Zwischentitel und Titelkarte. */
import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame } from 'remotion'
import { Logo, ein, oeffentlichSrc, type SzeneProps } from './long-bausteine'
import { LONG_MONO, LONG_MUTED, LONG_RAND_X, LONG_RAND_Y, LONG_SERIF, LONG_TEXT } from './long-look'

const FAHRTEN = [
  { von: [1.14, -2, -1], nach: [1.02, 2, 1] },
  { von: [1.02, 2, 0], nach: [1.14, -2, 1] },
  { von: [1.1, 0, 2], nach: [1.02, 0, -2] },
  { von: [1.04, -2, 2], nach: [1.14, 2, -1] },
] as const

export function LongBild(sp: SzeneProps) {
  const frame = useCurrentFrame()
  const s = sp.p.saetze[sp.block.saetze[0]!]!
  if (!s.bildUrl) {
    return (
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 36 }}>
        <div style={{ opacity: ein(frame, 0, 18) }}>
          <Logo url={sp.p.logoUrl} groesse={200} ticker={sp.p.ticker} />
        </div>
        <div style={{ fontFamily: LONG_SERIF, fontSize: 84, color: LONG_TEXT, opacity: ein(frame, 8, 18) }}>{sp.p.firmenname}</div>
      </AbsoluteFill>
    )
  }
  const fahrt = FAHRTEN[(sp.p.varianten.kameraSeed + sp.block.saetze[0]!) % FAHRTEN.length]!
  const k = Math.min(1, frame / Math.max(1, sp.block.dauer))
  const zoom = interpolate(k, [0, 1], [fahrt.von[0], fahrt.nach[0]])
  const x = interpolate(k, [0, 1], [fahrt.von[1], fahrt.nach[1]])
  const y = interpolate(k, [0, 1], [fahrt.von[2], fahrt.nach[2]])
  const src = oeffentlichSrc(s.bildUrl)
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${zoom}) translate(${x}%, ${y}%)` }}>
        {s.bildArt === 'video' ? (
          <OffthreadVideo src={src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(to top, rgba(12,12,14,0.6) 0%, rgba(12,12,14,0) 35%), radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.45) 100%)' }} />
      {s.bildCredit ? (
        <div style={{ position: 'absolute', right: 36, bottom: 26, fontFamily: LONG_MONO, fontSize: 15, color: 'rgba(243,241,236,0.55)', maxWidth: 900, textAlign: 'right' }}>
          {s.bildCredit}
        </div>
      ) : null}
    </AbsoluteFill>
  )
}

export function LongTitelKarte(sp: SzeneProps) {
  const frame = useCurrentFrame()
  const s = sp.p.saetze[sp.block.saetze[0]!]!
  const titel = sp.p.abschnittTitel[s.abschnittId] ?? ''
  return (
    <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: LONG_RAND_X }}>
      <div style={{ fontFamily: LONG_SERIF, fontSize: 130, color: LONG_TEXT, opacity: ein(frame, 0, 18) }}>{titel}</div>
    </AbsoluteFill>
  )
}

/** Zwischentitel vor jedem Abschnitt: Nummer, Titel, eine Linie, die sich zieht. */
export function LongBumper({ nummer, titel, akzent }: { nummer: number; titel: string; akzent: string }) {
  const frame = useCurrentFrame()
  const raus = interpolate(frame, [40, 54], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: '#0C0C0E', opacity: Math.min(ein(frame, 0, 8), 1) }}>
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: LONG_RAND_X, opacity: raus }}>
        <div style={{ fontFamily: LONG_MONO, fontSize: 30, letterSpacing: 6, color: akzent, opacity: ein(frame, 2, 10) }}>
          {String(nummer).padStart(2, '0')}
        </div>
        <div
          style={{
            fontFamily: LONG_SERIF,
            fontSize: 150,
            color: LONG_TEXT,
            lineHeight: 1.05,
            marginTop: 10,
            opacity: ein(frame, 5, 14),
            transform: `translateX(${(1 - ein(frame, 5, 18)) * -40}px)`,
          }}
        >
          {titel}
        </div>
        <div style={{ marginTop: 34, height: 3, width: 520 * ein(frame, 10, 24), background: akzent }} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', right: LONG_RAND_X, bottom: LONG_RAND_Y, fontFamily: LONG_MONO, fontSize: 22, color: LONG_MUTED, opacity: raus * 0.7 }}>
        {String(nummer).padStart(2, '0')} / 09
      </div>
    </AbsoluteFill>
  )
}
