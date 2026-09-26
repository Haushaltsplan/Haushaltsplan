/**
 * Hard-Reload der Omnia-App (Capacitor-WebView oder Browser),
 * damit ein frischer Vercel-Deploy ohne Neuinstallation sichtbar wird.
 */

export async function aktualisiereOmniaApp(): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    /* ignore */
  }

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch {
    /* ignore */
  }

  const url = new URL(window.location.href)
  url.searchParams.set('_omnia_r', String(Date.now()))
  window.location.replace(url.toString())
}
