/** ElevenLabs TTS mit Zeichen-Zeiten — eigener Key, nicht Gemini. */
import 'server-only'

import { moatShortSprechtext, regieFuerElevenLabs, woerterAusZeichen, type ShortSprechzeile } from '@/lib/youtube/moat-short-voice'
import type { MoatShortVoiceWort } from '@/remotion/moat-short-types'

const TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
/** ElevenLabs speed: 0,7–1,2. 1,15 zieht Moat-Shorts in das 30–35-Sekunden-Fenster. */
export const MOAT_STIMME_SPEED = 1.15

export function elevenLabsKonfiguriert(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim() && process.env.ELEVENLABS_VOICE_ID?.trim())
}

export async function erzeugeMoatShortStimme(
  zeilen: ShortSprechzeile[],
  speed = 1,
  opts?: { regie?: boolean },
): Promise<{
  audioBase64: string
  woerter: MoatShortVoiceWort[]
}> {
  const key = process.env.ELEVENLABS_API_KEY?.trim()
  const voice = process.env.ELEVENLABS_VOICE_ID?.trim()
  if (!key || !voice) throw new Error('ELEVENLABS_API_KEY oder ELEVENLABS_VOICE_ID fehlt.')
  const text = moatShortSprechtext(opts?.regie ? regieFuerElevenLabs(zeilen) : zeilen)
  if (text.length < 8) throw new Error('Kein Sprechtext.')
  if (text.length > 4000) throw new Error('Sprechtext ist zu lang für einen Short.')
  const tempo = Math.min(1.2, Math.max(0.7, speed))
  // Moat: Stability 0,40, Similarity 0,80, Style 0,20. Earnings bleibt bei der bisherigen Lage.
  const voice_settings = opts?.regie
    ? { stability: 0.4, similarity_boost: 0.8, style: 0.2, speed: tempo }
    : { stability: 0.42, similarity_boost: 0.78, speed: tempo }

  const res = await fetch(`${TTS_URL}/${encodeURIComponent(voice)}/with-timestamps`, {
    method: 'POST',
    headers: {
      'xi-api-key': key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID?.trim() || 'eleven_multilingual_v2',
      voice_settings,
    }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) {
    const roh = await res.text()
    throw new Error(`ElevenLabs ${res.status}: ${roh.slice(0, 220)}`)
  }
  const j = (await res.json()) as {
    audio_base64?: string
    alignment?: { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] }
    normalized_alignment?: { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] }
  }
  const audio = j.audio_base64?.trim()
  if (!audio) throw new Error('ElevenLabs lieferte kein Audio.')
  const a = j.alignment?.characters?.length ? j.alignment : j.normalized_alignment
  const woerter = woerterAusZeichen(
    a?.characters ?? [],
    a?.character_start_times_seconds ?? [],
    a?.character_end_times_seconds ?? [],
  )
  if (woerter.length < 4) throw new Error('ElevenLabs lieferte keine brauchbaren Wortzeiten.')
  return { audioBase64: audio, woerter }
}
