import { NextResponse } from 'next/server'

/** Öffentlicher Konfig-Check (kein Geheimnis — nur ob Server-Env gesetzt ist). */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const configured = Boolean(
    process.env.WHOOP_CLIENT_ID?.trim() && process.env.WHOOP_CLIENT_SECRET?.trim(),
  )
  return NextResponse.json({ configured })
}
