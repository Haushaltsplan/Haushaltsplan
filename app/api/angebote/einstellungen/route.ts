import { NextResponse } from 'next/server'

import { ladeEinstellung, speichereEinstellung } from '@/lib/angebote/db'
import { normalisierePlz } from '@/lib/angebote/http'
import type { HaendlerId } from '@/lib/angebote/types'
import { jsonMitOwner } from '@/lib/request-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const out = await jsonMitOwner(req, async (ownerUserId) => {
    const e = await ladeEinstellung(ownerUserId)
    return { ok: true as const, einstellung: e }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async (ownerUserId) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Ungültiges JSON.' }, { status: 400 })
    }
    const roh = body as {
      plz?: unknown
      marktIds?: unknown
      loyalty?: unknown
    }
    const plz = normalisierePlz(typeof roh.plz === 'string' ? roh.plz : '')
    if (!plz) {
      return NextResponse.json({ ok: false, error: 'PLZ muss 5 Ziffern haben.' }, { status: 400 })
    }
    const marktIds =
      roh.marktIds && typeof roh.marktIds === 'object' && !Array.isArray(roh.marktIds)
        ? (roh.marktIds as Partial<Record<HaendlerId, string>>)
        : undefined
    const loyalty = Array.isArray(roh.loyalty)
      ? roh.loyalty.filter((x): x is string => typeof x === 'string')
      : undefined
    const einstellung = await speichereEinstellung({
      ownerUserId,
      plz,
      marktIds,
      loyalty,
    })
    return { ok: true as const, einstellung }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}
