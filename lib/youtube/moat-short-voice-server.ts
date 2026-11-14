/** ElevenLabs TTS mit Zeichen-Zeiten — eigener Key, nicht Gemini. */
import 'server-only'

import {
  moatShortSprechtext,
  regieFuerElevenLabs,
  tempoAusRegler,
  woerterAusZeichen,
  type ShortSprechzeile,
  type StimmeRegie,
} from '@/lib/youtube/moat-short-voice'
import type { MoatShortVoiceWort } from '@/remotion/moat-short-types'

const TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech'
/** Englisch erzwingen, damit der Aligner „Sheer“ nicht als „Schiere“ zurückgibt. */
const STIMME_SPRACHE = 'en'

async function elevenLabsSprechen(
  key: string,
  voice: string,
  text: string,
  modell: string,
  voice_settings: { stability: number; similarity_boost: number; style?: number; speed: number },
): Promise<Response> {
  const kopf = {
    'xi-api-key': key,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  const basis = { text, model_id: modell, voice_settings }
  const url = `${TTS_URL}/${encodeURIComponent(voice)}/with-timestamps`
  const post = (body: Record<string, unknown>) =>
    fetch(url, {
      method: 'POST',
      headers: kopf,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    })
  try {
    const mitSprache = await post({ ...basis, language_code: STIMME_SPRACHE })
    if (mitSprache.ok) return mitSprache
    await mitSprache.text().catch(() => '')
  } catch {
    /* Sprachzwang abgelehnt — der Aufruf ohne language_code spricht trotzdem. */
  }
  return post(basis)
}
/** ElevenLabs speed: 0,7–1,2. 1,15 zieht Moat-Shorts in das 30–35-Sekunden-Fenster. */
export const MOAT_STIMME_SPEED = 1.15

export function elevenLabsKonfiguriert(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim() && process.env.ELEVENLABS_VOICE_ID?.trim())
}

export async function erzeugeMoatShortStimme(
  zeilen: ShortSprechzeile[],
  speed = 1,
  opts?: {
    regie?: boolean
    stimme?: { stability: number; similarity: number; style: number }
    regieWerte?: StimmeRegie
  },
): Promise<{
  audioBase64: string
  woerter: MoatShortVoiceWort[]
}> {
  const key = process.env.ELEVENLABS_API_KEY?.trim()
  const voice = process.env.ELEVENLABS_VOICE_ID?.trim()
  if (!key || !voice) throw new Error('ELEVENLABS_API_KEY oder ELEVENLABS_VOICE_ID fehlt.')
  const text = moatShortSprechtext(opts?.regie ? regieFuerElevenLabs(zeilen, opts.regieWerte) : zeilen)
  if (text.length < 8) throw new Error('Kein Sprechtext.')
  if (text.length > 4000) throw new Error('Sprechtext ist zu lang für einen Short.')
  const tempo = tempoAusRegler(speed, speed)
  const klemme = (v: number | undefined, fallback: number) => {
    if (v == null || !Number.isFinite(v)) return fallback
    return Math.min(1, Math.max(0, v))
  }
  const gewaehlt = opts?.stimme
  const voice_settings = opts?.regie
    ? {
        stability: klemme(gewaehlt?.stability, 0.4),
        similarity_boost: klemme(gewaehlt?.similarity, 0.8),
        style: klemme(gewaehlt?.style, 0.2),
        speed: tempo,
      }
    : { stability: 0.42, similarity_boost: 0.78, speed: tempo }

  const modell = process.env.ELEVENLABS_MODEL_ID?.trim() || 'eleven_multilingual_v2'
  const res = await elevenLabsSprechen(key, voice, text, modell, voice_settings)
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
