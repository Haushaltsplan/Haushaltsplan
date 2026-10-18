import 'server-only'

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export type FetchJsonOpts = {
  timeoutMs?: number
  retries?: number
  headers?: Record<string, string>
  label?: string
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function fetchText(
  url: string,
  opts: FetchJsonOpts = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 18_000
  const retries = opts.retries ?? 2
  const label = opts.label ?? 'http'
  let lastErr: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          Accept: 'text/html,application/json,*/*',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'User-Agent': DEFAULT_UA,
          ...opts.headers,
        },
        cache: 'no-store',
      })
      clearTimeout(timer)
      if (!res.ok) {
        const body = (await res.text()).slice(0, 300)
        throw new Error(`HTTP ${res.status}: ${body}`)
      }
      return await res.text()
    } catch (e) {
      clearTimeout(timer)
      lastErr = e
      console.warn(`[angebote:${label}] Versuch ${attempt + 1}/${retries + 1} fehlgeschlagen:`, e)
      if (attempt < retries) await sleep(400 * (attempt + 1) + Math.random() * 200)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

export async function fetchJson<T>(url: string, opts: FetchJsonOpts = {}): Promise<T> {
  const text = await fetchText(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
      ...opts.headers,
    },
  })
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Ungültiges JSON von ${url}`)
  }
}

/** ISO-Kalenderwoche z. B. 2026-W42 */
export function isoWoche(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function normalisierePlz(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length !== 5) return null
  return digits
}
