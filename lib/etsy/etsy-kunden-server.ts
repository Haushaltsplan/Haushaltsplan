/** Phase F: Käufer-CRM, Sequenzen, Gravur, Inbox-Notizen. */

import 'server-only'

import type { EtsyKundenErgebnis } from '@/lib/etsy/etsy-shop-os-types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type { EtsyKundenErgebnis } from '@/lib/etsy/etsy-shop-os-types'

function kaeuferKey(name: string, landIso: string | null): string {
  return `${name.trim().toLowerCase()}|${(landIso || '').toUpperCase()}`.slice(0, 120)
}

export async function syncEtsyKaeuferAusBestellungen(
  ownerUserId: string,
  sb: SupabaseClient,
): Promise<number> {
  const { data: bestellungen } = await sb
    .from('etsy_bestellung')
    .select('kaeufer_name, land_iso, betrag_eur, menge, gekauft_at, listing_title')
    .eq('owner_user_id', ownerUserId)
    .limit(200)

  const map = new Map<
    string,
    {
      name: string
      landIso: string | null
      kaeufe: number
      umsatz: number
      letzte: string | null
      holz: Set<string>
    }
  >()

  for (const b of bestellungen ?? []) {
    const name = String(b.kaeufer_name || '').trim()
    if (!name) continue
    const land = b.land_iso != null ? String(b.land_iso) : null
    const key = kaeuferKey(name, land)
    const cur = map.get(key) ?? {
      name,
      landIso: land,
      kaeufe: 0,
      umsatz: 0,
      letzte: null,
      holz: new Set<string>(),
    }
    cur.kaeufe += Math.max(1, Number(b.menge) || 1)
    cur.umsatz += Number(b.betrag_eur) || 0
    const gekauft = b.gekauft_at != null ? String(b.gekauft_at) : null
    if (gekauft && (!cur.letzte || gekauft > cur.letzte)) cur.letzte = gekauft
    const title = String(b.listing_title || '')
    const holzMatch = title.match(
      /\b(eiche|nussbaum|walnuss|kirsche|ahorn|esche|ulme|buche|olive|teak|akazie)\b/i,
    )
    if (holzMatch) cur.holz.add(holzMatch[1]!.toLowerCase())
    map.set(key, cur)
  }

  if (!map.size) return 0
  const rows = [...map.entries()].map(([key, v]) => ({
    owner_user_id: ownerUserId,
    kaeufer_key: key,
    name: v.name.slice(0, 120),
    land_iso: v.landIso,
    kaeufe: v.kaeufe,
    umsatz_eur: Math.round(v.umsatz * 100) / 100,
    letzte_kauf_at: v.letzte,
    holz_vorlieben: [...v.holz],
    updated_at: new Date().toISOString(),
  }))
  const { error } = await sb.from('etsy_kaeufer').upsert(rows, { onConflict: 'owner_user_id,kaeufer_key' })
  if (error) throw new Error(error.message)

  // Sequenzen: 30d Pflege, 11m Geschenk
  const heute = new Date()
  const aufgaben: Array<Record<string, unknown>> = []
  for (const [key, v] of map) {
    if (!v.letzte) continue
    const last = new Date(v.letzte)
    const d30 = new Date(last.getTime() + 30 * 86_400_000)
    const d11m = new Date(last.getTime() + 335 * 86_400_000)
    if (d30 <= new Date(heute.getTime() + 14 * 86_400_000) && d30 >= new Date(heute.getTime() - 7 * 86_400_000)) {
      aufgaben.push({
        owner_user_id: ownerUserId,
        kaeufer_key: key,
        kaeufer_name: v.name,
        art: 'pflege_30d',
        faellig_am: d30.toISOString().slice(0, 10),
        text: 'Pflege-Tipp Walnussöl senden',
      })
    }
    if (d11m <= new Date(heute.getTime() + 30 * 86_400_000) && d11m >= new Date(heute.getTime() - 14 * 86_400_000)) {
      aufgaben.push({
        owner_user_id: ownerUserId,
        kaeufer_key: key,
        kaeufer_name: v.name,
        art: 'geschenk_11m',
        faellig_am: d11m.toISOString().slice(0, 10),
        text: 'Weihnachts-/Jahrestags-Geschenk ansprechen',
      })
    }
  }
  if (aufgaben.length) {
    // Avoid duplicates: only insert if no open task of same art+key
    const { data: offen } = await sb
      .from('etsy_crm_aufgabe')
      .select('kaeufer_key, art')
      .eq('owner_user_id', ownerUserId)
      .eq('erledigt', false)
    const exist = new Set((offen ?? []).map((o) => `${o.kaeufer_key}|${o.art}`))
    const neu = aufgaben.filter((a) => !exist.has(`${a.kaeufer_key}|${a.art}`))
    if (neu.length) await sb.from('etsy_crm_aufgabe').insert(neu)
  }

  return rows.length
}

export async function baueEtsyKunden(ownerUserId: string, sb: SupabaseClient): Promise<EtsyKundenErgebnis> {
  await syncEtsyKaeuferAusBestellungen(ownerUserId, sb).catch(() => 0)
  const [kaeuferRes, crmRes, gravRes, msgRes] = await Promise.all([
    sb.from('etsy_kaeufer').select('*').eq('owner_user_id', ownerUserId).order('letzte_kauf_at', { ascending: false }).limit(50),
    sb.from('etsy_crm_aufgabe').select('*').eq('owner_user_id', ownerUserId).eq('erledigt', false).order('faellig_am').limit(30),
    sb.from('etsy_gravur_anfrage').select('*').eq('owner_user_id', ownerUserId).order('created_at', { ascending: false }).limit(30),
    sb.from('etsy_nachricht_notiz').select('*').eq('owner_user_id', ownerUserId).order('created_at', { ascending: false }).limit(30),
  ])

  return {
    kaeufer: (kaeuferRes.data ?? []).map((r) => ({
      key: String(r.kaeufer_key),
      name: String(r.name || ''),
      landIso: r.land_iso != null ? String(r.land_iso) : null,
      kaeufe: Number(r.kaeufe) || 0,
      umsatzEur: Number(r.umsatz_eur) || 0,
      letzteKaufAt: r.letzte_kauf_at != null ? String(r.letzte_kauf_at) : null,
      holzVorlieben: Array.isArray(r.holz_vorlieben) ? r.holz_vorlieben.map(String) : [],
      anlaesse: Array.isArray(r.anlaesse) ? r.anlaesse.map(String) : [],
      notiz: String(r.notiz || ''),
    })),
    crmAufgaben: (crmRes.data ?? []).map((r) => ({
      id: String(r.id),
      kaeuferKey: String(r.kaeufer_key),
      kaeuferName: String(r.kaeufer_name || ''),
      art: String(r.art),
      faelligAm: String(r.faellig_am),
      erledigt: Boolean(r.erledigt),
      text: String(r.text || ''),
    })),
    gravuren: (gravRes.data ?? []).map((r) => ({
      id: String(r.id),
      receiptId: r.receipt_id != null ? Number(r.receipt_id) : null,
      listingId: r.listing_id != null ? Number(r.listing_id) : null,
      kaeuferName: String(r.kaeufer_name || ''),
      textWunsch: String(r.text_wunsch || ''),
      aufschlagEur: Number(r.aufschlag_eur) || 15,
      status: String(r.status),
      notiz: String(r.notiz || ''),
    })),
    nachrichten: (msgRes.data ?? []).map((r) => ({
      id: String(r.id),
      prioritaet: String(r.prioritaet),
      betreff: String(r.betreff || ''),
      kaeuferName: String(r.kaeufer_name || ''),
      erledigt: Boolean(r.erledigt),
      notiz: String(r.notiz || ''),
      createdAt: String(r.created_at),
    })),
  }
}
