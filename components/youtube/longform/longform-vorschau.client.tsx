'use client'

import { Player } from '@remotion/player'
import { useMemo } from 'react'
import { AktienAnalyse } from '@/remotion/longform/AktienAnalyse'
import { berechneLongTimeline } from '@/remotion/longform/long-timeline'
import { LONG_FPS, LONG_HEIGHT, LONG_WIDTH, type AktienAnalyseProps } from '@/remotion/longform/long-types'

export default function LongformVorschau({ props }: { props: AktienAnalyseProps }) {
  const t = useMemo(() => berechneLongTimeline(props), [props])
  const sek = t.durationInFrames / LONG_FPS
  const ohneStimme = props.saetze.filter((s) => !s.audioUrl).length
  return (
    <div>
      <Player
        component={AktienAnalyse}
        inputProps={props}
        durationInFrames={t.durationInFrames}
        fps={LONG_FPS}
        compositionWidth={LONG_WIDTH}
        compositionHeight={LONG_HEIGHT}
        controls
        clickToPlay
        initiallyMuted={false}
        showVolumeControls
        numberOfSharedAudioTags={40}
        style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 14, overflow: 'hidden' }}
      />
      <p className="mt-2 text-xs text-[var(--app-text-muted)]">
        {Math.floor(sek / 60)}:{String(Math.round(sek % 60)).padStart(2, '0')} Min.
        {ohneStimme ? ` · ${ohneStimme} Sätze ohne Stimme (Länge geschätzt)` : ' · alle Sätze vertont'}
      </p>
    </div>
  )
}
