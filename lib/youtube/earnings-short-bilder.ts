/** Estimate-Screenshots für Earnings Check — client- und serverseitig. */

export const EARNINGS_SHORT_MAX_BILDER = 3
const ERLAUBT = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_KANTE = 1400
const JPEG_QUALITAET = 0.82

export type EarningsShortBild = { mimeType: string; base64: string; dataUrl: string }

export function dataUrlZuBild(dataUrl: string): EarningsShortBild | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl.trim())
  if (!m) return null
  return { mimeType: m[1]!, base64: m[2]!, dataUrl: `data:${m[1]};base64,${m[2]}` }
}

function leseDateiAlsDataUrl(datei: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => (typeof r.result === 'string' ? resolve(r.result) : reject(new Error('Lesen fehlgeschlagen.')))
    r.onerror = () => reject(new Error('Datei unlesbar.'))
    r.readAsDataURL(datei)
  })
}

function ladeBild(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Bild kaputt.'))
    img.src = src
  })
}

/** Komprimiert ein Screenshot, damit Gemini und der Player nicht an der Größe scheitern. */
export async function dateiZuEstimateBild(datei: File): Promise<EarningsShortBild> {
  const typ = datei.type.toLowerCase()
  if (!ERLAUBT.has(typ)) throw new Error('Nur JPG, PNG oder WebP.')
  const roh = await leseDateiAlsDataUrl(datei)
  const img = await ladeBild(roh)
  const scale = Math.min(1, MAX_KANTE / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas fehlt.')
  ctx.drawImage(img, 0, 0, w, h)
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITAET)
  const bild = dataUrlZuBild(dataUrl)
  if (!bild) throw new Error('Komprimieren fehlgeschlagen.')
  return bild
}

export function bilderAusJson(v: unknown): EarningsShortBild[] {
  if (!Array.isArray(v)) return []
  const out: EarningsShortBild[] = []
  for (const x of v) {
    if (typeof x === 'string') {
      const b = dataUrlZuBild(x)
      if (b) out.push(b)
      continue
    }
    if (!x || typeof x !== 'object') continue
    const o = x as { mimeType?: unknown; base64?: unknown; dataUrl?: unknown }
    if (typeof o.dataUrl === 'string') {
      const b = dataUrlZuBild(o.dataUrl)
      if (b) out.push(b)
      continue
    }
    const mime = typeof o.mimeType === 'string' && ERLAUBT.has(o.mimeType) ? o.mimeType : null
    const base64 = typeof o.base64 === 'string' && o.base64.length > 80 ? o.base64.replace(/\s+/g, '') : null
    if (mime && base64) out.push({ mimeType: mime, base64, dataUrl: `data:${mime};base64,${base64}` })
    if (out.length >= EARNINGS_SHORT_MAX_BILDER) break
  }
  return out.slice(0, EARNINGS_SHORT_MAX_BILDER)
}
