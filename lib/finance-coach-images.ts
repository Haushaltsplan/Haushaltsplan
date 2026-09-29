/** Erlaubte MIME-Typen für KI-Coach-Belegfotos (Server prüft erneut). */
export const COACH_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export type CoachImagePart = { mimeType: string; base64: string }

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.82

export const COACH_MAX_IMAGES_PER_SEND = 4

/** Kassenbon / Foto fürs Canvas; Ausgabe meist JPEG für kleinere Payloads. */
export async function compressImageFileForCoach(
  file: File,
  opts?: { maxEdge?: number; quality?: number; forceJpeg?: boolean },
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
  const forceJpeg = opts?.forceJpeg === true
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
    if (forceJpeg || file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif') {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    const mimeOut = forceJpeg || file.type !== 'image/png' || heic ? 'image/jpeg' : 'image/png'
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

/**
 * Vercel lehnt Request-Bodys > ~4,5 MB mit 413 ab. Rechnet Bilder schrittweise kleiner,
 * bis die Summe der Base64-Längen unter `maxBase64Zeichen` liegt (Standard ≈ 3,6 MB).
 */
export async function passeBilderAnUploadBudget(
  parts: CoachImagePart[],
  maxBase64Zeichen = 3_600_000,
): Promise<CoachImagePart[]> {
  const summe = (p: CoachImagePart[]) => p.reduce((n, x) => n + x.base64.length, 0)
  let aktuell = parts
  for (let runde = 0; runde < 4 && summe(aktuell) > maxBase64Zeichen; runde++) {
    const faktor = Math.sqrt(maxBase64Zeichen / summe(aktuell)) * 0.95
    const qualitaet = Math.max(0.55, 0.7 - runde * 0.05)
    aktuell = await Promise.all(
      aktuell.map(async (p) => {
        const blob = await (await fetch(coachImageDataUrl(p))).blob()
        const bitmap = await createImageBitmap(blob)
        try {
          const w = Math.max(1, Math.round(bitmap.width * Math.min(1, faktor)))
          const h = Math.max(1, Math.round(bitmap.height * Math.min(1, faktor)))
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) return p
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, w, h)
          ctx.drawImage(bitmap, 0, 0, w, h)
          const dataUrl = canvas.toDataURL('image/jpeg', qualitaet)
          const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
          return base64 ? { mimeType: 'image/jpeg', base64 } : p
        } finally {
          bitmap.close()
        }
      }),
    )
  }
  return aktuell
}

/** `res.json()` ohne Absturz bei HTML-/Text-Antworten (413, 504 von Vercel). */
export async function leseJsonAntwort<T extends { error?: string }>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    const error =
      res.status === 413
        ? 'Fotos zu groß für den Upload (413). Bitte weniger oder kleinere Fotos wählen.'
        : res.status === 504
          ? 'Zeitüberschreitung beim Server (504). Bitte erneut versuchen.'
          : `Serverfehler ${res.status}: ${text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)}`
    return { error } as T
  }
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
