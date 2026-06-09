import { istOmniaNativeApp } from '@/lib/fitnessdaten/omnia-native'

let bereit = false
let fehler: string | null = null
let abgeschlossen = false
const waiter: Array<(ok: boolean) => void> = []

export function setzeOmniaNativeBereit(ok: boolean, meldung?: string): void {
  bereit = ok
  fehler = ok ? null : (meldung ?? 'Native Bluetooth konnte nicht gestartet werden.')
  if (abgeschlossen) return
  abgeschlossen = true
  for (const w of waiter) w(ok)
  waiter.length = 0
}

export function istOmniaNativeBereit(): boolean {
  if (!istOmniaNativeApp()) return true
  return bereit
}

export function ladeOmniaNativeFehler(): string | null {
  return fehler
}

export function warteAufOmniaNativeBereit(): Promise<boolean> {
  if (!istOmniaNativeApp()) return Promise.resolve(true)
  if (abgeschlossen) return Promise.resolve(bereit)
  return new Promise((resolve) => waiter.push(resolve))
}
