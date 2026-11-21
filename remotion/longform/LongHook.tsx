/** Hook: cold open — große Zahl, Leitfrage oder Foto. Professioneller Einstieg ohne leere Flächen. */
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, useCurrentFrame } from 'remotion'
import {
  Blende,
  Logo,
  aktiverSatz,
  ein,
  oeffentlichSrc,
  satzLaeufe,
  zaehleText,
  type SatzLauf,
  type SzeneProps,
} from './long-bausteine'
import { LONG_DISPLAY, LONG_MONO, LONG_MUTED, LONG_RAND_X, LONG_RAND_Y, LONG_SANS, LONG_SERIF, LONG_SERIF_KURSIV, LONG_TEXT, mitAlpha } from './long-look'

function Kopf({ p, sichtbar }: { p: SzeneProps['p']; sichtbar: number }) {
  return (
    <div style={{ position: 'absolute', left: LONG_RAND_X, top: LONG_RAND_Y, display: 'flex', alignItems: 'center', gap: 20, opacity: sichtbar }}>
      <Logo url={p.logoUrl} groesse={56} ticker={p.ticker} />
      <div>
        <div style={{ fontFamily: LONG_MONO, fontSize: 22, letterSpacing: 4, color: LONG_TEXT }}>{p.ticker}</div>
        <div style={{ fontFamily: LONG_SANS, fontWeight: 600, fontSize: 20, color: LONG_MUTED, marginTop: 2 }}>{p.firmenname}</div>
      </div>
    </div>
  )
}

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

function HookZahl({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const frame = useCurrentFrame()
  const rel = frame + lauf.from
  const i = aktiverSatz(sp, rel)
  const f = zahlFakt(sp, i)
  const z = sp.t.saetze[i]!
  const start = (z.betonungFrame ?? z.from + 10) - sp.block.from - lauf.from
  const fort = ein(frame, start, 28)
  const akzent = sp.p.varianten.akzent
  if (!f) return <HookFrage sp={sp} lauf={lauf} />
  const slam = ein(frame, start - 4, 14)
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 55% 50% at 28% 48%, ${mitAlpha(akzent, 0.16)} 0%, rgba(0,0,0,0) 70%)`,
          opacity: ein(frame, 0, 24),
        }}
      />
      <Kopf p={sp.p} sichtbar={ein(frame, 0, 16)} />
      <div
        style={{
          position: 'absolute',
          left: LONG_RAND_X,
          top: 210,
          fontFamily: LONG_MONO,
          fontSize: 20,
          letterSpacing: 5,
          color: akzent,
          opacity: ein(frame, 4, 14),
        }}
      >
        COLD OPEN
      </div>
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: LONG_RAND_X, paddingRight: LONG_RAND_X }}>
        <div
          style={{
            fontFamily: LONG_DISPLAY,
            fontWeight: 900,
            fontSize: 240,
            lineHeight: 0.92,
            letterSpacing: -10,
            color: LONG_TEXT,
            fontVariantNumeric: 'tabular-nums',
            transform: `translateY(${(1 - slam) * 48}px) scale(${0.92 + slam * 0.08})`,
            opacity: slam,
            textShadow: `0 0 80px ${mitAlpha(akzent, 0.25)}`,
          }}
        >
          {zaehleText(f.text, fort)}
        </div>
        <div style={{ marginTop: 22, height: 5, width: 280 * fort, background: akzent, borderRadius: 3 }} />
        <div
          style={{
            marginTop: 28,
            maxWidth: 1100,
            fontFamily: LONG_SERIF_KURSIV,
            fontSize: 48,
            color: LONG_MUTED,
            opacity: ein(frame, start + 16, 18),
            transform: `translateY(${(1 - ein(frame, start + 16, 18)) * 16}px)`,
          }}
        >
          {f.label}
        </div>
        {sp.p.leitfrage ? (
          <div
            style={{
              marginTop: 48,
              maxWidth: 1400,
              fontFamily: LONG_SERIF,
              fontSize: 42,
              lineHeight: 1.2,
              color: LONG_TEXT,
              opacity: ein(frame, start + 36, 20),
            }}
          >
            {sp.p.leitfrage}
          </div>
        ) : null}
      </AbsoluteFill>
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
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 55% at 70% 40%, ${mitAlpha(akzent, 0.12)} 0%, rgba(0,0,0,0) 65%)`,
        }}
      />
      <Kopf p={sp.p} sichtbar={ein(frame, 0, 16)} />
      <div
        style={{
          position: 'absolute',
          left: LONG_RAND_X,
          top: 210,
          fontFamily: LONG_MONO,
          fontSize: 20,
          letterSpacing: 5,
          color: akzent,
          opacity: ein(frame, 4, 14),
        }}
      >
        THE QUESTION
      </div>
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
  const akzent = sp.p.varianten.akzent
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        {s.bildArt === 'video' ? (
          <OffthreadVideo src={src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(to top, rgba(12,12,14,0.96) 0%, rgba(12,12,14,0.45) 48%, rgba(12,12,14,0.62) 100%)' }} />
      <Kopf p={sp.p} sichtbar={ein(frame, 6, 18)} />
      <div
        style={{
          position: 'absolute',
          left: LONG_RAND_X,
          top: 210,
          fontFamily: LONG_MONO,
          fontSize: 20,
          letterSpacing: 5,
          color: akzent,
          opacity: ein(frame, 10, 14),
        }}
      >
        COLD OPEN
      </div>
      <div
        style={{
          position: 'absolute',
          left: LONG_RAND_X,
          right: LONG_RAND_X * 2,
          bottom: LONG_RAND_Y + 36,
          fontFamily: LONG_SERIF,
          fontSize: 84,
          lineHeight: 1.08,
          color: LONG_TEXT,
          opacity: ein(frame, 18, 22),
          transform: `translateY(${(1 - ein(frame, 18, 22)) * 28}px)`,
        }}
      >
        {sp.p.leitfrage}
      </div>
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
