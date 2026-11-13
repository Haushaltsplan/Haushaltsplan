import 'server-only'

import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { GoogleGenAI, PersonGeneration } from '@google/genai'

/** Nur dieses Bild. Script, Stimme und VidIQ bleiben auf GEMINI_API_KEY_FREE. */
const IMAGEN_MODELL = 'imagen-3.0-generate-002'
/** Optional. Standard ist aus: ein Standbild, die Fahrt macht Remotion. */
const VEO_MODELL = 'veo-3.1-fast-generate-preview'
const VEO_SEKUNDEN = 6

function billingKey(): string {
  let key = process.env.GEMINI_API_KEY ?? ''
  key = key.replace(/^\uFEFF/, '').trim()
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim()
  }
  if (!key || key === process.env.GEMINI_API_KEY_FREE?.trim()) {
    throw new Error('GEMINI_API_KEY fehlt oder ist derselbe Schlüssel wie der Free-Key. Nur das Hook-Bild nutzt den Billing-Key.')
  }
  return key
}

function tickerSicher(ticker: string): string {
  const sicher = ticker.replace(/[^A-Za-z0-9.-]/g, '').toUpperCase()
  if (!sicher) throw new Error('Ticker fehlt, der Hook kann nicht benannt werden.')
  return sicher
}

function veoGewuenscht(): boolean {
  return process.env.USE_VEO === 'true'
}

async function liegtSchon(datei: string): Promise<boolean> {
  try {
    await access(datei)
    return true
  } catch {
    return false
  }
}

async function imagen(ai: GoogleGenAI, prompt: string, datei: string): Promise<void> {
  const antwort = await ai.models.generateImages({
    model: IMAGEN_MODELL,
    prompt,
    config: { numberOfImages: 1, aspectRatio: '9:16', personGeneration: PersonGeneration.DONT_ALLOW },
  })
  const bytes = antwort.generatedImages?.[0]?.image?.imageBytes
  if (!bytes) throw new Error('Imagen lieferte kein Bild.')
  await writeFile(datei, Buffer.from(bytes, 'base64'))
}

async function veo(ai: GoogleGenAI, prompt: string, datei: string): Promise<void> {
  let operation = await ai.models.generateVideos({
    model: VEO_MODELL,
    prompt,
    config: {
      aspectRatio: '9:16',
      resolution: '720p',
      durationSeconds: VEO_SEKUNDEN,
      numberOfVideos: 1,
      personGeneration: 'allow_adult',
      negativePrompt: 'text, letters, logos, charts, watermarks, faces, people',
    },
  })
  const start = Date.now()
  while (!operation.done) {
    if (Date.now() - start > 150_000) throw new Error('Veo hat das Zeitlimit erreicht.')
    await new Promise((r) => setTimeout(r, 5_000))
    operation = await ai.operations.getVideosOperation({ operation })
  }
  const video = operation.response?.generatedVideos?.[0]?.video
  if (!video) throw new Error(operation.response?.raiMediaFilteredReasons?.join(' ') || 'Veo lieferte keine Datei.')
  if (video.videoBytes) {
    await writeFile(datei, Buffer.from(video.videoBytes, 'base64'))
    return
  }
  await ai.files.download({ file: video, downloadPath: datei })
}

/**
 * Hochformat-Standbild für die ersten fünf Sekunden.
 * Liegt die PNG schon, kostet der nächste Lauf nichts. Veo nur bei USE_VEO=true.
 */
export async function fetchHookVideo(prompt: string, ticker: string): Promise<string> {
  const text = prompt.replace(/\s+/g, ' ').trim()
  if (text.length < 12) throw new Error('Die Bildbeschreibung für den Hook ist zu kurz.')
  const name = tickerSicher(ticker)
  const ordner = path.join(process.cwd(), 'public', 'hooks')
  await mkdir(ordner, { recursive: true })
  if (veoGewuenscht()) {
    const mp4 = path.join(ordner, `${name}-hook.mp4`)
    if (await liegtSchon(mp4)) return `/hooks/${name}-hook.mp4`
    const ai = new GoogleGenAI({ apiKey: billingKey() })
    await veo(ai, text, mp4)
    return `/hooks/${name}-hook.mp4`
  }
  const png = path.join(ordner, `${name}-hook.png`)
  if (await liegtSchon(png)) return `/hooks/${name}-hook.png`
  const ai = new GoogleGenAI({ apiKey: billingKey() })
  await imagen(ai, text, png)
  return `/hooks/${name}-hook.png`
}
