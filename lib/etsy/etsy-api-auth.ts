/** Gemeinsame Auth für Etsy Shop-OS API-Routen. */

import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function etsyApiUser(req: Request): Promise<
  | { sb: SupabaseClient; userId: string; error?: undefined }
  | { sb?: undefined; userId?: undefined; error: NextResponse }
> {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return { error: NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 }) }
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return { error: NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 }) }
  return { sb, userId: user.id }
}
