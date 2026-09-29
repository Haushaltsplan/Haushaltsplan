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
  etsyNutzung?: number | null
  wettbewerbMarkt?: 'DE' | 'global' | null
  eigeneListings?: number
  status?: 'fehlt' | 'selten' | 'drin'
}

function dbFehler(error: { code?: string; message: string }) {
  const fehltTabelle =
    error.code === '42P01' || error.code === 'PGRST205' || /etsy_keyword_merkliste/.test(error.message)
  return NextResponse.json(
    {
      error: fehltTabelle
        ? 'Tabelle etsy_keyword_merkliste fehlt — Migration 20260929140000_etsy_keywords_hauptbegriff.sql in Supabase ausführen.'
        : `Datenbank: ${error.message}`,
    },
    { status: fehltTabelle ? 503 : 502 },
  )
}

function parseMerkExtra(raw: unknown): {
  etsyNutzung: number | null
  wettbewerbMarkt: 'DE' | 'global' | null
  eigeneListings: number | null
  status: 'fehlt' | 'selten' | 'drin' | null
} {
  const leer = { etsyNutzung: null, wettbewerbMarkt: null, eigeneListings: null, status: null }
  if (typeof raw !== 'string' || !raw.trim().startsWith('{')) return leer
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    return {
      etsyNutzung: typeof o.etsyNutzung === 'number' ? o.etsyNutzung : null,
      wettbewerbMarkt: o.wettbewerbMarkt === 'DE' || o.wettbewerbMarkt === 'global' ? o.wettbewerbMarkt : null,
      eigeneListings: typeof o.eigeneListings === 'number' ? o.eigeneListings : null,
      status: o.status === 'fehlt' || o.status === 'selten' || o.status === 'drin' ? o.status : null,
    }
  } catch {
    return leer
  }
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
    .select('keyword, nachfrage, wettbewerb, chance, quellen, saison, notiz, created_at')
    .order('created_at', { ascending: false })
  if (error) return dbFehler(error)
  const keywords = (data ?? []).map((r) => {
    const extra = parseMerkExtra(r.notiz)
    return {
      keyword: String(r.keyword),
      nachfrage: r.nachfrage != null ? Number(r.nachfrage) : null,
      wettbewerb: r.wettbewerb != null ? Number(r.wettbewerb) : null,
      chance: r.chance != null ? String(r.chance) : null,
      quellen: Array.isArray(r.quellen) ? r.quellen.map(String) : [],
      saison: r.saison != null ? String(r.saison) : null,
      etsyNutzung: extra.etsyNutzung,
      wettbewerbMarkt: extra.wettbewerbMarkt,
      eigeneListings: extra.eigeneListings,
      status: extra.status,
    }
  })
  return NextResponse.json({ ok: true, keywords })
}

export async function POST(req: Request) {
  const n = await nutzer(req)
  if (!n) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as MerkBody
  const keyword = String(body.keyword || '').trim().toLowerCase().slice(0, 80)
  if (keyword.length < 2) return NextResponse.json({ error: 'Keyword fehlt.' }, { status: 400 })
  const chance = ['hoch', 'mittel', 'niedrig'].includes(String(body.chance)) ? String(body.chance) : null
  const extra = {
    etsyNutzung: typeof body.etsyNutzung === 'number' ? Math.round(body.etsyNutzung) : null,
    wettbewerbMarkt: body.wettbewerbMarkt === 'DE' || body.wettbewerbMarkt === 'global' ? body.wettbewerbMarkt : null,
    eigeneListings: typeof body.eigeneListings === 'number' ? Math.max(0, Math.round(body.eigeneListings)) : null,
    status: body.status === 'fehlt' || body.status === 'selten' || body.status === 'drin' ? body.status : null,
  }
  const { error } = await n.sb.from('etsy_keyword_merkliste').upsert({
    owner_user_id: n.userId,
    keyword,
    nachfrage: typeof body.nachfrage === 'number' ? Math.max(0, Math.min(100, Math.round(body.nachfrage))) : null,
    wettbewerb: typeof body.wettbewerb === 'number' ? Math.round(body.wettbewerb) : null,
    chance,
    quellen: Array.isArray(body.quellen) ? body.quellen.map(String).slice(0, 5) : [],
    saison: body.saison ? String(body.saison).slice(0, 60) : null,
    notiz: JSON.stringify(extra),
  })
  if (error) return dbFehler(error)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const n = await nutzer(req)
  if (!n) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const keyword = (new URL(req.url).searchParams.get('keyword') || '').trim().toLowerCase()
  if (!keyword) return NextResponse.json({ error: 'Keyword fehlt.' }, { status: 400 })
  const { error } = await n.sb.from('etsy_keyword_merkliste').delete().eq('keyword', keyword)
  if (error) return dbFehler(error)
  return NextResponse.json({ ok: true })
}
