/** Spoken lines für Earnings Check — gleiche Wortzeiten-Logik wie Moat. */

import { sprechzeilenMitZeiten, woerterAusZeichen } from '@/lib/youtube/moat-short-voice'
import type { EarningsShortBeatId, EarningsShortProps, EarningsShortVoiceWort } from '@/remotion/earnings-short-types'

export type EarningsShortSprechzeile = { id: Exclude<EarningsShortBeatId, 'loop'>; text: string }

export function earningsShortSprechzeilen(
  props: Pick<EarningsShortProps, 'hook' | 'numbers' | 'call0' | 'call1' | 'filing' | 'takeaway'>,
): EarningsShortSprechzeile[] {
  const zeilen: EarningsShortSprechzeile[] = [
    { id: 'hook', text: props.hook },
    { id: 'numbers', text: props.numbers },
    { id: 'call0', text: props.call0 },
    { id: 'call1', text: props.call1 },
    { id: 'filing', text: props.filing },
    { id: 'takeaway', text: props.takeaway },
  ]
  return zeilen.filter((z) => z.text.trim())
}

export function earningsShortSprechtext(zeilen: EarningsShortSprechzeile[]): string {
  return zeilen.map((z) => z.text.trim()).join('\n')
}

export function earningsShortSprechFingerprint(
  props: Pick<EarningsShortProps, 'hook' | 'numbers' | 'call0' | 'call1' | 'filing' | 'takeaway'>,
): string {
  return earningsShortSprechtext(earningsShortSprechzeilen(props))
}

export function earningsShortZeilenMitZeiten(
  zeilen: EarningsShortSprechzeile[],
  woerter: EarningsShortVoiceWort[],
) {
  return sprechzeilenMitZeiten(zeilen, woerter)
}

export { woerterAusZeichen }
