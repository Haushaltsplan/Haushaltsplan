'use client'

import { Player } from '@remotion/player'
import { useMemo } from 'react'
import { EarningsShort } from '@/remotion/EarningsShort'
import { berechneEarningsShortTimeline } from '@/remotion/earnings-short-timeline'
import {
  EARNINGS_SHORT_FPS,
  EARNINGS_SHORT_HEIGHT,
  EARNINGS_SHORT_WIDTH,
  type EarningsShortProps,
} from '@/remotion/earnings-short-types'

export default function EarningsShortPreview({ props, restartKey }: { props: EarningsShortProps; restartKey?: number }) {
  const dauer = useMemo(() => berechneEarningsShortTimeline(props).durationInFrames, [props])
  const sekunden = dauer / EARNINGS_SHORT_FPS
  return (
    <div>
      <Player
        key={`${props.musicSrc ?? 'still'}-${props.voiceSrc ?? 'novoice'}-${props.sfx ? 'sfx' : 'nosfx'}-${restartKey ?? 0}`}
        component={EarningsShort}
        inputProps={props}
        durationInFrames={dauer}
        fps={EARNINGS_SHORT_FPS}
        compositionWidth={EARNINGS_SHORT_WIDTH}
        compositionHeight={EARNINGS_SHORT_HEIGHT}
        controls
        loop
        clickToPlay
        initiallyMuted={false}
        initialVolume={1}
        showVolumeControls
        numberOfSharedAudioTags={10}
        style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 18, overflow: 'hidden' }}
      />
      <p className="mt-2 text-center text-xs text-[var(--app-text-muted)]">
        {sekunden.toFixed(1)} Sekunden · letzter Frame = erster Frame · Play loopt wie YouTube
      </p>
    </div>
  )
}
