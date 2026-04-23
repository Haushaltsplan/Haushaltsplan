import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

type Zeile = { produkt_id?: string; menge?: unknown; notiz?: string }

function mapRpcError(msg: string): string {
  const m = msg.toUpperCase()
  if (m.includes('TITEL_FEHLT')) return 'Titel fehlt.'
  if (m.includes('ZEILEN_UNGUELTIG') || m.includes('ZEILEN_LEER')) return 'Keine gültigen Verbrauchszeilen.'
  if (m.includes('ZEILE_UNGUELTIG')) return 'Ungültige Zeile (produkt_id / menge).'
  if (m.includes('KEIN_LAGERBESTAND')) return 'Für mindestens ein Produkt gibt es keinen Lagerbestand-Eintrag.'
  if (m.includes('ZU_WENIG_BESTAND')) return 'Nicht genug Bestand für mindestens eine Zutat.'
  if (m.includes('INVALID_TEXT_REPRESENTATION') || m.includes('UUID')) return 'Ungültige Produkt-ID.'
  return msg.length > 200 ? `${msg.slice(0, 200)}…` : msg
}

export async function POST(req: Request) {
  let admin: ReturnType<typeof createSupabaseAdmin>
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json(
      {
        error:
          'SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local — Mahlzeit-Buchung nur serverseitig mit Service Role.',
      },
      { status: 501 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const titel = typeof body.titel === 'string' ? body.titel.trim() : ''
  if (!titel) {
    return NextResponse.json({ error: 'titel fehlt.' }, { status: 400 })
  }

  const quelleRaw = typeof body.quelle === 'string' ? body.quelle.trim().toLowerCase() : ''
  const quelle = quelleRaw === 'rezept' || quelleRaw === 'manuell' ? quelleRaw : 'manuell'

  let gekochtAm: string | null = null
  if (typeof body.gekocht_am === 'string' && body.gekocht_am.trim()) {
    const d = new Date(body.gekocht_am.trim())
    if (!Number.isFinite(d.getTime())) {
      return NextResponse.json({ error: 'gekocht_am ist kein gültiges Datum.' }, { status: 400 })
    }
    gekochtAm = d.toISOString()
  }

  const zeilenRaw = body.zeilen
  if (!Array.isArray(zeilenRaw) || zeilenRaw.length === 0) {
    return NextResponse.json({ error: 'zeilen muss ein nicht-leeres Array sein.' }, { status: 400 })
  }

  const zeilen: { produkt_id: string; menge: number; notiz: string | null }[] = []
  for (const z of zeilenRaw as Zeile[]) {
    if (!z || typeof z !== 'object') continue
    const pid = typeof z.produkt_id === 'string' ? z.produkt_id.trim() : ''
    const menge = Number(z.menge)
    const notiz =
      typeof z.notiz === 'string' && z.notiz.trim() ? z.notiz.trim().slice(0, 500) : null
    if (!pid || !Number.isFinite(menge) || menge <= 0) {
      return NextResponse.json({ error: 'Jede Zeile braucht produkt_id und positive menge.' }, { status: 400 })
    }
    zeilen.push({ produkt_id: pid, menge, notiz })
  }

  if (!zeilen.length) {
    return NextResponse.json({ error: 'zeilen enthält keine gültigen Einträge.' }, { status: 400 })
  }

  try {
    const { data, error } = await admin.rpc('lager_buche_mahlzeit', {
      p_titel: titel,
      p_gekocht_am: gekochtAm,
      p_quelle: quelle,
      p_zeilen: zeilen,
    })

    if (error) {
      console.error('lager/mahlzeit/buchen rpc', error)
      return NextResponse.json({ error: mapRpcError(error.message) }, { status: 400 })
    }

    const row = Array.isArray(data) ? data[0] : null
    const mid = row && typeof row === 'object' && 'mahlzeit_id' in row ? String((row as { mahlzeit_id: unknown }).mahlzeit_id) : ''
    const kosten =
      row && typeof row === 'object' && 'kosten_eur' in row ? Number((row as { kosten_eur: unknown }).kosten_eur) : NaN

    if (!mid) {
      return NextResponse.json({ error: 'Unerwartete Antwort der Datenbank.' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      mahlzeit_id: mid,
      kosten_geschaetzt_eur: Number.isFinite(kosten) ? Math.round(kosten * 100) / 100 : 0,
    })
  } catch (e) {
    console.error('lager/mahlzeit/buchen', e)
    const msg = e instanceof Error ? e.message : 'Serverfehler'
    return NextResponse.json({ error: mapRpcError(msg) }, { status: 500 })
  }
}
