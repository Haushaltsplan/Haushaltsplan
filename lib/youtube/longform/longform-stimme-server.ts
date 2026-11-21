/**
 * Ein ElevenLabs-Aufruf pro Satz. previous_text/next_text halten die Betonung über Satzgrenzen stimmig,
 * deshalb lässt sich jeder Satz einzeln neu erzeugen, ohne dass er im Video fremd klingt.
 */
import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { elevenLabsModell, elevenLabsVoiceSettings } from '@/lib/youtube/elevenlabs-modell'
import { woerterAusZeichen } from '@/lib/youtube/moat-short-voice'
import { ladeHoch, projektPfad } from '@/lib/youtube/longform/longform-db-server'
import type { LongformStimmeEinstellungen, LongformTake } from '@/lib/youtube/longform/longform-types'

const TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech'

function klemme(v: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
}

export function normiereEinstellungen(e: Partial<LongformStimmeEinstellungen> | null | undefined, basis: LongformStimmeEinstellungen): LongformStimmeEinstellungen {
  return {
    stability: klemme(Number(e?.stability), 0, 1, basis.stability),
    similarity: klemme(Number(e?.similarity), 0, 1, basis.similarity),
    style: klemme(Number(e?.style), 0, 1, basis.style),
    speed: klemme(Number(e?.speed), 0.7, 1.2, basis.speed),
  }
}

export function stimmeFingerprint(text: string, e: LongformStimmeEinstellungen, kontext: { vorher: string; nachher: string }): string {
  return createHash('sha1')
    .update(JSON.stringify([text.trim(), e, kontext.vorher.slice(-200), kontext.nachher.slice(0, 200), elevenLabsModell(), process.env.ELEVENLABS_VOICE_ID ?? '']))
    .digest('hex')
    .slice(0, 16)
}

export async function sprichSatz(opts: {
  projektId: string
  satzId: string
  text: string
  vorher: string
  nachher: string
  einstellungen: LongformStimmeEinstellungen
}): Promise<LongformTake> {
  const key = process.env.ELEVENLABS_API_KEY?.trim()
  const voice = process.env.ELEVENLABS_VOICE_ID?.trim()
  if (!key || !voice) throw new Error('ELEVENLABS_API_KEY oder ELEVENLABS_VOICE_ID fehlt.')
  const text = opts.text.trim()
  if (text.length < 2) throw new Error('Leerer Satz.')

  const body: Record<string, unknown> = {
    text,
    model_id: elevenLabsModell(),
    voice_settings: elevenLabsVoiceSettings({
      stability: opts.einstellungen.stability,
      similarity: opts.einstellungen.similarity,
      style: opts.einstellungen.style,
      speed: opts.einstellungen.speed,
    }),
    language_code: 'en',
  }
  if (opts.vorher.trim()) body.previous_text = opts.vorher.trim().slice(-600)
  if (opts.nachher.trim()) body.next_text = opts.nachher.trim().slice(0, 600)

  const url = `${TTS_URL}/${encodeURIComponent(voice)}/with-timestamps?output_format=mp3_44100_192`
  const kopf = { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' }
  let res = await fetch(url, { method: 'POST', headers: kopf, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) })
  if (!res.ok && res.status === 400) {
    // Fallback: ohne language_code / mit 128 kbps (manche Modelle/Plan-Kombi).
    delete body.language_code
    res = await fetch(url.replace('mp3_44100_192', 'mp3_44100_128'), { method: 'POST', headers: kopf, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) })
  }
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 220)}`)
  const j = (await res.json()) as {
    audio_base64?: string
    alignment?: { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] }
    normalized_alignment?: { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] }
  }
  if (!j.audio_base64) throw new Error('ElevenLabs lieferte kein Audio.')
  const a = j.alignment?.characters?.length ? j.alignment : j.normalized_alignment
  const ends = a?.character_end_times_seconds ?? []
  const woerter = woerterAusZeichen(a?.characters ?? [], a?.character_start_times_seconds ?? [], ends)
  // Nur knappes Polster — große Extra-ms erzeugen hörbare Löcher zwischen Sätzen.
  const dauerMs = Math.round((ends.length ? ends[ends.length - 1]! : 0) * 1000) + 40

  const id = randomUUID()
  const pfad = projektPfad(opts.projektId, 'stimme', `${opts.satzId}-${id}.mp3`)
  await ladeHoch(pfad, Buffer.from(j.audio_base64, 'base64'), 'audio/mpeg')
  return {
    id,
    pfad,
    dauerMs,
    woerter,
    fp: stimmeFingerprint(text, opts.einstellungen, { vorher: opts.vorher, nachher: opts.nachher }),
    erstellt: new Date().toISOString(),
  }
}
