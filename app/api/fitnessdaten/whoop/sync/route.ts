import { NextResponse } from 'next/server'

/** Whoop-Cloud-API entfernt — kein Abo mehr. */
export async function GET() {
  return NextResponse.json(
    { error: 'whoop_cloud_disabled', message: 'Whoop-Cloud ist deaktiviert. Nutze BLE am Band.' },
    { status: 410 },
  )
}

export async function POST() {
  return GET()
}
