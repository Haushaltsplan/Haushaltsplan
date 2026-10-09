/**
 * Top-5 Suchbegriffe je Produktgruppe (Schale/Vase) — rein, ohne DB/Netz.
 * Quellen: Auto-Scan (autoRang) + Merkliste + Fallback-Seeds.
 */

import type { EtsyAutoKeyword, EtsyKeywordIdee } from '@/lib/etsy/etsy-markt-types'
import { keywordProduktGruppe } from '@/lib/etsy/etsy-keyword-auto'
import { tagSprache } from '@/lib/etsy/etsy-zielmarkt'

export type EtsyProduktGruppe = 'schale' | 'vase' | 'allgemein'

export type EtsyTopKeyword = {
  keyword: string
  nachfrage: number | null
  chance: EtsyKeywordIdee['chance']
  quellen: EtsyKeywordIdee['quellen']
  ausMerkliste: boolean
}

/** Seite ≥ 3 oder nicht gefunden = schwach (Käufe kommen praktisch nur von S.1–2). */
export const ETSY_RANK_SCHWACH_SEITE = 3

export function istRankSchwach(r: {
  found: boolean
  page: number | null
}): boolean {
  if (!r.found) return true
  if (r.page == null) return true
  return r.page >= ETSY_RANK_SCHWACH_SEITE
}

export function istRankGruen(r: { found: boolean; page: number | null }): boolean {
  return r.found && r.page != null && r.page >= 1 && r.page < ETSY_RANK_SCHWACH_SEITE
}

const FALLBACK_SCHALE = [
  'gedrechselte schale',
  'obstschale',
  'holzschale',
  'dekoschale holz',
  'schale naturrand',
] as const

const FALLBACK_VASE = [
  'gedrechselte vase',
  'holzvase',
  'blumenvase holz',
  'holzvase unikat',
  'gedrechselte vase holz',
] as const

const FALLBACK_ALLGEMEIN = [
  'gedrechselte schale',
  'holzschale',
  'holzgeschenk',
  'gedrechselte vase',
  'holzvase',
] as const

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function listingProduktGruppe(title: string, tags: string[] = []): EtsyProduktGruppe {
  return keywordProduktGruppe(`${title} ${tags.join(' ')}`)
}

function tagTauglich(keyword: string): boolean {
  const k = norm(keyword)
  if (k.length < 3 || k.length > 20) return false
  if (tagSprache(k) === 'fremd') return false
  return true
}

function passtZurGruppe(keyword: string, gruppe: EtsyProduktGruppe, seeds: string[] = []): boolean {
  const g = keywordProduktGruppe(keyword, seeds)
  if (gruppe === 'allgemein') return true
  if (g === 'allgemein') return true
  return g === gruppe
}

function autoRangProxy(k: {
  keyword: string
  nachfrage: number
  chance: EtsyKeywordIdee['chance']
  quellen: EtsyKeywordIdee['quellen']
  tagTauglich?: boolean
  status?: string
}): number {
  let p = k.nachfrage
  if (k.chance === 'hoch') p += 28
  else if (k.chance === 'mittel') p += 14
  if (k.tagTauglich !== false) p += 8
  if (k.quellen.includes('etsy_tags')) p += 6
  if (k.quellen.includes('etsy_suggest')) p += 8
  if (k.quellen.includes('google_de') || k.quellen.includes('amazon_de')) p += 5
  const woerter = norm(k.keyword).split(/\s+/).filter(Boolean).length
  if (woerter >= 2) p += 12
  if (k.status === 'fehlt') p += 18
  else if (k.status === 'selten') p += 8
  return p
}

export function fallbackTopKeywords(gruppe: EtsyProduktGruppe): EtsyTopKeyword[] {
  const seeds =
    gruppe === 'vase' ? FALLBACK_VASE : gruppe === 'schale' ? FALLBACK_SCHALE : FALLBACK_ALLGEMEIN
  return seeds.slice(0, 5).map((keyword) => ({
    keyword,
    nachfrage: null,
    chance: null,
    quellen: [],
    ausMerkliste: false,
  }))
}

/**
 * Top-5: Merkliste der Gruppe voran, Rest aus Scan nach autoRang
 * (erst gruppen-spezifisch, dann allgemein), sonst Fallback.
 */
export function waehleTopKeywords(opts: {
  gruppe: EtsyProduktGruppe
  scanKeywords?: Array<EtsyAutoKeyword | EtsyKeywordIdee>
  merkliste?: string[]
  limit?: number
}): EtsyTopKeyword[] {
  const limit = Math.max(1, Math.min(8, opts.limit ?? 5))
  const seen = new Set<string>()
  const out: EtsyTopKeyword[] = []

  const push = (keyword: string, meta: Omit<EtsyTopKeyword, 'keyword'>, streng = false) => {
    const k = norm(keyword)
    if (!k || seen.has(k) || !tagTauglich(k)) return false
    const g = keywordProduktGruppe(k)
    if (streng) {
      if (opts.gruppe !== 'allgemein' && g !== opts.gruppe && g !== 'allgemein') return false
      if (opts.gruppe !== 'allgemein' && g === 'allgemein') return false
    } else if (!passtZurGruppe(k, opts.gruppe)) {
      return false
    }
    seen.add(k)
    out.push({ keyword: k, ...meta })
    return true
  }

  for (const m of opts.merkliste ?? []) {
    if (out.length >= limit) break
    push(m, { nachfrage: null, chance: null, quellen: [], ausMerkliste: true }, true)
  }
  for (const m of opts.merkliste ?? []) {
    if (out.length >= limit) break
    push(m, { nachfrage: null, chance: null, quellen: [], ausMerkliste: true }, false)
  }

  const scan = [...(opts.scanKeywords ?? [])].sort((a, b) => autoRangProxy(b) - autoRangProxy(a))
  for (const streng of [true, false]) {
    for (const s of scan) {
      if (out.length >= limit) break
      const seeds = 'seeds' in s && Array.isArray(s.seeds) ? s.seeds : []
      if (!passtZurGruppe(s.keyword, opts.gruppe, seeds)) continue
      push(
        s.keyword,
        {
          nachfrage: s.nachfrage ?? null,
          chance: s.chance ?? null,
          quellen: s.quellen ?? [],
          ausMerkliste: false,
        },
        streng,
      )
    }
  }

  if (out.length < limit) {
    for (const f of fallbackTopKeywords(opts.gruppe)) {
      if (out.length >= limit) break
      push(f.keyword, { ...f, ausMerkliste: false }, false)
    }
  }

  return out.slice(0, limit)
}
