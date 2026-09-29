/**
 * Kurzer Sitzungscode für Browser → Omnia-App (Clipboard),
 * weil Android-Intents JWTs oft abschneiden.
 */

const PREFIX = 'omnia1.'

export type OmniaSessionPayload = {
  access_token: string
  refresh_token: string
}

export function encodeOmniaSessionCode(p: OmniaSessionPayload): string {
  const json = JSON.stringify(p)
  const b64 =
    typeof btoa === 'function'
      ? btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, 'utf8').toString('base64')
  return `${PREFIX}${b64}`
}

export function decodeOmniaSessionCode(raw: string): OmniaSessionPayload | null {
  const t = raw.trim().replace(/\s+/g, '')
  if (!t.startsWith(PREFIX)) return null
  try {
    const b64 = t.slice(PREFIX.length)
    const json =
      typeof atob === 'function'
        ? decodeURIComponent(escape(atob(b64)))
        : Buffer.from(b64, 'base64').toString('utf8')
    const parsed = JSON.parse(json) as OmniaSessionPayload
    if (!parsed?.access_token || !parsed?.refresh_token) return null
    return parsed
  } catch {
    return null
  }
}
