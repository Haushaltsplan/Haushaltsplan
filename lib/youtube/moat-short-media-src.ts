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
  if (/^(https?:|blob:|data:)/i.test(rel) || rel.startsWith('/youtube-music/') || rel.startsWith('/api/')) return rel
  const datei = rel.split('/').pop()
  if (!datei) return rel
  const pfad = `/youtube-music/${encodeURIComponent(datei)}`
  if (typeof window === 'undefined') return pfad
  return `${window.location.origin}${pfad}`
}

/** Genau ein Same-Origin-Proxy, nie verschachtelt. */
export function logoPlaySrc(rel: string | null): string | null {
  if (!rel) return null
  if (/^(data:|blob:)/i.test(rel)) return rel
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
