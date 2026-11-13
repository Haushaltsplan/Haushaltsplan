import 'server-only'

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { GoogleGenAI, Modality } from '@google/genai'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

/** Öffentlicher Speicher. Auf Vercel gibt es kein beschreibbares public/. */
const HOOK_BUCKET = 'youtube-hooks'

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

function hookQuelle(name: string, art: 'bild' | 'video' = 'bild'): string {
  return `/api/youtube/hook-bild?ticker=${encodeURIComponent(name)}&art=${art}`
}

function lokalPfad(name: string, ext: string): string {
  return path.join(process.cwd(), 'public', 'hooks', `${name}-hook.${ext}`)
}

async function lokalSchreiben(name: string, ext: string, bytes: Buffer): Promise<boolean> {
  if (process.env.VERCEL) return false
  try {
    const datei = lokalPfad(name, ext)
    await mkdir(path.dirname(datei), { recursive: true })
    await writeFile(datei, bytes)
    return true
  } catch {
    return false
  }
}

async function cloudBereit(): Promise<ReturnType<typeof createSupabaseAdmin>> {
  const admin = createSupabaseAdmin()
  const { data } = await admin.storage.listBuckets()
  if (!data?.some((bucket) => bucket.name === HOOK_BUCKET)) {
    const { error } = await admin.storage.createBucket(HOOK_BUCKET, { public: true })
    if (error && !/already exists|duplicate/i.test(error.message)) {
      throw new Error(`Hook-Speicher: ${error.message}`)
    }
  }
  return admin
}

async function liegtInCloud(name: string, ext: string): Promise<boolean> {
  try {
    const admin = createSupabaseAdmin()
    const datei = `${name}-hook.${ext}`
    const { data, error } = await admin.storage.from(HOOK_BUCKET).list('', { search: datei, limit: 20 })
    if (error || !data) return false
    return data.some((eintrag) => eintrag.name === datei)
  } catch {
    return false
  }
}

async function inCloudSchreiben(name: string, ext: string, bytes: Buffer): Promise<void> {
  const admin = await cloudBereit()
  const mime = ext === 'png' ? 'image/png' : ext === 'mp4' ? 'video/mp4' : 'image/jpeg'
  const { error } = await admin.storage.from(HOOK_BUCKET).upload(`${name}-hook.${ext}`, new Uint8Array(bytes), {
    contentType: mime,
    upsert: true,
  })
  if (error) throw new Error(`Hook-Speicher: ${error.message}`)
}

/** Liest das gespeicherte Hook-Bild. Zuerst lokal, dann die Cloud. */
export async function hookBildLesen(ticker: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const name = tickerSicher(ticker)
  for (const ext of ['jpg', 'png', 'mp4'] as const) {
    const datei = lokalPfad(name, ext)
    if (await brauchbareDatei(datei)) {
      const mime = ext === 'png' ? 'image/png' : ext === 'mp4' ? 'video/mp4' : 'image/jpeg'
      return { bytes: await readFile(datei), mime }
    }
  }
  try {
    const admin = createSupabaseAdmin()
    for (const ext of ['jpg', 'png', 'mp4'] as const) {
      const { data, error } = await admin.storage.from(HOOK_BUCKET).download(`${name}-hook.${ext}`)
      if (error || !data) continue
      const mime = ext === 'png' ? 'image/png' : ext === 'mp4' ? 'video/mp4' : 'image/jpeg'
      return { bytes: Buffer.from(await data.arrayBuffer()), mime }
    }
  } catch {
    return null
  }
  return null
}

/**
 * Hochformat-Standbild für die ersten fünf Sekunden.
 * Liegt eine brauchbare Datei schon, kostet der nächste Lauf nichts. Veo nur bei USE_VEO=true.
 * Auf Vercel liegt die Datei im Supabase-Speicher, nicht unter public/.
 */
export async function fetchHookVideo(prompt: string, ticker: string): Promise<string> {
  const text = prompt.replace(/\s+/g, ' ').trim()
  if (text.length < 12) throw new Error('Die Bildbeschreibung für den Hook ist zu kurz.')
  const name = tickerSicher(ticker)
  const endungen = veoGewuenscht() ? (['mp4'] as const) : (['jpg', 'png'] as const)
  for (const ext of endungen) {
    if (await brauchbareDatei(lokalPfad(name, ext))) return hookQuelle(name, ext === 'mp4' ? 'video' : 'bild')
    if (await liegtInCloud(name, ext)) return hookQuelle(name, ext === 'mp4' ? 'video' : 'bild')
  }
  const ai = new GoogleGenAI({ apiKey: billingKey() })
  if (veoGewuenscht()) {
    const ziel = path.join(tmpdir(), `${name}-hook.mp4`)
    await veo(ai, text, ziel)
    const fertig = await readFile(ziel)
    const lokal = await lokalSchreiben(name, 'mp4', fertig)
    if (!lokal) await inCloudSchreiben(name, 'mp4', fertig)
    return hookQuelle(name, 'video')
  }
  const bild = await bildErzeugen(ai, text)
  const lokal = await lokalSchreiben(name, bild.ext, bild.bytes)
  if (!lokal) await inCloudSchreiben(name, bild.ext, bild.bytes)
  return hookQuelle(name)
}
