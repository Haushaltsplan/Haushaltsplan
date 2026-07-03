import 'server-only'

import { BESITZ_FOTO_BUCKET } from '@/lib/besitz-foto'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Eigenes Besitz-Foto aus Storage für KI-Vision laden. */
export async function ladeBesitzFotoBuffer(
  supabase: SupabaseClient,
  bildPfad: string,
): Promise<{ buffer: Buffer; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' } | null> {
  const pfad = bildPfad.trim()
  if (!pfad) return null

  const { data, error } = await supabase.storage.from(BESITZ_FOTO_BUCKET).download(pfad)
  if (error || !data) return null

  const buffer = Buffer.from(await data.arrayBuffer())
  if (buffer.byteLength < 400) return null

  const ct = (data.type || '').toLowerCase()
  if (ct.includes('png')) return { buffer, mimeType: 'image/png' }
  if (ct.includes('webp')) return { buffer, mimeType: 'image/webp' }
  return { buffer, mimeType: 'image/jpeg' }
}
