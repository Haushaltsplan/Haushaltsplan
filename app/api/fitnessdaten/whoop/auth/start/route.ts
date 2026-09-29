import { NextResponse } from 'next/server'

/** Whoop-OAuth entfernt — kein Abo mehr. */
export async function POST() {
  return NextResponse.json(
    { error: 'whoop_cloud_disabled', message: 'Whoop-OAuth ist deaktiviert.' },
    { status: 410 },
  )
}
