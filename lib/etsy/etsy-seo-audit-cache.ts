/** Persistenz: SEO-Audit-Cache, Historie, Rank-Cache. */

import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type { EtsySeoAuditResult } from '@/lib/etsy/etsy-seo-audit-types'

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
  const admin = createSupabaseAdmin()
  const now = new Date().toISOString()
  for (const r of opts.results) {
    await admin.from('etsy_seo_rank_cache').upsert({
      owner_user_id: opts.ownerUserId,
      listing_id: opts.listingId,
      keyword: r.keyword.slice(0, 80),
      page: r.page,
      position: r.position,
      found: r.found,
      note: r.note?.slice(0, 200) ?? null,
      provider: opts.provider,
      checked_at: now,
    })
  }
}
