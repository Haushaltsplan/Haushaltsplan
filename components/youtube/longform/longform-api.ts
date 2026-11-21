/** Client-Helfer für /api/youtube/longform/*. Fehler kommen als Exception mit deutscher Meldung. */
import type { LongformProjektZustand } from '@/lib/youtube/longform/longform-types'

export async function lfApi<T = Record<string, unknown>>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  const res = await fetch(url, {
    cache: 'no-store',
    ...rest,
    ...(json !== undefined
      ? { method: rest.method ?? 'POST', headers: { 'Content-Type': 'application/json', ...(rest.headers ?? {}) }, body: JSON.stringify(json) }
      : {}),
  })
  let data: Record<string, unknown> = {}
  try {
    data = (await res.json()) as Record<string, unknown>
  } catch {
    /* leer */
  }
  if (!res.ok || data.ok === false) {
    throw new Error(typeof data.fehler === 'string' ? data.fehler : typeof data.error === 'string' ? data.error : `Fehler ${res.status}`)
  }
  return data as T
}

export type ZustandAntwort = { ok: true; zustand: LongformProjektZustand }

export const LF_KNOPF =
  'rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] disabled:opacity-50'
export const LF_KNOPF_PRIMAER = 'rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50'
export const LF_FELD =
  'w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-red-500/40'
