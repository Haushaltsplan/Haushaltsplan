import { NextResponse } from 'next/server'
import { type NaturBildTeil, bestimmeNaturAusFotos, NATUR_MAX_FOTOS } from '@/lib/natur-bestimmen-vision'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
  const raw = form.getAll('file')
  const dateien: File[] = []
  for (const x of raw) {
    if (x instanceof File && x.size) dateien.push(x)
  }
  if (dateien.length === 0) {
    return NextResponse.json({ error: 'Bitte mindestens ein Foto (JPEG, PNG, WebP) hochladen.' }, { status: 400 })
  }
  if (dateien.length > NATUR_MAX_FOTOS) {
    return NextResponse.json(
      { error: `Höchstens ${NATUR_MAX_FOTOS} Fotos pro Anfrage (Kapazität KI-API).` },
      { status: 400 },
    )
  }

  const teile: NaturBildTeil[] = []
  for (const file of dateien) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Eine Datei ist zu groß (max. ${Math.round(MAX_BYTES / 1024 / 1024)} MB pro Bild).` },
        { status: 400 },
      )
    }
    const mime = mimeFuerBild(file)
    if (!mime) {
      return NextResponse.json({ error: 'Nur JPEG, PNG oder WebP pro Bild.' }, { status: 400 })
    }
    teile.push({ buffer: Buffer.from(await file.arrayBuffer()), mimeType: mime })
  }

  const r = await bestimmeNaturAusFotos(teile)
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.status === 501 ? 501 : r.status === 400 ? 400 : 502 })
  }
  return NextResponse.json({ ergebnis: r.ergebnis })
}
