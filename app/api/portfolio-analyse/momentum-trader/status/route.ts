/** Datenfundament-Status für Momentum Trader. */
import { NextResponse } from 'next/server'
import { ladeMomentumDatenStatus } from '@/lib/portfolio-analyse/momentum-trader/momentum-db-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status = await ladeMomentumDatenStatus()
  return NextResponse.json(status)
}
