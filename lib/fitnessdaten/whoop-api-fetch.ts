/** WHOOP-API-Aufrufe mit Supabase-Bearer (Native-App + PWA). */

import { supabase } from '@/lib/supabase'

export async function whoopAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function whoopApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const auth = await whoopAuthHeaders()
  return fetch(path, {
    ...init,
    credentials: 'include',
    headers: { ...auth, ...(init?.headers as Record<string, string> | undefined) },
  })
}
