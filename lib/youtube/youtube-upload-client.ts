/** Lädt das fertige MP4-Blob in Chunks direkt zu Google (nicht über Vercel). */

const CHUNK = 5 * 1024 * 1024

export async function ladeMp4ZuYoutube(
  uploadUrl: string,
  blob: Blob,
  onProgress?: (prozent: number) => void,
): Promise<string> {
  const gesamt = blob.size
  let start = 0
  let videoId = ''
  while (start < gesamt) {
    const ende = Math.min(start + CHUNK, gesamt)
    const teil = blob.slice(start, ende)
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(teil.size),
        'Content-Range': `bytes ${start}-${ende - 1}/${gesamt}`,
      },
      body: teil,
    })
    if (res.status === 308) {
      start = ende
      onProgress?.(Math.round((start / gesamt) * 100))
      continue
    }
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`YouTube-Upload ${res.status}: ${text.slice(0, 200)}`)
    }
    const j = (await res.json()) as { id?: string }
    if (!j.id) throw new Error('YouTube lieferte keine Video-ID.')
    videoId = j.id
    onProgress?.(100)
    break
  }
  if (!videoId) throw new Error('Upload unvollständig.')
  return videoId
}

export function youtubeShortsUrl(videoId: string): string {
  return `https://www.youtube.com/shorts/${videoId}`
}
