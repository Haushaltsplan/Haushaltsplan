/**
 * Echte Etsy Payment-Account Ledger + Payments (Scope transactions_r).
 * Endpoint: GET /shops/{id}/payment-account/ledger-entries
 *           GET /shops/{id}/payments
 */

import 'server-only'

import { etsyFetchJson, holeGueltigenEtsyAccessToken, stelleShopIdSicher } from '@/lib/etsy/etsy-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { SupabaseClient } from '@supabase/supabase-js'

type Money = { amount?: number; divisor?: number; currency_code?: string }

type ApiLedgerEntry = {
  entry_id?: number
  ledger_id?: number
  amount?: number
  currency?: string
  description?: string
  balance?: number | string
  create_date?: number
  created_timestamp?: number
  ledger_type?: string
  entry_type?: string
  parent_entry_id?: number | null
}

type ApiPayment = {
  payment_id?: number
  receipt_id?: number | null
  amount_gross?: Money
  amount_fees?: Money
  amount_net?: Money
  shipping_cost?: Money
  currency?: string
  status?: string
  create_timestamp?: number
  created_timestamp?: number
}

function moneyEur(m: Money | undefined): number | null {
  if (!m?.amount && m?.amount !== 0) return null
  const div = Number(m.divisor) || 100
  return Math.round((Number(m.amount) / div) * 100) / 100
}

/** Ledger-Amount: Etsy liefert oft Cent als Integer ohne Money-Objekt. */
function ledgerAmountEur(raw: ApiLedgerEntry): number | null {
  if (raw.amount == null) return null
  // Typisch: amount in kleinster Währungseinheit (Cents)
  const n = Number(raw.amount)
  if (!Number.isFinite(n)) return null
  // Heuristik: |amount| >= 1000 und ganzzahlig → Cents; sonst schon EUR
  if (Number.isInteger(n) && Math.abs(n) >= 50) return Math.round((n / 100) * 100) / 100
  return Math.round(n * 100) / 100
}

function balanceEur(raw: ApiLedgerEntry): number | null {
  if (raw.balance == null) return null
  const n = Number(raw.balance)
  if (!Number.isFinite(n)) return null
  if (Number.isInteger(n) && Math.abs(n) >= 50) return Math.round((n / 100) * 10000) / 10000
  return Math.round(n * 10000) / 10000
}

export async function syncEtsyFeeLedger(ownerUserId: string): Promise<{
  ledger: number
  payments: number
  fehler?: string
}> {
  const tokens = await holeGueltigenEtsyAccessToken(ownerUserId)
  const shopId = await stelleShopIdSicher(ownerUserId, tokens)
  const admin = createSupabaseAdmin()
  const minCreated = Math.floor((Date.now() - 120 * 86_400_000) / 1000)

  let ledgerCount = 0
  const ledgerRows: Array<Record<string, unknown>> = []
  for (let seite = 0; seite < 8; seite++) {
    let data: { results?: ApiLedgerEntry[]; count?: number }
    try {
      data = await etsyFetchJson<{ results?: ApiLedgerEntry[] }>(
        tokens.accessToken,
        `/application/shops/${shopId}/payment-account/ledger-entries?limit=50&offset=${seite * 50}&min_created=${minCreated}`,
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return {
        ledger: ledgerCount,
        payments: 0,
        fehler: /\b40[13]\b/.test(msg) ? 'scope' : msg.slice(0, 160),
      }
    }
    const results = data.results ?? []
    for (const e of results) {
      const id = Number(e.entry_id)
      if (!Number.isFinite(id)) continue
      const ts = Number(e.create_date ?? e.created_timestamp)
      ledgerRows.push({
        owner_user_id: ownerUserId,
        entry_id: id,
        ledger_id: e.ledger_id != null ? Number(e.ledger_id) : null,
        amount_eur: ledgerAmountEur(e),
        balance_eur: balanceEur(e),
        currency: String(e.currency || 'EUR').slice(0, 8),
        description: String(e.description || '').slice(0, 400),
        entry_type: String(e.entry_type || e.ledger_type || '').slice(0, 80),
        parent_entry_id: e.parent_entry_id != null ? Number(e.parent_entry_id) : null,
        created_at_etsy: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : null,
        synced_at: new Date().toISOString(),
        raw_json: e,
      })
    }
    ledgerCount += results.length
    if (results.length < 50) break
  }
  if (ledgerRows.length) {
    const { error } = await admin.from('etsy_payment_ledger').upsert(ledgerRows, {
      onConflict: 'owner_user_id,entry_id',
    })
    if (error) return { ledger: 0, payments: 0, fehler: error.message }
  }

  let paymentCount = 0
  const payRows: Array<Record<string, unknown>> = []
  for (let seite = 0; seite < 5; seite++) {
    let data: { results?: ApiPayment[] }
    try {
      data = await etsyFetchJson<{ results?: ApiPayment[] }>(
        tokens.accessToken,
        `/application/shops/${shopId}/payments?limit=50&offset=${seite * 50}`,
      )
    } catch (e) {
      // Payments können 404/leer sein — Ledger reicht
      return {
        ledger: ledgerRows.length,
        payments: paymentCount,
        fehler: e instanceof Error ? e.message.slice(0, 120) : undefined,
      }
    }
    const results = data.results ?? []
    for (const p of results) {
      const id = Number(p.payment_id)
      if (!Number.isFinite(id)) continue
      const ts = Number(p.create_timestamp ?? p.created_timestamp)
      payRows.push({
        owner_user_id: ownerUserId,
        payment_id: id,
        receipt_id: p.receipt_id != null ? Number(p.receipt_id) : null,
        amount_gross_eur: moneyEur(p.amount_gross),
        amount_fees_eur: moneyEur(p.amount_fees),
        amount_net_eur: moneyEur(p.amount_net),
        shipping_eur: moneyEur(p.shipping_cost),
        currency: String(p.currency || p.amount_gross?.currency_code || 'EUR').slice(0, 8),
        status: String(p.status || '').slice(0, 40),
        created_at_etsy: Number.isFinite(ts) ? new Date(ts * 1000).toISOString() : null,
        synced_at: new Date().toISOString(),
        raw_json: p,
      })
    }
    paymentCount += results.length
    if (results.length < 50) break
  }
  if (payRows.length) {
    const { error } = await admin.from('etsy_payment').upsert(payRows, {
      onConflict: 'owner_user_id,payment_id',
    })
    if (error) return { ledger: ledgerRows.length, payments: 0, fehler: error.message }
  }

  return { ledger: ledgerRows.length, payments: payRows.length }
}

export type EtsyFeeLedgerErgebnis = {
  fees30Eur: number
  gross30Eur: number
  net30Eur: number
  ledgerDebits30Eur: number
  ledgerCredits30Eur: number
  paymentsCount30: number
  ledgerCount30: number
  vergleichModell: {
    modellGebuehren30: number
    deltaEur: number
    hinweis: string
  }
  letzteEintraege: Array<{
    entryId: number
    amountEur: number | null
    description: string
    entryType: string
    at: string | null
  }>
}

export async function baueEtsyFeeLedgerAuswertung(
  ownerUserId: string,
  sb: SupabaseClient,
  modellGebuehren30: number,
): Promise<EtsyFeeLedgerErgebnis> {
  const ab = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [ledgerRes, payRes] = await Promise.all([
    sb
      .from('etsy_payment_ledger')
      .select('entry_id, amount_eur, description, entry_type, created_at_etsy')
      .eq('owner_user_id', ownerUserId)
      .gte('created_at_etsy', ab)
      .order('created_at_etsy', { ascending: false })
      .limit(200),
    sb
      .from('etsy_payment')
      .select('payment_id, amount_gross_eur, amount_fees_eur, amount_net_eur, created_at_etsy')
      .eq('owner_user_id', ownerUserId)
      .gte('created_at_etsy', ab)
      .limit(200),
  ])

  let fees30Eur = 0
  let gross30Eur = 0
  let net30Eur = 0
  for (const p of payRes.data ?? []) {
    fees30Eur += Number(p.amount_fees_eur) || 0
    gross30Eur += Number(p.amount_gross_eur) || 0
    net30Eur += Number(p.amount_net_eur) || 0
  }

  let ledgerDebits30Eur = 0
  let ledgerCredits30Eur = 0
  for (const e of ledgerRes.data ?? []) {
    const a = Number(e.amount_eur) || 0
    if (a < 0) ledgerDebits30Eur += Math.abs(a)
    else ledgerCredits30Eur += a
  }

  // Wenn Payments Fees haben, die nutzen; sonst Ledger-Debits als Proxy
  const echteFees = fees30Eur > 0 ? fees30Eur : ledgerDebits30Eur
  const delta = Math.round((echteFees - modellGebuehren30) * 100) / 100

  return {
    fees30Eur: Math.round(echteFees * 100) / 100,
    gross30Eur: Math.round(gross30Eur * 100) / 100,
    net30Eur: Math.round(net30Eur * 100) / 100,
    ledgerDebits30Eur: Math.round(ledgerDebits30Eur * 100) / 100,
    ledgerCredits30Eur: Math.round(ledgerCredits30Eur * 100) / 100,
    paymentsCount30: payRes.data?.length ?? 0,
    ledgerCount30: ledgerRes.data?.length ?? 0,
    vergleichModell: {
      modellGebuehren30,
      deltaEur: delta,
      hinweis:
        fees30Eur > 0
          ? 'Echte Payment-Fees vs. Modell (6,5%+4%+0,25€).'
          : ledgerDebits30Eur > 0
            ? 'Keine Payment-Fee-Felder — Ledger-Debits als Fee-Proxy.'
            : 'Noch keine Ledger-Daten — einmal syncen / Migration prüfen.',
    },
    letzteEintraege: (ledgerRes.data ?? []).slice(0, 12).map((e) => ({
      entryId: Number(e.entry_id),
      amountEur: e.amount_eur != null ? Number(e.amount_eur) : null,
      description: String(e.description || ''),
      entryType: String(e.entry_type || ''),
      at: e.created_at_etsy != null ? String(e.created_at_etsy) : null,
    })),
  }
}
