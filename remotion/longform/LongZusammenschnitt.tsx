/** Schlussfilm aus den hochgeladenen Kapitel-MP4s. Nichts wird neu gesprochen oder darübergelegt. */
import { Video } from '@remotion/media'
import { AbsoluteFill, Sequence } from 'remotion'
import { LONG_ABSPANN } from './long-timeline'
import { LONG_FPS } from './long-types'

export type ZusammenschnittTeil = { src: string; dauerMs: number }

export type ZusammenschnittProps = {
  teile: ZusammenschnittTeil[]
}

export function framesAusMs(ms: number): number {
  return Math.max(1, Math.round((ms / 1000) * LONG_FPS))
}

/**
 * Einzelne Kapiteldateien enden mit dem Abspann-Halt. Im zusammengesetzten Film
 * bleibt der Halt nur nach dem letzten Kapitel, sonst wäre zwischen den Kapiteln eine Pause.
 */
export function spielFrames(dauerMs: number, letztes: boolean): number {
  const roh = framesAusMs(dauerMs)
  if (letztes) return roh
  if (roh <= LONG_ABSPANN + LONG_FPS * 2) return roh
  return roh - LONG_ABSPANN
}

export function zusammenschnittDauer(teile: ZusammenschnittTeil[]): number {
  return Math.max(1, teile.reduce((n, t, i) => n + spielFrames(t.dauerMs, i === teile.length - 1), 0))
}

export function LongZusammenschnitt(p: ZusammenschnittProps) {
  let cursor = 0
  const letztes = p.teile.length - 1
  return (
    <AbsoluteFill style={{ backgroundColor: '#0c0c0e' }}>
      {p.teile.map((teil, i) => {
        const from = cursor
        const roh = framesAusMs(teil.dauerMs)
        const dauer = spielFrames(teil.dauerMs, i === letztes)
        cursor += dauer
        return (
          <Sequence key={`${i}-${teil.dauerMs}`} from={from} durationInFrames={dauer}>
            <AbsoluteFill>
              <Video
                src={teil.src}
                trimAfter={dauer < roh ? dauer : undefined}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </AbsoluteFill>
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
