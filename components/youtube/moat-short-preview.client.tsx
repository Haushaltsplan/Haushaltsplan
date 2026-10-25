'use client'

import { Player } from '@remotion/player'
import { useMemo } from 'react'
import { MoatShort } from '@/remotion/MoatShort'
import { berechneMoatShortTimeline } from '@/remotion/moat-short-timeline'
import { MOAT_SHORT_FPS, MOAT_SHORT_HEIGHT, MOAT_SHORT_WIDTH, type MoatShortProps } from '@/remotion/moat-short-types'

export default function MoatShortPreview({ props, restartKey }: { props: MoatShortProps; restartKey?: number }) {
  const dauer = useMemo(() => berechneMoatShortTimeline(props).durationInFrames, [props])
  const sekunden = dauer / MOAT_SHORT_FPS
  return (
    <div>
      <Player
        key={`${props.musicSrc ?? 'still'}-${props.voiceSrc ?? 'novoice'}-${props.sfx ? 'sfx' : 'nosfx'}-${restartKey ?? 0}`}
        component={MoatShort}
        inputProps={props}
        durationInFrames={dauer}
        fps={MOAT_SHORT_FPS}
        compositionWidth={MOAT_SHORT_WIDTH}
        compositionHeight={MOAT_SHORT_HEIGHT}
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
