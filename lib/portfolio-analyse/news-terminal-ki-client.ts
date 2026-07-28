/** Client-Cache für News-Terminal KI-Tagesfazite (pro Tag / Zeitraum). */

import type { NewsTerminalKiPaket } from '@/lib/portfolio-analyse/portfolio-news-terminal-types'

const LS_KEY = 'pa-news-ki-fazit-v1'

type Store = Record<string, NewsTerminalKiPaket>

function berlinDatumIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function newsKiCacheKey(opts: {
  nurHeute: boolean
  tickerKey: string
}): string {
  return `${berlinDatumIso()}|${opts.nurHeute ? 'heute' : '48h'}|${opts.tickerKey}`
}

function ladeStore(): Store {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Store
  } catch {
    return {}
  }
}

function speichereStore(store: Store) {
  if (typeof window === 'undefined') return
  try {
    // Nur heutige + gestrige Keys behalten
    const heute = berlinDatumIso()
    const cleaned: Store = {}
    for (const [k, v] of Object.entries(store)) {
      if (k.startsWith(heute) || k.includes(heute)) cleaned[k] = v
      else if (Object.keys(cleaned).length < 8) cleaned[k] = v
    }
    localStorage.setItem(LS_KEY, JSON.stringify(cleaned))
  } catch {
    /* quota — ignore */
  }
}

export function ladeNewsKiFazitAusCache(key: string): NewsTerminalKiPaket | null {
  return ladeStore()[key] ?? null
}

export function speichereNewsKiFazitImCache(key: string, paket: NewsTerminalKiPaket) {
  const store = ladeStore()
  store[key] = paket
  speichereStore(store)
}
