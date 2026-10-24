'use client'

import { Player } from '@remotion/player'
import { useMemo } from 'react'
import { MoatShort } from '@/remotion/MoatShort'
import { berechneMoatShortTimeline } from '@/remotion/moat-short-timeline'
import { MOAT_SHORT_FPS, MOAT_SHORT_HEIGHT, MOAT_SHORT_WIDTH, type MoatShortProps } from '@/remotion/moat-short-types'

function musikHref(src: string | null): string | null {
  if (!src) return null
  if (/^https?:\/\//i.test(src) || src.startsWith('/api/')) return src
  const datei = src.split('/').pop()
  return datei ? `/api/youtube/musik/datei/${encodeURIComponent(datei)}` : null
}

export default function MoatShortPreview({ props }: { props: MoatShortProps }) {
  const dauer = useMemo(() => berechneMoatShortTimeline(props).durationInFrames, [props])
  const href = musikHref(props.musicSrc)
  return (
    <div>
      <Player
        key={`${props.musicSrc ?? 'still'}-${props.sfx ? 'sfx' : 'nosfx'}`}
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
        {(dauer / MOAT_SHORT_FPS).toFixed(1)} Sekunden · Play im Video oder hier unten die Musikleiste.
      </p>
      {href ? <audio className="mt-2 w-full" controls preload="auto" src={href} /> : null}
    </div>
  )
}
