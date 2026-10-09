'use client'

import { PageSection, PageSectionPanel } from '@/components/page-shell'
import { baueEtsySeoDiff, type EtsySeoDiffZeile } from '@/lib/etsy/etsy-seo-diff'
import type {
  EtsyRankTrackingResult,
  EtsySeoAuditResult,
  EtsyShopListingDetail,
  EtsyShopListingKurz,
} from '@/lib/etsy/etsy-seo-audit-types'
import {
  ETSY_SEO_TAG_COUNT,
  ETSY_SEO_TAG_MAX,
  ETSY_SEO_TITLE_FRONTLOAD,
  ETSY_SEO_TITLE_IDEAL_MAX,
  ETSY_SEO_TITLE_IDEAL_MIN,
  ETSY_SEO_TITLE_MAX,
  pruefeEtsySeoRegeln,
  scoreFarbe,
  type EtsySeoRegelReport,
} from '@/lib/etsy/etsy-seo-regeln'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

type ListingRow = EtsyShopListingKurz & {
  cachedScore?: number | null
  cachedAt?: string | null
  rankPage?: number | null
  rankPosition?: number | null
  rankKeyword?: string | null
  rankCheckedAt?: string | null
  rankHasWeak?: boolean
  rankWeakKeyword?: string | null
}

type TopRankZeile = {
  keyword: string
  page: number | null
  position: number | null
  found: boolean
  note?: string
  nachfrage?: number | null
  chance?: 'hoch' | 'mittel' | 'niedrig' | null
  quellen?: Array<'etsy_tags' | 'etsy_suggest' | 'google_de' | 'amazon_de'>
  ausMerkliste?: boolean
  checkedAt?: string | null
}

type HistoriePunkt = { id: string; overallScore: number; createdAt: string }

type VorschlagInhalt = { title: string; tags: string[]; descriptionIntro: string; description?: string }

type Vorschlag = {
  listingId: number
  grund: string
  listingTitle: string
  scoreVorher: number | null
  before: VorschlagInhalt
  after: VorschlagInhalt
  audit: EtsySeoAuditResult | null
  createdAt: string
}

type ListFilter = 'alle' | 'schwach' | 'schlecht-rank' | 'tags-fehlen'

type Props = {
  verbunden: boolean
  /** Vom Cockpit: Listing direkt öffnen (force = frischer KI-Check). nonce erzwingt Wiederholung. */
  fokus?: { listingId: number; force?: boolean; nonce: number } | null
}

function scoreBadgeClass(score: number | null | undefined) {
  if (score == null) return 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]'
  const f = scoreFarbe(score)
  if (f === 'rot') return 'bg-rose-500/20 text-rose-300'
  if (f === 'gelb') return 'bg-amber-500/20 text-amber-300'
  return 'bg-emerald-500/20 text-emerald-300'
}

function istSchwach(l: ListingRow): boolean {
  return l.cachedScore == null || l.cachedScore < 80
}

function istSchlechtGerankt(l: ListingRow): boolean {
  if (l.rankHasWeak) return true
  return l.rankPage != null && l.rankPage >= 3
}

function rankAmpelClass(r: { found: boolean; page: number | null }): string {
  if (!r.found || r.page == null) return 'bg-rose-500/20 text-rose-300'
  if (r.page >= 3) return 'bg-rose-500/20 text-rose-300'
  if (r.page === 2) return 'bg-amber-500/20 text-amber-300'
  return 'bg-emerald-500/20 text-emerald-300'
}

function rankAmpelLabel(r: { found: boolean; page: number | null; position: number | null }): string {
  if (!r.found || r.page == null) return 'nicht gefunden'
  return `S.${r.page}${r.position != null ? ` #${r.position}` : ''}`
}

function hatUnvollstaendigeTags(l: ListingRow): boolean {
  return (l.tags?.length ?? 0) !== ETSY_SEO_TAG_COUNT
}

export function EtsySeoUeberwachung({ verbunden, fokus }: Props) {
  const [stateFilter, setStateFilter] = useState('active')
  const [listFilter, setListFilter] = useState<ListFilter>('alle')
  const [listings, setListings] = useState<ListingRow[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false)
  const [batchProgress, setBatchProgress] = useState('')
  const [tagsReparaturBusy, setTagsReparaturBusy] = useState(false)
  const [handwerkBusy, setHandwerkBusy] = useState(false)
  const [handgedrehtAnzahl, setHandgedrehtAnzahl] = useState(0)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyKind, setBusyKind] = useState<'audit' | 'optimize' | 'push' | 'rank' | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [auditedAt, setAuditedAt] = useState<string | null>(null)

  const [listing, setListing] = useState<EtsyShopListingDetail | null>(null)
  const [audit, setAudit] = useState<EtsySeoAuditResult | null>(null)
  const [regelReport, setRegelReport] = useState<EtsySeoRegelReport | null>(null)
  const [historie, setHistorie] = useState<HistoriePunkt[]>([])

  const [editTitle, setEditTitle] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editIntro, setEditIntro] = useState('')
  const [showDiff, setShowDiff] = useState(true)
  const [confirmPush, setConfirmPush] = useState<'title' | 'tags' | 'intro' | 'all' | null>(null)

  const [rank, setRank] = useState<EtsyRankTrackingResult | null>(null)
  const [topRankZeilen, setTopRankZeilen] = useState<TopRankZeile[]>([])
  const [topRankGruppe, setTopRankGruppe] = useState<string | null>(null)
  const [rankKeywords, setRankKeywords] = useState('')

  const [hauptbegriffGespeichert, setHauptbegriffGespeichert] = useState<string | null>(null)
  const [hauptbegriffEingabe, setHauptbegriffEingabe] = useState('')
  const [hauptbegriffBusy, setHauptbegriffBusy] = useState(false)

  const [vorschlaege, setVorschlaege] = useState<Vorschlag[]>([])
  const [vorschlagOffen, setVorschlagOffen] = useState<number | null>(null)
  const [vorschlagBusy, setVorschlagBusy] = useState<number | null>(null)

  const sichtbareListings = useMemo(() => {
    if (listFilter === 'schwach') return listings.filter(istSchwach)
    if (listFilter === 'schlecht-rank') return listings.filter(istSchlechtGerankt)
    if (listFilter === 'tags-fehlen') return listings.filter(hatUnvollstaendigeTags)
    return listings
  }, [listings, listFilter])

  const liveRegeln = useMemo(() => {
    if (!editTitle && !editTags) return null
    return pruefeEtsySeoRegeln({
      title: editTitle,
      tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
      description: editIntro || listing?.description || '',
      materials: listing?.materials,
      taxonomyId: listing?.taxonomyId,
      hauptbegriff: hauptbegriffGespeichert,
    })
  }, [
    editTitle,
    editTags,
    editIntro,
    listing?.description,
    listing?.materials,
    listing?.taxonomyId,
    hauptbegriffGespeichert,
  ])

  const scoreStats = useMemo(() => {
    let rot = 0
    let gelb = 0
    let gruen = 0
    let ohne = 0
    let sum = 0
    let n = 0
    let tagsFehlen = 0
    for (const l of listings) {
      if (hatUnvollstaendigeTags(l)) tagsFehlen++
      if (l.cachedScore == null) {
        ohne++
        continue
      }
      n++
      sum += l.cachedScore
      const f = scoreFarbe(l.cachedScore)
      if (f === 'rot') rot++
      else if (f === 'gelb') gelb++
      else gruen++
    }
    return { rot, gelb, gruen, ohne, tagsFehlen, avg: n ? Math.round(sum / n) : null }
  }, [listings])

  const diffZeilen: EtsySeoDiffZeile[] = useMemo(() => {
    if (!listing) return []
    return baueEtsySeoDiff({
      before: {
        title: listing.title,
        tags: listing.tags,
        description: listing.description,
      },
      after: {
        title: editTitle,
        tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
        descriptionIntro: editIntro,
      },
    })
  }, [listing, editTitle, editTags, editIntro])

  const ladeHandgedrehtStand = useCallback(async () => {
    if (!verbunden) return
    try {
      const res = await fetch('/api/etsy/listings/handwerk-sprache', { cache: 'no-store' })
      const j = (await res.json()) as { betroffen?: number }
      if (res.ok) setHandgedrehtAnzahl(j.betroffen ?? 0)
    } catch {
      /* optional */
    }
  }, [verbunden])

  const ladeListings = useCallback(async () => {
    if (!verbunden) return
    setLoadingList(true)
    try {
      const res = await fetch(`/api/etsy/listings?state=${encodeURIComponent(stateFilter)}&limit=100`, {
        cache: 'no-store',
      })
      const j = (await res.json()) as { error?: string; listings?: ListingRow[] }
      if (!res.ok) {
        toast.error(j.error ?? 'Listings laden fehlgeschlagen.')
        return
      }
      const rows = j.listings ?? []
      setListings(rows)
      // Schnellschätzung aus Titel/Tags; genauer Stand inkl. Beschreibung nachgeladen
      const lokal = rows.filter(
        (l) =>
          /handgedreht/i.test(l.title) || (l.tags ?? []).some((t) => /handgedreht/i.test(t)),
      ).length
      setHandgedrehtAnzahl((prev) => Math.max(prev, lokal))
      void ladeHandgedrehtStand()
    } catch {
      toast.error('Listings laden fehlgeschlagen.')
    } finally {
      setLoadingList(false)
    }
  }, [verbunden, stateFilter, ladeHandgedrehtStand])

  useEffect(() => {
    void ladeListings()
  }, [ladeListings])

  const ladeVorschlaege = useCallback(async () => {
    if (!verbunden) return
    try {
      const res = await fetch('/api/etsy/vorschlaege', { cache: 'no-store' })
      const j = (await res.json()) as { vorschlaege?: Vorschlag[] }
      if (res.ok) setVorschlaege(j.vorschlaege ?? [])
    } catch {
      /* Vorschläge optional */
    }
  }, [verbunden])

  useEffect(() => {
    void ladeVorschlaege()
  }, [ladeVorschlaege])

  const fokusNonce = fokus?.nonce
  useEffect(() => {
    if (!verbunden || !fokus?.listingId) return
    void starteAudit(fokus.listingId, Boolean(fokus.force))
    // Nur bei neuem Cockpit-Sprung (nonce) auslösen, nicht bei jedem Re-Render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fokusNonce, verbunden])

  async function vorschlagAktion(listingId: number, aktion: 'uebernehmen' | 'verwerfen') {
    setVorschlagBusy(listingId)
    try {
      const res = await fetch(`/api/etsy/vorschlaege/${listingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktion }),
      })
      const j = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(j.error ?? 'Aktion fehlgeschlagen.')
        if (res.status === 409) void ladeVorschlaege()
        return
      }
      toast.success(aktion === 'uebernehmen' ? 'Auf Etsy übernommen.' : 'Vorschlag verworfen.')
      setVorschlaege((prev) => prev.filter((v) => v.listingId !== listingId))
      if (aktion === 'uebernehmen') void ladeListings()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setVorschlagBusy(null)
    }
  }

  function applyAuditPayload(j: {
    listing: EtsyShopListingDetail
    audit: EtsySeoAuditResult
    fromCache?: boolean
    auditedAt?: string
    regelReport?: EtsySeoRegelReport
    historie?: HistoriePunkt[]
  }) {
    setListing(j.listing)
    setAudit(j.audit)
    setFromCache(Boolean(j.fromCache))
    setAuditedAt(j.auditedAt ?? null)
    setRegelReport(j.regelReport ?? null)
    setHistorie(j.historie ?? [])
    setEditTitle(j.audit.suggestions.optimized_title)
    setEditTags(j.audit.suggestions.optimized_tags.join(', '))
    setEditIntro(j.audit.suggestions.optimized_description_intro)
    setRankKeywords(j.audit.suggestions.optimized_tags.slice(0, 5).join(', '))
    setConfirmPush(null)
    setShowDiff(true)
    void ladeHauptbegriff(j.listing.listingId)
    void ladeTopRanks(j.listing.listingId)
  }

  async function ladeTopRanks(listingId: number) {
    try {
      const res = await fetch(`/api/etsy/listings/${listingId}/rank`, { cache: 'no-store' })
      const j = (await res.json()) as {
        error?: string
        gruppe?: string
        results?: TopRankZeile[]
      }
      if (!res.ok || !j.results) return
      setTopRankGruppe(j.gruppe ?? null)
      setTopRankZeilen(j.results)
      setRankKeywords(j.results.map((r) => r.keyword).join(', '))
    } catch {
      /* optional */
    }
  }

  async function ladeHauptbegriff(listingId: number) {
    setHauptbegriffGespeichert(null)
    setHauptbegriffEingabe('')
    try {
      const res = await fetch(`/api/etsy/listings/${listingId}/hauptbegriff`, { cache: 'no-store' })
      const j = (await res.json()) as { hauptbegriff?: string | null }
      if (res.ok && j.hauptbegriff) {
        setHauptbegriffGespeichert(j.hauptbegriff)
        setHauptbegriffEingabe(j.hauptbegriff)
      }
    } catch {
      /* Hauptbegriff optional */
    }
  }

  async function speichereHauptbegriff(wert: string | null) {
    if (!listing) return
    setHauptbegriffBusy(true)
    try {
      const res = await fetch(`/api/etsy/listings/${listing.listingId}/hauptbegriff`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hauptbegriff: wert }),
      })
      const j = (await res.json()) as { hauptbegriff?: string | null; error?: string }
      if (!res.ok) {
        toast.error(j.error ?? 'Speichern fehlgeschlagen.')
        return
      }
      setHauptbegriffGespeichert(j.hauptbegriff ?? null)
      setHauptbegriffEingabe(j.hauptbegriff ?? '')
      toast.success(j.hauptbegriff ? 'Hauptbegriff gespeichert — wird ab jetzt getrackt.' : 'Wieder automatisch.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setHauptbegriffBusy(false)
    }
  }

  async function starteAudit(listingId: number, force = false) {
    setSelectedId(listingId)
    setBusy(true)
    setBusyKind(force ? 'optimize' : 'audit')
    setRank(null)
    try {
      const res = await fetch(`/api/etsy/listings/${listingId}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const j = (await res.json()) as {
        error?: string
        listing?: EtsyShopListingDetail
        audit?: EtsySeoAuditResult
        fromCache?: boolean
        auditedAt?: string
        regelReport?: EtsySeoRegelReport
        historie?: HistoriePunkt[]
      }
      if (!res.ok || !j.audit || !j.listing) {
        toast.error(j.error ?? 'Audit fehlgeschlagen.')
        return
      }
      applyAuditPayload({
        listing: j.listing,
        audit: j.audit,
        fromCache: j.fromCache,
        auditedAt: j.auditedAt,
        regelReport: j.regelReport,
        historie: j.historie,
      })
      toast.success(
        force
          ? `Neu optimiert · Score ${j.audit.overall_score}/100 — Diff prüfen & pushen`
          : j.fromCache
            ? `Cache · Score ${j.audit.overall_score}/100`
            : `Frisch · Score ${j.audit.overall_score}/100`,
      )
      void ladeListings()
      // Detail-Panel in den Viewport scrollen
      requestAnimationFrame(() => {
        document.getElementById('seo-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  async function batchScan(force = false) {
    setBatchBusy(true)
    setBatchProgress('Batch-Audit läuft (max. 15, parallel 2)…')
    try {
      const res = await fetch('/api/etsy/listings/batch-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: stateFilter, limit: 15, force }),
      })
      const j = (await res.json()) as {
        error?: string
        results?: Array<{ listingId: number; overallScore: number; error?: string; fromCache?: boolean }>
      }
      if (!res.ok) {
        toast.error(j.error ?? 'Batch fehlgeschlagen.')
        return
      }
      const ok = (j.results ?? []).filter((r) => !r.error)
      const fail = (j.results ?? []).filter((r) => r.error)
      toast.success(`Batch fertig: ${ok.length} ok${fail.length ? `, ${fail.length} Fehler` : ''}`)
      void ladeListings()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Batch-Fehler')
    } finally {
      setBatchBusy(false)
      setBatchProgress('')
    }
  }

  async function repariereAlleTags() {
    const n = listings.filter(hatUnvollstaendigeTags).length
    if (!n) {
      toast.success('Alle geladenen Listings haben 13 Tags.')
      return
    }
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        `${n} Listing${n === 1 ? '' : 's'} auf Etsy auf ${ETSY_SEO_TAG_COUNT} Tags setzen?\n\nVorhandene Tags bleiben; fehlende kommen aus dem Änderungs-Log oder aus Titel/Holzart.`,
      )
    ) {
      return
    }
    setTagsReparaturBusy(true)
    setBatchProgress('Stelle 13 Tags je Listing wieder her…')
    try {
      const res = await fetch('/api/etsy/listings/tags-reparieren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const j = (await res.json()) as {
        error?: string
        repariert?: number
        fehlgeschlagen?: number
        betroffen?: number
      }
      if (!res.ok) {
        toast.error(j.error ?? 'Tags-Reparatur fehlgeschlagen.')
        return
      }
      toast.success(
        `${j.repariert ?? 0} von ${j.betroffen ?? n} Listings mit ${ETSY_SEO_TAG_COUNT} Tags auf Etsy` +
          (j.fehlgeschlagen ? ` · ${j.fehlgeschlagen} fehlgeschlagen` : ''),
      )
      void ladeListings()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Tags-Reparatur fehlgeschlagen')
    } finally {
      setTagsReparaturBusy(false)
      setBatchProgress('')
    }
  }

  async function schreibeHandwerkSpracheUm() {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        `„handgedreht“ → „handgedrechselt“ auf Etsy umschreiben?\n\nPrüft alle ${stateFilter === 'active' ? 'aktiven' : ''} Listings (Titel, Beschreibung, Tags) und schreibt nur geänderte Felder. Dauert je Listing ein paar Sekunden.`,
      )
    ) {
      return
    }
    setHandwerkBusy(true)
    setBatchProgress('Schreibe Handwerk-Sprache um (handgedreht → handgedrechselt)…')
    try {
      const res = await fetch('/api/etsy/listings/handwerk-sprache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: stateFilter }),
      })
      const j = (await res.json()) as {
        error?: string
        umgeschrieben?: number
        fehlgeschlagen?: number
        betroffen?: number
        geprueft?: number
        unveraendert?: number
      }
      if (!res.ok) {
        toast.error(j.error ?? 'Umschreibung fehlgeschlagen.')
        return
      }
      toast.success(
        `${j.umgeschrieben ?? 0} Listing${(j.umgeschrieben ?? 0) === 1 ? '' : 's'} umgeschrieben` +
          (j.unveraendert ? ` · ${j.unveraendert} schon ok` : '') +
          (j.fehlgeschlagen ? ` · ${j.fehlgeschlagen} Fehler` : ''),
      )
      setHandgedrehtAnzahl(0)
      void ladeListings()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Umschreibung fehlgeschlagen')
    } finally {
      setHandwerkBusy(false)
      setBatchProgress('')
    }
  }

  async function pushUpdate(kind: 'title' | 'tags' | 'intro' | 'all') {
    if (!selectedId || !listing) return
    if (confirmPush !== kind) {
      setConfirmPush(kind)
      toast('Diff prüfen — nochmals klicken zum Bestätigen.', { icon: '👀' })
      return
    }
    setBusy(true)
    setBusyKind('push')
    try {
      const tags = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, ETSY_SEO_TAG_COUNT)
      const res = await fetch(`/api/etsy/listings/${selectedId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: kind === 'title' || kind === 'all' ? editTitle.trim() : undefined,
          tags: kind === 'tags' || kind === 'all' ? tags : undefined,
          prependIntro: kind === 'intro' || kind === 'all',
          optimizedIntro:
            kind === 'intro' || kind === 'all' ? editIntro.trim() : undefined,
          existingDescription: listing.description,
        }),
      })
      const j = (await res.json()) as { error?: string; listing?: EtsyShopListingDetail }
      if (!res.ok) {
        toast.error(j.error ?? 'Update fehlgeschlagen.')
        return
      }
      if (j.listing) setListing(j.listing)
      setConfirmPush(null)
      toast.success('Auf Etsy gespeichert.')
      void ladeListings()
      void starteAudit(selectedId, true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  async function rankCheck(nutzeTop5 = true) {
    if (!selectedId) return
    setBusy(true)
    setBusyKind('rank')
    try {
      const keywords = nutzeTop5
        ? []
        : rankKeywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean)
      const res = await fetch(`/api/etsy/listings/${selectedId}/rank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keywords.length ? { keywords } : {}),
      })
      const j = (await res.json()) as {
        error?: string
        rank?: EtsyRankTrackingResult
        gruppe?: string
        topKeywords?: Array<{ keyword: string; nachfrage: number | null; chance: TopRankZeile['chance']; quellen: TopRankZeile['quellen']; ausMerkliste: boolean }>
      }
      if (!res.ok || !j.rank) {
        toast.error(j.error ?? 'Rank-Check fehlgeschlagen.')
        return
      }
      setRank(j.rank)
      if (j.gruppe) setTopRankGruppe(j.gruppe)
      const meta = new Map((j.topKeywords ?? []).map((t) => [t.keyword, t]))
      setTopRankZeilen(
        j.rank.results.map((r) => {
          const m = meta.get(r.keyword)
          return {
            keyword: r.keyword,
            page: r.page,
            position: r.position,
            found: r.found,
            note: r.note,
            nachfrage: m?.nachfrage ?? null,
            chance: m?.chance ?? null,
            quellen: m?.quellen ?? [],
            ausMerkliste: m?.ausMerkliste ?? false,
          }
        }),
      )
      const found = j.rank.results.filter((r) => r.found).length
      toast.success(`Rank (${j.rank.provider}): ${found}/${j.rank.results.length} gefunden`)
      void ladeListings()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  async function optimiereFuerKeyword(zielKeyword: string) {
    if (!selectedId) return
    const schutzKeywords = topRankZeilen
      .filter((r) => r.keyword !== zielKeyword && r.found && r.page != null && r.page < 3)
      .map((r) => r.keyword)
    setBusy(true)
    setBusyKind('optimize')
    try {
      const res = await fetch(`/api/etsy/listings/${selectedId}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, zielKeyword, schutzKeywords }),
      })
      const j = (await res.json()) as {
        error?: string
        listing?: EtsyShopListingDetail
        audit?: EtsySeoAuditResult
        fromCache?: boolean
        auditedAt?: string
        regelReport?: EtsySeoRegelReport
        historie?: HistoriePunkt[]
      }
      if (!res.ok || !j.audit || !j.listing) {
        toast.error(j.error ?? 'Optimierung fehlgeschlagen.')
        return
      }
      applyAuditPayload({
        listing: j.listing,
        audit: j.audit,
        fromCache: j.fromCache,
        auditedAt: j.auditedAt,
        regelReport: j.regelReport,
        historie: j.historie,
      })
      toast.success(
        schutzKeywords.length
          ? `Für „${zielKeyword}“ optimiert · ${schutzKeywords.length} Keywords geschützt — Diff prüfen`
          : `Für „${zielKeyword}“ optimiert — Diff prüfen & pushen`,
      )
      void ladeListings()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  if (!verbunden) {
    return (
      <PageSection titleId="seo-need-connect" title="SEO Überwachung">
        <PageSectionPanel density="compact">
          <p className="text-sm text-[var(--app-text-muted)]">
            Zuerst den Etsy-Shop verbinden — danach Batch-Audit, Scores und Live-Updates.
          </p>
        </PageSectionPanel>
      </PageSection>
    )
  }

  return (
    <>
      {vorschlaege.length > 0 && (
        <PageSection titleId="seo-vorschlaege" title={`Vorbereitete Vorschläge · ${vorschlaege.length}`}>
          <PageSectionPanel density="compact" className="space-y-2">
            <p className="text-xs text-[var(--app-text-muted)]">
              Vom Wochen-Cron erstellt (Ranking-Verlust oder Score &lt; 70). Diff prüfen, dann mit einem Klick
              auf Etsy übernehmen. Wurde das Listing inzwischen auf Etsy geändert, wird der Vorschlag als veraltet
              markiert statt die Änderung zu überschreiben.
            </p>
            <ul className="divide-y divide-[var(--app-border)]">
              {vorschlaege.map((v) => {
                const offen = vorschlagOffen === v.listingId
                const diff = baueEtsySeoDiff({
                  before: {
                    title: v.before.title,
                    tags: v.before.tags,
                    description: v.before.description ?? '',
                  },
                  after: { title: v.after.title, tags: v.after.tags, description: v.after.description },
                })
                return (
                  <li key={v.listingId} className="space-y-2 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--app-text)]">{v.listingTitle}</p>
                        <p className="text-xs text-[var(--app-text-muted)]">
                          #{v.listingId} · {v.grund}
                          {v.audit ? ` · Audit ${v.audit.overall_score}/100` : ''}
                          {v.audit?.geo_insights.ai_search_score != null
                            ? ` · KI-Suche ${v.audit.geo_insights.ai_search_score}`
                            : ''}
                          {' · '}
                          {new Date(v.createdAt).toLocaleDateString('de-DE')}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setVorschlagOffen(offen ? null : v.listingId)}
                          className="rounded-lg border border-[var(--app-border)] px-2.5 py-1.5 text-xs"
                        >
                          {offen ? 'Diff zu' : 'Diff'}
                        </button>
                        <button
                          type="button"
                          disabled={vorschlagBusy != null}
                          onClick={() => void vorschlagAktion(v.listingId, 'uebernehmen')}
                          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600 disabled:opacity-50"
                        >
                          {vorschlagBusy === v.listingId ? '…' : 'Übernehmen'}
                        </button>
                        <button
                          type="button"
                          disabled={vorschlagBusy != null}
                          onClick={() => void vorschlagAktion(v.listingId, 'verwerfen')}
                          className="rounded-lg border border-[var(--app-border)] px-2.5 py-1.5 text-xs text-[var(--app-text-muted)] disabled:opacity-50"
                        >
                          Verwerfen
                        </button>
                      </div>
                    </div>
                    {offen && (
                      <div className="space-y-2">
                        {diff
                          .filter((d) => d.changed)
                          .map((d) => (
                            <div
                              key={d.field}
                              className="grid gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs sm:grid-cols-2"
                            >
                              <div>
                                <p className="text-[var(--app-text-muted)]">{d.label} · aktuell</p>
                                <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[var(--app-text-muted)]">
                                  {d.before || '—'}
                                </pre>
                              </div>
                              <div>
                                <p className="text-[var(--app-text-muted)]">Vorschlag</p>
                                <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[var(--app-text)]">
                                  {d.after || '—'}
                                </pre>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </PageSectionPanel>
        </PageSection>
      )}

      <PageSection titleId="seo-overview" title="SEO Überwachung · Übersicht">
        <PageSectionPanel density="compact" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
            >
              <option value="active">Aktiv</option>
              <option value="draft">Entwürfe</option>
              <option value="inactive">Inaktiv</option>
            </select>
            <button
              type="button"
              disabled={loadingList || batchBusy || tagsReparaturBusy || handwerkBusy}
              onClick={() => void ladeListings()}
              className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm"
            >
              {loadingList ? 'Lädt…' : 'Aktualisieren'}
            </button>
            <button
              type="button"
              disabled={batchBusy || tagsReparaturBusy || handwerkBusy}
              onClick={() => void batchScan(false)}
              className="rounded-xl bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50"
            >
              {batchBusy ? 'Scan…' : 'Alle scannen (Cache)'}
            </button>
            <button
              type="button"
              disabled={batchBusy || tagsReparaturBusy || handwerkBusy}
              onClick={() => void batchScan(true)}
              className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm disabled:opacity-50"
            >
              Force-Rescan
            </button>
            {(handgedrehtAnzahl > 0 || handwerkBusy) && (
              <button
                type="button"
                disabled={batchBusy || tagsReparaturBusy || handwerkBusy}
                onClick={() => void schreibeHandwerkSpracheUm()}
                className="rounded-xl bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {handwerkBusy
                  ? 'Schreibe um…'
                  : `${handgedrehtAnzahl}× handgedreht → handgedrechselt`}
              </button>
            )}
            {scoreStats.tagsFehlen > 0 && (
              <button
                type="button"
                disabled={batchBusy || tagsReparaturBusy || handwerkBusy}
                onClick={() => void repariereAlleTags()}
                className="rounded-xl bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {tagsReparaturBusy
                  ? 'Stelle Tags her…'
                  : `${scoreStats.tagsFehlen}× 13 Tags wiederherstellen`}
              </button>
            )}
          </div>
          {handgedrehtAnzahl > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100">
              <p className="font-medium">
                {handgedrehtAnzahl} Listing{handgedrehtAnzahl === 1 ? '' : 's'} nutzen noch „handgedreht“.
              </p>
              <p className="mt-1 text-xs text-amber-200/90">
                Ein Klick ersetzt auf Etsy in Titel, Beschreibung und Tags durch „handgedrechselt“ (Tags: z. B.
                „gedrechselte schale“). Kein KI-Lauf nötig.
              </p>
            </div>
          )}
          {scoreStats.tagsFehlen > 0 && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-100">
              <p className="font-medium">
                {scoreStats.tagsFehlen} Listing{scoreStats.tagsFehlen === 1 ? '' : 's'} haben weniger als{' '}
                {ETSY_SEO_TAG_COUNT} Tags.
              </p>
              <p className="mt-1 text-xs text-rose-200/90">
                Ursache: Tag-Updates haben die Liste überschrieben statt alle 13 zu setzen. Ein Klick stellt die
                Tags aus dem Änderungs-Log wieder her und füllt auf 13 passende Long-Tail-Tags auf.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['alle', 'Alle'],
                ['tags-fehlen', `Tags fehlen (${scoreStats.tagsFehlen})`],
                ['schwach', 'Schwach (Score)'],
                ['schlecht-rank', 'Schlecht gerankt (S.≥3 / fehlt)'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setListFilter(id)}
                className={`rounded-lg px-2.5 py-1 text-xs ${
                  listFilter === id
                    ? 'bg-teal-700 text-white'
                    : 'border border-[var(--app-border)] text-[var(--app-text-muted)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {batchProgress && <p className="text-xs text-[var(--app-text-muted)]">{batchProgress}</p>}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`rounded-md px-2 py-0.5 font-semibold ${scoreBadgeClass(scoreStats.avg)}`}>
              Ø {scoreStats.avg != null ? scoreStats.avg : '—'}
            </span>
            <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-rose-300">
              Rot {scoreStats.rot}
            </span>
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-300">
              Gelb {scoreStats.gelb}
            </span>
            <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
              Grün {scoreStats.gruen}
            </span>
            {scoreStats.tagsFehlen > 0 && (
              <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-rose-200">
                Tags unvollständig {scoreStats.tagsFehlen}
              </span>
            )}
            {scoreStats.ohne > 0 && (
              <span className="rounded-md bg-[var(--app-surface-muted)] px-2 py-0.5 text-[var(--app-text-muted)]">
                Ohne Audit {scoreStats.ohne}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--app-text-muted)]">
            Aktive Listings · Stift = bearbeiten/neu optimieren. Schlecht gerankt = Top-Keyword Seite ≥3 oder nicht
            gefunden.
          </p>

          {sichtbareListings.length === 0 ? (
            <p className="text-sm text-[var(--app-text-muted)]">
              {listings.length === 0
                ? 'Keine Listings in diesem Status.'
                : 'Keine Treffer in diesem Filter.'}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--app-border)]">
              {sichtbareListings.map((l) => (
                <li
                  key={l.listingId}
                  className={`flex flex-wrap items-center justify-between gap-2 py-2 ${
                    selectedId === l.listingId ? 'bg-teal-500/5' : hatUnvollstaendigeTags(l) ? 'bg-rose-500/5' : ''
                  }`}
                >
                  <div className="min-w-0 flex items-start gap-2">
                    <span
                      className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreBadgeClass(l.cachedScore)}`}
                    >
                      {l.cachedScore != null ? l.cachedScore : '—'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--app-text)]">{l.title}</p>
                      <p className="text-xs text-[var(--app-text-muted)]">
                        #{l.listingId}
                        {l.priceEur != null ? ` · ${l.priceEur} €` : ''}
                        {l.rankHasWeak
                          ? ` · schwach${l.rankWeakKeyword ? ` („${l.rankWeakKeyword}“)` : ''}`
                          : l.rankPage != null
                            ? ` · Rank S.${l.rankPage}${l.rankPosition != null ? ` #${l.rankPosition}` : ''}${l.rankKeyword ? ` („${l.rankKeyword}“)` : ''}`
                            : ' · noch kein Rank'}
                        {l.cachedAt
                          ? ` · Audit ${new Date(l.cachedAt).toLocaleDateString('de-DE')}`
                          : ''}
                        {` · ${(l.tags?.length ?? 0)}/${ETSY_SEO_TAG_COUNT} Tags`}
                        {hatUnvollstaendigeTags(l) ? ' · unvollständig' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      disabled={busy || batchBusy || tagsReparaturBusy}
                      title="Bearbeiten / Keywords & Text neu optimieren"
                      onClick={() => void starteAudit(l.listingId, istSchwach(l) || istSchlechtGerankt(l))}
                      className="rounded-xl border border-[var(--app-border)] px-2.5 py-1.5 text-sm hover:bg-[var(--app-surface-muted)] disabled:opacity-50"
                      aria-label="Bearbeiten"
                    >
                      {busy && selectedId === l.listingId ? '…' : '✎'}
                    </button>
                    <button
                      type="button"
                      disabled={busy || batchBusy || tagsReparaturBusy}
                      onClick={() => void starteAudit(l.listingId, false)}
                      className="rounded-xl bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50"
                    >
                      Öffnen
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PageSectionPanel>
      </PageSection>

      {audit && listing && (
        <PageSection titleId="seo-detail" title={`Detail · Score ${audit.overall_score}/100`}>
          <PageSectionPanel density="compact" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-muted)]">
              <span className={`rounded-md px-2 py-0.5 font-semibold ${scoreBadgeClass(audit.overall_score)}`}>
                {audit.overall_score}
              </span>
              {fromCache ? <span>aus Cache</span> : <span>frisch analysiert</span>}
              {auditedAt && <span>· {new Date(auditedAt).toLocaleString('de-DE')}</span>}
              <button
                type="button"
                disabled={busy}
                onClick={() => selectedId && void starteAudit(selectedId, true)}
                className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {busyKind === 'optimize'
                  ? 'Generiert…'
                  : 'Keywords & Beschreibung neu generieren'}
              </button>
            </div>

            {audit.summary && <p className="text-sm text-[var(--app-text-muted)]">{audit.summary}</p>}

            <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-3">
              <p className="text-xs text-[var(--app-text-muted)]">
                Nach Neu-Generierung: Diff prüfen, dann alles auf einmal pushen (Titel + Tags + GEO-Intro).
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void pushUpdate('all')}
                className={`mt-2 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  confirmPush === 'all'
                    ? 'bg-amber-600 text-white'
                    : 'bg-teal-800 text-white disabled:opacity-50'
                }`}
              >
                {confirmPush === 'all'
                  ? 'Jetzt Titel + Tags + Intro pushen'
                  : 'Alles übernehmen (mit Diff-Check)'}
              </button>
            </div>

            {/* Hauptbegriff (eRank „Superstar Keyword“) */}
            {(() => {
              const r = liveRegeln || regelReport
              const hb = r?.hauptbegriff
              return (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
                  <p className="text-xs font-medium text-[var(--app-text)]">
                    Hauptbegriff{' '}
                    <span className="font-normal text-[var(--app-text-muted)]">
                      — die eine Suche, für die dieses Stück gefunden werden soll
                    </span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={hauptbegriffEingabe}
                      onChange={(e) => setHauptbegriffEingabe(e.target.value)}
                      placeholder={hb?.hauptbegriff ? `automatisch: ${hb.hauptbegriff}` : 'z. B. obstschale buche'}
                      className="min-w-0 flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1.5 text-sm text-[var(--app-text)]"
                    />
                    <button
                      type="button"
                      disabled={hauptbegriffBusy || !hauptbegriffEingabe.trim()}
                      onClick={() => void speichereHauptbegriff(hauptbegriffEingabe)}
                      className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50"
                    >
                      Festlegen
                    </button>
                    {hauptbegriffGespeichert && (
                      <button
                        type="button"
                        disabled={hauptbegriffBusy}
                        onClick={() => void speichereHauptbegriff(null)}
                        className="rounded-lg border border-[var(--app-border)] px-2.5 py-1.5 text-xs text-[var(--app-text-muted)]"
                      >
                        Automatisch
                      </button>
                    )}
                  </div>
                  {hb?.hauptbegriff && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {(
                        [
                          ['Vorne im Titel', hb.titelVorne],
                          ['Als Tag', hb.imTag],
                          ['In den ersten 2 Sätzen', hb.imEinstieg],
                        ] as const
                      ).map(([label, ok]) => (
                        <span
                          key={label}
                          className={`rounded-md px-2 py-0.5 ${ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}
                        >
                          {ok ? '✓' : '✗'} {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Regel-Checks live */}
            <div className="rounded-xl border border-[var(--app-border)] p-3">
              <p className="text-xs font-medium text-[var(--app-text-muted)]">
                Checkliste (Titel ideal {ETSY_SEO_TITLE_IDEAL_MIN}–{ETSY_SEO_TITLE_IDEAL_MAX} Zeichen, Wichtiges
                in den ersten {ETSY_SEO_TITLE_FRONTLOAD}, {ETSY_SEO_TAG_COUNT} Tags je ≤{ETSY_SEO_TAG_MAX} Zeichen)
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {(liveRegeln || regelReport) &&
                  (
                    [
                      ['Titel ≤140 Zeichen', (liveRegeln || regelReport)!.titleOk],
                      ['Wichtiges vorne', (liveRegeln || regelReport)!.titleFrontloadOk],
                      ['Titellänge ideal', (liveRegeln || regelReport)!.titleLengthIdeal],
                      ['Hauptbegriff überall', (liveRegeln || regelReport)!.hauptbegriffOk],
                      ['Keine Füllwörter vorne', (liveRegeln || regelReport)!.titleStopwordOk],
                      ['13 Tags', (liveRegeln || regelReport)!.tagsCountOk],
                      ['Tags ≤20 Zeichen', (liveRegeln || regelReport)!.tagsLengthOk],
                      ['Präzise Suchphrasen', (liveRegeln || regelReport)!.tagsLongtailOk],
                      [
                        `Tag-Mix ${(liveRegeln || regelReport)!.tagsPraezise} präzise / ${(liveRegeln || regelReport)!.tagsBreit} breit`,
                        (liveRegeln || regelReport)!.tagMixOk,
                      ],
                      ['Keine Wortdoppelungen', (liveRegeln || regelReport)!.tagsStemOk],
                      ['Nicht doppelt zur Kategorie', (liveRegeln || regelReport)!.tagsAttrOk],
                      ['Tags auf Deutsch', (liveRegeln || regelReport)!.tagsSpracheOk],
                      ['Beschreibung', (liveRegeln || regelReport)!.descriptionOk],
                      ['Starker Einstieg', (liveRegeln || regelReport)!.descFirst2Ok],
                      ['Holzart', (liveRegeln || regelReport)!.descHolzartOk],
                      ['Maße', (liveRegeln || regelReport)!.descMasseOk],
                      ['Pflege', (liveRegeln || regelReport)!.descPflegeOk],
                    ] as const
                  ).map(([label, ok]) => (
                    <span
                      key={String(label)}
                      className={`rounded-md px-2 py-0.5 ${ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}
                    >
                      {ok ? '✓' : '✗'} {label}
                    </span>
                  ))}
              </div>
              {(liveRegeln?.issues.length ?? 0) > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-[var(--app-text-muted)]">
                  {liveRegeln!.issues.slice(0, 6).map((i, idx) => (
                    <li key={`${i.message}-${idx}`}>
                      [{i.severity}] {i.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-[var(--app-text-muted)]">SEO-Issues</p>
              {audit.seo_issues.length === 0 ? (
                <p className="text-sm text-[var(--app-text)]">Keine kritischen Issues.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {audit.seo_issues.map((i, idx) => (
                    <li key={`${i.field}-${idx}`}>
                      <span
                        className={
                          i.severity === 'error'
                            ? 'text-rose-400'
                            : i.severity === 'warning'
                              ? 'text-amber-400'
                              : 'text-[var(--app-text-muted)]'
                        }
                      >
                        [{i.severity}]
                      </span>{' '}
                      <span className="text-[var(--app-text-muted)]">{i.field}:</span> {i.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-[var(--app-border)] p-3 text-sm">
              <p className="text-xs font-medium text-[var(--app-text-muted)]">GEO</p>
              <p className="mt-1">
                Zielgruppe: <strong>{audit.geo_insights.target_audience_clarity}</strong>
                {audit.geo_insights.what_clarity ? ` · WAS: ${audit.geo_insights.what_clarity}` : ''}
                {audit.geo_insights.occasion_clarity
                  ? ` · Anlass: ${audit.geo_insights.occasion_clarity}`
                  : ''}
              </p>
              {audit.geo_insights.missing_contexts.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-[var(--app-text-muted)]">
                  {audit.geo_insights.missing_contexts.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
              {audit.geo_insights.ai_search_score != null && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs">
                    KI-Suche (Gemini/ChatGPT/Perplexity):{' '}
                    <span
                      className={`rounded-md px-2 py-0.5 font-semibold tabular-nums ${scoreBadgeClass(audit.geo_insights.ai_search_score)}`}
                    >
                      {audit.geo_insights.ai_search_score}
                    </span>
                  </p>
                  {(audit.geo_insights.intent_queries_covered?.length ?? 0) > 0 && (
                    <p className="text-xs text-emerald-300/90">
                      ✓ {audit.geo_insights.intent_queries_covered!.join(' · ')}
                    </p>
                  )}
                  {(audit.geo_insights.intent_queries_missing?.length ?? 0) > 0 && (
                    <p className="text-xs text-amber-300/90">
                      ✗ {audit.geo_insights.intent_queries_missing!.join(' · ')}
                    </p>
                  )}
                </div>
              )}
            </div>

            {audit.markt && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                <p className="font-medium text-[var(--app-text-muted)]">
                  Markt-Abgleich · {audit.markt.abdeckung.abgedeckt.length}/
                  {audit.markt.abdeckung.abgedeckt.length + audit.markt.abdeckung.fehlend.length} reale
                  Suchphrasen abgedeckt
                  {audit.markt.preisMedianEur != null ? ` · Konkurrenz-Median ${audit.markt.preisMedianEur} €` : ''}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {audit.markt.abdeckung.abgedeckt.map((k) => (
                    <span key={k} className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                      ✓ {k}
                    </span>
                  ))}
                  {audit.markt.abdeckung.fehlend.map((k) => (
                    <span key={k} className="rounded border border-dashed border-amber-500/50 px-1.5 py-0.5 text-amber-200">
                      {k}
                    </span>
                  ))}
                </div>
                {audit.markt.degradiert && audit.markt.hinweise.length > 0 && (
                  <p className="mt-1 text-[10px] text-[var(--app-text-muted)]">{audit.markt.hinweise.join(' ')}</p>
                )}
              </div>
            )}

            {/* Diff */}
            <div>
              <button
                type="button"
                onClick={() => setShowDiff((v) => !v)}
                className="text-xs font-medium text-[var(--app-text-muted)] underline-offset-2 hover:underline"
              >
                {showDiff ? 'Diff ausblenden' : 'Diff anzeigen'} (alt → neu)
              </button>
              {showDiff && (
                <div className="mt-2 space-y-3">
                  {diffZeilen.map((d) => (
                    <div
                      key={d.field}
                      className={`rounded-xl border p-3 text-xs ${
                        d.changed
                          ? 'border-amber-500/40 bg-amber-500/5'
                          : 'border-[var(--app-border)] opacity-70'
                      }`}
                    >
                      <p className="font-medium text-[var(--app-text)]">
                        {d.label} {d.changed ? '· geändert' : '· unverändert'}
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div>
                          <p className="text-[var(--app-text-muted)]">Aktuell</p>
                          <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[var(--app-text-muted)]">
                            {d.before || '—'}
                          </pre>
                        </div>
                        <div>
                          <p className="text-[var(--app-text-muted)]">Vorschlag</p>
                          <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[var(--app-text)]">
                            {d.after || '—'}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-xs text-[var(--app-text-muted)]">
                Titel ({editTitle.length}/{ETSY_SEO_TITLE_MAX})
              </span>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={ETSY_SEO_TITLE_MAX}
                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void pushUpdate('title')}
                className={`mt-2 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  confirmPush === 'title'
                    ? 'bg-amber-600 text-white'
                    : 'border border-[var(--app-border)]'
                }`}
              >
                {confirmPush === 'title' ? 'Jetzt Titel pushen' : 'Titel übernehmen (mit Diff-Check)'}
              </button>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-xs text-[var(--app-text-muted)]">
                Tags (
                {
                  editTags
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean).length
                }
                /{ETSY_SEO_TAG_COUNT})
              </span>
              <textarea
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void pushUpdate('tags')}
                className={`mt-2 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  confirmPush === 'tags'
                    ? 'bg-amber-600 text-white'
                    : 'border border-[var(--app-border)]'
                }`}
              >
                {confirmPush === 'tags' ? 'Jetzt Tags pushen' : 'Tags übernehmen (mit Diff-Check)'}
              </button>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-xs text-[var(--app-text-muted)]">GEO-Intro</span>
              <textarea
                value={editIntro}
                onChange={(e) => setEditIntro(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm leading-relaxed"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void pushUpdate('intro')}
                className={`mt-2 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  confirmPush === 'intro'
                    ? 'bg-amber-600 text-white'
                    : 'border border-[var(--app-border)]'
                }`}
              >
                {confirmPush === 'intro'
                  ? 'Jetzt Intro vor Beschreibung setzen'
                  : 'Intro übernehmen (mit Diff-Check)'}
              </button>
            </label>

            {/* Score-Historie */}
            {historie.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--app-text-muted)]">Score-Verlauf</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[...historie].reverse().map((h) => (
                    <span
                      key={h.id}
                      title={new Date(h.createdAt).toLocaleString('de-DE')}
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreBadgeClass(h.overallScore)}`}
                    >
                      {h.overallScore}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-[var(--app-border)] pt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-[var(--app-text)]">
                  Top-Suchbegriffe
                  {topRankGruppe === 'schale'
                    ? ' (Schalen)'
                    : topRankGruppe === 'vase'
                      ? ' (Vasen)'
                      : topRankGruppe
                        ? ` (${topRankGruppe})`
                        : ''}
                  <span className="font-normal text-[var(--app-text-muted)]">
                    {' '}
                    · Seite 1–2 = gut · ≥3 / fehlt = schwach
                    {rank
                      ? ` · ${rank.provider === 'etsy_api_relevanz' ? 'API-Relevanz' : rank.provider}`
                      : ''}
                  </span>
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void rankCheck(true)}
                  className="rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {busyKind === 'rank' ? 'Prüft…' : 'Ranks aktualisieren'}
                </button>
              </div>

              {topRankZeilen.length === 0 ? (
                <p className="text-xs text-[var(--app-text-muted)]">
                  Noch keine Top-Keywords geladen — Audit öffnen oder Ranks aktualisieren.
                </p>
              ) : (
                <ul className="space-y-2">
                  {topRankZeilen.map((r) => {
                    const schwach = !r.found || r.page == null || r.page >= 3
                    return (
                      <li
                        key={r.keyword}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--app-border)] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium text-[var(--app-text)]">{r.keyword}</span>
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${rankAmpelClass(r)}`}
                            >
                              {rankAmpelLabel(r)}
                            </span>
                            {r.ausMerkliste && (
                              <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300">
                                Merkliste
                              </span>
                            )}
                            {r.chance && (
                              <span className="rounded-md bg-[var(--app-surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--app-text-muted)]">
                                Chance {r.chance}
                              </span>
                            )}
                          </div>
                          {(r.quellen?.length || r.note) && (
                            <p className="mt-0.5 text-[10px] text-[var(--app-text-muted)]">
                              {r.quellen?.length
                                ? r.quellen
                                    .map((q) =>
                                      q === 'etsy_suggest'
                                        ? 'Etsy'
                                        : q === 'etsy_tags'
                                          ? 'Etsy-Tags'
                                          : q === 'google_de'
                                            ? 'Google'
                                            : 'Amazon',
                                    )
                                    .join(' · ')
                                : null}
                              {r.note && !r.found ? ` · ${r.note}` : ''}
                            </p>
                          )}
                        </div>
                        {schwach && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void optimiereFuerKeyword(r.keyword)}
                            className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-100 disabled:opacity-50"
                          >
                            {busyKind === 'optimize' ? 'Optimiert…' : `Für „${r.keyword}“ optimieren`}
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              <details className="text-xs text-[var(--app-text-muted)]">
                <summary className="cursor-pointer">Eigene Keywords prüfen</summary>
                <input
                  value={rankKeywords}
                  onChange={(e) => setRankKeywords(e.target.value)}
                  placeholder="Keywords, kommagetrennt"
                  className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)]"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void rankCheck(false)}
                  className="mt-2 rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Diese Keywords prüfen
                </button>
              </details>
            </div>
          </PageSectionPanel>
        </PageSection>
      )}
    </>
  )
}
