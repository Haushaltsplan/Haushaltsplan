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

/** Response-Text sicher als JSON lesen — vermeidet SyntaxError bei HTML-Fehlerseiten. */
export async function parseMomentumApiJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text.trim()) return {} as T
  try {
    return JSON.parse(text) as T
  } catch {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 160)
    throw new Error(
      'Server-Fehler (HTTP ' + res.status + '): ' + (snippet || 'leere Antwort'),
    )
  }
}

/** JSON lesen; bei !ok mit lesbarer Fehlermeldung abbrechen. */
export async function parseMomentumApiJsonOderFehler<T>(
  res: Response,
  label: string,
): Promise<T> {
  const data = await parseMomentumApiJson<T & { fehler?: string }>(res)
  if (!res.ok) {
    throw new Error(data.fehler ?? label + ' (HTTP ' + res.status + ')')
  }
  return data
}

/** Optionales JSON — bei Fehler null statt Exception. */
export async function parseMomentumApiJsonOptional<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null
  try {
    return await parseMomentumApiJson<T>(res)
  } catch {
    return null
  }
}
