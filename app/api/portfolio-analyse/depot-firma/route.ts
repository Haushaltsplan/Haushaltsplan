import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { ladeDepotFirmaAntwort } from '@/lib/portfolio-analyse/depot-firma-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  return jsonMitOwner(req, async () => {
    try {
      const daten = await ladeDepotFirmaAntwort()
      if (!daten.ok) {
        return NextResponse.json(daten, { status: 200 })
      }
      return NextResponse.json(daten)
    } catch (e) {
      console.error('[depot-firma]', e)
      return NextResponse.json(
        { ok: false, message: e instanceof Error ? e.message : 'Depot als Firma konnte nicht gebaut werden.' },
        { status: 502 },
      )
    }
  })
}
