/** Macht aus verschachtelten Logo-Proxys wieder die echte Bild-URL. */
export function originaleLogoQuelle(url: string): string {
  let cur = url
  for (let i = 0; i < 6; i++) {
    try {
      const parsed = cur.startsWith('http') ? new URL(cur) : new URL(cur, 'https://local.invalid')
      if (!parsed.pathname.includes('/api/youtube/logo')) return cur
      const inner = parsed.searchParams.get('u')
      if (!inner) return cur
      cur = inner
    } catch {
      return cur
    }
  }
  return cur
}

export function musikPlaySrc(rel: string | null): string | null {
  if (!rel) return null
  if (/^https?:\/\//i.test(rel) || rel.startsWith('/api/')) return rel
  const datei = rel.split('/').pop()
  if (!datei || typeof window === 'undefined') return rel
  return `${window.location.origin}/api/youtube/musik/datei/${encodeURIComponent(datei)}`
}

/** Genau ein Same-Origin-Proxy, nie verschachtelt. */
export function logoPlaySrc(rel: string | null): string | null {
  if (!rel) return null
  const raw = originaleLogoQuelle(rel)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  if (/^https?:\/\//i.test(raw) && !raw.includes('/api/youtube/logo')) {
    const pfad = `/api/youtube/logo?u=${encodeURIComponent(raw)}`
    return origin ? `${origin}${pfad}` : pfad
  }
  if (raw.startsWith('/api/')) return origin ? `${origin}${raw}` : raw
  const relPfad = raw.replace(/^\/+/, '')
  if (origin && !(typeof window !== 'undefined' && 'remotion_staticBase' in window && window.remotion_staticBase)) {
    return `${origin}/${relPfad}`
  }
  return relPfad
}
