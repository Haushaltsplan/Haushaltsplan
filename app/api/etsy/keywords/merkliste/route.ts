import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MerkBody = {
  keyword?: string
  nachfrage?: number | null
  wettbewerb?: number | null
  chance?: string | null
  quellen?: string[]
  saison?: string | null
}

async function nutzer(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return null
  const {
    data: { user },
  } = await sb.auth.getUser()
  return user?.id ? { sb, userId: user.id } : null
}

export async function GET(req: Request) {
  const n = await nutzer(req)
  if (!n) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const { data, error } = await n.sb
    .from('etsy_keyword_merkliste')
    .select('keyword, nachfrage, wettbewerb, chance, quellen, saison, created_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ ok: true, keywords: data ?? [] })
}

export async function POST(req: Request) {
  const n = await nutzer(req)
  if (!n) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as MerkBody
  const keyword = String(body.keyword || '').trim().toLowerCase().slice(0, 80)
  if (keyword.length < 2) return NextResponse.json({ error: 'Keyword fehlt.' }, { status: 400 })
  const chance = ['hoch', 'mittel', 'niedrig'].includes(String(body.chance)) ? String(body.chance) : null
  const { error } = await n.sb.from('etsy_keyword_merkliste').upsert({
    owner_user_id: n.userId,
    keyword,
    nachfrage: typeof body.nachfrage === 'number' ? Math.max(0, Math.min(100, Math.round(body.nachfrage))) : null,
    wettbewerb: typeof body.wettbewerb === 'number' ? Math.round(body.wettbewerb) : null,
    chance,
    quellen: Array.isArray(body.quellen) ? body.quellen.map(String).slice(0, 5) : [],
    saison: body.saison ? String(body.saison).slice(0, 60) : null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const n = await nutzer(req)
  if (!n) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const keyword = (new URL(req.url).searchParams.get('keyword') || '').trim().toLowerCase()
  if (!keyword) return NextResponse.json({ error: 'Keyword fehlt.' }, { status: 400 })
  const { error } = await n.sb.from('etsy_keyword_merkliste').delete().eq('keyword', keyword)
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ ok: true })
}
