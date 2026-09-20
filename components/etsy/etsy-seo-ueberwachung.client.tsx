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
}

type HistoriePunkt = { id: string; overallScore: number; createdAt: string }

type ListFilter = 'alle' | 'schwach' | 'schlecht-rank'

type Props = { verbunden: boolean }

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
  return l.rankPage != null && l.rankPage >= 3
}

export function EtsySeoUeberwachung({ verbunden }: Props) {
  const [stateFilter, setStateFilter] = useState('active')
  const [listFilter, setListFilter] = useState<ListFilter>('alle')
  const [listings, setListings] = useState<ListingRow[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false)
  const [batchProgress, setBatchProgress] = useState('')

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
  const [rankKeywords, setRankKeywords] = useState('')

  const sichtbareListings = useMemo(() => {
    if (listFilter === 'schwach') return listings.filter(istSchwach)
    if (listFilter === 'schlecht-rank') return listings.filter(istSchlechtGerankt)
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
    })
  }, [editTitle, editTags, editIntro, listing?.description, listing?.materials, listing?.taxonomyId])

  const scoreStats = useMemo(() => {
    let rot = 0
    let gelb = 0
    let gruen = 0
    let ohne = 0
    let sum = 0
    let n = 0
    for (const l of listings) {
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
    return { rot, gelb, gruen, ohne, avg: n ? Math.round(sum / n) : null }
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

  const ladeListings = useCallback(async () => {
    if (!verbunden) return
    setLoadingList(true)
    try {
      const res = await fetch(`/api/etsy/listings?state=${encodeURIComponent(stateFilter)}&limit=50`, {
        cache: 'no-store',
      })
      const j = (await res.json()) as { error?: string; listings?: ListingRow[] }
      if (!res.ok) {
        toast.error(j.error ?? 'Listings laden fehlgeschlagen.')
        return
      }
      setListings(j.listings ?? [])
    } catch {
      toast.error('Listings laden fehlgeschlagen.')
    } finally {
      setLoadingList(false)
    }
  }, [verbunden, stateFilter])

  useEffect(() => {
    void ladeListings()
  }, [ladeListings])

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

  async function rankCheck() {
    if (!selectedId) return
    setBusy(true)
    setBusyKind('rank')
    try {
      const keywords = rankKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
      const res = await fetch(`/api/etsy/listings/${selectedId}/rank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      })
      const j = (await res.json()) as { error?: string; rank?: EtsyRankTrackingResult }
      if (!res.ok || !j.rank) {
        toast.error(j.error ?? 'Rank-Check fehlgeschlagen.')
        return
      }
      setRank(j.rank)
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
              disabled={loadingList || batchBusy}
              onClick={() => void ladeListings()}
              className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm"
            >
              {loadingList ? 'Lädt…' : 'Aktualisieren'}
            </button>
            <button
              type="button"
              disabled={batchBusy}
              onClick={() => void batchScan(false)}
              className="rounded-xl bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50"
            >
              {batchBusy ? 'Scan…' : 'Alle scannen (Cache)'}
            </button>
            <button
              type="button"
              disabled={batchBusy}
              onClick={() => void batchScan(true)}
              className="rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm disabled:opacity-50"
            >
              Force-Rescan
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['alle', 'Alle'],
                ['schwach', 'Schwach (Score)'],
                ['schlecht-rank', 'Schlecht gerankt (≥S.3)'],
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
            {scoreStats.ohne > 0 && (
              <span className="rounded-md bg-[var(--app-surface-muted)] px-2 py-0.5 text-[var(--app-text-muted)]">
                Ohne Audit {scoreStats.ohne}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--app-text-muted)]">
            Aktive Listings · Stift = bearbeiten/neu optimieren. Schlecht gerankt = nach Rank-Check Seite ≥3.
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
                    selectedId === l.listingId ? 'bg-teal-500/5' : ''
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
                        {l.rankPage != null
                          ? ` · Rank S.${l.rankPage}${l.rankPosition != null ? ` #${l.rankPosition}` : ''}${l.rankKeyword ? ` („${l.rankKeyword}“)` : ''}`
                          : ' · noch kein Rank'}
                        {l.cachedAt
                          ? ` · Audit ${new Date(l.cachedAt).toLocaleDateString('de-DE')}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      disabled={busy || batchBusy}
                      title="Bearbeiten / Keywords & Text neu optimieren"
                      onClick={() => void starteAudit(l.listingId, istSchwach(l) || istSchlechtGerankt(l))}
                      className="rounded-xl border border-[var(--app-border)] px-2.5 py-1.5 text-sm hover:bg-[var(--app-surface-muted)] disabled:opacity-50"
                      aria-label="Bearbeiten"
                    >
                      {busy && selectedId === l.listingId ? '…' : '✎'}
                    </button>
                    <button
                      type="button"
                      disabled={busy || batchBusy}
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

            {/* Regel-Checks live */}
            <div className="rounded-xl border border-[var(--app-border)] p-3">
              <p className="text-xs font-medium text-[var(--app-text-muted)]">
                Regel-Checks (Guide: Front-Load ≤{ETSY_SEO_TITLE_FRONTLOAD}, Titel Ideal{' '}
                {ETSY_SEO_TITLE_IDEAL_MIN}–{ETSY_SEO_TITLE_IDEAL_MAX}, {ETSY_SEO_TAG_COUNT} Long-Tail-Tags ≤
                {ETSY_SEO_TAG_MAX})
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {(liveRegeln || regelReport) &&
                  (
                    [
                      ['Titel', (liveRegeln || regelReport)!.titleOk],
                      ['Front-Load', (liveRegeln || regelReport)!.titleFrontloadOk],
                      ['Titel-Länge', (liveRegeln || regelReport)!.titleLengthIdeal],
                      ['Tag-Anzahl', (liveRegeln || regelReport)!.tagsCountOk],
                      ['Tag-Länge', (liveRegeln || regelReport)!.tagsLengthOk],
                      ['Long-Tail', (liveRegeln || regelReport)!.tagsLongtailOk],
                      ['Stemming', (liveRegeln || regelReport)!.tagsStemOk],
                      ['Attr-Duplikat', (liveRegeln || regelReport)!.tagsAttrOk],
                      ['Beschreibung', (liveRegeln || regelReport)!.descriptionOk],
                    ] as const
                  ).map(([label, ok]) => (
                    <span
                      key={String(label)}
                      className={`rounded-md px-2 py-0.5 ${ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}
                    >
                      {label}: {ok ? 'OK' : 'Fail'}
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
            </div>

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

            <div className="border-t border-[var(--app-border)] pt-3">
              <p className="text-xs font-medium text-[var(--app-text-muted)]">
                Rank Tracking (Etsy-Suche{rank ? ` · ${rank.provider}` : ''}
                {', '}optional Apify)
              </p>
              <input
                value={rankKeywords}
                onChange={(e) => setRankKeywords(e.target.value)}
                placeholder="Keywords, kommagetrennt"
                className="mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void rankCheck()}
                className="mt-2 rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Position prüfen
              </button>
              {rank && (
                <ul className="mt-2 space-y-1 text-xs text-[var(--app-text-muted)]">
                  {rank.results.map((r) => (
                    <li key={r.keyword}>
                      <strong className="text-[var(--app-text)]">{r.keyword}</strong>:{' '}
                      {r.found
                        ? `Seite ${r.page}, Platz ${r.position}`
                        : r.note || 'nicht gefunden'}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </PageSectionPanel>
        </PageSection>
      )}
    </>
  )
}
