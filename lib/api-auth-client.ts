import { supabase } from '@/lib/supabase'

/**
 * Hängt an JEDEN gleich-origin Aufruf von `/api/...` automatisch das
 * Supabase-Access-Token (`Authorization: Bearer …`) an, das die Middleware prüft.
 *
 * Vorteil gegenüber Einzeländerungen an jedem fetch: kein Aufrufer kann vergessen werden,
 * auch zukünftige. Es wird ausschließlich same-origin `/api/`-Verkehr berührt; Supabase-
 * Anfragen (eigene Domain) und RSC-Navigation bleiben unverändert.
 */

let accessToken: string | null = null
let installed = false

function istApiUrl(url: string): boolean {
  if (url.startsWith('/api/')) return true
  if (typeof window !== 'undefined' && url.startsWith(`${window.location.origin}/api/`)) return true
  return false
}

export function installApiAuth(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  void supabase.auth.getSession().then(({ data }) => {
    accessToken = data.session?.access_token ?? null
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    accessToken = session?.access_token ?? null
  })

  const original = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url

      if (istApiUrl(url)) {
        if (!accessToken) {
          const { data } = await supabase.auth.getSession()
          accessToken = data.session?.access_token ?? null
        }
        if (accessToken) {
          if (input instanceof Request) {
            const headers = new Headers(input.headers)
            if (!headers.has('authorization')) headers.set('Authorization', `Bearer ${accessToken}`)
            return original(new Request(input, { headers }))
          }
          const headers = new Headers(init?.headers)
          if (!headers.has('authorization')) headers.set('Authorization', `Bearer ${accessToken}`)
          return original(input, { ...init, headers })
        }
      }
    } catch {
      // Im Fehlerfall normal weiterreichen.
    }
    return original(input, init)
  }
}
