import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const url = new URL(req.url)
  const ticker = url.searchParams.get('ticker')?.trim() ?? ''
  if (!ticker) {
    return NextResponse.json({ ok: false, ticker: '', videos: [], message: 'Ticker fehlt.' }, { status: 400 })
  }

  try {
    const { ladeYoutubeVideosFuerTitel } = await import(
      '@/lib/portfolio-analyse/fundamentaldaten-youtube-server'
    )
    const paket = await ladeYoutubeVideosFuerTitel({
      ticker,
      firmenname: url.searchParams.get('name'),
      symbolYahoo: url.searchParams.get('symbol'),
    })
    return NextResponse.json(paket)
  } catch (e) {
    console.error('fundamentaldaten/youtube', e)
    return NextResponse.json(
      {
        ok: false,
        ticker,
        videos: [],
        message: e instanceof Error ? e.message : 'YouTube-Videos konnten nicht geladen werden.',
      },
      { status: 502 },
    )
  }
}
