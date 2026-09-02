import { NextResponse } from 'next/server'

import { ownerUserIdAusRequest } from '@/lib/supabase-user'
import { omniaRolleAusUser, ownerEmailsAusEnv, type OmniaRolle } from '@/lib/zugriff-rollen'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const userId = ownerUserIdAusRequest(req)
  const email = (req.headers.get('x-user-email') || '').trim().toLowerCase()
  const headerRolle = (req.headers.get('x-user-rolle') || '').trim() as OmniaRolle | ''
  const rolle: OmniaRolle =
    headerRolle === 'owner' || headerRolle === 'portfolio_gast'
      ? headerRolle
      : omniaRolleAusUser({ id: userId, email, app_metadata: { omnia_rolle: headerRolle } }, ownerEmailsAusEnv())

  if (!userId || rolle === 'none') {
    return NextResponse.json({ ok: false, rolle: 'none' }, { status: 403 })
  }

  return NextResponse.json({
    ok: true,
    rolle,
    userId,
    email,
  })
}
