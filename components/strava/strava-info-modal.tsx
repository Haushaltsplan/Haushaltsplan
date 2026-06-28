'use client'

import { WhoopInfoModal } from '@/components/fitnessdaten/whoop-info-modal'

export type StravaInfoModalState = { title: string; body: string } | null

export function StravaInfoModal({
  state,
  onClose,
}: {
  state: StravaInfoModalState
  onClose: () => void
}) {
  if (!state) return null
  return <WhoopInfoModal info={{ title: state.title, body: state.body }} onClose={onClose} />
}

export function stravaInfo(title: string, body: string): StravaInfoModalState {
  return { title, body }
}
