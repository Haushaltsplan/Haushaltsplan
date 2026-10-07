import 'server-only'

import { analyseTickerFuerPosition } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { requireOwnerUserId } from '@/lib/request-owner'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type {
  JournalEintrag,
  JournalGegenpruefung,
  JournalGegenpruefungStatus,
} from '@/lib/portfolio-analyse/investment-journal-types'

const TABLE = 'portfolio_investment_journal'
const TABLE_GP = 'portfolio_journal_gegenpruefung'

function admin() {
  return createSupabaseAdmin()
}

function istKonfiguriert() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

function mapStatusGp(raw: unknown): JournalGegenpruefungStatus | null {
  const s = String(raw ?? '')
  if (s === 'intakt' || s === 'unter_beobachtung' || s === 'beschaedigt') return s
  return null
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
    letzteGegenpruefungAm:
      row.letzte_gegenpruefung_am != null ? String(row.letzte_gegenpruefung_am) : null,
    letzteGegenpruefungStatus: mapStatusGp(row.letzte_gegenpruefung_status),
    erstelltAm: String(row.erstellt_am ?? ''),
    aktualisiertAm: String(row.aktualisiert_am ?? ''),
  }
}

function mapGpRow(row: Record<string, unknown>): JournalGegenpruefung {
  const details =
    row.details_json && typeof row.details_json === 'object' && !Array.isArray(row.details_json)
      ? (row.details_json as Record<string, unknown>)
      : {}
  return {
    id: String(row.id),
    journalId: row.journal_id != null ? String(row.journal_id) : null,
    ticker: String(row.ticker ?? ''),
    isin: row.isin != null ? String(row.isin) : null,
    quartalLabel: String(row.quartal_label ?? ''),
    status: mapStatusGp(row.status) ?? 'unter_beobachtung',
    fazit: String(row.fazit ?? ''),
    details,
    kiModell: row.ki_modell != null ? String(row.ki_modell) : null,
    erstelltAm: String(row.erstellt_am ?? ''),
  }
}

function tickerAliase(ticker: string): string[] {
  const t = ticker.trim().toUpperCase()
  if (!t) return []
  const bare = t.includes('.') ? t.split('.')[0]! : t
  return [...new Set([t, bare].filter(Boolean))]
}

function journalTreffer(
  e: JournalEintrag,
  opts: { ticker?: string; isin?: string | null },
): boolean {
  const isin = opts.isin?.trim().toUpperCase()
  if (isin && e.isin?.trim().toUpperCase() === isin) return true
  if (!opts.ticker) return !opts.isin
  const aliases = tickerAliase(opts.ticker)
  const et = e.ticker.trim().toUpperCase()
  const eBare = et.includes('.') ? et.split('.')[0]! : et
  return aliases.includes(et) || aliases.includes(eBare)
}

export async function ladeJournalEintraege(opts?: {
  ticker?: string
  isin?: string | null
}): Promise<JournalEintrag[]> {
  if (!istKonfiguriert()) return []
  const q = admin()
    .from(TABLE)
    .select('*')
    .eq('owner_user_id', requireOwnerUserId())
    .order('aktualisiert_am', { ascending: false })
  const { data, error } = await q
  if (error || !data) return []
  const alle = data.map((r) => mapRow(r as Record<string, unknown>))
  if (!opts?.ticker && !opts?.isin) return alle
  return alle.filter((e) => journalTreffer(e, { ticker: opts.ticker, isin: opts.isin }))
}

export async function ladeAktivenJournalEintrag(
  ticker: string,
  isin?: string | null,
): Promise<JournalEintrag | null> {
  const list = await ladeJournalEintraege({ ticker, isin })
  return list.find((e) => e.status === 'aktiv') ?? list[0] ?? null
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
  /** Nur leere Felder aus `fuelle` übernehmen (bestehende Texte bleiben). */
  nurLeereFuellen?: boolean
  fuelle?: { these?: string; kaufgrund?: string; watchpoints?: string }
}): Promise<JournalEintrag | null> {
  if (!istKonfiguriert()) throw new Error('Supabase nicht konfiguriert')
  const owner = requireOwnerUserId()
  const tickerRoh = input.ticker.trim().toUpperCase()
  const ticker = analyseTickerFuerPosition(input.isin ?? null, tickerRoh) || tickerRoh
  const review =
    input.reviewAm?.slice(0, 10) ||
    (() => {
      const d = new Date()
      d.setUTCMonth(d.getUTCMonth() + 6)
      return d.toISOString().slice(0, 10)
    })()

  let these = input.these ?? ''
  let kaufgrund = input.kaufgrund ?? ''
  let watchpoints = input.watchpoints ?? ''

  if (input.nurLeereFuellen && input.fuelle) {
    const bestehend = input.id
      ? (await ladeJournalEintraege({ ticker, isin: input.isin })).find((e) => e.id === input.id)
      : await ladeAktivenJournalEintrag(ticker, input.isin)
    these = bestehend?.these?.trim() ? bestehend.these : input.fuelle.these ?? ''
    kaufgrund = bestehend?.kaufgrund?.trim() ? bestehend.kaufgrund : input.fuelle.kaufgrund ?? ''
    watchpoints = bestehend?.watchpoints?.trim()
      ? bestehend.watchpoints
      : input.fuelle.watchpoints ?? ''
    // Wenn alle schon voll und kein id-Update nötig: trotzdem upsert mit bestehenden Werten
    if (bestehend && !input.id) {
      input = { ...input, id: bestehend.id }
    }
  }

  const payload = {
    owner_user_id: owner,
    isin: input.isin ?? null,
    ticker,
    name: input.name ?? ticker,
    these,
    kaufgrund,
    watchpoints,
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

  // Upsert auf aktiven Ticker (inkl. Alias ASML.AS → ASML)
  const bestehend = await ladeAktivenJournalEintrag(ticker, input.isin)
  if (bestehend) {
    const { data, error } = await admin()
      .from(TABLE)
      .update(payload)
      .eq('owner_user_id', owner)
      .eq('id', bestehend.id)
      .select('*')
      .maybeSingle()
    if (error || !data) throw new Error(error?.message ?? 'Update fehlgeschlagen')
    return mapRow(data as Record<string, unknown>)
  }

  const { data, error } = await admin().from(TABLE).insert(payload).select('*').maybeSingle()
  if (error || !data) throw new Error(error?.message ?? 'Insert fehlgeschlagen')
  return mapRow(data as Record<string, unknown>)
}

export async function speichereJournalGegenpruefung(input: {
  journalId?: string | null
  ticker: string
  isin?: string | null
  quartalLabel: string
  status: JournalGegenpruefungStatus
  fazit: string
  details?: Record<string, unknown>
  kiModell?: string | null
}): Promise<JournalGegenpruefung> {
  if (!istKonfiguriert()) throw new Error('Supabase nicht konfiguriert')
  const owner = requireOwnerUserId()
  const ticker = input.ticker.trim().toUpperCase()
  const jetzt = new Date().toISOString()

  const { data, error } = await admin()
    .from(TABLE_GP)
    .insert({
      owner_user_id: owner,
      journal_id: input.journalId ?? null,
      ticker,
      isin: input.isin ?? null,
      quartal_label: input.quartalLabel.slice(0, 80),
      status: input.status,
      fazit: input.fazit.slice(0, 8_000),
      details_json: input.details ?? {},
      ki_modell: input.kiModell?.slice(0, 80) ?? null,
      erstellt_am: jetzt,
    })
    .select('*')
    .maybeSingle()

  if (error || !data) {
    // Spalte/Tabelle fehlt ggf. noch — Fallback-Fehler klar
    throw new Error(error?.message ?? 'Gegenprüfung speichern fehlgeschlagen')
  }

  // Denorm auf Journal (best effort)
  try {
    let q = admin()
      .from(TABLE)
      .update({
        letzte_gegenpruefung_am: jetzt,
        letzte_gegenpruefung_status: input.status,
        aktualisiert_am: jetzt,
      })
      .eq('owner_user_id', owner)
    if (input.journalId) q = q.eq('id', input.journalId)
    else q = q.eq('ticker', ticker).eq('status', 'aktiv')
    await q
  } catch {
    /* Migration ggf. noch nicht da */
  }

  return mapGpRow(data as Record<string, unknown>)
}

export async function ladeJournalGegenpruefungen(opts: {
  ticker?: string
  limit?: number
}): Promise<JournalGegenpruefung[]> {
  if (!istKonfiguriert()) return []
  let q = admin()
    .from(TABLE_GP)
    .select('*')
    .eq('owner_user_id', requireOwnerUserId())
    .order('erstellt_am', { ascending: false })
    .limit(opts.limit ?? 40)
  if (opts.ticker) q = q.eq('ticker', opts.ticker.trim().toUpperCase())
  const { data, error } = await q
  if (error || !data) return []
  return data.map((r) => mapGpRow(r as Record<string, unknown>))
}
