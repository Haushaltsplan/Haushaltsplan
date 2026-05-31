import { NextResponse } from 'next/server'
import {
  defaultBasisEinheitAusKauf,
  istLagerBasisEinheit,
  kaufEinheitFuerDb,
  mengeInBasisEinheit,
  normalisiereKaufEinheit,
  type LagerBasisEinheit,
  type LagerKaufEinheit,
} from '@/lib/lager-einheiten'
import { einkaufsdatumLokalZuIsoMitMittag } from '@/lib/lager-einkaufsdatum'
import { normalisiereLagerKategorie } from '@/lib/lager-produkt-kategorie'
import { findeProduktIdNachLagerZuordnung } from '@/lib/lager-artikel-kanonisch'
import { produktAnzeigeNameAusBon } from '@/lib/produkt-name-normalize'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'

export const runtime = 'nodejs'

function einheitLabelFuerProdukt(b: LagerBasisEinheit): string {
  if (b === 'Liter') return 'Liter'
  if (b === 'kg') return 'kg'
  return 'Stück'
}

function parseKaufEinheit(body: Record<string, unknown>): LagerKaufEinheit | null {
  const raw =
    (typeof body.kauf_einheit === 'string' && body.kauf_einheit) ||
    (typeof body.purchase_unit === 'string' && body.purchase_unit) ||
    (typeof body.einheit === 'string' && body.einheit) ||
    ''
  return normalisiereKaufEinheit(raw)
}

function parseKaufMenge(body: Record<string, unknown>): number {
  const v =
    body.kauf_menge != null
      ? Number(body.kauf_menge)
      : body.purchase_quantity != null
        ? Number(body.purchase_quantity)
        : body.menge != null
          ? Number(body.menge)
          : NaN
  return v
}

/** Neues Produkt inkl. erstem Bestand und Einkaufszeile (Ø-/Letzt-Preis). */
export async function POST(req: Request) {
  const admin = createSupabaseFuerRequest(req)
  if (!admin) {
    return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const kaufMengeRaw = parseKaufMenge(body)
  const kaufEinheit = parseKaufEinheit(body)
  const basisRaw =
    typeof body.basis_einheit === 'string'
      ? body.basis_einheit.trim()
      : typeof body.base_unit === 'string'
        ? body.base_unit.trim()
        : ''
  const gesamtpreis = Number(body.gesamtpreis)
  const einkaufsdatum = typeof body.einkaufsdatum === 'string' ? body.einkaufsdatum.trim() : ''
  const kategorie = normalisiereLagerKategorie(
    typeof body.kategorie === 'string' && body.kategorie.trim() ? body.kategorie : null,
  )

  if (!name) {
    return NextResponse.json({ error: 'Bezeichnung (name) fehlt.' }, { status: 400 })
  }
  if (!einkaufsdatum) {
    return NextResponse.json({ error: 'Einkaufsdatum fehlt.' }, { status: 400 })
  }
  if (!Number.isFinite(kaufMengeRaw) || kaufMengeRaw <= 0) {
    return NextResponse.json({ error: 'Kauf-Menge (kauf_menge / menge) muss eine positive Zahl sein.' }, { status: 400 })
  }
  if (!kaufEinheit) {
    return NextResponse.json(
      { error: 'Kauf-Einheit fehlt oder unbekannt (z. B. g, kg, ml, Liter, Stück).' },
      { status: 400 },
    )
  }
  if (!Number.isFinite(gesamtpreis) || gesamtpreis < 0) {
    return NextResponse.json({ error: 'Gesamtpreis muss eine Zahl ≥ 0 sein.' }, { status: 400 })
  }

  let erstelltAm: string
  try {
    erstelltAm = einkaufsdatumLokalZuIsoMitMittag(einkaufsdatum)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Datum ungültig.' }, { status: 400 })
  }

  let produktId: string | null = null
  let neuAngelegt = false
  try {
    const { data: alle, error: aErr } = await admin.from('produkte').select('id, name')
    if (aErr) throw new Error(aErr.message)
    const vorhanden = findeProduktIdNachLagerZuordnung((alle || []) as { id: string; name: string }[], name)

    const kaufRounded = Math.round(kaufMengeRaw * 1000) / 1000
    const gRounded = Math.round(gesamtpreis * 100) / 100

    if (vorhanden) {
      produktId = vorhanden
      const { data: pRow, error: pErr } = await admin
        .from('produkte')
        .select('basis_einheit')
        .eq('id', produktId)
        .single()
      if (pErr) throw new Error(pErr.message)
      const basis = String(pRow?.basis_einheit || 'Stück')
      if (!istLagerBasisEinheit(basis)) {
        throw new Error('Artikel hat keine gültige Basiseinheit (kg, Liter, Stück).')
      }
      let basisMenge: number
      try {
        basisMenge = mengeInBasisEinheit(kaufRounded, kaufEinheit, basis)
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Umrechnung Kauf → Basis fehlgeschlagen.')
      }
      const basisRounded = Math.round(basisMenge * 1_000_000) / 1_000_000

      const { data: lb } = await admin.from('lagerbestand').select('aktuelle_menge').eq('produkt_id', produktId).maybeSingle()
      const neu = (Number(lb?.aktuelle_menge) || 0) + basisRounded
      const { error: lbErr } = await admin.from('lagerbestand').upsert(
        { produkt_id: produktId, aktuelle_menge: neu },
        { onConflict: 'produkt_id' },
      )
      if (lbErr) throw new Error(lbErr.message)

      const { error: eErr } = await admin.from('lager_einkauf').insert({
        produkt_id: produktId,
        menge: basisRounded,
        kauf_menge: kaufRounded,
        kauf_einheit: kaufEinheitFuerDb(kaufEinheit),
        basis_menge: basisRounded,
        basis_einheit: basis,
        gesamtpreis: gRounded,
        erstellt_am: erstelltAm,
        quelle: 'manuell',
      })
      if (eErr) throw new Error(eErr.message)

      if (kategorie !== 'Sonstiges') {
        const { data: prKat } = await admin.from('produkte').select('kategorie').eq('id', produktId).maybeSingle()
        const altKat = normalisiereLagerKategorie(prKat?.kategorie ?? null)
        if (altKat === 'Sonstiges') {
          await admin.from('produkte').update({ kategorie }).eq('id', produktId)
        }
      }

      return NextResponse.json({ ok: true, id: produktId, neuerArtikel: false })
    }

    const basisNeu: LagerBasisEinheit =
      basisRaw && istLagerBasisEinheit(basisRaw) ? basisRaw : defaultBasisEinheitAusKauf(kaufEinheit)
    let basisMengeNeu: number
    try {
      basisMengeNeu = mengeInBasisEinheit(kaufRounded, kaufEinheit, basisNeu)
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Umrechnung Kauf → Basis fehlgeschlagen.')
    }
    const basisRoundedNeu = Math.round(basisMengeNeu * 1_000_000) / 1_000_000

    const anzeigeName = produktAnzeigeNameAusBon(name)
    const { data: ins, error: iErr } = await admin
      .from('produkte')
      .insert([
        {
          name: anzeigeName,
          einheit: einheitLabelFuerProdukt(basisNeu),
          basis_einheit: basisNeu,
          kategorie,
        },
      ])
      .select('id')
      .single()
    if (iErr || !ins) throw new Error(iErr?.message || 'Produkt anlegen fehlgeschlagen.')
    produktId = ins.id as string
    neuAngelegt = true

    const { error: lbErr } = await admin.from('lagerbestand').upsert(
      { produkt_id: produktId, aktuelle_menge: basisRoundedNeu },
      { onConflict: 'produkt_id' },
    )
    if (lbErr) throw new Error(lbErr.message)

    const { error: eErr } = await admin.from('lager_einkauf').insert({
      produkt_id: produktId,
      menge: basisRoundedNeu,
      kauf_menge: kaufRounded,
      kauf_einheit: kaufEinheitFuerDb(kaufEinheit),
      basis_menge: basisRoundedNeu,
      basis_einheit: basisNeu,
      gesamtpreis: gRounded,
      erstellt_am: erstelltAm,
      quelle: 'manuell',
    })
    if (eErr) throw new Error(eErr.message)

    return NextResponse.json({ ok: true, id: produktId, neuerArtikel: true })
  } catch (e) {
    if (produktId && neuAngelegt) {
      await admin.from('produkte').delete().eq('id', produktId)
    }
    console.error('lager/produkt POST', e)
    const msg = e instanceof Error ? e.message : 'Serverfehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const admin = createSupabaseFuerRequest(req)
  if (!admin) {
    return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : undefined
  const einheit = typeof body.einheit === 'string' ? body.einheit.trim() : undefined
  const kategorie =
    typeof body.kategorie === 'string' && body.kategorie.trim()
      ? normalisiereLagerKategorie(body.kategorie)
      : undefined

  if (!id) {
    return NextResponse.json({ error: 'id fehlt.' }, { status: 400 })
  }
  if (name !== undefined && !name) {
    return NextResponse.json({ error: 'Name darf nicht leer sein.' }, { status: 400 })
  }

  const patch: Record<string, string> = {}
  if (name !== undefined) patch.name = name
  if (einheit !== undefined) patch.einheit = einheit
  if (kategorie !== undefined) patch.kategorie = kategorie

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Keine Felder zum Aktualisieren (name, einheit, kategorie).' }, { status: 400 })
  }

  try {
    const { data, error } = await admin
      .from('produkte')
      .update(patch)
      .eq('id', id)
      .select('id, name, einheit, kategorie')
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, produkt: data })
  } catch (e) {
    console.error('lager/produkt PATCH', e)
    const msg = e instanceof Error ? e.message : 'Serverfehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const admin = createSupabaseFuerRequest(req)
  if (!admin) {
    return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  }

  let id = ''
  try {
    const body = await req.json()
    id = typeof body.id === 'string' ? body.id.trim() : ''
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  if (!id) {
    return NextResponse.json({ error: 'id fehlt.' }, { status: 400 })
  }

  try {
    const { error } = await admin.from('produkte').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('lager/produkt DELETE', e)
    const msg = e instanceof Error ? e.message : 'Serverfehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
