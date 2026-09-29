import { NextResponse } from 'next/server'

/** Whoop-Cloud disconnect — No-Op (bereits deaktiviert). */
export async function POST() {
  return NextResponse.json({ ok: true, disabled: true })
}
