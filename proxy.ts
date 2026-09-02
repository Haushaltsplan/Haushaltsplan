import { NextResponse, type NextRequest } from 'next/server'
import { gastApiErlaubt, omniaRolleAusUser } from '@/lib/zugriff-rollen'

/**
 * Zentrale Absicherung ALLER /api-Routen (Next.js 16 „Proxy", früher Middleware):
 *   - verlangt einen gültigen, angemeldeten Supabase-Nutzer (Bearer-Token),
 *   - optional eingeschränkt auf erlaubte E-Mail(s) via APP_ALLOWED_EMAILS,
 *   - reicht die geprüfte Nutzer-ID/-E-Mail als x-user-* an die Route weiter
 *     (clientseitig gesetzte x-user-* werden entfernt → kein Spoofing).
 *
 * So kann niemand ohne Login die KI-/Server-Routen aufrufen (Kosten/Datenschutz),
 * selbst wenn er die öffentliche URL kennt.
 */

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
const SUPABASE_ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

function erlaubteEmails(): string[] {
  return (process.env.APP_ALLOWED_EMAILS || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/** OAuth-Callbacks, Pings & Vercel-Crons (Auth prüft die Route selbst via CRON_SECRET). */
function oeffentlicheApi(pathname: string): boolean {
  return (
    pathname === '/api/fitnessdaten/whoop/auth' ||
    pathname === '/api/fitnessdaten/whoop/auth/start' ||
    pathname === '/api/fitnessdaten/whoop/callback' ||
    pathname === '/api/fitnessdaten/whoop/ping' ||
    pathname === '/api/strava/auth/start' ||
    pathname === '/api/strava/callback' ||
    pathname === '/api/strava/ping' ||
    pathname === '/api/strava/cron-sync' ||
    pathname === '/api/portfolio-analyse/nachkaeufe/cron-scan' ||
    pathname === '/api/portfolio-analyse/quartals-auto-ki/cron'
  )
}

export async function proxy(req: NextRequest) {
  if (oeffentlicheApi(req.nextUrl.pathname)) {
    return NextResponse.next()
  }

  // Ohne Supabase-Konfiguration kann nicht geprüft werden — App ist dann ohnehin
  // funktionslos; nicht künstlich aussperren.
  if (!SUPABASE_URL || !SUPABASE_ANON) return NextResponse.next()

  const auth = req.headers.get('authorization') || ''
  const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim()
  if (!token) {
    return jsonError('Anmeldung erforderlich.', 401)
  }

  let email = ''
  let userId = ''
  let appMetadata: Record<string, unknown> = {}
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      return jsonError('Sitzung ungültig oder abgelaufen.', 401)
    }
    const user = (await res.json()) as {
      id?: string
      email?: string
      app_metadata?: Record<string, unknown>
    }
    userId = String(user.id || '')
    email = String(user.email || '').toLowerCase()
    appMetadata = user.app_metadata && typeof user.app_metadata === 'object' ? user.app_metadata : {}
    if (!userId) {
      return jsonError('Sitzung ungültig.', 401)
    }
  } catch {
    return jsonError('Authentifizierung fehlgeschlagen.', 401)
  }

  const rolle = omniaRolleAusUser({ id: userId, email, app_metadata: appMetadata }, erlaubteEmails())
  if (rolle === 'none') {
    return jsonError('Kein Zugriff für dieses Konto.', 403)
  }
  if (rolle === 'portfolio_gast' && !gastApiErlaubt(req.nextUrl.pathname)) {
    return jsonError('Dieser Bereich ist für den Portfolio-Gast nicht verfügbar.', 403)
  }

  // Bereinigte Header weiterreichen (potenzielles Client-Spoofing entfernen).
  const headers = new Headers(req.headers)
  headers.delete('x-user-id')
  headers.delete('x-user-email')
  headers.delete('x-user-rolle')
  headers.set('x-user-id', userId)
  headers.set('x-user-rolle', rolle)
  if (email) headers.set('x-user-email', email)

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/api/:path*'],
}
