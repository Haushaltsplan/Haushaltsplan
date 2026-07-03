import { NextResponse } from 'next/server'
import {
  kiAnreichereBesitzItem,
  mergeAnreicherung,
  type BesitzAnreichernItem,
} from '@/lib/besitz-anreichern-ki'
import { brauchtBesitzAnreicherung, errateBesitzArtRegeln } from '@/lib/besitz-art-erkennung'
import { ladeBesitzFotoBuffer } from '@/lib/besitz-foto-server'
import { resolveCoachProvider } from '@/lib/ki-coach-backend'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const runtime = 'nodejs'
export const maxDuration = 120

const BATCH_SIZE = 3

type BesitzRow = BesitzAnreichernItem & {
  kleidungsart: string | null
  groesse: string | null
  farbe: string | null
  hersteller: string | null
  bild_pfad: string | null
}

export async function POST(req: Request) {
  const supabase = createSupabaseFuerRequest(req)
  if (!supabase) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 })
  }

  let body: { ids?: string[]; limit?: number } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    body = {}
  }

  const limit = Math.min(Math.max(body.limit ?? BATCH_SIZE, 1), 5)

  let query = supabase
    .from('besitz_gegenstand')
    .select(
      'id, name, kategorie, kleidungsart, groesse, farbe, bild_pfad, einkaufspreis_eur, einkaufsdatum, haendler, hersteller, notiz',
    )
    .order('erstellt_am', { ascending: false })

  if (Array.isArray(body.ids) && body.ids.length) {
    query = query.in('id', body.ids.slice(0, 20))
  }

  const { data, error } = await query.limit(80)
  if (error) {
    return NextResponse.json({ error: error.message || 'Liste konnte nicht geladen werden.' }, { status: 500 })
  }

  const alle = (data || []) as BesitzRow[]
  const offen = alle.filter((z) => brauchtBesitzAnreicherung(z)).slice(0, limit)

  if (!offen.length) {
    return NextResponse.json({
      fertig: true,
      verarbeitet: 0,
      offen_gesamt: 0,
      ergebnisse: [],
      hinweis: 'Alle Gegenstände mit Foto sind bereits angereichert.',
    })
  }

  const resolved = resolveCoachProvider()

  const ergebnisse: Array<{
    id: string
    name: string
    kleidungsart: string | null
    groesse: string | null
    farbe: string | null
    hersteller: string | null
    art_quelle: string | null
    fehler?: string
  }> = []

  for (const row of offen) {
    const item: BesitzAnreichernItem = {
      id: row.id,
      name: row.name,
      kategorie: row.kategorie,
      hersteller: row.hersteller,
      notiz: row.notiz,
      haendler: row.haendler,
      einkaufspreis_eur: row.einkaufspreis_eur,
      einkaufsdatum: row.einkaufsdatum,
    }

    const regel = errateBesitzArtRegeln(item)
    let merged = mergeAnreicherung(item, regel, null)
    let kiOk = true

    const fotoBuf = await ladeBesitzFotoBuffer(supabase, row.bild_pfad ?? '')
    if (!fotoBuf) {
      ergebnisse.push({
        id: row.id,
        name: row.name,
        kleidungsart: merged.kleidungsart,
        groesse: merged.groesse ?? row.groesse,
        farbe: merged.farbe ?? row.farbe,
        hersteller: merged.hersteller ?? row.hersteller,
        art_quelle: merged.art_quelle,
        fehler: 'Eigenes Foto konnte nicht geladen werden.',
      })
      continue
    }

    if (!resolved) {
      ergebnisse.push({
        id: row.id,
        name: row.name,
        kleidungsart: merged.kleidungsart,
        groesse: merged.groesse ?? row.groesse,
        farbe: merged.farbe ?? row.farbe,
        hersteller: merged.hersteller ?? row.hersteller,
        art_quelle: merged.art_quelle,
        fehler: 'KI nicht konfiguriert — nur Regeln angewendet.',
      })
      kiOk = false
    } else {
      const ki = await kiAnreichereBesitzItem(resolved.provider, resolved.apiKey, item, {
        mimeType: fotoBuf.mimeType,
        base64: fotoBuf.buffer.toString('base64'),
      })
      if (!ki.ok) {
        ergebnisse.push({
          id: row.id,
          name: row.name,
          kleidungsart: merged.kleidungsart,
          groesse: merged.groesse ?? row.groesse,
          farbe: merged.farbe ?? row.farbe,
          hersteller: merged.hersteller ?? row.hersteller,
          art_quelle: merged.art_quelle,
          fehler: ki.error,
        })
        kiOk = false
      } else {
        merged = mergeAnreicherung(item, regel, ki.ergebnis)
      }
    }

    const update: Record<string, string | null> = {}
    if (merged.kleidungsart && !row.kleidungsart?.trim()) update.kleidungsart = merged.kleidungsart
    if (merged.groesse && !row.groesse?.trim()) update.groesse = merged.groesse
    if (merged.farbe && !row.farbe?.trim()) update.farbe = merged.farbe
    if (merged.hersteller && !row.hersteller?.trim()) update.hersteller = merged.hersteller

    if (Object.keys(update).length) {
      const { error: updErr } = await supabase.from('besitz_gegenstand').update(update).eq('id', row.id)
      if (updErr) {
        ergebnisse.push({
          id: row.id,
          name: row.name,
          kleidungsart: update.kleidungsart ?? row.kleidungsart,
          groesse: (update.groesse as string | null) ?? row.groesse,
          farbe: (update.farbe as string | null) ?? row.farbe,
          hersteller: (update.hersteller as string | null) ?? row.hersteller,
          art_quelle: merged.art_quelle,
          fehler: updErr.message,
        })
        continue
      }
    }

    if (kiOk) {
      ergebnisse.push({
        id: row.id,
        name: row.name,
        kleidungsart: (update.kleidungsart as string | null) ?? row.kleidungsart ?? merged.kleidungsart,
        groesse: (update.groesse as string | null) ?? row.groesse ?? merged.groesse,
        farbe: (update.farbe as string | null) ?? row.farbe ?? merged.farbe,
        hersteller: (update.hersteller as string | null) ?? row.hersteller ?? merged.hersteller,
        art_quelle: merged.art_quelle,
      })
    }

    if (resolved && offen.indexOf(row) < offen.length - 1) {
      await new Promise((r) => setTimeout(r, 1200))
    }
  }

  const offenVorher = alle.filter((z) => brauchtBesitzAnreicherung(z)).length

  return NextResponse.json({
    fertig: offen.length < limit,
    verarbeitet: ergebnisse.length,
    offen_gesamt: offenVorher,
    ergebnisse,
    ki: resolved?.provider ?? null,
  })
}
