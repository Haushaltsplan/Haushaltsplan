import 'server-only'

import { AsyncLocalStorage } from 'node:async_hooks'
import { NextResponse } from 'next/server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { ownerUserIdAusRequest } from '@/lib/supabase-user'
import { omniaRolleAusUser, ownerEmailsAusEnv, type OmniaRolle } from '@/lib/zugriff-rollen'

type OwnerKontext = { ownerUserId: string; rolle: OmniaRolle }

const ownerAls = new AsyncLocalStorage<OwnerKontext>()

export function ownerUserIdAusKontext(): string | undefined {
  return ownerAls.getStore()?.ownerUserId
}

export function rolleAusKontext(): OmniaRolle {
  return ownerAls.getStore()?.rolle ?? 'owner'
}

export function istPortfolioGastKontext(): boolean {
  return rolleAusKontext() === 'portfolio_gast'
}

/**
 * Pflicht für Service-Role-Queries auf personenbezogene Tabellen.
 * Ohne Kontext: harter Abbruch statt ungefiltertes Lesen (kein Datenleck).
 */
export function requireOwnerUserId(explizit?: string | null): string {
  const id = (explizit || '').trim() || ownerAls.getStore()?.ownerUserId
  if (!id) {
    throw new Error('owner_user_id fehlt — personenbezogene Abfrage abgebrochen.')
  }
  return id
}

export function runWithOwnerUserId<T>(ownerUserId: string, fn: () => T, rolle?: OmniaRolle): T {
  const id = ownerUserId.trim()
  if (!id) throw new Error('owner_user_id fehlt.')
  const nextRolle = rolle ?? ownerAls.getStore()?.rolle ?? 'owner'
  return ownerAls.run({ ownerUserId: id, rolle: nextRolle }, fn)
}

export async function jsonMitOwner<T>(
  req: Request,
  fn: (ownerUserId: string) => Promise<T>,
): Promise<T | NextResponse> {
  const id = ownerUserIdAusRequest(req)
  if (!id) {
    return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  }
  const rolle: OmniaRolle =
    req.headers.get('x-user-rolle') === 'portfolio_gast' ? 'portfolio_gast' : 'owner'
  return ownerAls.run({ ownerUserId: id, rolle }, () => fn(id))
}

/** Konto des App-Eigentümers (Allowlist) — für Cron/Scripts, nie als Fallback in Gast-Requests. */
export async function primaererOwnerUserId(): Promise<string | null> {
  const allow = ownerEmailsAusEnv()
  try {
    const admin = createSupabaseAdmin()
    let page = 1
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error || !data?.users?.length) break
      for (const u of data.users) {
        const rolle = omniaRolleAusUser(u, allow)
        if (rolle === 'owner') return u.id
      }
      if (data.users.length < 200) break
      page += 1
    }
  } catch (e) {
    console.warn('[request-owner] primaererOwnerUserId:', e)
  }
  return null
}

export async function runWithPrimaeremOwner<T>(fn: () => Promise<T>): Promise<T> {
  const id = await primaererOwnerUserId()
  if (!id) throw new Error('Kein Owner-Konto gefunden (APP_ALLOWED_EMAILS / auth.users).')
  return ownerAls.run({ ownerUserId: id, rolle: 'owner' }, fn)
}
