/** Momentum-API-Aufrufe mit Supabase-Bearer. */

import { supabase } from '@/lib/supabase'

export async function momentumAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function momentumApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const auth = await momentumAuthHeaders()
  return fetch(path, {
    ...init,
    credentials: 'include',
    headers: { ...auth, ...(init?.headers as Record<string, string> | undefined) },
  })
}
