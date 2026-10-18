import { NextResponse } from 'next/server'

import { normalisierePlz } from '@/lib/angebote/http'
import type { HaendlerId } from '@/lib/angebote/types'
import { HAENDLER_IDS } from '@/lib/angebote/types'
import { fuehreVergleichAus } from '@/lib/angebote/vergleich'
import { jsonMitOwner } from '@/lib/request-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

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
      force?: unknown
      q?: unknown
      haendler?: unknown
      loyalty?: unknown
      sort?: unknown
    }
    const plz = normalisierePlz(typeof roh.plz === 'string' ? roh.plz : '')
    if (!plz) {
      return NextResponse.json({ ok: false, error: 'PLZ muss 5 Ziffern haben.' }, { status: 400 })
    }
    const haendler = Array.isArray(roh.haendler)
      ? roh.haendler.filter((h): h is HaendlerId =>
          typeof h === 'string' && (HAENDLER_IDS as readonly string[]).includes(h),
        )
      : undefined
    const sort =
      roh.sort === 'preis' ||
      roh.sort === 'grundpreis' ||
      roh.sort === 'haendler' ||
      roh.sort === 'name'
        ? roh.sort
        : 'preis'

    try {
      const result = await fuehreVergleichAus(ownerUserId, {
        plz,
        force: Boolean(roh.force),
        q: typeof roh.q === 'string' ? roh.q : undefined,
        haendler,
        loyalty: Array.isArray(roh.loyalty)
          ? roh.loyalty.filter((x): x is string => typeof x === 'string')
          : undefined,
        sort,
      })
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[angebote:vergleich]', msg)
      return NextResponse.json({ ok: false, error: msg }, { status: 502 })
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}
