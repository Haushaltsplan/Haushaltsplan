'use client'

import { PageSection, PageSectionPanel } from '@/components/page-shell'
import { EtsyInfoHint } from '@/components/etsy/etsy-info-hint'
import { ETSY_SEO_INFO } from '@/lib/etsy/etsy-seo-info'
import { ETSY_RANK_FOKUS_KEYWORDS } from '@/lib/etsy/etsy-rank-fokus'
import { scoreFarbe } from '@/lib/etsy/etsy-seo-regeln'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type RankZelle = {
  keyword: string
  label: string
  page: number | null
  position: number | null
  found: boolean
  note: string | null
  checkedAt: string | null
}

type MatrixListing = {
  listingId: number
  title: string
  priceEur: number | null
  url: string | null
  cachedScore: number | null
  ranks: RankZelle[]
  schwachAnzahl: number
  schwachstesKeyword: string | null
  geprueft: boolean
}

type Props = {
  verbunden: boolean
  fokus?: { listingId: number; force?: boolean; nonce: number } | null
}

function scoreBadgeClass(score: number | null | undefined) {
  if (score == null) return 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]'
  const f = scoreFarbe(score)
  if (f === 'rot') return 'bg-rose-500/20 text-rose-300'
  if (f === 'gelb') return 'bg-amber-500/20 text-amber-300'
  return 'bg-emerald-500/20 text-emerald-300'
}

function zelleStil(r: RankZelle): string {
  if (!r.checkedAt && r.note === 'noch nicht geprüft') {
    return 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]'
  }
  if (!r.found || r.page == null) return 'bg-rose-500/20 text-rose-200 border-rose-500/30'
  if (r.page >= 3) return 'bg-rose-500/20 text-rose-200 border-rose-500/30'
  if (r.page === 2) return 'bg-amber-500/20 text-amber-100 border-amber-500/30'
  return 'bg-emerald-500/20 text-emerald-100 border-emerald-500/30'
}

function zelleText(r: RankZelle): string {
  if (!r.checkedAt && r.note === 'noch nicht geprüft') return '—'
  if (!r.found || r.page == null) return 'fehlt'
  return `S.${r.page}`
}

function zelleSub(r: RankZelle): string {
  if (r.found && r.position != null) return `#${r.position}`
  if (r.note?.includes('Probe dünn')) return 'unsicher'
  if (r.note?.includes('API')) return 'API'
  return ''
}

export function EtsySeoUeberwachung({ verbunden, fokus }: Props) {
  const [listings, setListings] = useState<MatrixListing[]>([])
  const [keywords, setKeywords] = useState<Array<{ keyword: string; label: string }>>([])
  const [loading, setLoading] = useState(false)
  const [rankBusy, setRankBusy] = useState(false)
  const [optBusyId, setOptBusyId] = useState<number | null>(null)
  const [providerHinweis, setProviderHinweis] = useState<string | null>(null)

  const ladeMatrix = useCallback(async () => {
    if (!verbunden) return
    setLoading(true)
    try {
      const res = await fetch('/api/etsy/listings/rank-matrix', { cache: 'no-store' })
      const j = (await res.json()) as {
        error?: string
        listings?: MatrixListing[]
        keywords?: Array<{ keyword: string; label: string }>
      }
      if (!res.ok) {
        toast.error(j.error ?? 'Listings laden fehlgeschlagen.')
        return
      }
      setListings(j.listings ?? [])
      setKeywords(
        j.keywords ??
          ETSY_RANK_FOKUS_KEYWORDS.map((k) => ({ keyword: k, label: k })),
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setLoading(false)
    }
  }, [verbunden])

  useEffect(() => {
    void ladeMatrix()
  }, [ladeMatrix])

  useEffect(() => {
    if (!fokus?.listingId) return
    const el = document.getElementById(`listing-row-${fokus.listingId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [fokus])

  async function ranksAktualisieren() {
    setRankBusy(true)
    setProviderHinweis(null)
    try {
      const res = await fetch('/api/etsy/listings/rank-matrix', { method: 'POST' })
      const j = (await res.json()) as {
        error?: string
        listings?: MatrixListing[]
        keywords?: Array<{ keyword: string; label: string }>
        lauf?: { provider?: string; listings?: number }
      }
      if (!res.ok) {
        toast.error(j.error ?? 'Rank-Messung fehlgeschlagen.')
        return
      }
      setListings(j.listings ?? [])
      if (j.keywords) setKeywords(j.keywords)
      const p = j.lauf?.provider
      if (p === 'etsy_api_relevanz') {
        setProviderHinweis('Messung über Etsy-API (Suchseite blockiert) — Näherung, kein Browser-Ranking 1:1.')
      } else if (p === 'etsy_search') {
        setProviderHinweis('Messung über Etsy-Suchseite.')
      } else if (p === 'unavailable') {
        setProviderHinweis('Suche gerade nicht erreichbar — später erneut versuchen.')
      }
      toast.success(`Ranks aktualisiert · ${j.lauf?.listings ?? 0} Listings`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setRankBusy(false)
    }
  }

  async function rankingOptimieren(listingId: number, zielKeyword?: string | null) {
    setOptBusyId(listingId)
    try {
      const res = await fetch(`/api/etsy/listings/${listingId}/ranking-optimieren`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zielKeyword ? { zielKeyword } : {}),
      })
      const j = (await res.json()) as {
        error?: string
        zielKeyword?: string
        pushed?: boolean
      }
      if (!res.ok) {
        toast.error(j.error ?? 'Optimierung fehlgeschlagen.')
        return
      }
      toast.success(
        j.zielKeyword
          ? `Live auf Etsy: „${j.zielKeyword}“ gestärkt, die anderen 4 geschützt.`
          : 'Listing auf Etsy aktualisiert.',
      )
      void ladeMatrix()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setOptBusyId(null)
    }
  }

  if (!verbunden) {
    return (
      <PageSection titleId="seo-need-connect" title="Meine Listings">
        <PageSectionPanel density="compact">
          <p className="text-sm text-[var(--app-text-muted)]">
            Zuerst den Etsy-Shop verbinden — danach siehst du Ranks unter den fünf Schalen-Suchbegriffen.
          </p>
        </PageSectionPanel>
      </PageSection>
    )
  }

  const kwHeaders = keywords.length
    ? keywords
    : ETSY_RANK_FOKUS_KEYWORDS.map((k) => ({ keyword: k, label: k }))

  return (
    <PageSection
      titleId="seo-overview"
      title={
        <span className="inline-flex items-center gap-2">
          Meine Listings · Rank-Matrix
          <EtsyInfoHint info={ETSY_SEO_INFO.uebersicht} label="Erklärung: Rank-Matrix" />
        </span>
      }
    >
      <PageSectionPanel density="compact" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-xl space-y-1">
            <p className="text-sm text-[var(--app-text-muted)]">
              Fünf Kernbegriffe für Schalen — Farbe = Seite. Ein Button optimiert und speichert direkt auf Etsy,
              ohne die anderen Begriffe zu opfern.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--app-text-muted)]">
              <span className="inline-flex items-center gap-1">
                Kernbegriffe
                <EtsyInfoHint info={ETSY_SEO_INFO.keywordsFuenf} label="Erklärung: Kernbegriffe" />
              </span>
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">S.1 gut</span>
              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-amber-200">S.2 ok</span>
              <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-rose-200">≥S.3 / fehlt</span>
            </div>
            {providerHinweis && (
              <p className="text-[11px] text-amber-200/90">{providerHinweis}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={rankBusy || loading || optBusyId != null}
              onClick={() => void ranksAktualisieren()}
              className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-50"
            >
              {rankBusy ? 'Misst Ranks…' : 'Ranks aktualisieren'}
            </button>
            <EtsyInfoHint info={ETSY_SEO_INFO.ranksAktualisieren} label="Erklärung: Ranks aktualisieren" />
          </div>
        </div>

        {loading && listings.length === 0 ? (
          <p className="text-sm text-[var(--app-text-muted)]">Listings werden geladen…</p>
        ) : listings.length === 0 ? (
          <p className="text-sm text-[var(--app-text-muted)]">Keine aktiven Listings.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--app-border)] text-[11px] text-[var(--app-text-muted)]">
                  <th className="sticky left-0 z-10 bg-[var(--app-surface)] py-2 pr-3 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      Listing
                      <EtsyInfoHint info={ETSY_SEO_INFO.score} label="Erklärung: Score" />
                    </span>
                  </th>
                  {kwHeaders.map((k) => (
                    <th key={k.keyword} className="px-1 py-2 text-center font-medium">
                      <span className="inline-flex flex-col items-center gap-0.5">
                        <span className="max-w-[5.5rem] leading-tight">{k.label}</span>
                        <EtsyInfoHint info={ETSY_SEO_INFO.rankZelle} label={`Erklärung: ${k.label}`} />
                      </span>
                    </th>
                  ))}
                  <th className="py-2 pl-2 text-right font-medium">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      Aktion
                      <EtsyInfoHint
                        info={ETSY_SEO_INFO.rankingOptimieren}
                        label="Erklärung: Ranking optimieren"
                      />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr
                    id={`listing-row-${l.listingId}`}
                    key={l.listingId}
                    className="border-b border-[var(--app-border)]/70 align-middle"
                  >
                    <td className="sticky left-0 z-10 bg-[var(--app-surface)] py-2.5 pr-3">
                      <div className="flex min-w-[11rem] max-w-[16rem] items-start gap-2">
                        <span
                          className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${scoreBadgeClass(l.cachedScore)}`}
                        >
                          {l.cachedScore != null ? l.cachedScore : '—'}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--app-text)]" title={l.title}>
                            {l.title}
                          </p>
                          <p className="text-[11px] text-[var(--app-text-muted)]">
                            {l.priceEur != null ? `${l.priceEur} €` : ''}
                            {l.schwachAnzahl > 0
                              ? ` · ${l.schwachAnzahl} schwach`
                              : l.geprueft
                                ? ' · stabil'
                                : ' · noch nicht gemessen'}
                          </p>
                        </div>
                      </div>
                    </td>
                    {l.ranks.map((r) => (
                      <td key={r.keyword} className="px-1 py-2 text-center">
                        <div
                          className={`mx-auto inline-flex min-w-[3.25rem] flex-col items-center rounded-lg border px-1.5 py-1 ${zelleStil(r)}`}
                          title={r.note || r.label}
                        >
                          <span className="text-xs font-semibold tabular-nums">{zelleText(r)}</span>
                          {zelleSub(r) ? (
                            <span className="text-[10px] opacity-80">{zelleSub(r)}</span>
                          ) : null}
                        </div>
                      </td>
                    ))}
                    <td className="py-2 pl-2 text-right">
                      <button
                        type="button"
                        disabled={rankBusy || optBusyId != null}
                        onClick={() => void rankingOptimieren(l.listingId, l.schwachstesKeyword)}
                        className="rounded-xl border border-teal-500/40 bg-teal-600/20 px-3 py-1.5 text-xs font-medium text-teal-100 hover:bg-teal-600/35 disabled:opacity-50"
                      >
                        {optBusyId === l.listingId ? 'Optimiert & speichert…' : 'Ranking optimieren'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-[var(--app-text-muted)]">
          „Ranking optimieren“ schreibt Titel, Tags und Intro neu und lädt sie sofort auf Etsy hoch. Die fünf
          Kernbegriffe bleiben als Tags geschützt; das schwächste Keyword wird vorne im Titel gestärkt. Danach
          erneut Ranks messen — sichtbare Verbesserungen brauchen oft Zeit.
        </p>
      </PageSectionPanel>
    </PageSection>
  )
}
