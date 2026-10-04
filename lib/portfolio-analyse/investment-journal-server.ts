import 'server-only'

import { requireOwnerUserId } from '@/lib/request-owner'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export type JournalEintrag = {
  id: string
  isin: string | null
  ticker: string
  name: string
  these: string
  kaufgrund: string
  watchpoints: string
  status: 'aktiv' | 'geschlossen'
  reviewAm: string | null
  erstelltAm: string
  aktualisiertAm: string
}

const TABLE = 'portfolio_investment_journal'

function admin() {
  return createSupabaseAdmin()
}

function istKonfiguriert() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function mapRow(row: Record<string, unknown>): JournalEintrag {
  return {
    id: String(row.id),
    isin: row.isin != null ? String(row.isin) : null,
    ticker: String(row.ticker ?? ''),
    name: String(row.name ?? ''),
    these: String(row.these ?? ''),
    kaufgrund: String(row.kaufgrund ?? ''),
    watchpoints: String(row.watchpoints ?? ''),
    status: row.status === 'geschlossen' ? 'geschlossen' : 'aktiv',
    reviewAm: row.review_am != null ? String(row.review_am).slice(0, 10) : null,
    erstelltAm: String(row.erstellt_am ?? ''),
    aktualisiertAm: String(row.aktualisiert_am ?? ''),
  }
}

export async function ladeJournalEintraege(opts?: { ticker?: string }): Promise<JournalEintrag[]> {
  if (!istKonfiguriert()) return []
  let q = admin()
    .from(TABLE)
    .select('*')
    .eq('owner_user_id', requireOwnerUserId())
    .order('aktualisiert_am', { ascending: false })
  if (opts?.ticker) q = q.eq('ticker', opts.ticker.trim().toUpperCase())
  const { data, error } = await q
  if (error || !data) return []
  return data.map((r) => mapRow(r as Record<string, unknown>))
}

export async function speichereJournalEintrag(input: {
  id?: string
  isin?: string | null
  ticker: string
  name?: string
  these?: string
  kaufgrund?: string
  watchpoints?: string
  status?: 'aktiv' | 'geschlossen'
  reviewAm?: string | null
}): Promise<JournalEintrag | null> {
  if (!istKonfiguriert()) throw new Error('Supabase nicht konfiguriert')
  const owner = requireOwnerUserId()
  const ticker = input.ticker.trim().toUpperCase()
  const review =
    input.reviewAm?.slice(0, 10) ||
    (() => {
      const d = new Date()
      d.setUTCMonth(d.getUTCMonth() + 6)
      return d.toISOString().slice(0, 10)
    })()

  const payload = {
    owner_user_id: owner,
    isin: input.isin ?? null,
    ticker,
    name: input.name ?? ticker,
    these: input.these ?? '',
    kaufgrund: input.kaufgrund ?? '',
    watchpoints: input.watchpoints ?? '',
    status: input.status ?? 'aktiv',
    review_am: review,
    aktualisiert_am: new Date().toISOString(),
  }

  if (input.id) {
    const { data, error } = await admin()
      .from(TABLE)
      .update(payload)
      .eq('owner_user_id', owner)
      .eq('id', input.id)
      .select('*')
      .maybeSingle()
    if (error || !data) throw new Error(error?.message ?? 'Update fehlgeschlagen')
    return mapRow(data as Record<string, unknown>)
  }

  const { data, error } = await admin().from(TABLE).insert(payload).select('*').maybeSingle()
  if (error || !data) throw new Error(error?.message ?? 'Insert fehlgeschlagen')
  return mapRow(data as Record<string, unknown>)
}
