/**
 * Ein Klick: schwächstes Fokus-Keyword pushen, alle anderen 4 schützen,
 * Titel/Tags/Intro generieren und direkt auf Etsy speichern.
 */
import {
  normalisiereDrechselSprache,
  normalisiereDrechselTags,
} from '@/lib/etsy/etsy-drechsel-sprache'
import { ladeEtsyEigeneSignale } from '@/lib/etsy/etsy-cockpit-server'
import { ladeEtsyListingDetail, updateEtsyListing } from '@/lib/etsy/etsy-listings-server'
import {
  ETSY_RANK_FOKUS_KEYWORDS,
  normRankKeyword,
} from '@/lib/etsy/etsy-rank-fokus'
import { auditiereEtsyListing } from '@/lib/etsy/etsy-seo-audit-engine'
import {
  ladeEtsyHauptbegriff,
  ladeEtsyRankCacheFuerListing,
  speichereEtsySeoAudit,
} from '@/lib/etsy/etsy-seo-audit-cache'
import { listingFingerprint } from '@/lib/etsy/etsy-seo-diff'
import { ETSY_SEO_TAG_COUNT } from '@/lib/etsy/etsy-seo-regeln'
import { beschreibeAenderung, protokolliereEtsyAenderung } from '@/lib/etsy/etsy-statistik-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180

type Ctx = { params: Promise<{ id: string }> }

type Body = { zielKeyword?: string }

function waehleZiel(
  ranks: Array<{ keyword: string; found: boolean; page: number | null; position: number | null }>,
  explizit?: string | null,
): string {
  if (explizit) {
    const k = normRankKeyword(explizit)
    if ((ETSY_RANK_FOKUS_KEYWORDS as readonly string[]).includes(k)) return k
  }
  const fokus = ETSY_RANK_FOKUS_KEYWORDS.map((keyword) => {
    const r = ranks.find((x) => normRankKeyword(x.keyword) === keyword)
    return {
      keyword,
      found: r?.found ?? false,
      page: r?.page ?? null,
      position: r?.position ?? null,
      score: !r || !r.found || r.page == null ? 10_000 : r.page * 1000 + (r.position ?? 999),
    }
  })
  fokus.sort((a, b) => b.score - a.score)
  return fokus[0]!.keyword
}

export async function POST(req: Request, ctx: Ctx) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  const { id } = await ctx.params
  const listingId = Number(id)
  if (!Number.isFinite(listingId) || listingId <= 0) {
    return NextResponse.json({ error: 'Ungültige listing id.' }, { status: 400 })
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    /* optional */
  }

  try {
    const [{ listing }, hauptbegriff, rankCache, eigeneSignale] = await Promise.all([
      ladeEtsyListingDetail(user.id, listingId),
      ladeEtsyHauptbegriff(user.id, listingId).catch(() => null),
      ladeEtsyRankCacheFuerListing(user.id, listingId),
      ladeEtsyEigeneSignale(user.id).catch(() => null),
    ])

    const zielKeyword = waehleZiel(rankCache, body.zielKeyword)
    const schutzKeywords = ETSY_RANK_FOKUS_KEYWORDS.filter((k) => k !== zielKeyword)

    const audit = await auditiereEtsyListing(listing, {
      hauptbegriff: zielKeyword || hauptbegriff,
      eigeneSignale,
      zielKeyword,
      schutzKeywords: [...schutzKeywords],
    })

    let title = normalisiereDrechselSprache(audit.suggestions.optimized_title).slice(0, 140)
    // Ziel-Keyword hart vorne halten (erste ~50 Zeichen), ohne die Phrase zu verdoppeln
    {
      const k = zielKeyword
      const lower = title.toLowerCase()
      if (!lower.startsWith(k)) {
        const label = k.replace(/^\w/, (c) => c.toUpperCase())
        const ohne = title.replace(new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig'), '').replace(/\s*\|\s*/g, ' | ').replace(/^\s*\|\s*|\s*\|\s*$/g, '').trim()
        title = normalisiereDrechselSprache(`${label} | ${ohne}`.replace(/\s+/g, ' ').trim()).slice(0, 140)
      }
    }
    const tags = normalisiereDrechselTags(audit.suggestions.optimized_tags, { aufDreizehn: true })
    if (tags.length !== ETSY_SEO_TAG_COUNT) {
      return NextResponse.json(
        { error: `Optimierung lieferte ${tags.length} statt ${ETSY_SEO_TAG_COUNT} Tags.` },
        { status: 502 },
      )
    }
    const intro = normalisiereDrechselSprache(audit.suggestions.optimized_description_intro.trim())
    const rest = normalisiereDrechselSprache(listing.description.trim())
    const description = rest.startsWith(intro) ? rest : `${intro}\n\n${rest}`.trim()

    // Alle 5 Fokus-Keywords als Tags erzwingen (Schutz + Ziel)
    const fokusOk = [...ETSY_RANK_FOKUS_KEYWORDS].filter((k) => k.length <= 20)
    const fokusSet = new Set<string>(fokusOk)
    const gemischt = [...fokusOk, ...tags.filter((t) => !fokusSet.has(t.toLowerCase()))]
    const tagsFinal = normalisiereDrechselTags(gemischt, { aufDreizehn: true })

    const updated = await updateEtsyListing(user.id, listingId, {
      title,
      tags: tagsFinal,
      description,
    })

    await speichereEtsySeoAudit({
      ownerUserId: user.id,
      listingId,
      fingerprint: listingFingerprint(updated),
      audit,
      listingTitle: updated.title,
      state: updated.state,
    }).catch(() => null)

    await protokolliereEtsyAenderung({
      ownerUserId: user.id,
      listingId,
      listingTitle: updated.title,
      quelle: 'manuell',
      beschreibung: `Ranking „${zielKeyword}“ · ${beschreibeAenderung(
        { title: listing.title, tags: listing.tags, description: listing.description },
        { title, tags: tagsFinal, description },
      )}`,
      before: { title: listing.title, tags: listing.tags, description: listing.description },
      after: { title, tags: tagsFinal, description },
    }).catch(() => null)

    return NextResponse.json({
      ok: true,
      listing: updated,
      audit,
      zielKeyword,
      schutzKeywords,
      pushed: true,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ranking-Optimierung fehlgeschlagen'
    console.error('[etsy ranking-optimieren]', msg)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
