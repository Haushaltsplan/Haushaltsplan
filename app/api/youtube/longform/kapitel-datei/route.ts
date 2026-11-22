/**
 * Fertige Kapitel-MP4.
 * POST { id, aktion: 'link', abschnittId } = signierter Upload-Link (die Datei geht direkt in den Bucket).
 * POST { id, aktion: 'merken', abschnittId, dauerMs } = Datei ist oben, ins Projekt eintragen.
 * POST { id, aktion: 'entfernen', abschnittId } = Eintrag und Datei löschen.
 */
import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import {
  LONGFORM_BUCKET,
  ladeProjekt,
  mitUrls,
  projektPfad,
  signierteKapitelUploadUrl,
  speichereProjekt,
} from '@/lib/youtube/longform/longform-db-server'
import { LONGFORM_ABSCHNITTE, type LongformAbschnittId } from '@/lib/youtube/longform/longform-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

function istAbschnitt(id: string): id is LongformAbschnittId {
  return (LONGFORM_ABSCHNITTE as readonly string[]).includes(id)
}

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let body: { id?: unknown; aktion?: unknown; abschnittId?: unknown; dauerMs?: unknown }
    try {
      body = (await req.json()) as typeof body
    } catch {
      return { ok: false as const, fehler: 'Kein gültiges JSON.' }
    }
    const id = typeof body.id === 'string' ? body.id : ''
    const abschnittId = typeof body.abschnittId === 'string' ? body.abschnittId : ''
    if (!id || !istAbschnitt(abschnittId)) return { ok: false as const, fehler: 'Kapitel unbekannt.' }
    const projekt = await ladeProjekt(id)
    if (!projekt) return { ok: false as const, fehler: 'Projekt nicht gefunden.' }
    const pfad = projektPfad(id, 'export', `${abschnittId}.mp4`)

    if (body.aktion === 'link') {
      const link = await signierteKapitelUploadUrl(pfad)
      return { ok: true as const, signedUrl: link.signedUrl, pfad }
    }

    if (body.aktion === 'entfernen') {
      await createSupabaseAdmin().storage.from(LONGFORM_BUCKET).remove([pfad])
      const kapitelDateien = { ...projekt.zustand.kapitelDateien }
      delete kapitelDateien[abschnittId]
      await speichereProjekt(id, { ...projekt.zustand, kapitelDateien })
      const neu = await ladeProjekt(id)
      return { ok: true as const, zustand: await mitUrls(neu?.zustand ?? projekt.zustand) }
    }

    if (body.aktion === 'merken') {
      const dauerMs = typeof body.dauerMs === 'number' ? Math.round(body.dauerMs) : 0
      if (dauerMs < 500 || dauerMs > 20 * 60 * 1000) return { ok: false as const, fehler: 'Länge der Datei passt nicht.' }
      const probe = await createSupabaseAdmin().storage.from(LONGFORM_BUCKET).createSignedUrl(pfad, 60)
      if (probe.error || !probe.data?.signedUrl) return { ok: false as const, fehler: 'Die Datei ist nicht angekommen.' }
      const kapitelDateien = { ...projekt.zustand.kapitelDateien, [abschnittId]: { pfad, dauerMs } }
      await speichereProjekt(id, { ...projekt.zustand, kapitelDateien })
      const neu = await ladeProjekt(id)
      return { ok: true as const, zustand: await mitUrls(neu?.zustand ?? projekt.zustand) }
    }

    return { ok: false as const, fehler: 'Aktion unbekannt.' }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out, { status: out.ok ? 200 : 400 })
}
