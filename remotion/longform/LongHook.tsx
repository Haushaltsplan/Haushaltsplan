/** Hook: cold open — große Zahl, Leitfrage oder Foto. Professioneller Einstieg ohne leere Flächen. */
import { Video } from '@remotion/media'
import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame } from 'remotion'
import { dollarImText, dollarKompakt } from '../../lib/youtube/longform/longform-format'
import { Blende, Logo, aktiverSatz, ein, oeffentlichSrc, satzLaeufe, type SatzLauf, type SzeneProps } from './long-bausteine'
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
  const zahl = dollarImText(f.text, f.wert)
  const groesse = zahlGroesse(zahl) + (72 - zahlGroesse(zahl)) * wander
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
          {zahl}
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

function HookRuhe({ sp }: { sp: SzeneProps }) {
  return (
    <AbsoluteFill style={{ background: '#0C0C0E', justifyContent: 'center', alignItems: 'center' }}>
      <Logo url={sp.p.logoUrl} groesse={160} ticker={sp.p.ticker} />
      <div style={{ marginTop: 28, fontFamily: LONG_SERIF, fontSize: 64, color: LONG_TEXT }}>{sp.p.firmenname}</div>
    </AbsoluteFill>
  )
}

function basisZeile(sp: SzeneProps): string | null {
  const b = sp.p.hookBasis
  const teile = [b?.marketCap ? `Market cap ${dollarKompakt(b.marketCap)}` : null, b?.wkn ? `WKN ${b.wkn}` : null, b?.isin ? `ISIN ${b.isin}` : null].filter(
    (t): t is string => !!t,
  )
  return teile.length ? teile.join('   ·   ') : null
}

function HookBild({ sp, lauf, karte }: { sp: SzeneProps; lauf: SatzLauf; karte: { wert: string; label: string } | null }) {
  const frame = useCurrentFrame()
  const s = sp.p.saetze[lauf.saetze[0]!]
  if (!s?.bildUrl) return <HookRuhe sp={sp} />
  const dauer = Math.max(1, lauf.bis - lauf.from)
  const zoom = interpolate(frame, [0, dauer], [1.06, 1], { extrapolateRight: 'clamp' })
  const src = oeffentlichSrc(s.bildUrl)
  const basis = basisZeile(sp)
  const wertGroesse = !karte ? 64 : karte.wert.length > 22 ? 36 : karte.wert.length > 14 ? 48 : 64
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        {s.bildArt === 'video' ? (
          <Video src={src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(to top, rgba(12,12,14,0.82) 0%, rgba(12,12,14,0.05) 42%, rgba(12,12,14,0) 70%)' }} />
      {karte ? (
        <div
          style={{
            position: 'absolute',
            left: 80,
            top: 64,
            maxWidth: 560,
            padding: '18px 24px',
            borderRadius: 18,
            background: 'rgba(12,12,14,0.78)',
            opacity: ein(frame, 8, 12),
          }}
        >
          <div style={{ fontFamily: LONG_MONO, fontSize: 16, letterSpacing: 3, color: LONG_MUTED }}>{karte.label.toUpperCase()}</div>
          <div style={{ marginTop: 6, fontFamily: LONG_DISPLAY, fontWeight: 800, fontSize: wertGroesse, lineHeight: 1.05, color: LONG_TEXT }}>{karte.wert}</div>
        </div>
      ) : null}
      {basis ? (
        <div
          style={{
            position: 'absolute',
            right: 48,
            bottom: 36,
            maxWidth: 980,
            textAlign: 'right',
            fontFamily: LONG_MONO,
            fontSize: 18,
            letterSpacing: 0.4,
            color: 'rgba(243,241,236,0.88)',
            textShadow: '0 1px 8px rgba(0,0,0,0.85)',
            opacity: ein(frame, 12, 14),
          }}
        >
          {basis}
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 80, bottom: 72, display: 'flex', alignItems: 'center', gap: 18, opacity: ein(frame, 8, 12) }}>
        <Logo url={sp.p.logoUrl} groesse={64} ticker={sp.p.ticker} />
        <div style={{ fontFamily: LONG_SERIF, fontSize: 36, color: LONG_TEXT }}>{sp.p.firmenname}</div>
      </div>
    </AbsoluteFill>
  )
}

export function LongHook(sp: SzeneProps) {
  const laeufe = satzLaeufe(sp)
  return (
    <AbsoluteFill>
      {laeufe.map((l, k) => {
        const fotoIndex = laeufe.slice(0, k).filter((x) => x.szene === 'hook_bild' && sp.p.saetze[x.saetze[0]!]?.bildUrl).length
        const karte = l.szene === 'hook_bild' ? (sp.p.hookKarten?.[fotoIndex] ?? null) : null
        return (
          <Blende key={k} von={l.from} bis={l.bis + (k < laeufe.length - 1 ? 3 : 0)}>
            <Sequence from={l.from} layout="none" durationInFrames={Math.max(1, l.bis - l.from + 4)}>
              {l.szene === 'hook_zahl' ? <HookZahl sp={sp} lauf={l} /> : l.szene === 'hook_bild' ? <HookBild sp={sp} lauf={l} karte={karte} /> : <HookFrage sp={sp} lauf={l} />}
            </Sequence>
          </Blende>
        )
      })}
    </AbsoluteFill>
  )
}
