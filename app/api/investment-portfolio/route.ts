import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { ladePortfolioKomplett, speicherePortfolioPositionen } from '@/lib/investment-portfolio-store'
import { parsePortfolioApiPayload } from '@/lib/investment-portfolio-validierung'

export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await ladePortfolioKomplett()
  return NextResponse.json(payload)
}

export async function PUT(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, message: 'Kein gültiges JSON.' }, { status: 400 })
  }
  const parsed = parsePortfolioApiPayload(body)
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 })
  }
  const saved = await speicherePortfolioPositionen(parsed.rows)
  if (!saved.ok) {
    return NextResponse.json({ ok: false, message: saved.message }, { status: 500 })
  }
  revalidatePath('/')
  revalidatePath('/investments')
  return NextResponse.json({ ok: true })
}
