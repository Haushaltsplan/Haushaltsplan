import { NextResponse } from 'next/server'

function redirectBase(req: Request): string {
  const url = new URL(req.url)
  return `${url.origin}/fitnessdaten`
}

/** Whoop-OAuth-Callback — Cloud entfernt, zurück zur Fitness-UI. */
export async function GET(req: Request) {
  return NextResponse.redirect(`${redirectBase(req)}?whoop_error=cloud_disabled`)
}
