/** Long-Form-Aktienanalyse 16:9: Szenenblöcke, satzweise Stimme, Musik mit Ducking, Abo-Einblendung. */
import { Audio } from '@remotion/media'
import { useMemo } from 'react'
import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame } from 'remotion'
import { Hintergrund, Korn, oeffentlichSrc, type SzeneProps } from './long-bausteine'
import { LONG_MUSIK_FREI, LONG_MUSIK_UNTER_STIMME } from './long-look'
import { berechneLongTimeline, type LongBlock, type LongTimeline } from './long-timeline'
import type { AktienAnalyseProps } from './long-types'
import { LongBild, LongBumper, LongTitelKarte } from './LongBild'
import { LongChart } from './LongChart'
import { LongEnde } from './LongEnde'
import { LongHook } from './LongHook'
import { LongJahresChart } from './LongJahresChart'
import { LongMoat } from './LongMoat'

function KornAbSekunde() {
  const frame = useCurrentFrame()
  if (frame < 90) return null
  return <Korn />
}

function Szene(sp: SzeneProps) {
  switch (sp.block.familie) {
    case 'hook':
      return <LongHook {...sp} />
    case 'chart':
      return <LongChart {...sp} />
    case 'moat':
      return <LongMoat {...sp} />
    case 'reihe':
      return <LongJahresChart {...sp} />
    case 'titel':
      return <LongTitelKarte {...sp} />
    case 'karte':
      return <LongEnde {...sp} />
    default:
      return <LongBild {...sp} />
  }
}

/** Langsame Drift plus kurzer Zoom-Impuls auf dem betonten Wort. Richtung hängt vom Kamera-Seed ab. */
function Kamera({ p, t, block, children }: SzeneProps & { children: React.ReactNode }) {
  const frame = useCurrentFrame()
  const impulse = block.saetze.map((i) => t.saetze[i]!.betonungFrame).filter((f): f is number => f != null).map((f) => f - block.from)
  let punch = 0
  for (const f of impulse) {
    const d = frame - f
    if (d >= -4 && d < 40) punch = Math.max(punch, interpolate(d, [-4, 6, 40], [0, 1, 0.55], { extrapolateRight: 'clamp' }))
  }
  // Chart/B-Roll: kaum Punch — sonst „zucken“ die Linien und Fotos.
  if (block.familie === 'chart' || block.familie === 'reihe') punch = 0
  if (block.familie === 'bild' || block.familie === 'moat') punch *= 0.25
  if (block.familie === 'hook' && frame + block.from < 90) {
    return <AbsoluteFill>{children}</AbsoluteFill>
  }
  const drift = interpolate(frame, [0, Math.max(1, block.dauer)], [1, block.familie === 'chart' ? 1.008 : 1.018], {
    extrapolateRight: 'clamp',
  })
  const seed = p.varianten.kameraSeed + block.from
  const ox = 40 + (seed % 3) * 10
  const oy = 42 + ((seed >> 2) % 3) * 8
  return <AbsoluteFill style={{ transform: `scale(${drift + punch * 0.02})`, transformOrigin: `${ox}% ${oy}%` }}>{children}</AbsoluteFill>
}

function musikVolumen(f: number, t: LongTimeline, basis: number, von: number, bis: number): number {
  let abstand = Infinity
  for (const [a, b] of t.sprechen) {
    if (f >= a && f <= b) {
      abstand = 0
      break
    }
    abstand = Math.min(abstand, f < a ? a - f : f - b)
  }
  const frei = Math.min(1, abstand / 6)
  const pegel = LONG_MUSIK_UNTER_STIMME + (LONG_MUSIK_FREI - LONG_MUSIK_UNTER_STIMME) * frei
  const kante = Math.min(1, (f - von) / 20, (bis - f) / 30)
  return Math.max(0, pegel * basis * Math.max(0, kante))
}

const UEBERLAPP = 5

function logoKey(logos: { url: string }[] | null | undefined): string {
  return (logos ?? []).map((l) => l.url).join('|')
}

/** Überlapp nur zwischen zwei Sätzen desselben Kapitels. Die Kapitelkarte bleibt eine Pause. */
function satzFenster(p: AktienAnalyseProps, t: LongTimeline, i: number) {
  const z = t.saetze[i]!
  const vor = i > 0 ? t.saetze[i - 1] : null
  const nach = t.saetze[i + 1]
  const gleichesVor = vor != null && p.saetze[i]!.abschnittId === p.saetze[i - 1]!.abschnittId && z.from - (vor.from + vor.dauer) <= 2
  const gleichesNach = nach != null && p.saetze[i]!.abschnittId === p.saetze[i + 1]!.abschnittId && nach.from - (z.from + z.dauer) <= 2
  const start = gleichesVor ? Math.max(0, z.from - UEBERLAPP) : z.from
  const ende = gleichesNach ? z.from + z.dauer + UEBERLAPP : z.from + z.dauer
  return { start, laenge: Math.max(1, ende - start), ein: gleichesVor ? UEBERLAPP : 2, aus: gleichesNach ? UEBERLAPP : 4 }
}

/** Im Überlapp fällt der vorige Satz und der nächste kommt. Dazwischen bleibt Stimme. */
function SatzTon({ src, laenge, einblende, ausblende }: { src: string; laenge: number; einblende: number; ausblende: number }) {
  const frame = useCurrentFrame()
  const rein = interpolate(frame, [0, einblende], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const raus = interpolate(frame, [Math.max(einblende, laenge - ausblende), laenge], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <Audio src={src} volume={rein * raus} />
}

function Ton({ p, t }: { p: AktienAnalyseProps; t: LongTimeline }) {
  const basis = Math.max(0, p.musik.pegel) / 50
  const musikTeile = useMemo(() => {
    if (!p.musik.aktiv) return []
    const teile: { src: string; von: number; bis: number; start: number }[] = []
    for (const a of t.abschnitte) {
      const track = p.musik.tracks.find((x) => x.abschnittId === a.id)
      if (!track) continue
      const letzter = teile[teile.length - 1]
      if (letzter && letzter.src === track.src && letzter.bis >= a.from - 2) letzter.bis = a.bis
      else teile.push({ src: track.src, von: Math.max(0, a.from - 10), bis: a.bis, start: track.startSek ?? 0 })
    }
    if (teile.length) teile[teile.length - 1]!.bis = t.durationInFrames
    return teile
  }, [p.musik, t])

  return (
    <>
      {p.saetze.map((s, i) => {
        const z = t.saetze[i]!
        if (!s.audioUrl) return null
        const fenster = satzFenster(p, t, i)
        return (
          <Sequence key={s.id} from={fenster.start} durationInFrames={fenster.laenge} layout="none">
            <SatzTon src={s.audioUrl} laenge={fenster.laenge} einblende={fenster.ein} ausblende={fenster.aus} />
          </Sequence>
        )
      })}
      {musikTeile.map((m, k) => (
        <Sequence key={k} from={m.von} durationInFrames={Math.max(1, m.bis - m.von)} layout="none">
          <Audio
            src={oeffentlichSrc(m.src)}
            loop
            trimBefore={m.start > 0 ? Math.round(m.start * 30) : undefined}
            volume={(f) => musikVolumen(f + m.von, t, basis, m.von, m.bis)}
          />
        </Sequence>
      ))}
    </>
  )
}

/** Kleine Logoleiste, solange derselbe Konkurrenten-Satzblock läuft. */
function KonkurrentenLeiste({ p, t }: { p: AktienAnalyseProps; t: LongTimeline }) {
  const frame = useCurrentFrame()
  let pos = 0
  for (let i = 0; i < t.saetze.length; i++) if (t.saetze[i]!.from <= frame) pos = i
  const logos = p.saetze[pos]?.visual.konkurrentLogos ?? []
  if (!logos.length) return null
  const key = logoKey(logos)
  let start = t.saetze[pos]!.from
  for (let i = pos - 1; i >= 0; i--) {
    if (logoKey(p.saetze[i]?.visual.konkurrentLogos) !== key) break
    start = t.saetze[i]!.from
  }
  const o = interpolate(frame, [start, start + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <div style={{ position: 'absolute', left: 120, top: 36, zIndex: 4, display: 'flex', gap: 16, opacity: o }}>
      {logos.map((l) => (
        <div
          key={l.url}
          style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            background: 'rgba(12,12,14,0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 10,
          }}
        >
          <Img src={oeffentlichSrc(l.url)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      ))}
    </div>
  )
}

export function AktienAnalyse(p: AktienAnalyseProps) {
  const t = useMemo(() => berechneLongTimeline(p), [p])
  return (
    <AbsoluteFill style={{ background: '#0C0C0E' }}>
      <Hintergrund akzent={p.varianten.akzent} seed={p.varianten.kameraSeed} />
      {t.bloecke.map((b: LongBlock, k) => (
        <Sequence key={k} from={b.from} durationInFrames={b.dauer}>
          <Kamera p={p} t={t} block={b}>
            <Szene p={p} t={t} block={b} />
          </Kamera>
        </Sequence>
      ))}
      {t.bumper.map((b) => (
        <Sequence key={b.from} from={b.from} durationInFrames={b.dauer}>
          <LongBumper
            nummer={b.nummer}
            titel={p.abschnittTitel[b.abschnittId] ?? ''}
            akzent={p.varianten.akzent}
            gesamt={Math.max(1, t.bumper.length)}
            dauer={b.dauer}
          />
        </Sequence>
      ))}
      <KornAbSekunde />
      <KonkurrentenLeiste p={p} t={t} />
      <Ton p={p} t={t} />
    </AbsoluteFill>
  )
}
