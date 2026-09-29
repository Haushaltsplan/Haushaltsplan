/**
 * Wöchentlicher SEO-Cron (vercel.json: Mo 08:00 UTC).
 * GET/POST mit Authorization: Bearer CRON_SECRET
 *
 * 1) Shop-weites Rank-Tracking der Fokus-Keywords → etsy_seo_rank_cache + _historie
 * 2) Kandidaten = Ranking-Verluste ∪ Audit-Score < 70
 * 3) ?reaudit=1 → max. 5 Kandidaten frisch auditieren (Free-Gemini + Markt-Daten)
 *    und als Vorschlag (Diff) in etsy_seo_vorschlag ablegen → UI: 1 Klick übernehmen
 *
 * Query: ?rank=0 überspringt Schritt 1.
 */
import { auditiereEtsyListing } from '@/lib/etsy/etsy-seo-audit-engine'
import {
  ladeEtsyRankVerluste,
  ladeEtsySeoSchwachstellen,
  ladeEtsySeoVorschlag,
  speichereEtsySeoAudit,
  speichereEtsySeoVorschlag,
} from '@/lib/etsy/etsy-seo-audit-cache'
import { listingFingerprint } from '@/lib/etsy/etsy-seo-diff'
import { ladeEtsyListingDetail } from '@/lib/etsy/etsy-listings-server'
import { trackListingRanks } from '@/lib/etsy/etsy-rank-apify'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const SCORE_SCHWELLE = 69
const MAX_REAUDITS = 5
/** Puffer unter maxDuration, damit ein laufender Gemini-Call noch fertig wird. */
const ZEITBUDGET_MS = 230_000

function cronErlaubt(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || '').trim()
  // Wie Strava: ohne CRON_SECRET in Dev durchlassen; in Prod immer setzen.
  if (!secret) return process.env.NODE_ENV !== 'production'
  const auth = req.headers.get('authorization') || ''
  return auth === `Bearer ${secret}`
}

type Kandidat = { listingId: number; grund: string; scoreVorher: number | null }

async function run(opts: { reaudit: boolean; rank: boolean }) {
  const start = Date.now()
  const zeitUebrig = () => Date.now() - start < ZEITBUDGET_MS

  const { data: owners } = await createSupabaseAdmin()
    .from('etsy_oauth_tokens')
    .select('owner_user_id')
  const userIds = [...new Set((owners ?? []).map((o) => String(o.owner_user_id)).filter(Boolean))]

  const report: Array<{
    ownerUserId: string
    rank?: { keywords: number; listings: number; provider: string; error?: string }
    verluste: number
    weak: Array<{ listingId: number; score: number; title: string }>
    kandidaten: Kandidat[]
    vorschlaege?: Array<{ listingId: number; score?: number; skipped?: string; error?: string }>
  }> = []

  for (const ownerUserId of userIds) {
    const entry: (typeof report)[number] = { ownerUserId, verluste: 0, weak: [], kandidaten: [] }

    if (opts.rank && zeitUebrig()) {
      try {
        const lauf = await trackListingRanks({ ownerUserId, maxKeywords: 20 })
        entry.rank = { keywords: lauf.keywords, listings: lauf.listings, provider: lauf.provider }
      } catch (e) {
        entry.rank = {
          keywords: 0,
          listings: 0,
          provider: 'unavailable',
          error: e instanceof Error ? e.message.slice(0, 160) : 'Rank-Tracking fehlgeschlagen',
        }
      }
    }

    const [verluste, weak] = await Promise.all([
      ladeEtsyRankVerluste(ownerUserId),
      ladeEtsySeoSchwachstellen(ownerUserId, SCORE_SCHWELLE),
    ])
    entry.verluste = verluste.length
    entry.weak = weak.map((w) => ({ listingId: w.listingId, score: w.overallScore, title: w.listingTitle }))

    // Ranking-Verluste zuerst (akuter), dann schwächster Score.
    const scoreMap = new Map(weak.map((w) => [w.listingId, w.overallScore]))
    const kandidaten = new Map<number, Kandidat>()
    for (const v of verluste) {
      const alt = v.vorher.found ? `S.${v.vorher.page} #${v.vorher.position}` : 'nicht gefunden'
      const neu = v.jetzt.found ? `S.${v.jetzt.page} #${v.jetzt.position}` : 'nicht gefunden'
      const bisher = kandidaten.get(v.listingId)
      const grund = `Ranking-Verlust „${v.keyword}“: ${alt} → ${neu}`
      kandidaten.set(v.listingId, {
        listingId: v.listingId,
        grund: bisher ? `${bisher.grund}; ${grund}` : grund,
        scoreVorher: scoreMap.get(v.listingId) ?? null,
      })
    }
    for (const w of weak) {
      const bisher = kandidaten.get(w.listingId)
      const grund = `Audit-Score ${w.overallScore} < ${SCORE_SCHWELLE + 1}`
      kandidaten.set(w.listingId, {
        listingId: w.listingId,
        grund: bisher ? `${bisher.grund}; ${grund}` : grund,
        scoreVorher: w.overallScore,
      })
    }
    entry.kandidaten = [...kandidaten.values()]

    if (opts.reaudit && entry.kandidaten.length > 0) {
      entry.vorschlaege = []
      let erstellt = 0
      for (const k of entry.kandidaten) {
        if (erstellt >= MAX_REAUDITS) break
        if (!zeitUebrig()) {
          entry.vorschlaege.push({ listingId: k.listingId, skipped: 'Zeitbudget' })
          break
        }
        try {
          const { listing } = await ladeEtsyListingDetail(ownerUserId, k.listingId)
          const fingerprint = listingFingerprint(listing)
          const offen = await ladeEtsySeoVorschlag(ownerUserId, k.listingId)
          if (offen?.status === 'offen' && offen.fingerprint === fingerprint) {
            entry.vorschlaege.push({ listingId: k.listingId, skipped: 'Offener Vorschlag unverändert' })
            continue
          }

          const audit = await auditiereEtsyListing(listing, {
            marktLimits: { maxAutosuggest: 2, maxCompetitor: 1, budgetMs: 12_000 },
          })
          await speichereEtsySeoAudit({
            ownerUserId,
            listingId: k.listingId,
            fingerprint,
            audit,
            listingTitle: listing.title,
            state: listing.state,
          })

          const s = audit.suggestions
          const intro = s.optimized_description_intro.trim()
          const description =
            s.optimized_description?.trim() ||
            (listing.description.trim().startsWith(intro)
              ? listing.description.trim()
              : `${intro}\n\n${listing.description.trim()}`.trim())
          const after = {
            title: s.optimized_title,
            tags: s.optimized_tags,
            descriptionIntro: intro,
            description,
          }
          const unveraendert =
            after.title.trim() === listing.title.trim() &&
            after.tags.join('|') === listing.tags.join('|') &&
            after.description === listing.description.trim()
          if (unveraendert) {
            entry.vorschlaege.push({ listingId: k.listingId, score: audit.overall_score, skipped: 'Kein Diff' })
            continue
          }

          await speichereEtsySeoVorschlag({
            ownerUserId,
            listingId: k.listingId,
            grund: k.grund,
            fingerprint,
            listingTitle: listing.title,
            scoreVorher: k.scoreVorher,
            before: {
              title: listing.title,
              tags: listing.tags,
              descriptionIntro: '',
              description: listing.description,
            },
            after,
            audit,
          })
          erstellt++
          entry.vorschlaege.push({ listingId: k.listingId, score: audit.overall_score })
        } catch (e) {
          entry.vorschlaege.push({
            listingId: k.listingId,
            error: e instanceof Error ? e.message.slice(0, 120) : 'Fehler',
          })
        }
      }
    }

    report.push(entry)
    console.info(
      `[etsy-seo-cron] owner=${ownerUserId} rank=${entry.rank?.provider ?? 'skip'} verluste=${entry.verluste} ` +
        `schwach=${entry.weak.length} vorschlaege=${entry.vorschlaege?.filter((v) => v.score != null && !v.skipped).length ?? 0}`,
    )
  }

  return {
    ok: true,
    owners: userIds.length,
    reports: report.length,
    reaudit: opts.reaudit,
    dauerMs: Date.now() - start,
    report,
  }
}

export async function GET(req: Request) {
  if (!cronErlaubt(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  try {
    return NextResponse.json(
      await run({ reaudit: sp.get('reaudit') === '1', rank: sp.get('rank') !== '0' }),
    )
  } catch (e) {
    console.error('[etsy-seo-cron]', e)
    return NextResponse.json({ error: 'Cron fehlgeschlagen' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  return GET(req)
}
