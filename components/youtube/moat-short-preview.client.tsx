'use client'

import { Player } from '@remotion/player'
import { useMemo } from 'react'
import { MoatShort } from '@/remotion/MoatShort'
import { berechneMoatShortTimeline } from '@/remotion/moat-short-timeline'
import { MOAT_SHORT_FPS, MOAT_SHORT_HEIGHT, MOAT_SHORT_WIDTH, type MoatShortProps } from '@/remotion/moat-short-types'

export default function MoatShortPreview({ props }: { props: MoatShortProps }) {
  const dauer = useMemo(() => berechneMoatShortTimeline(props).durationInFrames, [props])
  return (
    <div>
      <Player
        component={MoatShort}
        inputProps={props}
        durationInFrames={dauer}
        fps={MOAT_SHORT_FPS}
        compositionWidth={MOAT_SHORT_WIDTH}
        compositionHeight={MOAT_SHORT_HEIGHT}
        controls
        loop
        style={{ width: '100%', aspectRatio: '9 / 16', borderRadius: 18, overflow: 'hidden' }}
      />
      <p className="mt-2 text-center text-xs text-[var(--app-text-muted)]">
        {(dauer / MOAT_SHORT_FPS).toFixed(1)} Sekunden · Timing geschätzt (noch ohne Stimme)
      </p>
    </div>
  )
}
