/**
 * Long-Form-Projekte.
 * GET (ohne id) = Liste, GET ?id= = Projekt mit signierten URLs,
 * POST { export, thema } = neues Projekt, POST { id, export } = JSON nachladen,
 * PATCH { id, zustand } = speichern, DELETE ?id= = löschen.
 */
import { NextResponse } from 'next/server'
import { jsonMitOwner } from '@/lib/request-owner'
import { ladeProjekt, listeProjekte, loescheProjekt, mitUrls, speichereProjekt } from '@/lib/youtube/longform/longform-db-server'
import { ergaenzeKapitelAusExport, erstelleProjekt, ersetzeExport, leseLongformExport } from '@/lib/youtube/longform/longform-projekt-server'
import { hatKalenderluecke } from '@/lib/youtube/longform/longform-reihen'
import { entferneSchlussVorFazit } from '@/lib/youtube/longform/longform-skript-server'
import type { LongformProjektZustand } from '@/lib/youtube/longform/longform-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    const id = new URL(req.url).searchParams.get('id')
    try {
      if (!id) return { ok: true as const, projekte: await listeProjekte() }
      const p = await ladeProjekt(id)
      if (!p) return { ok: false as const, fehler: 'Projekt nicht gefunden.' }
      const fuellbar = new Set(['umsatz', 'gewinn', 'fcf', 'capex', 'schulden', 'aktien', 'marge', 'roic'])
      if ((p.zustand.faktenblatt.reihen ?? []).some((r) => fuellbar.has(r.id) && hatKalenderluecke(r))) {
        p.zustand = await ergaenzeKapitelAusExport(p.id, p.zustand)
        await speichereProjekt(p.id, p.zustand)
      }
      const skript = p.zustand.skript
      if (skript && entferneSchlussVorFazit(skript.abschnitte)) {
        const ids = new Set(skript.abschnitte.flatMap((a) => a.saetze.map((s) => s.id)))
        p.zustand = {
          ...p.zustand,
          skript,
          stimme: {
            ...p.zustand.stimme,
            saetze: Object.fromEntries(Object.entries(p.zustand.stimme.saetze).filter(([k]) => ids.has(k))),
          },
          bilder: Object.fromEntries(Object.entries(p.zustand.bilder).filter(([k]) => ids.has(k))),
        }
        await speichereProjekt(p.id, p.zustand)
      }
      return { ok: true as const, projekt: { ...p, zustand: await mitUrls(p.zustand) } }
    } catch (e) {
      return { ok: false as const, fehler: e instanceof Error ? e.message : 'Laden fehlgeschlagen.' }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out, { status: out.ok ? 200 : 400 })
}

export async function POST(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let body: { id?: unknown; export?: unknown; thema?: unknown }
    try {
      body = (await req.json()) as typeof body
    } catch {
      return { ok: false as const, fehler: 'Kein gültiges JSON.' }
    }
    const eingabe = leseLongformExport(body.export)
    if (typeof eingabe === 'string') return { ok: false as const, fehler: eingabe }
    const id = typeof body.id === 'string' ? body.id : ''
    try {
      if (id) {
        const projekt = await ersetzeExport(id, eingabe)
        return { ok: true as const, projekt: { ...projekt, zustand: await mitUrls(projekt.zustand) } }
      }
      const projekt = await erstelleProjekt(eingabe, typeof body.thema === 'string' ? body.thema : '')
      return { ok: true as const, projekt }
    } catch (e) {
      return { ok: false as const, fehler: e instanceof Error ? e.message : 'Projekt anlegen fehlgeschlagen.' }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out, { status: out.ok ? 200 : 400 })
}

export async function PATCH(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    let body: { id?: unknown; zustand?: unknown }
    try {
      body = (await req.json()) as typeof body
    } catch {
      return { ok: false as const, fehler: 'Kein gültiges JSON.' }
    }
    const id = typeof body.id === 'string' ? body.id : ''
    const zustand = body.zustand as LongformProjektZustand | undefined
    if (!id || !zustand || zustand.version !== 1 || !zustand.faktenblatt) return { ok: false as const, fehler: 'Projektzustand fehlt.' }
    try {
      const alt = await ladeProjekt(id)
      if (!alt) return { ok: false as const, fehler: 'Projekt nicht gefunden.' }
      // Das Faktenblatt ist die Quelle der Wahrheit und wird nie vom Client überschrieben.
      const aktualisiertAm = await speichereProjekt(id, { ...zustand, faktenblatt: alt.zustand.faktenblatt, quellen: alt.zustand.quellen })
      return { ok: true as const, aktualisiertAm }
    } catch (e) {
      return { ok: false as const, fehler: e instanceof Error ? e.message : 'Speichern fehlgeschlagen.' }
    }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out, { status: out.ok ? 200 : 400 })
}

export async function DELETE(req: Request) {
  const out = await jsonMitOwner(req, async () => {
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return { ok: false as const, fehler: 'id fehlt.' }
    await loescheProjekt(id)
    return { ok: true as const }
  })
  if (out instanceof NextResponse) return out
  return NextResponse.json(out, { status: out.ok ? 200 : 400 })
}
