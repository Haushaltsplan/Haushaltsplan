/** URL-Prüfung ohne DNS — auch im Browser nutzbar. */

const BLOCKIERTE_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'instance-data',
])

export function istPrivateOderLokaleIp(ip: string): boolean {
  const roh = ip.trim().toLowerCase().split('%')[0] ?? ''
  if (!roh) return true
  if (roh === '::1' || roh === '0.0.0.0' || roh === '::') return true
  if (roh.startsWith('::ffff:')) return istPrivateOderLokaleIp(roh.slice('::ffff:'.length))
  if (roh.includes(':')) {
    const kopf = roh.split(':')[0] ?? ''
    if (kopf === 'fe80' || kopf === 'fc00' || kopf.startsWith('fd') || kopf.startsWith('fc')) return true
    return false
  }
  const teile = roh.split('.')
  if (teile.length !== 4) return true
  const n = teile.map((t) => Number(t))
  if (n.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return true
  const a = n[0] ?? 0
  const b = n[1] ?? 0
  if (a === 10 || a === 127 || a === 0 || a === 255) return true
  if (a === 169 && b === 254) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

function hostIstIp(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')
}

/** Formale Prüfung eines Produktlinks. Wirft bei privaten oder ungültigen Adressen. */
export function pruefeHttpUrlForm(raw: string): URL {
  const t = raw.trim()
  if (!t || t.length > 2000) throw new Error('Bitte einen http- oder https-Link einfügen.')
  let u: URL
  try {
    u = new URL(t)
  } catch {
    throw new Error('Das ist kein gültiger Link.')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Nur http- und https-Links.')
  }
  if (u.username || u.password) throw new Error('Links mit Zugangsdaten sind nicht erlaubt.')
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('Nur die Standard-Ports 80 und 443.')
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!host || BLOCKIERTE_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    throw new Error('Diese Adresse ist nicht erlaubt.')
  }
  if (hostIstIp(host) && istPrivateOderLokaleIp(host)) {
    throw new Error('Diese Adresse ist nicht erlaubt.')
  }
  return u
}

/** Vergleichsschlüssel ohne Hash und übliche Tracking-Parameter. */
export function normalisiereProduktUrl(raw: string): string {
  try {
    const u = new URL(raw.trim())
    u.hash = ''
    const weg = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'mc_cid', 'mc_eid']
    for (const k of weg) u.searchParams.delete(k)
    const pfad = u.pathname.replace(/\/+$/, '') || '/'
    u.pathname = pfad
    return u.toString()
  } catch {
    return raw.trim()
  }
}

export function absUrl(raw: string, basis: string): string {
  const t = raw.trim()
  if (!t || t.startsWith('data:') || t.startsWith('javascript:')) return ''
  try {
    const u = new URL(t, basis)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    if (u.protocol === 'http:') u.protocol = 'https:'
    return u.toString()
  } catch {
    return ''
  }
}
