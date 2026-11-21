/** POST multipart { id, datei } — PDF, Bild oder Text als Quelle fürs Skript. */
import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { ladeProjekt } from '@/lib/youtube/longform/longform-db-server'
import { speichereQuelle } from '@/lib/youtube/longform/longform-projekt-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return { ok: false as const, fehler: 'Upload fehlt.' }
    }
    const id = String(form.get('id') ?? '')
    const datei = form.get('datei')
    if (!id || !(datei instanceof File)) return { ok: false as const, fehler: 'id oder Datei fehlt.' }
    try {
      const p = await ladeProjekt(id)
      if (!p) return { ok: false as const, fehler: 'Projekt nicht gefunden.' }
      const zustand = await speichereQuelle(id, p.zustand, datei)
      return { ok: true as const, quellen: zustand.quellen }
    } catch (e) {
      return { ok: false as const, fehler: e instanceof Error ? e.message : 'Upload fehlgeschlagen.' }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out, { status: out.ok ? 200 : 400 })
}
