import { NextResponse } from 'next/server'
import { extrahiereKalenderEventsAusFoto } from '@/lib/kalender-foto-vision'

export const runtime = 'nodejs'

const MAX_BYTES = 12 * 1024 * 1024

function mimeFuerBild(file: File): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  const n = file.name.toLowerCase()
  if (file.type === 'image/jpeg' || n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg'
  if (file.type === 'image/png' || n.endsWith('.png')) return 'image/png'
  if (file.type === 'image/webp' || n.endsWith('.webp')) return 'image/webp'
  return null
}

export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: 'Bitte ein Bild (JPEG, PNG, WebP) hochladen.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `Datei zu groß (max. ${Math.round(MAX_BYTES / 1024 / 1024)} MB).` }, { status: 400 })
  }
  const mime = mimeFuerBild(file)
  if (!mime) {
    return NextResponse.json({ error: 'Nur JPEG, PNG oder WebP.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const r = await extrahiereKalenderEventsAusFoto(buffer, mime)
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.status === 501 ? 501 : 502 })
  }
  return NextResponse.json({ events: r.events })
}
