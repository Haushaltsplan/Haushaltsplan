/** Gemeinsames ElevenLabs-Modell für Long-Form und Moat-Shorts. */

export const ELEVENLABS_MODELL_STANDARD = 'eleven_v4'

export function elevenLabsModell(): string {
  return process.env.ELEVENLABS_MODEL_ID?.trim() || ELEVENLABS_MODELL_STANDARD
}

/** v4 kennt nur Stability + Similarity (kein Style/Speed). */
export function elevenLabsIstV4Familie(modell = elevenLabsModell()): boolean {
  return /^eleven_v4/i.test(modell)
}

export function elevenLabsVoiceSettings(opts: {
  stability: number
  similarity: number
  style?: number
  speed?: number
}): Record<string, number | boolean> {
  const settings: Record<string, number | boolean> = {
    stability: opts.stability,
    similarity_boost: opts.similarity,
  }
  if (!elevenLabsIstV4Familie()) {
    if (opts.style != null) settings.style = opts.style
    if (opts.speed != null) settings.speed = opts.speed
    settings.use_speaker_boost = true
  }
  return settings
}
