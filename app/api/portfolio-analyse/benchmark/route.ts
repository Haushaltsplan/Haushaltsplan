import { NextResponse } from 'next/server'
import { ladeBenchmarkVergleich } from '@/lib/portfolio-analyse/benchmark-vergleich-server'
import { jsonMitOwner } from '@/lib/request-owner'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    const url = new URL(req.url)
    const bis = url.searchParams.get('bis') || new Date().toISOString().slice(0, 10)
    const von =
      url.searchParams.get('von') ||
      (() => {
        const d = new Date(`${bis}T12:00:00Z`)
        d.setUTCFullYear(d.getUTCFullYear() - 1)
        return d.toISOString().slice(0, 10)
      })()
    const vergleich = await ladeBenchmarkVergleich({ von, bis })
    return { ok: true, vergleich }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}
