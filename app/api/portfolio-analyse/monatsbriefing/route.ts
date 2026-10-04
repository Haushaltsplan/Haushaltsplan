import { NextResponse } from 'next/server'
import { baueMonatsbriefing } from '@/lib/portfolio-analyse/monatsbriefing-server'
import { jsonMitOwner } from '@/lib/request-owner'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

export async function GET(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    const briefing = await baueMonatsbriefing()
    return { ok: true, briefing }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}
