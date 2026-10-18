/**
 * GET /api/export-data?token=… — kompakter Live-Export der Haushaltsdaten.
 * Auth: Query-Parameter `token` muss mit CHAT_API_SECRET übereinstimmen.
 */
import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { ladeExportData } from '@/lib/export-data-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function tokenOk(token: string | null): boolean {
  const secret = (process.env.CHAT_API_SECRET || '').trim()
  if (!secret || !token) return false
  try {
    const a = Buffer.from(token)
    const b = Buffer.from(secret)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  if (!tokenOk(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await ladeExportData()
    return NextResponse.json(data)
  } catch (e) {
    console.error('[export-data]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Export fehlgeschlagen' },
      { status: 500 },
    )
  }
}
