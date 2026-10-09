/**
 * Shop-weite Rank-Matrix für die 5 festen Schalen-Keywords.
 * GET = Cache + Listings · POST = frisch messen + speichern.
 */
import { trackeFokusRankMatrix } from '@/lib/etsy/etsy-rank-apify'
import {
  ETSY_RANK_FOKUS_KEYWORDS,
  ETSY_RANK_FOKUS_LABELS,
  normRankKeyword,
} from '@/lib/etsy/etsy-rank-fokus'
import { ladeEtsyRankCacheFuerListing, ladeEtsySeoCacheMap } from '@/lib/etsy/etsy-seo-audit-cache'
import { ladeEtsyShopListings } from '@/lib/etsy/etsy-listings-server'
import { createSupabaseFuerRequest } from '@/lib/supabase-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180

type RankZelle = {
  keyword: string
  label: string
  page: number | null
  position: number | null
  found: boolean
  note: string | null
  checkedAt: string | null
}

async function baueMatrix(ownerUserId: string) {
  const [{ shopId, listings }, seoMap] = await Promise.all([
    ladeEtsyShopListings(ownerUserId, { state: 'active', limit: 100 }),
    ladeEtsySeoCacheMap(ownerUserId),
  ])

  const zeilen = await Promise.all(
    listings.map(async (l) => {
      const cache = await ladeEtsyRankCacheFuerListing(ownerUserId, l.listingId)
      const byKw = new Map(cache.map((c) => [normRankKeyword(c.keyword), c]))
      const ranks: RankZelle[] = ETSY_RANK_FOKUS_KEYWORDS.map((keyword) => {
        const c = byKw.get(keyword)
        return {
          keyword,
          label: ETSY_RANK_FOKUS_LABELS[keyword],
          page: c?.page ?? null,
          position: c?.position ?? null,
          found: c?.found ?? false,
          note: c?.note ?? (c ? null : 'noch nicht geprüft'),
          checkedAt: c?.checkedAt ?? null,
        }
      })
      const geprueft = ranks.some((r) => r.checkedAt)
      const schwach = ranks.filter((r) => geprueft && (!r.found || (r.page != null && r.page >= 3)))
      const seo = seoMap.get(l.listingId)
      return {
        listingId: l.listingId,
        title: l.title,
        priceEur: l.priceEur,
        url: l.url,
        tags: l.tags,
        cachedScore: seo?.overallScore ?? null,
        ranks,
        schwachAnzahl: schwach.length,
        schwachstesKeyword: schwach[0]?.keyword ?? null,
        geprueft,
      }
    }),
  )

  zeilen.sort((a, b) => {
    if (a.schwachAnzahl !== b.schwachAnzahl) return b.schwachAnzahl - a.schwachAnzahl
    const sa = a.cachedScore ?? 999
    const sb = b.cachedScore ?? 999
    return sa - sb
  })

  return {
    shopId,
    keywords: ETSY_RANK_FOKUS_KEYWORDS.map((k) => ({
      keyword: k,
      label: ETSY_RANK_FOKUS_LABELS[k],
    })),
    listings: zeilen,
  }
}

export async function GET(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  try {
    const matrix = await baueMatrix(user.id)
    return NextResponse.json({ ok: true, ...matrix })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Matrix laden fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const sb = createSupabaseFuerRequest(req)
  if (!sb) return NextResponse.json({ error: 'Anmeldung erforderlich.' }, { status: 401 })
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user?.id) return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 })

  try {
    const lauf = await trackeFokusRankMatrix({ ownerUserId: user.id })
    const matrix = await baueMatrix(user.id)
    return NextResponse.json({
      ok: true,
      ...matrix,
      lauf: {
        keywords: lauf.keywords,
        listings: lauf.listings,
        provider: lauf.provider,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Rank-Matrix fehlgeschlagen'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
