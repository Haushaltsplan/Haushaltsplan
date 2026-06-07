import { compressImageFileToJpegUpload } from '@/lib/finance-coach-images'
import { supabase } from '@/lib/supabase'

export const BESITZ_FOTO_BUCKET = 'besitz-fotos'

const SIGNED_URL_TTL_SEC = 3600

export function besitzFotoPfad(userId: string, gegenstandId: string): string {
  return `${userId}/${gegenstandId}.jpg`
}

export async function uploadBesitzFoto(gegenstandId: string, file: File): Promise<string> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) throw new Error('Nicht angemeldet — Foto-Upload nicht möglich.')

  const compressed = await compressImageFileToJpegUpload(file, { maxEdge: 960, quality: 0.78 })
  const path = besitzFotoPfad(user.id, gegenstandId)
  const { error } = await supabase.storage.from(BESITZ_FOTO_BUCKET).upload(path, compressed, {
    upsert: true,
    contentType: 'image/jpeg',
  })
  if (error) throw new Error(error.message || 'Foto konnte nicht hochgeladen werden.')
  return path
}

export async function loescheBesitzFoto(pfad: string | null | undefined): Promise<void> {
  if (!pfad?.trim()) return
  const { error } = await supabase.storage.from(BESITZ_FOTO_BUCKET).remove([pfad])
  if (error) console.warn('besitz foto löschen', error.message)
}

export async function besitzFotoSignedUrl(pfad: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BESITZ_FOTO_BUCKET).createSignedUrl(pfad, SIGNED_URL_TTL_SEC)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function besitzFotoSignedUrls(pfade: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(pfade.filter(Boolean))]
  if (!unique.length) return {}
  const { data, error } = await supabase.storage.from(BESITZ_FOTO_BUCKET).createSignedUrls(unique, SIGNED_URL_TTL_SEC)
  if (error || !data?.length) return {}
  const out: Record<string, string> = {}
  for (const row of data) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl
  }
  return out
}
