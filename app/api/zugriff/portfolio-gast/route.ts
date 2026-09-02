import { NextResponse } from 'next/server'

import {
  entziehePortfolioGast,
  ladePortfolioGastEin,
  listePortfolioGaeste,
} from '@/lib/zugriff-gaeste-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function nurOwner(req: Request): boolean {
  return req.headers.get('x-user-rolle') === 'owner'
}

export async function GET(req: Request) {
  if (!nurOwner(req)) {
    return NextResponse.json({ ok: false, fehler: 'Nur der Eigentümer darf Gäste sehen.' }, { status: 403 })
  }
  try {
    const gaeste = await listePortfolioGaeste()
    return NextResponse.json({ ok: true, gaeste })
  } catch (e) {
    return NextResponse.json(
      { ok: false, fehler: e instanceof Error ? e.message : 'Gäste konnten nicht geladen werden.' },
      { status: 502 },
    )
  }
}

export async function POST(req: Request) {
  if (!nurOwner(req)) {
    return NextResponse.json({ ok: false, fehler: 'Nur der Eigentümer darf Gäste einladen.' }, { status: 403 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 })
  }
  const email = String((body as { email?: unknown })?.email ?? '')
  const result = await ladePortfolioGastEin(email)
  if (!result.ok) {
    return NextResponse.json({ ok: false, fehler: result.fehler }, { status: 400 })
  }
  return NextResponse.json({ ok: true, userId: result.userId, email: result.email })
}

export async function DELETE(req: Request) {
  if (!nurOwner(req)) {
    return NextResponse.json({ ok: false, fehler: 'Nur der Eigentümer darf Gäste entfernen.' }, { status: 403 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 })
  }
  const userId = String((body as { userId?: unknown })?.userId ?? '')
  const result = await entziehePortfolioGast(userId)
  if (!result.ok) {
    return NextResponse.json({ ok: false, fehler: result.fehler }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
