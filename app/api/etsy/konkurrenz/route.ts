import {
  aktualisiereEtsyKonkurrenz,
  entferneEtsyKonkurrenzShop,
  fuegeEtsyKonkurrenzShopHinzu,
  ladeEtsyKonkurrenz,
} from '@/lib/etsy/etsy-konkurrenz-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

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
  const tage = Math.max(7, Math.min(365, Number(new URL(req.url).searchParams.get('tage')) || 90))
  try {
    return NextResponse.json({ ok: true, ...(await ladeEtsyKonkurrenz(n.sb, tage)) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Laden fehlgeschlagen' }, { status: 502 })
  }
}

/**
 * Body `{ neuEntdecken?: boolean }` → Sofort-Snapshot (sonst täglich per Cron).
 * Body `{ hinzufuegen: "JoergZube" }` → Shop dauerhaft aufnehmen.
 */
export async function POST(req: Request) {
  const n = await nutzer(req)
  if (!n) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { neuEntdecken?: boolean; hinzufuegen?: string }
  try {
    if (typeof body.hinzufuegen === 'string') {
      const r = await fuegeEtsyKonkurrenzShopHinzu(n.userId, body.hinzufuegen)
      if (!r.ok) return NextResponse.json({ error: r.fehler }, { status: 404 })
      return NextResponse.json({ ok: true, name: r.name })
    }
    const lauf = await aktualisiereEtsyKonkurrenz(n.userId, { neuEntdecken: body.neuEntdecken === true })
    if (lauf.fehler) return NextResponse.json({ error: lauf.fehler, lauf }, { status: 502 })
    return NextResponse.json({ ok: true, lauf })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Aktualisieren fehlgeschlagen' }, { status: 502 })
  }
}

/** `?shopId=` → Shop aus dem Chart nehmen und künftig nicht mehr vorschlagen. */
export async function DELETE(req: Request) {
  const n = await nutzer(req)
  if (!n) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const shopId = Number(new URL(req.url).searchParams.get('shopId'))
  if (!Number.isFinite(shopId) || shopId <= 0) return NextResponse.json({ error: 'shopId fehlt.' }, { status: 400 })
  try {
    await entferneEtsyKonkurrenzShop(n.userId, shopId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Entfernen fehlgeschlagen' }, { status: 502 })
  }
}
