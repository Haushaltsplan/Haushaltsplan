import 'server-only'

import type { User } from '@supabase/supabase-js'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { ownerEmailsAusEnv, PORTFOLIO_GAST_ROLLE } from '@/lib/zugriff-rollen'

export type PortfolioGastZeile = {
  userId: string
  email: string
  erstelltAm: string | null
}

async function alleAuthUsers(): Promise<User[]> {
  const admin = createSupabaseAdmin()
  const users: User[] = []
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    const batch = data?.users ?? []
    users.push(...batch)
    if (batch.length < 200) break
    page += 1
  }
  return users
}

export async function listePortfolioGaeste(): Promise<PortfolioGastZeile[]> {
  const users = await alleAuthUsers()
  return users
    .filter((u) => String(u.app_metadata?.omnia_rolle || '') === PORTFOLIO_GAST_ROLLE)
    .map((u) => ({
      userId: u.id,
      email: u.email || '',
      erstelltAm: u.created_at ?? null,
    }))
    .sort((a, b) => a.email.localeCompare(b.email))
}

export async function ladePortfolioGastEin(
  email: string,
): Promise<{ ok: true; userId: string; email: string } | { ok: false; fehler: string }> {
  const clean = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return { ok: false, fehler: 'Bitte eine gültige E-Mail eingeben.' }
  }
  if (ownerEmailsAusEnv().includes(clean)) {
    return { ok: false, fehler: 'Das ist die Eigentümer-E-Mail — nicht als Gast einladbar.' }
  }

  const admin = createSupabaseAdmin()
  const vorhandene = await alleAuthUsers()
  const schon = vorhandene.find((u) => (u.email || '').toLowerCase() === clean)

  if (schon) {
    const { error } = await admin.auth.admin.updateUserById(schon.id, {
      app_metadata: { ...(schon.app_metadata ?? {}), omnia_rolle: PORTFOLIO_GAST_ROLLE },
    })
    if (error) return { ok: false, fehler: error.message }
    return { ok: true, userId: schon.id, email: clean }
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: clean,
    email_confirm: true,
    app_metadata: { omnia_rolle: PORTFOLIO_GAST_ROLLE },
  })
  if (error || !data.user?.id) {
    return { ok: false, fehler: error?.message || 'Konto konnte nicht angelegt werden.' }
  }

  return { ok: true, userId: data.user.id, email: clean }
}

export async function entziehePortfolioGast(
  userId: string,
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const id = userId.trim()
  if (!id) return { ok: false, fehler: 'userId fehlt.' }
  const admin = createSupabaseAdmin()
  const { data, error: getErr } = await admin.auth.admin.getUserById(id)
  if (getErr || !data.user) return { ok: false, fehler: getErr?.message || 'Konto nicht gefunden.' }
  if (String(data.user.app_metadata?.omnia_rolle || '') !== PORTFOLIO_GAST_ROLLE) {
    return { ok: false, fehler: 'Das ist kein Portfolio-Gast.' }
  }
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return { ok: false, fehler: error.message }
  return { ok: true }
}
