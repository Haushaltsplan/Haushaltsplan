import { NextResponse } from 'next/server'
import {
  ladePortfolioNewsTerminal,
  type NewsTerminalDepotPosition,
  type NewsTerminalUnternehmen,
} from '@/lib/portfolio-analyse/portfolio-news-terminal-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

const MAX_POSITIONEN = 80
const MAX_EXTRA = 40

function parseDepotPositionen(raw: unknown): NewsTerminalDepotPosition[] {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(0, MAX_POSITIONEN)
    .map((row) => {
      const r = row as Record<string, unknown>
      const name = String(r.name ?? '').trim()
      if (!name) return null
      return {
        isin: r.isin != null ? String(r.isin).trim().toUpperCase() || null : null,
        name,
        symbolYahoo: r.symbolYahoo != null ? String(r.symbolYahoo).trim().toUpperCase() || null : null,
      } satisfies NewsTerminalDepotPosition
    })
    .filter((p): p is NewsTerminalDepotPosition => p != null)
}

function parseExtraUnternehmen(raw: unknown): NewsTerminalUnternehmen[] {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(0, MAX_EXTRA)
    .map((row) => {
      const r = row as Record<string, unknown>
      const name = String(r.name ?? '').trim()
      const symbol = r.symbol != null ? String(r.symbol).trim().toUpperCase() || null : null
      const isin = r.isin != null ? String(r.isin).trim().toUpperCase() || null : null
      const id = isin ?? symbol ?? name.toUpperCase()
      if (!id || !name) return null
      return { id, name, symbol, isin } satisfies NewsTerminalUnternehmen
    })
    .filter((e): e is NewsTerminalUnternehmen => e != null)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const nurHeute = url.searchParams.get('heute') === '1'
  const limit = Math.min(80, Math.max(8, Number(url.searchParams.get('limit')) || 48))

  try {
    const paket = await ladePortfolioNewsTerminal({ nurHeute, limit })
    return NextResponse.json({ ok: true, ...paket })
  } catch (e) {
    console.error('news-terminal GET', e)
    return NextResponse.json(
      { ok: false, message: 'News-Terminal konnte nicht geladen werden.' },
      { status: 502 },
    )
  }
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Kein gültiges JSON.' }, { status: 400 })
  }

  const b = body as {
    nurHeute?: boolean
    limit?: number
    positionen?: unknown
    extraUnternehmen?: unknown
  }
  const depotPositionen = parseDepotPositionen(b.positionen)
  const extraUnternehmen = parseExtraUnternehmen(b.extraUnternehmen)
  const nurHeute = b.nurHeute === true
  const limit = Math.min(80, Math.max(8, Number(b.limit) || 48))

  try {
    const paket = await ladePortfolioNewsTerminal({
      nurHeute,
      depotPositionen,
      extraUnternehmen,
      limit,
    })
    return NextResponse.json({ ok: true, ...paket })
  } catch (e) {
    console.error('news-terminal POST', e)
    return NextResponse.json(
      { ok: false, message: 'News-Terminal konnte nicht geladen werden.' },
      { status: 502 },
    )
  }
}
