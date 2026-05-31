import type { SupabaseClient } from '@supabase/supabase-js'

export type LagerChargeRow = {
  id: string
  produkt_id: string
  menge: number
  mhd: string | null
  erstellt_am: string
}

/** Nächstes MHD aus offenen Chargen → Spalte `produkte.mhd` aktualisieren. */
export async function syncProduktMhdAusChargen(admin: SupabaseClient, produktId: string): Promise<void> {
  const { data, error } = await admin
    .from('lager_charge')
    .select('mhd, menge')
    .eq('produkt_id', produktId)
    .gt('menge', 0)
    .not('mhd', 'is', null)
    .order('mhd', { ascending: true })
  if (error) {
    if (error.message.includes('lager_charge') || error.message.includes('schema cache')) return
    throw new Error(error.message)
  }
  const rows = data || []
  const naechstes = rows.length > 0 ? String((rows[0] as { mhd: string }).mhd).slice(0, 10) : null
  await admin.from('produkte').update({ mhd: naechstes }).eq('id', produktId)
}

/** Neue Charge nach Einkauf / Einbuchung. */
export async function chargeHinzufuegen(
  admin: SupabaseClient,
  produktId: string,
  menge: number,
  opts?: { mhd?: string | null; lagerEinkaufId?: string | null },
): Promise<void> {
  const m = Math.round(menge * 1000) / 1000
  if (m <= 0) return
  const mhd = opts?.mhd && /^\d{4}-\d{2}-\d{2}$/.test(opts.mhd.trim()) ? opts.mhd.trim() : null
  const row: Record<string, unknown> = { produkt_id: produktId, menge: m }
  if (mhd) row.mhd = mhd
  if (opts?.lagerEinkaufId) row.lager_einkauf_id = opts.lagerEinkaufId

  const { error } = await admin.from('lager_charge').insert(row)
  if (error) {
    if (error.message.includes('lager_charge') || error.message.includes('schema cache')) return
    throw new Error(error.message)
  }
  await syncProduktMhdAusChargen(admin, produktId)
}

/** Verbrauch: zuerst ältestes MHD (FIFO), sonst älteste Charge ohne MHD. */
export async function chargeVerbrauchenFifo(
  admin: SupabaseClient,
  produktId: string,
  menge: number,
): Promise<{ ok: boolean; fehler?: string; verbraucht?: number }> {
  let rest = Math.round(menge * 1000) / 1000
  if (rest <= 0) return { ok: false, fehler: 'Menge muss positiv sein.' }

  const { data, error } = await admin
    .from('lager_charge')
    .select('id, menge, mhd, erstellt_am')
    .eq('produkt_id', produktId)
    .gt('menge', 0)
    .order('mhd', { ascending: true, nullsFirst: false })
    .order('erstellt_am', { ascending: true })

  if (error) {
    if (error.message.includes('lager_charge') || error.message.includes('schema cache')) {
      return { ok: true, verbraucht: 0 }
    }
    return { ok: false, fehler: error.message }
  }

  const charges = (data || []) as LagerChargeRow[]
  if (charges.length === 0) return { ok: true, verbraucht: 0 }

  charges.sort((a, b) => {
    const ma = a.mhd ? a.mhd : '9999-12-31'
    const mb = b.mhd ? b.mhd : '9999-12-31'
    if (ma !== mb) return ma.localeCompare(mb)
    return String(a.erstellt_am).localeCompare(String(b.erstellt_am))
  })

  let verbraucht = 0
  for (const c of charges) {
    if (rest <= 0) break
    const vor = Number(c.menge) || 0
    if (vor <= 0) continue
    const ab = Math.min(rest, vor)
    const neu = Math.round((vor - ab) * 1000) / 1000
    const { error: uErr } = await admin.from('lager_charge').update({ menge: neu }).eq('id', c.id)
    if (uErr) return { ok: false, fehler: uErr.message }
    rest = Math.round((rest - ab) * 1000) / 1000
    verbraucht += ab
  }

  if (rest > 1e-6) {
    return { ok: false, fehler: `Nicht genug in Chargen (fehlen noch ${rest}).` }
  }

  await syncProduktMhdAusChargen(admin, produktId)
  return { ok: true, verbraucht }
}
