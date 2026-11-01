import { lookup } from 'node:dns/promises'
import { NextResponse } from 'next/server'
import { istPrivateOderLokaleIp, pruefeHttpUrlForm } from '@/lib/radwerkstatt/radwerkstatt-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 4_000_000

async function pruefeBildUrl(raw: string): Promise<string> {
  const u = pruefeHttpUrlForm(raw)
  const host = u.hostname.replace(/^\[|\]$/g, '')
  const istIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')
  if (istIp) {
    if (istPrivateOderLokaleIp(host)) throw new Error('Diese Adresse ist nicht erlaubt.')
    return u.toString()
  }
  let records: { address: string }[]
  try {
    records = await lookup(host, { all: true })
  } catch {
    throw new Error('Die Adresse ist nicht erreichbar.')
  }
  if (!records.length) throw new Error('Die Adresse ist nicht erreichbar.')
  for (const r of records) {
    if (istPrivateOderLokaleIp(r.address)) throw new Error('Diese Adresse ist nicht erlaubt.')
  }
  return u.toString()
}

function typAusBytes(buf: Uint8Array): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif'
  if (buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp'
  return ''
}

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url') ?? ''
  try {
    let current = await pruefeBildUrl(url)
    for (let i = 0; i < 4; i++) {
      const res = await fetch(current, {
        redirect: 'manual',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      })
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (res.body) await res.body.cancel().catch(() => undefined)
        if (!loc) return NextResponse.json({ error: 'Die Weiterleitung hat kein Ziel.' }, { status: 422 })
        current = await pruefeBildUrl(new URL(loc, current).toString())
        continue
      }
      if (!res.ok) return NextResponse.json({ error: 'Das Bild ist nicht erreichbar.' }, { status: 422 })
      const buf = new Uint8Array(await res.arrayBuffer())
      if (buf.byteLength < 32 || buf.byteLength > MAX_BYTES) {
        return NextResponse.json({ error: 'Das Bild ist ungeeignet.' }, { status: 422 })
      }
      const typ = typAusBytes(buf)
      if (!typ) return NextResponse.json({ error: 'Das ist kein Bild.' }, { status: 422 })
      return new NextResponse(buf, {
        headers: {
          'Content-Type': typ,
          'Cache-Control': 'private, max-age=86400',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }
    return NextResponse.json({ error: 'Zu viele Weiterleitungen.' }, { status: 422 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Das Bild ist nicht erreichbar.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
