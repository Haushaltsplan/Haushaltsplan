import { NextResponse } from 'next/server'
import { liesProduktAusLink } from '@/lib/radwerkstatt/radwerkstatt-produkt-server'
import { pruefeHttpUrlForm } from '@/lib/radwerkstatt/radwerkstatt-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 })
  }
  const url = body && typeof body === 'object' ? String((body as { url?: unknown }).url ?? '') : ''
  try {
    pruefeHttpUrlForm(url)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Ungültiger Link.' }, { status: 400 })
  }
  try {
    const entwurf = await liesProduktAusLink(url)
    return NextResponse.json({ entwurf })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Der Link konnte nicht gelesen werden.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
