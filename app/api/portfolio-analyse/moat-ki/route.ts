/**
 * GET  ?ticker=… — Cache laden
 * POST { ticker, paket, isin?, erzwingen? } — KI-Moat generieren (Free-Tier)
 */
import { NextResponse } from 'next/server'
import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  generiereMoatKiBewertung,
  ladeMoatKiCache,
} from '@/lib/portfolio-analyse/moat-ki-server'
import { jsonMitOwner } from '@/lib/request-owner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    const ticker = (new URL(req.url).searchParams.get('ticker') || '').trim().toUpperCase()
    if (!ticker) return { ok: false as const, fehler: 'ticker fehlt' }
    const bewertung = await ladeMoatKiCache(ticker)
    return { ok: true as const, bewertung }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return { ok: false as const, fehler: 'Kein gültiges JSON.' }
    }

    const ticker = String(body.ticker ?? '').trim().toUpperCase()
    if (!ticker) return { ok: false as const, fehler: 'ticker fehlt' }

    const erzwingen = body.erzwingen === true
    if (!erzwingen) {
      const cached = await ladeMoatKiCache(ticker)
      if (cached) return { ok: true as const, bewertung: cached, ausCache: true }
    }

    const paket = body.paket as FundamentaldatenPaket | undefined
    if (!paket || typeof paket !== 'object' || !paket.ok) {
      return { ok: false as const, fehler: 'Fundamentaldaten-Paket fehlt oder ungültig.' }
    }

    try {
      const bewertung = await generiereMoatKiBewertung(
        paket,
        typeof body.isin === 'string' ? body.isin : null,
      )
      return { ok: true as const, bewertung, ausCache: false }
    } catch (e) {
      return {
        ok: false as const,
        fehler: e instanceof Error ? e.message : 'Moat-KI fehlgeschlagen',
      }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out)
}
