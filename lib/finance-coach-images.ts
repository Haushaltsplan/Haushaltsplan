/** Erlaubte MIME-Typen für KI-Coach-Belegfotos (Server prüft erneut). */
export const COACH_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export type CoachImagePart = { mimeType: string; base64: string }

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.82

export const COACH_MAX_IMAGES_PER_SEND = 4
/** Person- + Kleidungsfotos in einer Modeberater-Anfrage. */
export const MODEBERATER_MAX_PERSON_FOTOS = 4
export const MODEBERATER_MAX_KLEIDUNG_FOTOS = 4

/** Kassenbon / Foto fürs Canvas; Ausgabe meist JPEG für kleinere Payloads. */
export async function compressImageFileForCoach(
  file: File,
  opts?: { maxEdge?: number; quality?: number },
): Promise<CoachImagePart> {
  const t = (file.type || '').toLowerCase()
  const heic = t === 'image/heic' || t === 'image/heif' || /\.hei[cf]$/i.test(file.name)
  if (t && !t.startsWith('image/') && !heic) {
    throw new Error('Nur Bilddateien sind erlaubt.')
  }
  if (t && !heic && !COACH_IMAGE_MIME.has(t) && t.startsWith('image/')) {
    throw new Error('Nur JPEG, PNG, WebP, GIF — oder Kamera-Aufnahme.')
  }
  const maxEdge = opts?.maxEdge ?? MAX_EDGE
  const jpegQuality = opts?.quality ?? JPEG_QUALITY
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(
      heic
        ? 'HEIC wird in diesem Browser nicht gelesen. Am iPhone die Kamera hier nutzen oder das Foto als JPEG teilen.'
        : 'Bild konnte nicht gelesen werden (Format?).',
    )
  })
  try {
    const maxSide = Math.max(bitmap.width, bitmap.height)
    const scale = maxSide > maxEdge ? maxEdge / maxSide : 1
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas nicht verfügbar.')
    if (file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif') {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    const mimeOut = file.type === 'image/png' && !heic ? 'image/png' : 'image/jpeg'
    const dataUrl = canvas.toDataURL(mimeOut, mimeOut === 'image/jpeg' ? jpegQuality : undefined)
    const comma = dataUrl.indexOf(',')
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : ''
    if (!base64) throw new Error('Bildkompression lieferte keine Daten.')
    return { mimeType: mimeOut, base64 }
  } finally {
    bitmap.close()
  }
}

export function coachImageDataUrl(part: CoachImagePart): string {
  return `data:${part.mimeType};base64,${part.base64}`
}

export type CompressImageUploadOpts = {
  /** Längere Kante max. in px (Standard: 1024 — kleinere Requests, z. B. Vercel-Payload-Limit). */
  maxEdge?: number
  /** JPEG-Qualität 0–1 (Standard: 0.72). */
  quality?: number
}

/**
 * Für FormData-Uploads: Dekodiert im Browser, skaliert, liefert ein **JPEG-File**.
 * Reduziert 413 „Request entity too large“ (Serverless-Payload-Limits).
 */
export async function compressImageFileToJpegUpload(
  file: File,
  opts?: CompressImageUploadOpts,
): Promise<File> {
  const maxEdge = opts?.maxEdge ?? 1024
  const quality = opts?.quality ?? 0.72
  const t = (file.type || '').toLowerCase()
  const extOk = /\.(heic|heif|jpe?g|png|gif|webp)$/i.test(file.name)
  if (!t.startsWith('image/') && !extOk) {
    throw new Error('Nur Bilddateien sind erlaubt.')
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(
      'Bild konnte nicht gelesen werden (Format?). Tipp: HEIC wird nicht überall unterstützt — in der Galerie als JPEG speichern oder „Kompatibel“ am iPhone.',
    )
  })
  try {
    const maxSide = Math.max(bitmap.width, bitmap.height)
    const scale = maxSide > maxEdge ? maxEdge / maxSide : 1
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas nicht verfügbar.')
    if (t === 'image/png' || t === 'image/webp' || t === 'image/gif') {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
    }
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('JPEG-Kompression lieferte keine Daten.'))),
        'image/jpeg',
        quality,
      )
    })

    const base = file.name
      .replace(/\.[^.\\/]+$/, '')
      .replace(/[^\w\-äöüÄÖÜß]+/gi, '_')
      .slice(0, 60)
    return new File([blob], `${base || 'foto'}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } finally {
    bitmap.close()
  }
}
