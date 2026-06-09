import type { CapacitorConfig } from '@capacitor/cli'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

/** `.env.local` für `cap sync` (Capacitor lädt es nicht von selbst). */
function ladeEnvLocal(): Record<string, string> {
  const pfad = join(process.cwd(), '.env.local')
  if (!existsSync(pfad)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(pfad, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

const envLocal = ladeEnvLocal()

/**
 * Omnia Native — lädt die gehostete Next.js-App.
 * Lokal: OMNIA_CAPACITOR_SERVER_URL=http://192.168.x.x:3000
 * Produktion: deine öffentliche HTTPS-URL (Vercel o. ä.)
 */
const serverUrl = (
  process.env.OMNIA_CAPACITOR_SERVER_URL ||
  envLocal.OMNIA_CAPACITOR_SERVER_URL ||
  envLocal.NEXT_PUBLIC_APP_URL
)?.trim()

const config: CapacitorConfig = {
  appId: 'de.omnia.haushalt',
  appName: 'Omnia',
  webDir: 'capacitor-www',
  android: {
    allowMixedContent: Boolean(serverUrl?.startsWith('http://')),
    /** WHOOP-OAuth: „; wv)“ vermeiden, Capacitor-Bridge bleibt erhalten (nicht overrideUserAgent). */
    appendUserAgent: ' OmniaCapacitor/1.0',
  },
  plugins: {},
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith('http://'),
        },
      }
    : {}),
}

export default config
