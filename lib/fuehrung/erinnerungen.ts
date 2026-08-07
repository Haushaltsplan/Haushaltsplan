/**
 * Browser-Erinnerungen: Morgen-Mantra + Abend-Check.
 * Läuft im Client (Tab/PWA geöffnet); SW zeigt Notification falls möglich.
 */

import {
  abendCheckOffen,
  heuteIso,
  ladeFuehrungState,
  speichereFuehrungState,
  type FuehrungState,
} from '@/lib/fuehrung/store'

export function mantraEinzeiler(mantra: string): string {
  const line =
    mantra
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? 'Führung: Pause vor dem Ja.'
  return line.length > 120 ? `${line.slice(0, 117)}…` : line
}

async function showNotification(title: string, body: string, url: string): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const opts: NotificationOptions = {
    body,
    icon: '/favicon.ico',
    tag: `fuehrung-${url}`,
    data: { url },
  }

  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg?.showNotification) {
      await reg.showNotification(title, opts)
      return
    }
  } catch {
    /* fallback */
  }
  try {
    new Notification(title, opts)
  } catch {
    /* ignore */
  }
}

/** Prüft und feuert fällige Erinnerungen; speichert „last*“ im State. */
export async function pruefeFuehrungErinnerungen(jetzt = new Date()): Promise<FuehrungState | null> {
  const state = ladeFuehrungState()
  const er = state.erinnerungen
  if (!er?.aktiv) return null
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null

  const heute = heuteIso()
  const h = jetzt.getHours()
  const min = jetzt.getMinutes()
  let changed = false
  const next = { ...state, erinnerungen: { ...er } }

  const morgenOk =
    h > er.morgenStunde || (h === er.morgenStunde && min >= er.morgenMinute)
  if (morgenOk && er.lastMorgen !== heute) {
    await showNotification('Führung · Mantra', mantraEinzeiler(state.mantra), '/fuehrung?tab=heute')
    next.erinnerungen.lastMorgen = heute
    changed = true
  }

  const abendOk =
    h > er.abendStunde || (h === er.abendStunde && min >= er.abendMinute)
  if (abendOk && er.lastAbend !== heute && abendCheckOffen(state, jetzt)) {
    await showNotification(
      'Führung · Abend-Check',
      '2 Minuten: Tag abschließen — Redirects, Win, abhaken.',
      '/fuehrung?tab=heute',
    )
    next.erinnerungen.lastAbend = heute
    changed = true
  }

  if (changed) {
    speichereFuehrungState(next)
    return next
  }
  return null
}

export async function requestFuehrungNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}
