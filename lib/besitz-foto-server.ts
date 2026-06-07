import 'server-only'

import { BESITZ_FOTO_BUCKET, besitzFotoPfad } from '@/lib/besitz-foto'
import type { SupabaseClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const MAX_DOWNLOAD_BYTES = 4 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15_000

function istPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local')) return true
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true
  if (/^\[?::1\]?$/.test(h)) return true
  return false
}

export function istBrauchbareBildUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    if (istPrivateHost(u.hostname)) return false
    return true
  } catch {
    return false
  }
}

export async function ladeProduktbildVonUrl(url: string): Promise<Buffer | null> {
  if (!istBrauchbareBildUrl(url)) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'MeinHaushalt-Besitz/1.0 (Produktfoto-Import)',
        Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8,*/*;q=0.5',
      },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (!ct.startsWith('image/')) return null
    const len = Number(res.headers.get('content-length') || 0)
    if (len > MAX_DOWNLOAD_BYTES) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > MAX_DOWNLOAD_BYTES || buf.byteLength < 800) return null
    return buf
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function normalisiereProduktbild(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(960, 960, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78 })
    .toBuffer()
}

export async function speichereBesitzProduktfoto(
  supabase: SupabaseClient,
  userId: string,
  gegenstandId: string,
  bildUrl: string,
): Promise<string | null> {
  const raw = await ladeProduktbildVonUrl(bildUrl)
  if (!raw) return null
  let jpeg: Buffer
  try {
    jpeg = await normalisiereProduktbild(raw)
  } catch {
    return null
  }
  const path = besitzFotoPfad(userId, gegenstandId)
  const { error } = await supabase.storage.from(BESITZ_FOTO_BUCKET).upload(path, jpeg, {
    upsert: true,
    contentType: 'image/jpeg',
  })
  if (error) {
    console.warn('besitz produktfoto upload', error.message)
    return null
  }
  return path
}
