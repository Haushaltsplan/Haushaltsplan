const REV_KEY = 'omnia-client-state-rev-v1'

function leseRevs(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(REV_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === 'string' && v) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

export function leseClientStateRev(schluessel: string): string | null {
  return leseRevs()[schluessel] ?? null
}

export function setzeClientStateRev(schluessel: string, iso?: string): string {
  const am = iso?.trim() || new Date().toISOString()
  if (typeof window === 'undefined') return am
  const map = leseRevs()
  map[schluessel] = am
  try {
    window.localStorage.setItem(REV_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
  return am
}
