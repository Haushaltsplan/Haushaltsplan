/** Trade-Journal — GET / POST / PATCH / DELETE */
import { NextResponse } from 'next/server'
import { heuteIsoUtc } from '@/lib/portfolio-analyse/dividenden-datum-hilfen'
import { berechneMomentumPerformance } from '@/lib/portfolio-analyse/momentum-trader/momentum-performance-server'
import {
  erstelleMomentumTrade,
  ladeMomentumTrades,
  ladeMomentumTradesAlle,
  loescheMomentumTrade,
  schliesseMomentumTrade,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trades-server'
import type { MomentumPlaybook, MomentumRichtung } from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const dynamic = 'force-dynamic'

async function auth(sbReq: Request) {
  const sb = createSupabaseFuerRequest(sbReq)
  if (!sb) return { sb: null, res: NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 }) }
  const {
    data: { user },
    error,
  } = await sb.auth.getUser()
  if (error || !user) return { sb: null, res: NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 }) }
  return { sb, res: null }
}

export async function GET(req: Request) {
  const { sb, res } = await auth(req)
  if (res || !sb) return res!
  try {
    const trades = await ladeMomentumTrades(sb)
    const performance = berechneMomentumPerformance(await ladeMomentumTradesAlle(sb))
    return NextResponse.json({ trades, performance })
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const { sb, res } = await auth(req)
  if (res || !sb) return res!

  let body: Record<string, unknown>
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ fehler: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const symbol = body.symbol != null ? String(body.symbol).trim().toUpperCase() : ''
  const playbook = body.playbook != null ? String(body.playbook) : ''
  const direction = body.direction != null ? String(body.direction) : ''
  const entryPrice = Number(body.entryPrice)
  const entryDate = body.entryDate != null ? String(body.entryDate).slice(0, 10) : heuteIsoUtc()

  if (!symbol || !playbook || (direction !== 'long' && direction !== 'short')) {
    return NextResponse.json({ fehler: 'symbol, playbook und direction (long|short) erforderlich.' }, { status: 400 })
  }
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return NextResponse.json({ fehler: 'entryPrice ungültig.' }, { status: 400 })
  }

  try {
    const trade = await erstelleMomentumTrade(sb, {
      symbol,
      playbook: playbook as MomentumPlaybook,
      direction: direction as MomentumRichtung,
      entryDate,
      entryPrice,
      stopPrice: body.stopPrice != null ? Number(body.stopPrice) : null,
      targetPrice: body.targetPrice != null ? Number(body.targetPrice) : null,
      riskEur: body.riskEur != null ? Number(body.riskEur) : undefined,
      notizen: body.notizen != null ? String(body.notizen) : null,
      ruleCompliance: body.ruleCompliance !== false,
      scanDate: body.scanDate != null ? String(body.scanDate).slice(0, 10) : null,
      signalErfolgPct: body.signalErfolgPct != null ? Number(body.signalErfolgPct) : null,
      ausScan: body.ausScan === true,
    })
    return NextResponse.json({ ok: true, trade })
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const { sb, res } = await auth(req)
  if (res || !sb) return res!

  let body: Record<string, unknown>
  try {
    body = ((await req.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ fehler: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const id = body.id != null ? String(body.id) : ''
  const exitPrice = Number(body.exitPrice)
  const exitDate = body.exitDate != null ? String(body.exitDate).slice(0, 10) : heuteIsoUtc()

  if (!id || !Number.isFinite(exitPrice)) {
    return NextResponse.json({ fehler: 'id und exitPrice erforderlich.' }, { status: 400 })
  }

  try {
    const trade = await schliesseMomentumTrade(sb, id, {
      exitDate,
      exitPrice,
      ruleCompliance: body.ruleCompliance !== false,
      notizen: body.notizen != null ? String(body.notizen) : undefined,
    })
    return NextResponse.json({ ok: true, trade })
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const { sb, res } = await auth(req)
  if (res || !sb) return res!

  let id = ''
  try {
    const body = ((await req.json()) ?? {}) as Record<string, unknown>
    id = body.id != null ? String(body.id) : ''
  } catch {
    const u = new URL(req.url)
    id = u.searchParams.get('id') ?? ''
  }

  if (!id) return NextResponse.json({ fehler: 'id fehlt.' }, { status: 400 })

  try {
    await loescheMomentumTrade(sb, id)
    const trades = await ladeMomentumTrades(sb)
    return NextResponse.json({ ok: true, trades })
  } catch (e) {
    return NextResponse.json({ fehler: String(e) }, { status: 500 })
  }
}
