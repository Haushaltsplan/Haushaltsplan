import { erkundeEtsyKeywords } from '@/lib/etsy/etsy-scraping'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Keyword-Explorer: `?q=holzschale&tief=1&holz=buche` */
export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  if (q.length < 3) return NextResponse.json({ error: 'Bitte mindestens 3 Zeichen eingeben.' }, { status: 400 })

  const ergebnis = await erkundeEtsyKeywords(q, {
    tief: url.searchParams.get('tief') === '1',
    holzKontext: url.searchParams.get('holz') || undefined,
    budgetMs: 45_000,
  })
  return NextResponse.json({ ok: true, ...ergebnis })
}
