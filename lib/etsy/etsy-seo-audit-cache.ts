/** Persistenz: SEO-Audit-Cache, Historie, Rank-Cache. */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { EtsyRankVerlust, EtsySeoAuditResult } from '@/lib/etsy/etsy-seo-audit-types'

export type EtsySeoCacheEintrag = {
  listingId: number
  fingerprint: string
  overallScore: number
  audit: EtsySeoAuditResult
  listingTitle: string
  state: string | null
  auditedAt: string
}

export async function ladeEtsySeoCacheMap(
  ownerUserId: string,
): Promise<Map<number, EtsySeoCacheEintrag>> {
  const { data, error } = await createSupabaseAdmin()
    .from('etsy_seo_audit_cache')
    .select('listing_id, fingerprint, overall_score, audit_json, listing_title, state, audited_at')
    .eq('owner_user_id', ownerUserId)
  const map = new Map<number, EtsySeoCacheEintrag>()
  if (error || !data) return map
  for (const r of data) {
    const listingId = Number(r.listing_id)
    if (!Number.isFinite(listingId)) continue
    map.set(listingId, {
      listingId,
      fingerprint: String(r.fingerprint || ''),
      overallScore: Number(r.overall_score),
      audit: r.audit_json as EtsySeoAuditResult,
      listingTitle: String(r.listing_title || ''),
      state: r.state != null ? String(r.state) : null,
      auditedAt: String(r.audited_at),
    })
  }
  return map
}

export async function ladeEtsySeoCacheFuerListing(
  ownerUserId: string,
  listingId: number,
): Promise<EtsySeoCacheEintrag | null> {
  const { data, error } = await createSupabaseAdmin()
    .from('etsy_seo_audit_cache')
    .select('listing_id, fingerprint, overall_score, audit_json, listing_title, state, audited_at')
    .eq('owner_user_id', ownerUserId)
    .eq('listing_id', listingId)
    .maybeSingle()
  if (error || !data) return null
  return {
    listingId: Number(data.listing_id),
    fingerprint: String(data.fingerprint || ''),
    overallScore: Number(data.overall_score),
    audit: data.audit_json as EtsySeoAuditResult,
    listingTitle: String(data.listing_title || ''),
    state: data.state != null ? String(data.state) : null,
    auditedAt: String(data.audited_at),
  }
}

export async function speichereEtsySeoAudit(opts: {
  ownerUserId: string
  listingId: number
  fingerprint: string
  audit: EtsySeoAuditResult
  listingTitle: string
  state?: string | null
}): Promise<void> {
  const admin = createSupabaseAdmin()
  const { error } = await admin.from('etsy_seo_audit_cache').upsert({
    owner_user_id: opts.ownerUserId,
    listing_id: opts.listingId,
    fingerprint: opts.fingerprint,
    overall_score: opts.audit.overall_score,
    audit_json: opts.audit,
    listing_title: opts.listingTitle.slice(0, 200),
    state: opts.state ?? null,
    audited_at: new Date().toISOString(),
  })
  if (error) throw new Error(`SEO-Cache: ${error.message}`)

  await admin.from('etsy_seo_audit_historie').insert({
    owner_user_id: opts.ownerUserId,
    listing_id: opts.listingId,
    overall_score: opts.audit.overall_score,
    fingerprint: opts.fingerprint,
    audit_json: opts.audit,
  })
}

export type EtsySeoHistoriePunkt = {
  id: string
  listingId: number
  overallScore: number
  createdAt: string
}

export async function ladeEtsySeoHistorie(
  ownerUserId: string,
  listingId: number,
  limit = 20,
): Promise<EtsySeoHistoriePunkt[]> {
  const { data, error } = await createSupabaseAdmin()
    .from('etsy_seo_audit_historie')
    .select('id, listing_id, overall_score, created_at')
    .eq('owner_user_id', ownerUserId)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map((r) => ({
    id: String(r.id),
    listingId: Number(r.listing_id),
    overallScore: Number(r.overall_score),
    createdAt: String(r.created_at),
  }))
}

export async function ladeEtsySeoSchwachstellen(
  ownerUserId: string,
  maxScore = 79,
): Promise<EtsySeoCacheEintrag[]> {
  const { data, error } = await createSupabaseAdmin()
    .from('etsy_seo_audit_cache')
    .select('listing_id, fingerprint, overall_score, audit_json, listing_title, state, audited_at')
    .eq('owner_user_id', ownerUserId)
    .lte('overall_score', maxScore)
    .order('overall_score', { ascending: true })
    .limit(50)
  if (error || !data) return []
  return data.map((r) => ({
    listingId: Number(r.listing_id),
    fingerprint: String(r.fingerprint || ''),
    overallScore: Number(r.overall_score),
    audit: r.audit_json as EtsySeoAuditResult,
    listingTitle: String(r.listing_title || ''),
    state: r.state != null ? String(r.state) : null,
    auditedAt: String(r.audited_at),
  }))
}

export async function speichereEtsyRankErgebnisse(opts: {
  ownerUserId: string
  listingId: number
  results: Array<{
    keyword: string
    page: number | null
    position: number | null
    found: boolean
    note?: string
  }>
  provider: string
}): Promise<void> {
  if (opts.results.length === 0) return
  const admin = createSupabaseAdmin()
  const now = new Date().toISOString()
  const zeilen = opts.results.map((r) => ({
    owner_user_id: opts.ownerUserId,
    listing_id: opts.listingId,
    keyword: r.keyword.toLowerCase().slice(0, 80),
    page: r.page,
    position: r.position,
    found: r.found,
    provider: opts.provider,
    checked_at: now,
  }))
  const { error } = await admin
    .from('etsy_seo_rank_cache')
    .upsert(zeilen.map((z, i) => ({ ...z, note: opts.results[i]!.note?.slice(0, 200) ?? null })))
  if (error) throw new Error(`Rank-Cache: ${error.message}`)
  const hist = await admin.from('etsy_seo_rank_historie').insert(zeilen)
  if (hist.error) console.warn('[etsy-rank] historie:', hist.error.message)
}

/** Bisher getrackte Keywords je Listing = Fokus-Keywords für den Cron. */
export async function ladeEtsyFokusKeywords(ownerUserId: string): Promise<Map<number, string[]>> {
  const { data, error } = await createSupabaseAdmin()
    .from('etsy_seo_rank_cache')
    .select('listing_id, keyword, checked_at')
    .eq('owner_user_id', ownerUserId)
    .order('checked_at', { ascending: false })
  const map = new Map<number, string[]>()
  if (error || !data) return map
  for (const r of data) {
    const id = Number(r.listing_id)
    const kw = String(r.keyword || '').trim()
    if (!Number.isFinite(id) || !kw) continue
    const arr = map.get(id) ?? []
    if (!arr.includes(kw) && arr.length < 5) arr.push(kw)
    map.set(id, arr)
  }
  return map
}

/**
 * Verlust = gefunden → nicht gefunden, schlechtere Seite oder ≥10 Plätze schlechter
 * (Vergleich der letzten zwei Messungen je Listing+Keyword).
 */
export async function ladeEtsyRankVerluste(
  ownerUserId: string,
  tage = 21,
): Promise<EtsyRankVerlust[]> {
  const seit = new Date(Date.now() - tage * 86_400_000).toISOString()
  const { data, error } = await createSupabaseAdmin()
    .from('etsy_seo_rank_historie')
    .select('listing_id, keyword, page, position, found, checked_at')
    .eq('owner_user_id', ownerUserId)
    .gte('checked_at', seit)
    .order('checked_at', { ascending: false })
    .limit(2000)
  if (error || !data) return []

  const gruppen = new Map<string, typeof data>()
  for (const r of data) {
    const k = `${r.listing_id}|${r.keyword}`
    const arr = gruppen.get(k) ?? []
    if (arr.length < 2) arr.push(r)
    gruppen.set(k, arr)
  }

  const verluste: EtsyRankVerlust[] = []
  for (const [, [jetzt, vorher]] of gruppen) {
    if (!jetzt || !vorher) continue
    const j = {
      page: jetzt.page != null ? Number(jetzt.page) : null,
      position: jetzt.position != null ? Number(jetzt.position) : null,
      found: Boolean(jetzt.found),
    }
    const v = {
      page: vorher.page != null ? Number(vorher.page) : null,
      position: vorher.position != null ? Number(vorher.position) : null,
      found: Boolean(vorher.found),
    }
    const verloren =
      (v.found && !j.found) ||
      (v.page != null && j.page != null && j.page > v.page) ||
      (v.position != null && j.position != null && j.position - v.position >= 10)
    if (verloren) {
      verluste.push({
        listingId: Number(jetzt.listing_id),
        keyword: String(jetzt.keyword),
        vorher: v,
        jetzt: j,
        checkedAt: String(jetzt.checked_at),
      })
    }
  }
  return verluste
}

// ---------------------------------------------------------------------------
// Vorbereitete Vorschläge (Cron → UI 1-Klick)
// ---------------------------------------------------------------------------

export type EtsySeoVorschlagInhalt = {
  title: string
  tags: string[]
  descriptionIntro: string
  description?: string
}

export type EtsySeoVorschlag = {
  listingId: number
  status: 'offen' | 'uebernommen' | 'verworfen' | 'veraltet'
  grund: string
  fingerprint: string
  listingTitle: string
  scoreVorher: number | null
  before: EtsySeoVorschlagInhalt
  after: EtsySeoVorschlagInhalt
  audit: EtsySeoAuditResult | null
  createdAt: string
}

function mapVorschlag(r: Record<string, unknown>): EtsySeoVorschlag {
  return {
    listingId: Number(r.listing_id),
    status: String(r.status) as EtsySeoVorschlag['status'],
    grund: String(r.grund || ''),
    fingerprint: String(r.fingerprint || ''),
    listingTitle: String(r.listing_title || ''),
    scoreVorher: r.score_vorher != null ? Number(r.score_vorher) : null,
    before: r.before_json as EtsySeoVorschlagInhalt,
    after: r.after_json as EtsySeoVorschlagInhalt,
    audit: (r.audit_json as EtsySeoAuditResult | null) ?? null,
    createdAt: String(r.created_at),
  }
}

export async function speichereEtsySeoVorschlag(opts: {
  ownerUserId: string
  listingId: number
  grund: string
  fingerprint: string
  listingTitle: string
  scoreVorher: number | null
  before: EtsySeoVorschlagInhalt
  after: EtsySeoVorschlagInhalt
  audit: EtsySeoAuditResult
}): Promise<void> {
  const { error } = await createSupabaseAdmin().from('etsy_seo_vorschlag').upsert({
    owner_user_id: opts.ownerUserId,
    listing_id: opts.listingId,
    status: 'offen',
    grund: opts.grund.slice(0, 300),
    fingerprint: opts.fingerprint,
    listing_title: opts.listingTitle.slice(0, 200),
    score_vorher: opts.scoreVorher,
    before_json: opts.before,
    after_json: opts.after,
    audit_json: opts.audit,
    created_at: new Date().toISOString(),
    entschieden_at: null,
  })
  if (error) throw new Error(`Vorschlag: ${error.message}`)
}

export async function ladeEtsySeoVorschlaege(
  ownerUserId: string,
  status: EtsySeoVorschlag['status'] = 'offen',
): Promise<EtsySeoVorschlag[]> {
  const { data, error } = await createSupabaseAdmin()
    .from('etsy_seo_vorschlag')
    .select(
      'listing_id, status, grund, fingerprint, listing_title, score_vorher, before_json, after_json, audit_json, created_at',
    )
    .eq('owner_user_id', ownerUserId)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error || !data) return []
  return data.map((r) => mapVorschlag(r as Record<string, unknown>))
}

export async function ladeEtsySeoVorschlag(
  ownerUserId: string,
  listingId: number,
): Promise<EtsySeoVorschlag | null> {
  const { data, error } = await createSupabaseAdmin()
    .from('etsy_seo_vorschlag')
    .select(
      'listing_id, status, grund, fingerprint, listing_title, score_vorher, before_json, after_json, audit_json, created_at',
    )
    .eq('owner_user_id', ownerUserId)
    .eq('listing_id', listingId)
    .maybeSingle()
  if (error || !data) return null
  return mapVorschlag(data as Record<string, unknown>)
}

export async function setzeEtsySeoVorschlagStatus(
  ownerUserId: string,
  listingId: number,
  status: Exclude<EtsySeoVorschlag['status'], 'offen'>,
): Promise<void> {
  const { error } = await createSupabaseAdmin()
    .from('etsy_seo_vorschlag')
    .update({ status, entschieden_at: new Date().toISOString() })
    .eq('owner_user_id', ownerUserId)
    .eq('listing_id', listingId)
  if (error) throw new Error(`Vorschlag-Status: ${error.message}`)
}

export type EtsyRankKurz = {
  listingId: number
  bestPage: number | null
  bestPosition: number | null
  keyword: string
  found: boolean
  checkedAt: string
  /** Mindestens ein getracktes Keyword: nicht gefunden oder Seite ≥ 3 */
  hasWeak: boolean
  weakKeyword: string | null
}

export type EtsyRankCacheZeile = {
  keyword: string
  page: number | null
  position: number | null
  found: boolean
  note: string | null
  checkedAt: string
  provider: string | null
}

/** Alle Rank-Cache-Zeilen eines Listings (für Top-5-Anzeige). */
export async function ladeEtsyRankCacheFuerListing(
  ownerUserId: string,
  listingId: number,
): Promise<EtsyRankCacheZeile[]> {
  const { data, error } = await createSupabaseAdmin()
    .from('etsy_seo_rank_cache')
    .select('keyword, page, position, found, note, checked_at, provider')
    .eq('owner_user_id', ownerUserId)
    .eq('listing_id', listingId)
    .order('checked_at', { ascending: false })
  if (error || !data) return []
  return data.map((r) => ({
    keyword: String(r.keyword || ''),
    page: r.page != null ? Number(r.page) : null,
    position: r.position != null ? Number(r.position) : null,
    found: Boolean(r.found),
    note: r.note != null ? String(r.note) : null,
    checkedAt: String(r.checked_at),
    provider: r.provider != null ? String(r.provider) : null,
  }))
}

/**
 * Rank-Kurzinfo je Listing: beste gefundene Position + Schwach-Flag
 * (nicht gefunden oder Seite ≥ 3 unter allen getrackten Keywords).
 */
export async function ladeEtsyRankMap(ownerUserId: string): Promise<Map<number, EtsyRankKurz>> {
  const { data, error } = await createSupabaseAdmin()
    .from('etsy_seo_rank_cache')
    .select('listing_id, keyword, page, position, found, checked_at')
    .eq('owner_user_id', ownerUserId)
  const map = new Map<number, EtsyRankKurz>()
  if (error || !data) return map
  for (const r of data) {
    const listingId = Number(r.listing_id)
    if (!Number.isFinite(listingId)) continue
    const page = r.page != null ? Number(r.page) : null
    const position = r.position != null ? Number(r.position) : null
    const found = Boolean(r.found)
    const keyword = String(r.keyword || '')
    const checkedAt = String(r.checked_at)
    const schwach = !found || page == null || page >= 3
    const prev = map.get(listingId)
    if (!prev) {
      map.set(listingId, {
        listingId,
        bestPage: found ? page : null,
        bestPosition: found ? position : null,
        keyword: found ? keyword : keyword,
        found,
        checkedAt,
        hasWeak: schwach,
        weakKeyword: schwach ? keyword : null,
      })
      continue
    }
    if (schwach) {
      prev.hasWeak = true
      if (!prev.weakKeyword) prev.weakKeyword = keyword
    }
    const better =
      found &&
      page != null &&
      (prev.bestPage == null ||
        page < prev.bestPage ||
        (page === prev.bestPage &&
          position != null &&
          (prev.bestPosition == null || position < prev.bestPosition)))
    if (better) {
      prev.bestPage = page
      prev.bestPosition = position
      prev.keyword = keyword
      prev.found = true
      prev.checkedAt = checkedAt
    } else if (checkedAt > prev.checkedAt) {
      prev.checkedAt = checkedAt
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// Hauptbegriff pro Listing
// ---------------------------------------------------------------------------

export async function ladeEtsyHauptbegriffe(ownerUserId: string): Promise<Map<number, string>> {
  const { data, error } = await createSupabaseAdmin()
    .from('etsy_listing_hauptbegriff')
    .select('listing_id, hauptbegriff')
    .eq('owner_user_id', ownerUserId)
  const map = new Map<number, string>()
  if (error || !data) return map
  for (const r of data) {
    const id = Number(r.listing_id)
    const hb = String(r.hauptbegriff || '').trim()
    if (Number.isFinite(id) && hb) map.set(id, hb)
  }
  return map
}

export async function ladeEtsyHauptbegriff(ownerUserId: string, listingId: number): Promise<string | null> {
  const { data } = await createSupabaseAdmin()
    .from('etsy_listing_hauptbegriff')
    .select('hauptbegriff')
    .eq('owner_user_id', ownerUserId)
    .eq('listing_id', listingId)
    .maybeSingle()
  const hb = String(data?.hauptbegriff || '').trim()
  return hb || null
}

/** `null` löscht den festgelegten Begriff → wieder automatisch abgeleitet. */
export async function speichereEtsyHauptbegriff(
  ownerUserId: string,
  listingId: number,
  hauptbegriff: string | null,
): Promise<void> {
  const db = createSupabaseAdmin().from('etsy_listing_hauptbegriff')
  const hb = hauptbegriff?.trim().toLowerCase().slice(0, 60) || ''
  const { error } = hb
    ? await db.upsert({
        owner_user_id: ownerUserId,
        listing_id: listingId,
        hauptbegriff: hb,
        updated_at: new Date().toISOString(),
      })
    : await db.delete().eq('owner_user_id', ownerUserId).eq('listing_id', listingId)
  if (error) throw new Error(error.message)
}
