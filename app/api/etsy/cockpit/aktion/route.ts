import {
  fuehreTagTauschAus,
  planeKeywordEinbau,
  setzeEtsyAufgabeStatus,
} from '@/lib/etsy/etsy-cockpit-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Body =
  | {
      art: 'tag_tausch'
      tausch?: Array<{ listingId?: number; alt?: string | null; neu?: string }>
      aufgabeKey?: string
    }
  | { art: 'ausblenden'; aufgabeKey?: string; tage?: number }
  | { art: 'keyword_plan'; keyword?: string; listingId?: number }

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as Body | null
  if (!body?.art) return NextResponse.json({ error: 'art fehlt.' }, { status: 400 })

  try {
    if (body.art === 'tag_tausch') {
      const tausch = (body.tausch ?? [])
        .filter((t) => Number(t.listingId) > 0 && typeof t.neu === 'string' && t.neu.trim())
        .map((t) => ({
          listingId: Number(t.listingId),
          neu: String(t.neu),
          ...(t.alt === undefined ? {} : { alt: t.alt === null ? null : String(t.alt) }),
        }))
      if (!tausch.length) return NextResponse.json({ error: 'Kein gültiger Tag-Tausch.' }, { status: 400 })
      const ergebnisse = await fuehreTagTauschAus(user.id, tausch, body.aufgabeKey)
      const ok = ergebnisse.filter((e) => e.ok).length
      return NextResponse.json(
        { ok: ok > 0, erfolgreich: ok, ergebnisse, error: ok ? undefined : ergebnisse[0]?.fehler },
        { status: ok ? 200 : 409 },
      )
    }

    if (body.art === 'ausblenden') {
      const key = String(body.aufgabeKey || '').trim()
      if (key.length < 3) return NextResponse.json({ error: 'aufgabeKey fehlt.' }, { status: 400 })
      await setzeEtsyAufgabeStatus(user.id, key, 'ausgeblendet', Number(body.tage) || 14)
      return NextResponse.json({ ok: true })
    }

    if (body.art === 'keyword_plan') {
      const keyword = String(body.keyword || '').trim().toLowerCase()
      if (keyword.length < 2) return NextResponse.json({ error: 'Keyword fehlt.' }, { status: 400 })
      const listingId = Number(body.listingId) > 0 ? Number(body.listingId) : undefined
      return NextResponse.json({ ok: true, ...(await planeKeywordEinbau(user.id, keyword, listingId)) })
    }

    return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Aktion fehlgeschlagen'
    console.error('[etsy cockpit aktion]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
