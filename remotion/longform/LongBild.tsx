/** Foto/Clip mit Ken-Burns-Fahrt, Zwischentitel und Titelkarte. */
import { Video } from '@remotion/media'
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion'
import { Logo, ein, oeffentlichSrc, type SzeneProps } from './long-bausteine'
import { LONG_MONO, LONG_MUTED, LONG_RAND_X, LONG_RAND_Y, LONG_SERIF, LONG_TEXT, mitAlpha } from './long-look'

const FAHRTEN = [
  { von: [1.12, -1.5, -0.8], nach: [1.03, 1.5, 0.8] },
  { von: [1.03, 1.5, 0], nach: [1.12, -1.5, 0.8] },
  { von: [1.1, 0, 1.5], nach: [1.03, 0, -1.5] },
  { von: [1.04, -1.5, 1.5], nach: [1.12, 1.5, -0.8] },
] as const

export function LongBild(sp: SzeneProps) {
  const frame = useCurrentFrame()
  const s = sp.p.saetze[sp.block.saetze[0]!]!
  const akzent = sp.p.varianten.akzent
  if (!s.bildUrl) {
    // Kein PENDING-Platzhalter: Firmenlogo / Name als sauberer Daten-Fallback.
    return (
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <div style={{ opacity: ein(frame, 0, 14) }}>
          <Logo url={sp.p.logoUrl} groesse={160} ticker={sp.p.ticker} />
        </div>
        <div style={{ fontFamily: LONG_SERIF, fontSize: 72, color: LONG_TEXT, opacity: ein(frame, 6, 16) }}>{sp.p.firmenname}</div>
        {sp.p.branche ? (
          <div style={{ fontFamily: LONG_MONO, fontSize: 22, letterSpacing: 3, color: LONG_MUTED, opacity: ein(frame, 12, 14) }}>
            {sp.p.branche.toUpperCase()}
          </div>
        ) : null}
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
          <Video src={src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to top, rgba(12,12,14,0.78) 0%, rgba(12,12,14,0.15) 38%, rgba(12,12,14,0.35) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: LONG_RAND_X,
          bottom: LONG_RAND_Y + 28,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          opacity: ein(frame, 8, 16),
        }}
      >
        <div style={{ width: 4, height: 52, borderRadius: 2, background: akzent }} />
        <div>
          <div style={{ fontFamily: LONG_MONO, fontSize: 18, letterSpacing: 3, color: akzent }}>{sp.p.ticker}</div>
          <div style={{ fontFamily: LONG_SERIF, fontSize: 42, color: LONG_TEXT, marginTop: 4 }}>{sp.p.firmenname}</div>
        </div>
      </div>
      {s.bildCredit ? (
        <div
          style={{
            position: 'absolute',
            right: 36,
            bottom: 26,
            fontFamily: LONG_MONO,
            fontSize: 14,
            color: 'rgba(243,241,236,0.5)',
            maxWidth: 720,
            textAlign: 'right',
          }}
        >
          {s.bildCredit.length > 90 ? `${s.bildCredit.slice(0, 87)}…` : s.bildCredit}
        </div>
      ) : null}
    </AbsoluteFill>
  )
}

export function LongTitelKarte(sp: SzeneProps) {
  const frame = useCurrentFrame()
  const s = sp.p.saetze[sp.block.saetze[0]!]!
  const titel = s.visual.fokus?.trim() || sp.p.abschnittTitel[s.abschnittId] || ''
  const akzent = sp.p.varianten.akzent
  return (
    <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: LONG_RAND_X }}>
      <div style={{ fontFamily: LONG_MONO, fontSize: 22, letterSpacing: 5, color: akzent, opacity: ein(frame, 0, 12) }}>{sp.p.ticker}</div>
      <div style={{ fontFamily: LONG_SERIF, fontSize: 120, color: LONG_TEXT, marginTop: 12, opacity: ein(frame, 4, 18), maxWidth: 1500 }}>
        {titel}
      </div>
      <div style={{ marginTop: 28, height: 4, width: 360 * ein(frame, 10, 20), background: akzent }} />
    </AbsoluteFill>
  )
}

/** Zwischentitel vor jedem Abschnitt: Nummer, Titel, eine Linie, die sich zieht. */
export function LongBumper({ nummer, titel, akzent, gesamt = 3, dauer = 15 }: { nummer: number; titel: string; akzent: string; gesamt?: number; dauer?: number }) {
  const frame = useCurrentFrame()
  const rein = ein(frame, 0, 10)
  const raus = interpolate(frame, [Math.max(10, dauer - 10), dauer], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ background: '#0C0C0E', opacity: raus }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 50% 40% at 30% 50%, ${mitAlpha(akzent, 0.12)} 0%, rgba(0,0,0,0) 70%)`,
          opacity: rein,
        }}
      />
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: LONG_RAND_X, opacity: rein }}>
        <div style={{ fontFamily: LONG_MONO, fontSize: 28, letterSpacing: 6, color: akzent, opacity: ein(frame, 0, 4) }}>
          CHAPTER {String(nummer).padStart(2, '0')}
        </div>
        <div
          style={{
            fontFamily: LONG_SERIF,
            fontSize: 132,
            color: LONG_TEXT,
            lineHeight: 1.05,
            marginTop: 8,
            opacity: ein(frame, 1, 5),
            transform: `translateX(${(1 - ein(frame, 1, 5)) * -28}px)`,
          }}
        >
          {titel}
        </div>
        <div style={{ marginTop: 28, height: 3, width: 480 * ein(frame, 2, 6), background: akzent }} />
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          right: LONG_RAND_X,
          bottom: LONG_RAND_Y,
          fontFamily: LONG_MONO,
          fontSize: 22,
          color: LONG_MUTED,
          opacity: raus * 0.7,
        }}
      >
        {String(nummer).padStart(2, '0')} / {String(gesamt).padStart(2, '0')}
      </div>
    </AbsoluteFill>
  )
}
