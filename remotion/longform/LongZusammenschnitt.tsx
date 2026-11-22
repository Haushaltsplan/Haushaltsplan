/** Schlussfilm aus den hochgeladenen Kapitel-MP4s. Nichts wird neu gesprochen oder darübergelegt. */
import { Video } from '@remotion/media'
import { AbsoluteFill, Sequence } from 'remotion'
import { LONG_FPS } from './long-types'

export type ZusammenschnittTeil = { src: string; dauerMs: number }

export type ZusammenschnittProps = {
  teile: ZusammenschnittTeil[]
}

export function framesAusMs(ms: number): number {
  return Math.max(1, Math.round((ms / 1000) * LONG_FPS))
}

export function zusammenschnittDauer(teile: ZusammenschnittTeil[]): number {
  return Math.max(1, teile.reduce((n, t) => n + framesAusMs(t.dauerMs), 0))
}

export function LongZusammenschnitt(p: ZusammenschnittProps) {
  let cursor = 0
  return (
    <AbsoluteFill style={{ backgroundColor: '#0c0c0e' }}>
      {p.teile.map((teil, i) => {
        const from = cursor
        const dauer = framesAusMs(teil.dauerMs)
        cursor += dauer
        return (
          <Sequence key={`${i}-${teil.dauerMs}`} from={from} durationInFrames={dauer}>
            <AbsoluteFill>
              <Video src={teil.src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </AbsoluteFill>
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
