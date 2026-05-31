import { NextResponse } from 'next/server'
import type { CoachImagePart } from '@/lib/finance-coach-images'
import { extractKassenzettelPositionen, type Kassenzeile } from '@/lib/kassenzettel-gemini'
import {
  defaultBasisEinheitAusKauf,
  istLagerBasisEinheit,
  kaufEinheitFuerDb,
  mengeInBasisEinheit,
  normalisiereKaufEinheit,
  type LagerBasisEinheit,
  type LagerKaufEinheit,
} from '@/lib/lager-einheiten'
import {
  applyMultipackGetraenkKorrektur,
  findeProduktIdNachLagerZuordnung,
  istLagerIrrelevantPfandOderLeergut,
  lagerArtikelSammelname,
} from '@/lib/lager-artikel-kanonisch'
import { chargeHinzufuegen } from '@/lib/lager-charge'
import { lagerKategorieFinal, normalisiereLagerKategorie } from '@/lib/lager-produkt-kategorie'
import { produktAnzeigeNameAusBon } from '@/lib/produkt-name-normalize'
import { readGeminiApiKeyFromEnv } from '@/lib/ki-coach-backend'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import type { SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function geminiModel() {
  return (
    process.env.FINANCE_COACH_GEMINI_MODEL ||
    process.env.GEMINI_MODEL ||
    'gemini-2.5-flash'
  ).trim()
}

function normalizeImages(raw: unknown): CoachImagePart[] {
  if (!Array.isArray(raw)) return []
  const out: CoachImagePart[] = []
  const allow = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  const maxB64 = 3_600_000
  for (const im of raw) {
    if (!im || typeof im !== 'object') continue
    const o = im as Record<string, unknown>
    const mimeType = typeof o.mimeType === 'string' ? o.mimeType.trim().toLowerCase() : ''
    let base64 = typeof o.base64 === 'string' ? o.base64.replace(/\s/g, '') : ''
    if (base64.startsWith('data:') && base64.includes('base64,')) {
      base64 = base64.split('base64,').pop() || ''
    }
    if (!mimeType || !allow.has(mimeType) || !base64 || base64.length > maxB64) continue
    out.push({ mimeType, base64 })
    if (out.length >= 6) break
  }
  return out
}

function parseOptionaleZahl(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const s = String(v).replace(/\s/g, '').replace(/€/g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function normalizePositionen(raw: unknown): Kassenzeile[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((p) => {
      if (!p || typeof p !== 'object') return null
      const o = p as Record<string, unknown>
      const roh0 = String(o.artikel ?? '').trim()
      if (istLagerIrrelevantPfandOderLeergut(roh0)) return null
      const pack = applyMultipackGetraenkKorrektur(roh0)
      const roh = pack?.roh ?? roh0
      const menge =
        pack?.menge ??
        (typeof o.menge === 'string' ? Number(String(o.menge).replace(',', '.')) : Number(o.menge))
      const einheitNorm = pack?.einheit ?? (o.einheit != null ? String(o.einheit) : null)
      const canonical = lagerArtikelSammelname(roh)
      const katRaw = o.kategorie
      const kategorie = lagerKategorieFinal(typeof katRaw === 'string' ? katRaw : null, canonical)
      return {
        artikel: canonical,
        menge,
        einzelpreis: parseOptionaleZahl(o.einzelpreis),
        gesamtpreis: parseOptionaleZahl(o.gesamtpreis),
        einheit: einheitNorm,
        kategorie,
      } as Kassenzeile
    })
    .filter((p): p is Kassenzeile => {
      if (!p || p.artikel.length === 0) return false
      const m = Number(p.menge)
      return Number.isFinite(m) && m > 0
    })
}

function normalizeEinheit(raw: string | null | undefined): string {
  const s = (raw || '').toLowerCase().trim()
  if (s.includes('kg') || s.includes('kilogramm')) return 'kg'
  if (s.includes('liter') || /^l$/.test(s) || s.endsWith(' l')) return 'Liter'
  return 'Stück'
}

function einheitLabelFuerProdukt(b: LagerBasisEinheit): string {
  if (b === 'Liter') return 'Liter'
  if (b === 'kg') return 'kg'
  return 'Stück'
}

/** Bon-Zeile → Kauf-Einheit (Gramm nur wenn im Text erkennbar). */
function kaufEinheitAusBonZeile(z: Kassenzeile): LagerKaufEinheit {
  const k = normalisiereKaufEinheit(z.einheit)
  if (k) return k
  const leg = normalizeEinheit(z.einheit)
  if (leg === 'kg') return 'kg'
  if (leg === 'Liter') return 'Liter'
  return 'Stück'
}

function gesamtFuerZeile(z: Kassenzeile): number {
  const einheit = normalizeEinheit(z.einheit)
  const m = z.menge
  const e = z.einzelpreis
  let g = z.gesamtpreis

  const ausEinzelUndMenge =
    e != null && Number.isFinite(e) && e >= 0 && Number.isFinite(m) && m > 0
      ? Math.round(e * m * 100) / 100
      : null

  /** Bei kg/Liter wird oft fälschlich der kg-/l-Preis als gesamtpreis gesetzt statt Zeilensumme. */
  if (
    (einheit === 'kg' || einheit === 'Liter') &&
    g != null &&
    Number.isFinite(g) &&
    g >= 0 &&
    ausEinzelUndMenge != null &&
    e != null
  ) {
    const diffSumme = Math.abs(g - ausEinzelUndMenge)
    const diffReferenz = Math.abs(g - e)
    const tol = Math.max(0.05, 0.02 * ausEinzelUndMenge)
    if (diffSumme > tol && diffReferenz < diffSumme * 0.55) {
      g = null
    }
  }

  if (g != null && Number.isFinite(g) && g >= 0) return Math.round(g * 100) / 100
  if (ausEinzelUndMenge != null) return ausEinzelUndMenge
  return 0
}

async function findOrCreateProdukt(
  admin: SupabaseClient,
  name: string,
  ersteKaufEinheit: LagerKaufEinheit,
  kategorie: string,
) {
  const { data: all, error: qErr } = await admin.from('produkte').select('id, name')
  if (qErr) throw new Error(qErr.message)
  const treffer = findeProduktIdNachLagerZuordnung((all || []) as { id: string; name: string }[], name)
  if (treffer) {
    const kat = normalisiereLagerKategorie(kategorie)
    if (kat !== 'Sonstiges') {
      const { data: pr } = await admin.from('produkte').select('kategorie').eq('id', treffer).maybeSingle()
      const alt = normalisiereLagerKategorie(pr?.kategorie ?? null)
      if (alt === 'Sonstiges') {
        await admin.from('produkte').update({ kategorie: kat }).eq('id', treffer)
      }
    }
    return treffer
  }

  const basis: LagerBasisEinheit = defaultBasisEinheitAusKauf(ersteKaufEinheit)
  const anzeigeName = produktAnzeigeNameAusBon(name.trim())
  const katInsert = normalisiereLagerKategorie(kategorie)
  const { data: ins, error } = await admin
    .from('produkte')
    .insert([
      {
        name: anzeigeName,
        einheit: einheitLabelFuerProdukt(basis),
        basis_einheit: basis,
        kategorie: katInsert,
      },
    ])
    .select('id')
    .single()
  if (error || !ins) throw new Error(error?.message || 'Produkt anlegen fehlgeschlagen.')

  const pid = ins.id as string
  const { error: lbErr } = await admin.from('lagerbestand').upsert(
    { produkt_id: pid, aktuelle_menge: 0 },
    { onConflict: 'produkt_id' },
  )
  if (lbErr) throw new Error(lbErr.message)
  return pid
}

async function bucheZeile(admin: SupabaseClient, z: Kassenzeile) {
  const gesamt = gesamtFuerZeile(z)
  if (!Number.isFinite(gesamt) || gesamt < 0) {
    throw new Error('Ungültiger Zeilenpreis.')
  }

  const kaufE = kaufEinheitAusBonZeile(z)
  const produktId = await findOrCreateProdukt(admin, z.artikel, kaufE, z.kategorie)

  const { data: pRow, error: pErr } = await admin
    .from('produkte')
    .select('basis_einheit')
    .eq('id', produktId)
    .single()
  if (pErr) throw new Error(pErr.message)
  const basis = String(pRow?.basis_einheit || 'Stück')
  if (!istLagerBasisEinheit(basis)) {
    throw new Error('Artikel hat keine gültige Basiseinheit.')
  }

  const kaufRounded = Math.round(z.menge * 1000) / 1000
  let basisMenge: number
  try {
    basisMenge = mengeInBasisEinheit(kaufRounded, kaufE, basis)
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Einheit passt nicht zur Basiseinheit des Artikels.')
  }
  const basisRounded = Math.round(basisMenge * 1_000_000) / 1_000_000

  const { data: lb } = await admin.from('lagerbestand').select('aktuelle_menge').eq('produkt_id', produktId).maybeSingle()
  const neu = (Number(lb?.aktuelle_menge) || 0) + basisRounded

  const { error: uErr } = await admin.from('lagerbestand').upsert(
    { produkt_id: produktId, aktuelle_menge: neu },
    { onConflict: 'produkt_id' },
  )
  if (uErr) throw new Error(uErr.message)

  const { error: eErr } = await admin.from('lager_einkauf').insert({
    produkt_id: produktId,
    menge: basisRounded,
    kauf_menge: kaufRounded,
    kauf_einheit: kaufEinheitFuerDb(kaufE),
    basis_menge: basisRounded,
    basis_einheit: basis,
    gesamtpreis: gesamt,
  })
  if (eErr) throw new Error(eErr.message)

  await chargeHinzufuegen(admin, produktId, basisRounded)
}

export async function POST(req: Request) {
  const gKey = readGeminiApiKeyFromEnv()
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const mode = body.mode === 'buchen' ? 'buchen' : 'analyse'

  try {
    if (mode === 'analyse') {
      if (!gKey) {
        return NextResponse.json({ error: 'GEMINI_API_KEY fehlt (Kassenzettel-Analyse).' }, { status: 501 })
      }
      const images = normalizeImages(body.images)
      if (!images.length) {
        return NextResponse.json({ error: 'Mindestens ein Belegbild (JPEG/PNG/WebP/GIF) nötig.' }, { status: 400 })
      }
      const hinweis = typeof body.hinweis === 'string' ? body.hinweis : undefined
      const positionen = await extractKassenzettelPositionen(gKey, geminiModel(), images, hinweis)
      return NextResponse.json({ positionen })
    }

    // buchen
    const admin = createSupabaseFuerRequest(req)
    if (!admin) {
      return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
    }

    const positionen = normalizePositionen(body.positionen)
    if (!positionen.length) {
      return NextResponse.json({ error: 'Keine gültigen Positionen. Zuerst „Analysieren“ oder Positionen senden.' }, { status: 400 })
    }

    const gebucht: string[] = []
    const warnungen: string[] = []

    for (const z of positionen) {
      try {
        await bucheZeile(admin, z)
        gebucht.push(z.artikel)
      } catch (e) {
        warnungen.push(`${z.artikel}: ${e instanceof Error ? e.message : 'Fehler'}`)
      }
    }

    return NextResponse.json({
      gebucht,
      warnungen,
      anzahlGebucht: gebucht.length,
      anzahlZeilen: positionen.length,
    })
  } catch (e) {
    console.error('lager/kassenzettel', e)
    const msg = e instanceof Error ? e.message : 'Serverfehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
