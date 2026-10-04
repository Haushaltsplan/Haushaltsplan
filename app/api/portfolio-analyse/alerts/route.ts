import { NextResponse } from 'next/server'
import {
  generierePortfolioAlerts,
  ladePortfolioAlerts,
  markiereAlertGelesen,
  markiereAlleAlertsGelesen,
} from '@/lib/portfolio-analyse/portfolio-alerts-server'
import { jsonMitOwner } from '@/lib/request-owner'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    const url = new URL(req.url)
    const nurUngelesen = url.searchParams.get('ungelesen') === '1'
    const alerts = await ladePortfolioAlerts({ nurUngelesen, limit: 80 })
    return { ok: true, alerts, ungelesen: alerts.filter((a) => !a.gelesenAm).length }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      body = {}
    }
    const action = String(body.action ?? 'generate')
    if (action === 'generate') {
      const r = await generierePortfolioAlerts()
      const alerts = await ladePortfolioAlerts({ limit: 80 })
      return { ok: true, ...r, alerts, ungelesen: alerts.filter((a) => !a.gelesenAm).length }
    }
    if (action === 'read') {
      const id = String(body.id ?? '')
      if (!id) return { ok: false, message: 'id fehlt' }
      const ok = await markiereAlertGelesen(id)
      return { ok }
    }
    if (action === 'read_all') {
      const n = await markiereAlleAlertsGelesen()
      return { ok: true, gelesen: n }
    }
    return { ok: false, message: 'Unbekannte action' }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}
