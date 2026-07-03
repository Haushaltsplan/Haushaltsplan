import type { MomentumErinnerung } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

export const MOMENTUM_ERINNERUNGEN_SETTINGS_KEY = 'mein-haushalt.momentum-erinnerungen.v1' as const
export const MOMENTUM_ERINNERUNGEN_EVENT = 'mein-haushalt:momentum-erinnerungen' as const

export type MomentumErinnerungenSettings = {
  enabled: boolean
  /** Dedupe-Keys: typ:symbol:datum */
  gesendet: string[]
}

const DEFAULTS: MomentumErinnerungenSettings = {
  enabled: false,
  gesendet: [],
}

const NOTIFY_TYPEN = new Set<MomentumErinnerung['typ']>([
  'earnings_heute',
  'earnings_morgen',
  'pre_event_aktiv',
  'scan_verfuegbar',
  'top_signal',
])

export function ladeMomentumErinnerungenEinstellungen(): MomentumErinnerungenSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS, gesendet: [] }
  try {
    const raw = window.localStorage.getItem(MOMENTUM_ERINNERUNGEN_SETTINGS_KEY)
    if (!raw) return { ...DEFAULTS, gesendet: [] }
    const o = JSON.parse(raw) as Record<string, unknown>
    const gesendet = Array.isArray(o.gesendet)
      ? o.gesendet.filter((k): k is string => typeof k === 'string').slice(-300)
      : []
    return { enabled: o.enabled === true, gesendet }
  } catch {
    return { ...DEFAULTS, gesendet: [] }
  }
}

export function speichereMomentumErinnerungenEinstellungen(s: MomentumErinnerungenSettings) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      MOMENTUM_ERINNERUNGEN_SETTINGS_KEY,
      JSON.stringify({ enabled: s.enabled, gesendet: s.gesendet.slice(-300) }),
    )
    window.dispatchEvent(new CustomEvent(MOMENTUM_ERINNERUNGEN_EVENT))
  } catch {
    // ignore
  }
}

export function heuteAlsIsoDatumLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function erinnerungNotifyKey(e: MomentumErinnerung, heuteIso: string): string {
  const sym = (e.symbol ?? 'all').toUpperCase()
  return e.typ + ':' + sym + ':' + heuteIso
}

export function bauMomentumNotification(e: MomentumErinnerung): { title: string; body: string; tag: string } {
  const sym = e.symbol ?? 'Momentum'
  const tag = 'momentum-' + e.typ + '-' + sym + '-' + heuteAlsIsoDatumLocal()
  if (e.typ === 'earnings_heute') {
    return { title: 'Earnings heute: ' + sym, body: e.text, tag }
  }
  if (e.typ === 'earnings_morgen') {
    return { title: 'Earnings morgen: ' + sym, body: e.text, tag }
  }
  if (e.typ === 'pre_event_aktiv') {
    return { title: 'Pre-Event: ' + sym, body: e.text, tag }
  }
  if (e.typ === 'top_signal') {
    return { title: 'Top-Signal: ' + sym, body: e.text, tag }
  }
  return { title: 'Trade-Setup aktiv', body: e.text, tag }
}

/** Welche Erinnerungen eine Browser-Notification auslösen dürfen. */
export function filterNotifyErinnerungen(items: MomentumErinnerung[]): MomentumErinnerung[] {
  return items.filter((e) => NOTIFY_TYPEN.has(e.typ))
}
