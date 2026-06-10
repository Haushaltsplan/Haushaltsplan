/** Strava-API-Aufrufe mit Supabase-Bearer. */

import { supabase } from '@/lib/supabase'

export async function stravaAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function stravaApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const auth = await stravaAuthHeaders()
  return fetch(path, {
    ...init,
    credentials: 'include',
    headers: { ...auth, ...(init?.headers as Record<string, string> | undefined) },
  })
}
