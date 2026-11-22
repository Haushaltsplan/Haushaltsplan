/** Eine Zeile am Ende: investiert oder nicht. Danach nur die Kanal-Karte. */
import { AbsoluteFill, Img, useCurrentFrame } from 'remotion'
import { ein, oeffentlichSrc } from './long-bausteine'
import { LONG_MONO, LONG_SERIF, LONG_TEXT } from './long-look'

export function LongDisclosure({ investiert, firmenname }: { investiert: boolean; firmenname: string }) {
  const frame = useCurrentFrame()
  const zeile = investiert ? `I own shares of ${firmenname}.` : `I do not own shares of ${firmenname}.`
  return (
    <AbsoluteFill style={{ background: '#0C0C0E', justifyContent: 'center', paddingLeft: 160, paddingRight: 160 }}>
      <div style={{ fontFamily: LONG_MONO, fontSize: 20, letterSpacing: 4, color: 'rgba(243,241,236,0.45)', opacity: ein(frame, 4, 12) }}>
        DISCLOSURE
      </div>
      <div style={{ fontFamily: LONG_SERIF, fontSize: 72, color: LONG_TEXT, marginTop: 18, maxWidth: 1400, opacity: ein(frame, 8, 16) }}>{zeile}</div>
    </AbsoluteFill>
  )
}

export function LongSchluss({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const frame = useCurrentFrame()
  const o = ein(frame, 4, 12)
  return (
    <AbsoluteFill style={{ background: '#0C0C0E', justifyContent: 'center', alignItems: 'center' }}>
      {logoUrl ? (
        <Img src={oeffentlichSrc(logoUrl)} style={{ width: 120, height: 120, borderRadius: 60, objectFit: 'cover', opacity: o }} />
      ) : null}
      <div style={{ marginTop: 22, fontFamily: LONG_SERIF, fontSize: 64, color: LONG_TEXT, opacity: o }}>{name}</div>
    </AbsoluteFill>
  )
}
