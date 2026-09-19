/** LLM-Audit-Engine für bestehende Etsy-Listings. */

import 'server-only'

import {
  buildEtsySeoAuditSystemPrompt,
  ETSY_SEO_AUDIT_JSON_SCHEMA,
} from '@/lib/etsy/etsy-seo-audit-prompt'
import type {
  EtsyGeoInsights,
  EtsySeoAuditResult,
  EtsySeoIssue,
  EtsySeoIssueField,
  EtsySeoIssueSeverity,
  EtsyShopListingDetail,
} from '@/lib/etsy/etsy-seo-audit-types'
import { pruefeListingRegeln } from '@/lib/etsy/etsy-seo-regeln'
import {
  resolveGeminiFreeTierProvider,
  runCoachCompletion,
  type CoachMessage,
} from '@/lib/ki-coach-backend'

const TITLE_MAX = 140
const TAG_MAX = 20
const TAG_COUNT = 13

function parseJsonObject(reply: string): Record<string, unknown> | null {
  const t = reply.trim()
  try {
    return JSON.parse(t) as Record<string, unknown>
  } catch {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>
      } catch {
        return null
      }
    }
    return null
  }
}

function asClarity(raw: unknown): 'Hoch' | 'Mittel' | 'Niedrig' {
  const s = String(raw || '').toLowerCase()
  if (s.startsWith('hoch') || s === 'high') return 'Hoch'
  if (s.startsWith('nied') || s === 'low') return 'Niedrig'
  return 'Mittel'
}

function normalisiereTag(raw: string): string {
  return raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TAG_MAX)
}

function normalisiereTags(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    const t = normalisiereTag(String(item || ''))
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
    if (out.length >= TAG_COUNT) break
  }
  while (out.length < TAG_COUNT) {
    const pad = `holzunikat${out.length + 1}`.slice(0, TAG_MAX)
    if (!seen.has(pad)) {
      seen.add(pad)
      out.push(pad)
    } else break
  }
  return out.slice(0, TAG_COUNT)
}

function normalisiereIssues(raw: unknown): EtsySeoIssue[] {
  if (!Array.isArray(raw)) return []
  const fields = new Set<EtsySeoIssueField>([
    'title',
    'tags',
    'description',
    'price',
    'attributes',
    'general',
  ])
  const out: EtsySeoIssue[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const severityRaw = String(o.severity || 'info').toLowerCase()
    const severity: EtsySeoIssueSeverity =
      severityRaw === 'error' || severityRaw === 'warning' ? severityRaw : 'info'
    const fieldRaw = String(o.field || 'general').toLowerCase() as EtsySeoIssueField
    const field = fields.has(fieldRaw) ? fieldRaw : 'general'
    const message = String(o.message || '').trim()
    if (!message) continue
    out.push({ severity, field, message: message.slice(0, 300) })
    if (out.length >= 25) break
  }
  return out
}

function validiereAudit(raw: Record<string, unknown>): EtsySeoAuditResult {
  let score = Number(raw.overall_score)
  if (!Number.isFinite(score)) score = 50
  score = Math.max(0, Math.min(100, Math.round(score)))

  const geoRaw =
    raw.geo_insights && typeof raw.geo_insights === 'object'
      ? (raw.geo_insights as Record<string, unknown>)
      : {}
  const geo_insights: EtsyGeoInsights = {
    target_audience_clarity: asClarity(geoRaw.target_audience_clarity),
    missing_contexts: Array.isArray(geoRaw.missing_contexts)
      ? geoRaw.missing_contexts.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
      : [],
    what_clarity: geoRaw.what_clarity != null ? asClarity(geoRaw.what_clarity) : undefined,
    occasion_clarity: geoRaw.occasion_clarity != null ? asClarity(geoRaw.occasion_clarity) : undefined,
  }

  const sugRaw =
    raw.suggestions && typeof raw.suggestions === 'object'
      ? (raw.suggestions as Record<string, unknown>)
      : {}
  let optimized_title = String(sugRaw.optimized_title || '').trim().replace(/\s+/g, ' ')
  if (optimized_title.length > TITLE_MAX) optimized_title = optimized_title.slice(0, TITLE_MAX).trim()
  const optimized_tags = normalisiereTags(sugRaw.optimized_tags)
  const optimized_description_intro = String(sugRaw.optimized_description_intro || '').trim()
  const optDesc =
    typeof sugRaw.optimized_description === 'string' && sugRaw.optimized_description.trim()
      ? sugRaw.optimized_description.trim()
      : null

  if (!optimized_title) throw new Error('Audit ohne optimized_title.')
  if (!optimized_description_intro) throw new Error('Audit ohne optimized_description_intro.')

  return {
    overall_score: score,
    seo_issues: normalisiereIssues(raw.seo_issues),
    geo_insights,
    suggestions: {
      optimized_title,
      optimized_tags,
      optimized_description_intro,
      optimized_description: optDesc,
    },
    summary: typeof raw.summary === 'string' ? raw.summary.trim().slice(0, 400) : undefined,
  }
}

function baueUserPayload(listing: EtsyShopListingDetail): string {
  return [
    'Auditiere dieses Etsy-Listing und liefere JSON.',
    `listing_id: ${listing.listingId}`,
    `state: ${listing.state}`,
    `title (${listing.title.length} Zeichen): ${listing.title}`,
    `tags (${listing.tags.length}): ${listing.tags.join(', ')}`,
    `price_eur: ${listing.priceEur ?? 'n/a'}`,
    `taxonomy_id: ${listing.taxonomyId ?? 'n/a'}`,
    `materials: ${listing.materials.join(', ') || 'n/a'}`,
    `who_made: ${listing.whoMade ?? 'n/a'}`,
    `when_made: ${listing.whenMade ?? 'n/a'}`,
    '--- BESCHREIBUNG ---',
    listing.description.slice(0, 12000),
  ].join('\n')
}

/** Regelbasierte Sofort-Checks (ergänzen das LLM-Ergebnis). */
export function regelbasierteSeoHinweise(listing: EtsyShopListingDetail): EtsySeoIssue[] {
  return pruefeListingRegeln(listing).issues
}

export async function auditiereEtsyListing(
  listing: EtsyShopListingDetail,
): Promise<EtsySeoAuditResult> {
  const resolved = resolveGeminiFreeTierProvider()
  if (!resolved) {
    throw new Error('GEMINI_API_KEY_FREE fehlt — SEO-Audit nutzt nur den Free-Tier-Key.')
  }

  const regelReport = pruefeListingRegeln(listing)
  const messages: CoachMessage[] = [
    {
      role: 'user',
      content:
        baueUserPayload(listing) +
        '\n\nBereits bekannte Regel-Issues:\n' +
        (regelReport.issues.map((i) => `- [${i.severity}] ${i.field}: ${i.message}`).join('\n') ||
          '- keine'),
    },
  ]

  const result = await runCoachCompletion(
    'gemini',
    resolved.apiKey,
    buildEtsySeoAuditSystemPrompt(),
    messages,
    {
      temperature: 0.35,
      geminiForceFreeApiKey: true,
      thinkingMinimal: true,
      maxOutputTokens: 4096,
      jsonResponse: { schema: ETSY_SEO_AUDIT_JSON_SCHEMA },
    },
  )

  if (!result.ok) throw new Error(result.hint || 'SEO-Audit fehlgeschlagen.')
  const parsed = parseJsonObject(result.reply)
  if (!parsed) throw new Error('Audit-Antwort war kein gültiges JSON.')

  const audit = validiereAudit(parsed)
  audit.overall_score = Math.max(0, Math.min(100, audit.overall_score - regelReport.scorePenalty))
  const seen = new Set(audit.seo_issues.map((i) => `${i.field}:${i.message}`))
  for (const r of regelReport.issues) {
    const k = `${r.field}:${r.message}`
    if (!seen.has(k)) {
      audit.seo_issues.unshift(r)
      seen.add(k)
    }
  }
  return audit
}
