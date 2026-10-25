/** ElevenLabs TTS mit Zeichen-Zeiten — eigener Key, nicht Gemini. */
import 'server-only'

import { moatShortSprechtext, woerterAusZeichen, type ShortSprechzeile } from '@/lib/youtube/moat-short-voice'
import type { MoatShortVoiceWort } from '@/remotion/moat-short-types'

const TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech'

export function elevenLabsKonfiguriert(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim() && process.env.ELEVENLABS_VOICE_ID?.trim())
}

export async function erzeugeMoatShortStimme(zeilen: ShortSprechzeile[]): Promise<{
  audioBase64: string
  woerter: MoatShortVoiceWort[]
}> {
  const key = process.env.ELEVENLABS_API_KEY?.trim()
  const voice = process.env.ELEVENLABS_VOICE_ID?.trim()
  if (!key || !voice) throw new Error('ELEVENLABS_API_KEY oder ELEVENLABS_VOICE_ID fehlt.')
  const text = moatShortSprechtext(zeilen)
  if (text.length < 8) throw new Error('Kein Sprechtext.')
  if (text.length > 4000) throw new Error('Sprechtext ist zu lang für einen Short.')

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
      voice_settings: { stability: 0.42, similarity_boost: 0.78 },
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
