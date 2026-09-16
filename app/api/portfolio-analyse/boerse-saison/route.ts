import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    const { ladeBoersenSaison } = await import('@/lib/portfolio-analyse/boersen-saison-server')
    const paket = await ladeBoersenSaison()
    return NextResponse.json(paket)
  } catch (e) {
    console.error('boerse-saison', e)
    return NextResponse.json(
      {
        ok: false,
        indezes: [],
        geladenAm: new Date().toISOString(),
        fehler: e instanceof Error ? e.message : 'Börsen-Saison konnte nicht geladen werden.',
      },
      { status: 502 },
    )
  }
}
