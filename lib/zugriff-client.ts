'use client'

import type { OmniaRolle } from '@/lib/zugriff-rollen'

let userId: string | null = null
let rolle: OmniaRolle = 'none'

export function setzeClientZugriff(next: { userId: string | null; rolle: OmniaRolle }) {
  userId = next.userId
  rolle = next.rolle
}

export function clientZugriffUserId(): string | null {
  return userId
}

export function clientZugriffRolle(): OmniaRolle {
  return rolle
}

/** localStorage-Key pro Konto — Gäste dürfen den ungescoupten Geräte-Stand nicht erben. */
export function personlicherStorageKey(basis: string): string {
  return userId ? `${basis}:${userId}` : basis
}

export function lesePersonlichenStorage(basis: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const key = personlicherStorageKey(basis)
    const raw = window.localStorage.getItem(key)
    if (raw) return raw
    if (key === basis) return null
    if (rolle === 'portfolio_gast') return null
    const legacy = window.localStorage.getItem(basis)
    if (legacy) {
      window.localStorage.setItem(key, legacy)
      return legacy
    }
  } catch {
    /* ignore */
  }
  return null
}

export function schreibePersonlichenStorage(basis: string, wert: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(personlicherStorageKey(basis), wert)
  } catch {
    /* quota */
  }
}
