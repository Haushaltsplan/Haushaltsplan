/**
 * Bildmaterial.
 * GET = ob Pixabay konfiguriert ist
 * POST JSON { id, aktion: 'suchen', satzId, begriff, mitPixabay? } — Kandidaten (Pixabay nur auf Knopfdruck)
 * POST JSON { id, aktion: 'waehlen', satzId, kandidat } — herunterladen und dem Satz zuordnen
 * POST JSON { id, aktion: 'entfernen', satzId }
 * POST multipart { id, satzId, datei } — eigenes Bild/Video für einen Satz
 */
import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import {
  bewerteKandidaten,
  fuelleBrollAutomatisch,
  pixabayKonfiguriert,
  sucheOpenverse,
  suchePixabay,
  sucheWikimedia,
  uebernimmKandidat,
} from '@/lib/youtube/longform/longform-bilder-server'
import { ladeHoch, ladeProjekt, mitUrls, projektPfad, speichereProjekt } from '@/lib/youtube/longform/longform-db-server'
import type { LongformBild, LongformBildKandidat, LongformProjektZustand } from '@/lib/youtube/longform/longform-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET() {
  return NextResponse.json({ pixabay: pixabayKonfiguriert() })
}

function satzText(z: LongformProjektZustand, satzId: string): string | null {
  for (const a of z.skript?.abschnitte ?? []) for (const s of a.saetze) if (s.id === satzId) return s.text
  return null
}

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    const istForm = (req.headers.get('content-type') ?? '').includes('multipart/form-data')
    if (istForm) {
      const form = await req.formData().catch(() => null)
      const id = String(form?.get('id') ?? '')
      const satzId = String(form?.get('satzId') ?? '')
      const datei = form?.get('datei')
      if (!id || !satzId || !(datei instanceof File)) return { ok: false as const, fehler: 'id, satzId oder Datei fehlt.' }
      const p = await ladeProjekt(id)
      if (!p || !satzText(p.zustand, satzId)) return { ok: false as const, fehler: 'Satz nicht gefunden.' }
      const mime = datei.type || 'image/jpeg'
      if (!/^(image\/(jpeg|png|webp)|video\/mp4)$/.test(mime)) return { ok: false as const, fehler: 'Nur JPG, PNG, WebP oder MP4.' }
      if (datei.size > 60_000_000) return { ok: false as const, fehler: 'Datei ist größer als 60 MB.' }
      const bildId = randomUUID()
      const endung = mime === 'video/mp4' ? 'mp4' : mime.split('/')[1]!.replace('jpeg', 'jpg')
      const pfad = projektPfad(id, 'bilder', `${satzId}-${bildId}.${endung}`)
      await ladeHoch(pfad, Buffer.from(await datei.arrayBuffer()), mime)
      const bild: LongformBild = { id: bildId, quelle: 'upload', art: mime === 'video/mp4' ? 'video' : 'foto', pfad, breite: null, hoehe: null, credit: null, suchbegriff: datei.name }
      const z = { ...p.zustand, bilder: { ...p.zustand.bilder, [satzId]: bild } }
      await speichereProjekt(id, z)
      return { ok: true as const, zustand: await mitUrls(z) }
    }

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return { ok: false as const, fehler: 'Kein gültiges JSON.' }
    }
    const id = typeof body.id === 'string' ? body.id : ''
    const satzId = typeof body.satzId === 'string' ? body.satzId : ''
    const p = id ? await ladeProjekt(id) : null
    if (!p) return { ok: false as const, fehler: 'Projekt nicht gefunden.' }

    try {
      if (body.aktion === 'auto') {
        const skript = p.zustand.skript
        if (!skript) return { ok: false as const, fehler: 'Kein Skript.' }
        const auftraege = skript.abschnitte.flatMap((a) =>
          a.saetze
            .filter((s) => s.visual.szene === 'bild' && s.visual.fokus !== 'abo' && !p.zustand.bilder[s.id])
            .map((s) => ({
              satzId: s.id,
              text: s.text,
              begriff: (s.visual.bildWunsch ?? `${p.zustand.faktenblatt.firmenname} ${p.zustand.faktenblatt.branche ?? 'industry'}`).trim(),
            })),
        )
        if (!auftraege.length) return { ok: true as const, zustand: await mitUrls(p.zustand), gefuellt: 0 }
        const neu = await fuelleBrollAutomatisch(id, auftraege.slice(0, 10))
        const z = { ...p.zustand, bilder: { ...p.zustand.bilder, ...neu } }
        await speichereProjekt(id, z)
        return { ok: true as const, zustand: await mitUrls(z), gefuellt: Object.keys(neu).length }
      }

      const text = satzText(p.zustand, satzId)
      if (!text) return { ok: false as const, fehler: 'Satz nicht gefunden.' }

      if (body.aktion === 'suchen') {
        const begriff = String(body.begriff ?? '').trim().slice(0, 100)
        if (begriff.length < 2) return { ok: false as const, fehler: 'Suchbegriff fehlt.' }
        const [wiki, ov, pix] = await Promise.all([
          sucheWikimedia(begriff),
          sucheOpenverse(begriff),
          body.mitPixabay === true ? suchePixabay(begriff) : Promise.resolve([] as LongformBildKandidat[]),
        ])
        const kandidaten = await bewerteKandidaten([...pix.filter((k) => k.art === 'video'), ...wiki, ...ov, ...pix.filter((k) => k.art === 'foto')], text)
        return { ok: true as const, kandidaten: kandidaten.slice(0, 16) }
      }
      if (body.aktion === 'waehlen') {
        const k = body.kandidat as LongformBildKandidat | undefined
        if (!k?.originalUrl) return { ok: false as const, fehler: 'Kandidat fehlt.' }
        const bild = await uebernimmKandidat(id, satzId, k)
        const z = { ...p.zustand, bilder: { ...p.zustand.bilder, [satzId]: bild } }
        await speichereProjekt(id, z)
        return { ok: true as const, zustand: await mitUrls(z) }
      }
      if (body.aktion === 'entfernen') {
        const z = { ...p.zustand, bilder: { ...p.zustand.bilder, [satzId]: null } }
        await speichereProjekt(id, z)
        return { ok: true as const, zustand: await mitUrls(z) }
      }
      return { ok: false as const, fehler: 'Unbekannte Aktion.' }
    } catch (e) {
      return { ok: false as const, fehler: e instanceof Error ? e.message : 'Bilder fehlgeschlagen.' }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out, { status: out.ok ? 200 : 400 })
}
