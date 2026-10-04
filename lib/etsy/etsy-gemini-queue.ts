/**
 * Serialisierte Gemini-Free-Queue mit Mindestabstand — schützt Batch-Audits
 * und Multi-Image-Listing-Generierung vor RPM/TPM-Abbrüchen.
 */

import 'server-only'

const MIN_ABSTAND_MS = Math.max(800, Number(process.env.ETSY_GEMINI_MIN_GAP_MS) || 2_200)
const MAX_RETRIES = 3

let kette: Promise<unknown> = Promise.resolve()
let letzterStart = 0

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function istRateLimitFehler(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /429|rate.?limit|quota|resource.?exhausted|too many requests/i.test(msg)
}

/**
 * Führt `fn` in einer globalen Queue aus (eine Gemini-Anfrage nach der anderen)
 * mit Mindestabstand und Retry bei 429.
 */
export async function mitEtsyGeminiQueue<T>(fn: () => Promise<T>): Promise<T> {
  const vorher = kette
  let freigeben!: () => void
  kette = new Promise<void>((r) => {
    freigeben = r
  })
  await vorher.catch(() => undefined)

  try {
    let letzterFehler: unknown
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const warten = letzterStart + MIN_ABSTAND_MS - Date.now()
      if (warten > 0) await sleep(warten)
      letzterStart = Date.now()
      try {
        return await fn()
      } catch (e) {
        letzterFehler = e
        if (!istRateLimitFehler(e) || attempt === MAX_RETRIES - 1) throw e
        const backoff = MIN_ABSTAND_MS * (attempt + 2) + Math.floor(Math.random() * 500)
        console.warn(`[etsy-gemini-queue] 429/Quota — Retry in ${backoff}ms (Versuch ${attempt + 1})`)
        await sleep(backoff)
      }
    }
    throw letzterFehler instanceof Error ? letzterFehler : new Error('Gemini-Queue fehlgeschlagen')
  } finally {
    freigeben()
  }
}
