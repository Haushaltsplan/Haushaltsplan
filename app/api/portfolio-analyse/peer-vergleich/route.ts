import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const { ladePeerVergleich, ladePeerVergleichMitSubject } = await import(
      '@/lib/portfolio-analyse/peer-vergleich-server'
    )
    const body = (await req.json()) as Record<string, unknown>
    const ticker = body.ticker != null ? String(body.ticker).trim() : ''
    if (!ticker) {
      return NextResponse.json({ ok: false, fehler: 'Ticker fehlt.' }, { status: 400 })
    }

    const subject = body.subject as
      | {
          ticker: string
          roic: number | null
          fcfMarge: number | null
          ruleOf40: number | null
          netDebtEbitda: number | null
        }
      | undefined

    const paket = subject
      ? await ladePeerVergleichMitSubject(subject, body.isin != null ? String(body.isin) : null, Boolean(body.force))
      : await ladePeerVergleich({
          ticker,
          isin: body.isin != null ? String(body.isin).trim() || null : null,
          force: Boolean(body.force),
        })

    return NextResponse.json(paket)
  } catch (e) {
    console.error('peer-vergleich', e)
    return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message : 'Fehler' }, { status: 500 })
  }
}
