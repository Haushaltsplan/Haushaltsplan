import 'server-only'

import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { GoogleGenAI, Modality } from '@google/genai'

/**
 * Nur dieses Bild. Script, Stimme und VidIQ bleiben auf GEMINI_API_KEY_FREE.
 * generateImages (Imagen 3) läuft auf diesem Schlüssel nicht: das ist nur Vertex.
 * Dasselbe Billing-Konto erzeugt das Standbild über das Gemini-Bildmodell.
 */
const BILD_MODELLE = ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-2.5-flash-image']
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

async function brauchbareDatei(datei: string): Promise<boolean> {
  try {
    const info = await stat(datei)
    return info.size > 1000
  } catch {
    return false
  }
}

async function bildErzeugen(ai: GoogleGenAI, prompt: string): Promise<{ bytes: Buffer; ext: 'jpg' | 'png' }> {
  let letzter = 'Kein Bildmodell hat geantwortet.'
  for (const model of BILD_MODELLE) {
    try {
      const antwort = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: [Modality.IMAGE],
          imageConfig: { aspectRatio: '9:16', imageSize: '2K' },
        },
      })
      const parts = antwort.candidates?.[0]?.content?.parts ?? []
      const inline = parts.find((teil) => teil.inlineData?.data)?.inlineData
      if (!inline?.data) {
        const text = parts.map((teil) => teil.text).filter(Boolean).join(' ')
        letzter = text || `${model} lieferte kein Bild.`
        continue
      }
      const png = (inline.mimeType || '').includes('png')
      return { bytes: Buffer.from(inline.data, 'base64'), ext: png ? 'png' : 'jpg' }
    } catch (fehler) {
      letzter = fehler instanceof Error ? fehler.message : String(fehler)
    }
  }
  throw new Error(letzter)
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
 * Liegt eine brauchbare Datei schon, kostet der nächste Lauf nichts. Veo nur bei USE_VEO=true.
 */
export async function fetchHookVideo(prompt: string, ticker: string): Promise<string> {
  const text = prompt.replace(/\s+/g, ' ').trim()
  if (text.length < 12) throw new Error('Die Bildbeschreibung für den Hook ist zu kurz.')
  const name = tickerSicher(ticker)
  const ordner = path.join(process.cwd(), 'public', 'hooks')
  await mkdir(ordner, { recursive: true })
  if (veoGewuenscht()) {
    const mp4 = path.join(ordner, `${name}-hook.mp4`)
    if (await brauchbareDatei(mp4)) return `/hooks/${name}-hook.mp4`
    const ai = new GoogleGenAI({ apiKey: billingKey() })
    await veo(ai, text, mp4)
    return `/hooks/${name}-hook.mp4`
  }
  for (const ext of ['jpg', 'png'] as const) {
    if (await brauchbareDatei(path.join(ordner, `${name}-hook.${ext}`))) return `/hooks/${name}-hook.${ext}`
  }
  const ai = new GoogleGenAI({ apiKey: billingKey() })
  const bild = await bildErzeugen(ai, text)
  await writeFile(path.join(ordner, `${name}-hook.${bild.ext}`), bild.bytes)
  return `/hooks/${name}-hook.${bild.ext}`
}
