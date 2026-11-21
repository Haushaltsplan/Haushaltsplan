/** Hook: drei Bildsprachen (große Zahl, Leitfrage, Foto). Welche, entscheidet Skript bzw. Variante. */
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
import { LONG_DISPLAY, LONG_MONO, LONG_MUTED, LONG_RAND_X, LONG_RAND_Y, LONG_SERIF, LONG_SERIF_KURSIV, LONG_TEXT } from './long-look'

function Kopf({ p, sichtbar }: { p: SzeneProps['p']; sichtbar: number }) {
  return (
    <div style={{ position: 'absolute', left: LONG_RAND_X, top: LONG_RAND_Y, display: 'flex', alignItems: 'center', gap: 22, opacity: sichtbar }}>
      <Logo url={p.logoUrl} groesse={64} ticker={p.ticker} />
      <div style={{ fontFamily: LONG_MONO, fontSize: 26, letterSpacing: 4, color: LONG_MUTED }}>{p.ticker}</div>
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
  const fort = ein(frame, start, 26)
  const akzent = sp.p.varianten.akzent
  if (!f) return <HookFrage sp={sp} lauf={lauf} />
  return (
    <AbsoluteFill>
      <Kopf p={sp.p} sichtbar={ein(frame, 0, 20)} />
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: LONG_RAND_X, paddingRight: LONG_RAND_X }}>
        <div
          style={{
            fontFamily: LONG_DISPLAY,
            fontWeight: 900,
            fontSize: 260,
            lineHeight: 0.95,
            letterSpacing: -8,
            color: LONG_TEXT,
            fontVariantNumeric: 'tabular-nums',
            transform: `translateY(${(1 - ein(frame, start - 6, 18)) * 30}px)`,
            opacity: ein(frame, start - 6, 12),
          }}
        >
          {zaehleText(f.text, fort)}
        </div>
        <div style={{ marginTop: 28, height: 4, width: 220 * fort, background: akzent }} />
        <div style={{ marginTop: 26, fontFamily: LONG_SERIF_KURSIV, fontSize: 54, color: LONG_MUTED, opacity: ein(frame, start + 14, 16) }}>{f.label}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

function HookFrage({ sp, lauf }: { sp: SzeneProps; lauf: SatzLauf }) {
  const frame = useCurrentFrame()
  const woerter = sp.p.leitfrage.split(/\s+/).filter(Boolean)
  const proWort = Math.max(3, Math.min(7, Math.floor((lauf.bis - lauf.from) / Math.max(1, woerter.length) / 3)))
  const akzent = sp.p.varianten.akzent
  const markiere = Math.max(0, woerter.length - 2)
  return (
    <AbsoluteFill>
      <Kopf p={sp.p} sichtbar={ein(frame, 0, 20)} />
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: LONG_RAND_X, paddingRight: LONG_RAND_X * 2 }}>
        <div style={{ fontFamily: LONG_SERIF, fontSize: 118, lineHeight: 1.08, color: LONG_TEXT, letterSpacing: -1 }}>
          {woerter.map((w, k) => {
            const o = ein(frame, 8 + k * proWort, 10)
            return (
              <span key={k} style={{ opacity: o, display: 'inline-block', transform: `translateY(${(1 - o) * 18}px)`, marginRight: 26, position: 'relative' }}>
                {w}
                {k >= markiere ? (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      bottom: 6,
                      height: 6,
                      width: `${ein(frame, 8 + woerter.length * proWort + 6, 18) * 100}%`,
                      background: akzent,
                      opacity: 0.85,
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
  const zoom = interpolate(frame, [0, dauer], [1.12, 1.0], { extrapolateRight: 'clamp' })
  const src = oeffentlichSrc(s.bildUrl)
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        {s.bildArt === 'video' ? (
          <OffthreadVideo src={src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(to top, rgba(12,12,14,0.94) 0%, rgba(12,12,14,0.35) 55%, rgba(12,12,14,0.55) 100%)' }} />
      <Kopf p={sp.p} sichtbar={ein(frame, 6, 20)} />
      <div
        style={{
          position: 'absolute',
          left: LONG_RAND_X,
          right: LONG_RAND_X * 3,
          bottom: LONG_RAND_Y + 20,
          fontFamily: LONG_SERIF,
          fontSize: 96,
          lineHeight: 1.06,
          color: LONG_TEXT,
          opacity: ein(frame, 20, 22),
          transform: `translateY(${(1 - ein(frame, 20, 22)) * 24}px)`,
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
        <Blende key={k} von={l.from} bis={l.bis + (k < laeufe.length - 1 ? 8 : 0)}>
          <Sequence from={l.from} layout="none">
            {l.szene === 'hook_zahl' ? <HookZahl sp={sp} lauf={l} /> : l.szene === 'hook_bild' ? <HookBild sp={sp} lauf={l} /> : <HookFrage sp={sp} lauf={l} />}
          </Sequence>
        </Blende>
      ))}
    </AbsoluteFill>
  )
}
