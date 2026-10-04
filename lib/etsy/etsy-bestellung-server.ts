/** Phase B: Bestell-Pipeline aus Etsy Receipts + lokale Statuspflege. */

import 'server-only'

import { etsyFetchJson, holeGueltigenEtsyAccessToken, stelleShopIdSicher } from '@/lib/etsy/etsy-server'
import type { EtsyBestellStatus } from '@/lib/etsy/etsy-shop-os-types'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { SupabaseClient } from '@supabase/supabase-js'

type ApiReceipt = {
  receipt_id?: number
  name?: string
  first_line?: string
  second_line?: string
  city?: string
  zip?: string
  country_iso?: string
  status?: string
  is_shipped?: boolean
  create_timestamp?: number
  created_timestamp?: number
  grandtotal?: { amount?: number; divisor?: number }
  total_price?: { amount?: number; divisor?: number }
  transactions?: Array<{
    listing_id?: number
    title?: string
    quantity?: number
  }>
}

function betragEur(r: ApiReceipt): number | null {
  const raw = r.grandtotal ?? r.total_price
  if (!raw?.amount) return null
  return Math.round((Number(raw.amount) / (Number(raw.divisor) || 100)) * 100) / 100
}

function zollHinweis(landIso: string | null | undefined): string {
  if (!landIso) return ''
  const eu = new Set([
    'DE', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GR', 'HU', 'IE', 'IT',
    'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  ])
  if (eu.has(landIso.toUpperCase())) return ''
  return 'Nicht-EU: Zollinhaltserklärung / Handelsrechnung prüfen.'
}

const DEFAULT_VORLAGEN: Array<{ schluessel: string; titel: string; text: string }> = [
  {
    schluessel: 'unterwegs',
    titel: 'Unterwegs',
    text: 'Deine Schale ist unterwegs. Sobald sie ankommt, freue ich mich über eine kurze Rückmeldung — und wenn alles passt, über eine Bewertung.',
  },
  {
    schluessel: 'angekommen',
    titel: 'Angekommen?',
    text: 'Ist deine Schale gut angekommen? Bei Fragen zur Pflege (Walnussöl, kein Spülmaschine) melde dich gerne.',
  },
  {
    schluessel: 'pflege',
    titel: 'Pflegehinweis',
    text: 'Pflege-Tipp: gelegentlich mit lebensmittelechtem Walnussöl nachölen, trocken abwischen, nicht in die Spülmaschine.',
  },
]

export async function stelleVersandVorlagenSicher(ownerUserId: string, sb: SupabaseClient): Promise<void> {
  const { count } = await sb
    .from('etsy_versand_vorlage')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', ownerUserId)
  if ((count ?? 0) > 0) return
  await sb.from('etsy_versand_vorlage').insert(
    DEFAULT_VORLAGEN.map((v) => ({
      owner_user_id: ownerUserId,
      schluessel: v.schluessel,
      titel: v.titel,
      text: v.text,
    })),
  )
}

export async function syncEtsyBestellungen(ownerUserId: string): Promise<{ anzahl: number; fehler?: string }> {
  const tokens = await holeGueltigenEtsyAccessToken(ownerUserId)
  const shopId = await stelleShopIdSicher(ownerUserId, tokens)
  const admin = createSupabaseAdmin()
  const zeilen: Array<Record<string, unknown>> = []
  const grenze = Date.now() - 120 * 86_400_000

  for (let seite = 0; seite < 5; seite++) {
    let data: { results?: ApiReceipt[] }
    try {
      data = await etsyFetchJson<{ results?: ApiReceipt[] }>(
        tokens.accessToken,
        `/application/shops/${shopId}/receipts?limit=50&offset=${seite * 50}&was_paid=true`,
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { anzahl: zeilen.length, fehler: /\b40[13]\b/.test(msg) ? 'scope' : msg.slice(0, 160) }
    }
    const results = data.results ?? []
    let aelteste = Infinity
    for (const r of results) {
      const rid = Number(r.receipt_id)
      if (!Number.isFinite(rid)) continue
      const ts = Number(r.create_timestamp ?? r.created_timestamp) * 1000
      if (Number.isFinite(ts)) aelteste = Math.min(aelteste, ts)
      if (Number.isFinite(ts) && ts < grenze) continue
      const tx = r.transactions?.[0]
      const land = r.country_iso ? String(r.country_iso) : null
      const shipped = Boolean(r.is_shipped)
      zeilen.push({
        owner_user_id: ownerUserId,
        receipt_id: rid,
        listing_id: tx?.listing_id != null ? Number(tx.listing_id) : null,
        listing_title: String(tx?.title || '').slice(0, 200),
        kaeufer_name: String(r.name || '').slice(0, 120),
        land_iso: land,
        stadt: r.city ? String(r.city) : null,
        plz: r.zip ? String(r.zip) : null,
        adresse: [r.first_line, r.second_line].filter(Boolean).join(', ').slice(0, 300),
        betrag_eur: betragEur(r),
        menge: Math.max(1, Number(tx?.quantity) || 1),
        is_shipped: shipped,
        zoll_hinweis: zollHinweis(land),
        gekauft_at: Number.isFinite(ts) ? new Date(ts).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
    }
    if (results.length < 50 || aelteste < grenze) break
  }

  if (!zeilen.length) return { anzahl: 0 }

  // Status nur setzen, wenn Zeile neu ist — bestehende Status nicht überschreiben.
  const { data: exist } = await admin
    .from('etsy_bestellung')
    .select('receipt_id, status')
    .eq('owner_user_id', ownerUserId)
    .in(
      'receipt_id',
      zeilen.map((z) => z.receipt_id as number),
    )
  const statusMap = new Map((exist ?? []).map((e) => [Number(e.receipt_id), String(e.status)]))

  const upserts = zeilen.map((z) => {
    const alt = statusMap.get(Number(z.receipt_id))
    const shipped = Boolean(z.is_shipped)
    let status: EtsyBestellStatus = (alt as EtsyBestellStatus) || 'neu'
    if (!alt && shipped) status = 'versendet'
    if (alt === 'neu' && shipped) status = 'versendet'
    return { ...z, status }
  })

  const { error } = await admin.from('etsy_bestellung').upsert(upserts, {
    onConflict: 'owner_user_id,receipt_id',
  })
  if (error) return { anzahl: 0, fehler: error.message }
  return { anzahl: upserts.length }
}

export type EtsyBestellungZeile = {
  receiptId: number
  listingId: number | null
  listingTitle: string
  status: EtsyBestellStatus
  kaeuferName: string
  landIso: string | null
  stadt: string | null
  plz: string | null
  adresse: string
  betragEur: number | null
  menge: number
  isShipped: boolean
  gewichtG: number | null
  masseText: string | null
  zollHinweis: string
  notiz: string
  gekauftAt: string | null
}

export async function ladeEtsyBestellungen(ownerUserId: string, sb: SupabaseClient): Promise<EtsyBestellungZeile[]> {
  const { data, error } = await sb
    .from('etsy_bestellung')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .order('gekauft_at', { ascending: false })
    .limit(80)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    receiptId: Number(r.receipt_id),
    listingId: r.listing_id != null ? Number(r.listing_id) : null,
    listingTitle: String(r.listing_title || ''),
    status: r.status as EtsyBestellStatus,
    kaeuferName: String(r.kaeufer_name || ''),
    landIso: r.land_iso != null ? String(r.land_iso) : null,
    stadt: r.stadt != null ? String(r.stadt) : null,
    plz: r.plz != null ? String(r.plz) : null,
    adresse: String(r.adresse || ''),
    betragEur: r.betrag_eur != null ? Number(r.betrag_eur) : null,
    menge: Number(r.menge) || 1,
    isShipped: Boolean(r.is_shipped),
    gewichtG: r.gewicht_g != null ? Number(r.gewicht_g) : null,
    masseText: r.masse_text != null ? String(r.masse_text) : null,
    zollHinweis: String(r.zoll_hinweis || ''),
    notiz: String(r.notiz || ''),
    gekauftAt: r.gekauft_at != null ? String(r.gekauft_at) : null,
  }))
}

export async function setzeBestellStatus(
  ownerUserId: string,
  receiptId: number,
  status: EtsyBestellStatus,
  patch: { notiz?: string; gewichtG?: number | null; masseText?: string | null },
  sb: SupabaseClient,
): Promise<void> {
  const { error } = await sb
    .from('etsy_bestellung')
    .update({
      status,
      notiz: patch.notiz,
      gewicht_g: patch.gewichtG,
      masse_text: patch.masseText,
      status_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('owner_user_id', ownerUserId)
    .eq('receipt_id', receiptId)
  if (error) throw new Error(error.message)
}
