'use client'

/**
 * Lokale App-Sperre (zusätzlich zum Login): Fingerabdruck/Face-ID via WebAuthn,
 * mit PIN als Rückfall. Alles läuft auf dem Gerät — es ist ein bequemer Schutz
 * gegen Zugriff bei entsperrtem, aber unbeaufsichtigtem Handy.
 *
 * Hinweis: Wer die Website-Daten löscht, entfernt damit auch die Supabase-Sitzung
 * → es greift dann wieder die normale Login-Pflicht (Magic-Link). Die App-Sperre ist
 * also eine zusätzliche Schicht, kein Ersatz für Login + RLS.
 */

const LS_ENABLED = 'omnia:applock:enabled'
const LS_CRED = 'omnia:applock:cred'
const LS_PIN_SALT = 'omnia:applock:pinsalt'
const LS_PIN_HASH = 'omnia:applock:pinhash'

export const APP_LOCK_CHANGED_EVENT = 'omnia-applock-changed'

function ls(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function meldeAenderung() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(APP_LOCK_CHANGED_EVENT))
}

// ---------- Status ----------

export function appLockAktiv(): boolean {
  return ls()?.getItem(LS_ENABLED) === '1'
}

export function appLockHatBiometrie(): boolean {
  return Boolean(ls()?.getItem(LS_CRED))
}

export function appLockHatPin(): boolean {
  return Boolean(ls()?.getItem(LS_PIN_HASH) && ls()?.getItem(LS_PIN_SALT))
}

export function webauthnVerfuegbar(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined'
}

/** Ob ein eingebauter Biometrie-Sensor (Fingerabdruck/Face-ID) nutzbar ist. */
export async function platformBiometrieVerfuegbar(): Promise<boolean> {
  if (!webauthnVerfuegbar()) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

// ---------- Base64URL ----------

function bufToB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const str = atob(b64)
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i)
  return bytes
}

function zufallsBytes(n: number): Uint8Array<ArrayBuffer> {
  const a = new Uint8Array(n)
  crypto.getRandomValues(a)
  return a
}

// ---------- PIN ----------

async function hashePin(pin: string, saltB64: string): Promise<string> {
  const salt = b64urlToBytes(saltB64)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return bufToB64url(bits)
}

export async function setzePin(pin: string): Promise<void> {
  const store = ls()
  if (!store) throw new Error('Speicher nicht verfügbar.')
  const saltB64 = bufToB64url(zufallsBytes(16))
  const hash = await hashePin(pin, saltB64)
  store.setItem(LS_PIN_SALT, saltB64)
  store.setItem(LS_PIN_HASH, hash)
  store.setItem(LS_ENABLED, '1')
  meldeAenderung()
}

export async function pruefePin(pin: string): Promise<boolean> {
  const store = ls()
  if (!store) return false
  const saltB64 = store.getItem(LS_PIN_SALT)
  const erwartet = store.getItem(LS_PIN_HASH)
  if (!saltB64 || !erwartet) return false
  const hash = await hashePin(pin, saltB64)
  // Konstante Länge → einfache Gleichheit ist hier ausreichend (lokaler Schutz).
  return hash === erwartet
}

// ---------- Biometrie (WebAuthn) ----------

function rpId(): string {
  return typeof window !== 'undefined' ? window.location.hostname : 'localhost'
}

/** Registriert Fingerabdruck/Face-ID auf diesem Gerät. Setzt zugleich die Sperre aktiv. */
export async function registriereBiometrie(): Promise<{ ok: boolean; error?: string }> {
  if (!webauthnVerfuegbar()) return { ok: false, error: 'Dein Browser unterstützt keine Biometrie.' }
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: zufallsBytes(32),
        rp: { name: 'Omnia', id: rpId() },
        user: {
          id: zufallsBytes(16),
          name: 'omnia-app-lock',
          displayName: 'Omnia App-Sperre',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null

    if (!cred) return { ok: false, error: 'Einrichtung abgebrochen.' }
    const store = ls()
    if (!store) return { ok: false, error: 'Speicher nicht verfügbar.' }
    store.setItem(LS_CRED, bufToB64url(cred.rawId))
    store.setItem(LS_ENABLED, '1')
    meldeAenderung()
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Biometrie-Einrichtung fehlgeschlagen.'
    return { ok: false, error: msg }
  }
}

/** Fragt Fingerabdruck/Face-ID zur Entsperrung ab. */
export async function entsperreMitBiometrie(): Promise<{ ok: boolean; error?: string }> {
  if (!webauthnVerfuegbar()) return { ok: false, error: 'Biometrie nicht verfügbar.' }
  const credB64 = ls()?.getItem(LS_CRED)
  if (!credB64) return { ok: false, error: 'Keine Biometrie eingerichtet.' }
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: zufallsBytes(32),
        allowCredentials: [
          { type: 'public-key', id: b64urlToBytes(credB64), transports: ['internal'] },
        ],
        userVerification: 'required',
        rpId: rpId(),
        timeout: 60000,
      },
    })
    if (!assertion) return { ok: false, error: 'Abgebrochen.' }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Entsperren fehlgeschlagen.'
    return { ok: false, error: msg }
  }
}

export function entferneBiometrie(): void {
  ls()?.removeItem(LS_CRED)
  meldeAenderung()
}

/** Sperre komplett entfernen (Biometrie + PIN). */
export function entferneAppLock(): void {
  const store = ls()
  if (!store) return
  store.removeItem(LS_ENABLED)
  store.removeItem(LS_CRED)
  store.removeItem(LS_PIN_SALT)
  store.removeItem(LS_PIN_HASH)
  meldeAenderung()
}
