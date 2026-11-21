/** Long-Form-Aktienanalyse 16:9: Szenenblöcke, satzweise Stimme, Musik mit Ducking, Abo-Einblendung. */
import { Audio } from '@remotion/media'
import { mouseClick, whoosh } from '@remotion/sfx'
import { useMemo } from 'react'
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion'
import { SFX_CONFIG } from '../sfx-config'
import { Hintergrund, Korn, oeffentlichSrc, type SzeneProps } from './long-bausteine'
import { LONG_MUSIK_FREI, LONG_MUSIK_UNTER_STIMME, LONG_SFX_PEGEL } from './long-look'
import { berechneLongTimeline, type LongBlock, type LongTimeline } from './long-timeline'
import type { AktienAnalyseProps } from './long-types'
import { ABO_KLICK_ABO, ABO_KLICK_LIKE, LongAbo } from './LongAbo'
import { LongBild, LongBumper, LongTitelKarte } from './LongBild'
import { LongChart } from './LongChart'
import { LongHook } from './LongHook'
import { LongMoat } from './LongMoat'

function Szene(sp: SzeneProps) {
  switch (sp.block.familie) {
    case 'hook':
      return <LongHook {...sp} />
    case 'chart':
      return <LongChart {...sp} />
    case 'moat':
      return <LongMoat {...sp} />
    case 'titel':
      return <LongTitelKarte {...sp} />
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
  if (block.familie === 'chart') punch = 0
  if (block.familie === 'bild' || block.familie === 'moat') punch *= 0.25
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
        return (
          <Sequence key={s.id} from={z.from} durationInFrames={z.dauer + 6} layout="none">
            <Audio src={s.audioUrl} />
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
      {p.sfx ? (
        <>
          <Sequence from={0} durationInFrames={10} layout="none">
            <Audio src={oeffentlichSrc(SFX_CONFIG.hookImpact.datei)} volume={SFX_CONFIG.hookImpact.pegel * 0.7} />
          </Sequence>
          {t.bumper.map((b) => (
            <Sequence key={b.from} from={Math.max(0, b.from - 4)} durationInFrames={30} layout="none">
              <Audio src={whoosh} volume={LONG_SFX_PEGEL * 0.6} />
            </Sequence>
          ))}
          {t.abo
            ? [ABO_KLICK_LIKE, ABO_KLICK_ABO].map((k) => (
                <Sequence key={k} from={t.abo!.from + k} durationInFrames={15} layout="none">
                  <Audio src={mouseClick} volume={LONG_SFX_PEGEL} />
                </Sequence>
              ))
            : null}
        </>
      ) : null}
    </>
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
          />
        </Sequence>
      ))}
      {t.abo ? (
        <Sequence from={t.abo.from} durationInFrames={t.abo.dauer}>
          <LongAbo dauer={t.abo.dauer} text={p.varianten.aboText} akzent={p.varianten.akzent} ticker={p.ticker} />
        </Sequence>
      ) : null}
      <Korn />
      <Ton p={p} t={t} />
    </AbsoluteFill>
  )
}
