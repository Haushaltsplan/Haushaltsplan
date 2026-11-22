/** Schlussfilm aus den hochgeladenen Kapitel-MP4s. Stimme bleibt in den Dateien, die Abo-Karte liegt nur darüber. */
import { Video } from '@remotion/media'
import { AbsoluteFill, Sequence } from 'remotion'
import { LONGFORM_KANAL_LOGO, LONGFORM_KANAL_NAME } from '../../lib/youtube/longform/longform-kanal'
import { LongAbo } from './LongAbo'
import { LONG_ABO_DAUER } from './long-timeline'
import { LONG_FPS } from './long-types'

export type ZusammenschnittTeil = { src: string; dauerMs: number }

export type ZusammenschnittProps = {
  teile: ZusammenschnittTeil[]
  aboFromMs: number | null
  aboText: string
  akzent: string
  kanalName?: string
  kanalLogoUrl?: string | null
}

export function framesAusMs(ms: number): number {
  return Math.max(1, Math.round((ms / 1000) * LONG_FPS))
}

export function zusammenschnittDauer(teile: ZusammenschnittTeil[], aboFromMs: number | null): number {
  const bild = teile.reduce((n, t) => n + framesAusMs(t.dauerMs), 0)
  if (aboFromMs == null) return Math.max(1, bild)
  const karte = Math.round((aboFromMs / 1000) * LONG_FPS) + LONG_ABO_DAUER
  return Math.max(bild, karte, 1)
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
      {p.aboFromMs != null ? (
        <Sequence from={Math.round((p.aboFromMs / 1000) * LONG_FPS)} durationInFrames={LONG_ABO_DAUER}>
          <LongAbo
            dauer={LONG_ABO_DAUER}
            text={p.aboText}
            akzent={p.akzent}
            kanalName={p.kanalName ?? LONGFORM_KANAL_NAME}
            kanalLogoUrl={p.kanalLogoUrl ?? LONGFORM_KANAL_LOGO}
          />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  )
}
