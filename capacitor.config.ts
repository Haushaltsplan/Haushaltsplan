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
    appendUserAgent: ' OmniaCapacitor/1.0',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#08090d',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#08090d',
      overlaysWebView: true,
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith('http://'),
          allowNavigation: [
            'api.prod.whoop.com',
            '*.whoop.com',
            'whoop.com',
            'www.strava.com',
            'strava.com',
          ],
        },
      }
    : {}),
}

export default config
