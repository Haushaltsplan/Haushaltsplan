import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function hostErlaubt(hostname: string): boolean {
  const h = hostname.toLowerCase()
  const needles = [
    'b-cdn.net',
    'marktguru',
    'lidl',
    'rewe',
    'aldi',
    'edeka',
    'penny',
    'kaufland',
    'netto',
    'globus',
    'static-coupons',
  ]
  return needles.some((n) => h.includes(n))
}

/** Proxy für Produktbilder (Hotlink-/Referrer-Probleme vermeiden). */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const raw = url.searchParams.get('u') || url.searchParams.get('url')
  if (!raw) {
    return NextResponse.json({ error: 'url fehlt' }, { status: 400 })
  }
  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: 'Ungültige URL' }, { status: 400 })
  }
  if (target.protocol !== 'https:' || !hostErlaubt(target.hostname)) {
    return NextResponse.json({ error: 'Host nicht erlaubt' }, { status: 403 })
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Referer: 'https://www.marktguru.de/',
      },
      cache: 'no-store',
    })
    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status })
    }
    const buf = await upstream.arrayBuffer()
    const type = upstream.headers.get('content-type') || 'image/jpeg'
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    })
  } catch (e) {
    console.warn('[angebote:bild]', e)
    return NextResponse.json({ error: 'Bild nicht ladbar' }, { status: 502 })
  }
}
