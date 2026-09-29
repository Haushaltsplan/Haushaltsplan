import { NextResponse } from 'next/server'

/** Health-Check ohne Whoop-Cloud. */
export async function GET() {
  return NextResponse.json({ ok: true, cloud: false, ble: true })
}
