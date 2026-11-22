/** Hook: cold open — große Zahl, Leitfrage oder Foto. Professioneller Einstieg ohne leere Flächen. */
import { Video } from '@remotion/media'
import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame } from 'remotion'
import { Blende, aktiverSatz, ein, oeffentlichSrc, satzLaeufe, type SatzLauf, type SzeneProps } from './long-bausteine'
import { LONG_DISPLAY, LONG_MONO, LONG_MUTED, LONG_RAND_X, LONG_SERIF, LONG_SERIF_KURSIV, LONG_TEXT } from './long-look'

function zahlFakt(sp: SzeneProps, i: number) {
  for (let k = i; k >= 0; k--) {
    const s = sp.p.saetze[k]
    if (!s || s.abschnittId !== 'hook') break
    for (const id of s.faktIds) {
      const f = sp.p.fakten[id]
      if (f && f.wert != null && /\d/.test(f.text)) return f
    }
  }
  return null
}

function zahlGroesse(text: string): number {
  if (text.length > 12) return 120
  if (text.length > 8) return 160
  return 200
}

function HookZahl({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const frame = useCurrentFrame()
  const rel = frame + lauf.from
  const i = aktiverSatz(sp, rel)
  const f = zahlFakt(sp, i)
  const z = sp.t.saetze[i]!
  const akzent = sp.p.varianten.akzent
  if (!f) return <HookFrage sp={sp} lauf={lauf} />
  const cover = i === sp.block.saetze[0]
  const satzStart = z.from - sp.block.from - lauf.from
  const linie = cover ? ein(frame, Math.max(0, satzStart - 10), 10) : 1
  const sichtbar = cover ? ein(frame, Math.max(0, satzStart), 8) : 1
  const wander = cover ? 0 : ein(frame, Math.max(0, satzStart), 14)
  const groesse = zahlGroesse(f.text) + (72 - zahlGroesse(f.text)) * wander
  const left = 240 + (220 - 240) * wander
  const top = 340 + (188 - 340) * wander
  return (
    <AbsoluteFill style={{ background: '#0C0C0E' }}>
      <div style={{ position: 'absolute', left: 180, top: 200, width: 1, height: 680 * linie, background: akzent }} />
      <div
        style={{
          position: 'absolute',
          left,
          top,
          opacity: sichtbar,
          transform: `scale(${1.03 - sichtbar * 0.03})`,
          transformOrigin: 'left center',
        }}
      >
        <div
          style={{
            fontFamily: LONG_DISPLAY,
            fontWeight: 900,
            fontSize: groesse,
            lineHeight: 0.92,
            letterSpacing: -4,
            color: '#F3F1EC',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {f.text}
        </div>
        <div style={{ marginTop: 22, fontFamily: LONG_MONO, fontSize: 22, letterSpacing: 4, color: LONG_MUTED, opacity: 1 - wander }}>
          {f.label.toUpperCase()}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 220, top: 360, maxWidth: 1400, opacity: wander }}>
        <div style={{ fontFamily: LONG_SERIF_KURSIV, fontSize: 28, color: LONG_MUTED }}>{sp.p.firmenname}</div>
        <div style={{ marginTop: 16, fontFamily: LONG_SERIF, fontSize: 64, lineHeight: 1.15, color: LONG_TEXT }}>{sp.p.leitfrage}</div>
      </div>
    </AbsoluteFill>
  )
}

function HookFrage({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const frame = useCurrentFrame()
  const woerter = sp.p.leitfrage.split(/\s+/).filter(Boolean)
  const proWort = Math.max(2, Math.min(6, Math.floor((lauf.bis - lauf.from) / Math.max(1, woerter.length) / 2.5)))
  const akzent = sp.p.varianten.akzent
  const markiere = Math.max(0, woerter.length - 3)
  return (
    <AbsoluteFill style={{ background: '#0C0C0E' }}>
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: LONG_RAND_X, paddingRight: LONG_RAND_X * 1.5 }}>
        <div style={{ fontFamily: LONG_SERIF, fontSize: 96, lineHeight: 1.12, color: LONG_TEXT, letterSpacing: -1.5, maxWidth: 1500 }}>
          {woerter.map((w, k) => {
            const o = ein(frame, 6 + k * proWort, 9)
            return (
              <span key={k} style={{ opacity: o, display: 'inline-block', transform: `translateY(${(1 - o) * 22}px)`, marginRight: 22, position: 'relative' }}>
                {w}
                {k >= markiere ? (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      bottom: 4,
                      height: 7,
                      width: `${ein(frame, 8 + woerter.length * proWort + 4, 16) * 100}%`,
                      background: akzent,
                      opacity: 0.9,
                      borderRadius: 2,
                    }}
                  />
                ) : null}
              </span>
            )
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function HookBild({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const frame = useCurrentFrame()
  const s = lauf.saetze.map((i) => sp.p.saetze[i]!).find((x) => x.bildUrl)
  if (!s?.bildUrl) return <HookFrage sp={sp} lauf={lauf} />
  const dauer = Math.max(1, lauf.bis - lauf.from)
  const zoom = interpolate(frame, [0, dauer], [1.14, 1.02], { extrapolateRight: 'clamp' })
  const src = oeffentlichSrc(s.bildUrl)
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        {s.bildArt === 'video' ? (
          <Video src={src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(to top, rgba(12,12,14,0.96) 0%, rgba(12,12,14,0.2) 42%, rgba(12,12,14,0) 68%)' }} />
      {(() => {
        const f = zahlFakt(sp, lauf.saetze[0]!)
        return (
          <div style={{ position: 'absolute', left: 220, bottom: 120, right: 160, opacity: ein(frame, 6, 8) }}>
            {f ? (
              <>
                <div style={{ fontFamily: LONG_DISPLAY, fontWeight: 900, fontSize: Math.min(160, zahlGroesse(f.text)), color: '#F3F1EC', letterSpacing: -3, lineHeight: 0.92 }}>
                  {f.text}
                </div>
                <div style={{ marginTop: 16, fontFamily: LONG_MONO, fontSize: 22, letterSpacing: 4, color: LONG_MUTED }}>{f.label.toUpperCase()}</div>
              </>
            ) : (
              <div style={{ fontFamily: LONG_SERIF, fontSize: 64, lineHeight: 1.12, color: LONG_TEXT }}>{sp.p.leitfrage}</div>
            )}
          </div>
        )
      })()}
    </AbsoluteFill>
  )
}

export function LongHook(sp: SzeneProps) {
  const laeufe = satzLaeufe(sp)
  return (
    <AbsoluteFill>
      {laeufe.map((l, k) => (
        <Blende key={k} von={l.from} bis={l.bis + (k < laeufe.length - 1 ? 3 : 0)}>
          <Sequence from={l.from} layout="none" durationInFrames={Math.max(1, l.bis - l.from + 4)}>
            {l.szene === 'hook_zahl' ? <HookZahl sp={sp} lauf={l} /> : l.szene === 'hook_bild' ? <HookBild sp={sp} lauf={l} /> : <HookFrage sp={sp} lauf={l} />}
          </Sequence>
        </Blende>
      ))}
    </AbsoluteFill>
  )
}
