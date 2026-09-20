'use client'

import { PageChrome, PageHero, PageSection, PageSectionPanel } from '@/components/page-shell'
import { compressImageFileForCoach, coachImageDataUrl, type CoachImagePart } from '@/lib/finance-coach-images'
import { oeffneEtsyOAuthUrl } from '@/lib/etsy/etsy-oauth-open'
import {
  berechneEtsyDraftSeoGeoScore,
  ETSY_SEO_TAG_COUNT,
  scoreFarbe,
} from '@/lib/etsy/etsy-seo-regeln'
import {
  ETSY_DEFAULT_FINISH,
  ETSY_DEFAULT_STANDORT,
  ETSY_DEFAULT_TAXONOMY_ID,
  filterFotoWarnungen,
  type EtsyDraftHistorieEintrag,
  type EtsyFotoCheck,
  type EtsyGeneratedListing,
  type EtsyListingVorlage,
} from '@/lib/etsy/etsy-types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

type Status = {
  configured: boolean
  connected: boolean
  shopId: number | null
  shopName: string | null
}

type ShippingProfile = { shippingProfileId: number; title: string }
type ReadinessState = { readinessStateId: number; readinessState: string }

type DraftResult = {
  listingId: number
  shopId: number
  title: string
  tags: string[]
  listingUrl: string | null
}

type Schritt = 'aufnahme' | 'freigabe'

type EtsyKiAgentClientProps = {
  /** Eingebettet im Etsy-Hub (ohne eigenen Chrome/Connect). */
  hubModus?: boolean
  verbunden?: boolean
  onStatusRefresh?: () => void
}

export function EtsyKiAgentClient({
  hubModus = false,
  verbunden: verbundenProp,
  onStatusRefresh,
}: EtsyKiAgentClientProps = {}) {
  const [status, setStatus] = useState<Status | null>(null)
  const [statusLoading, setStatusLoading] = useState(!hubModus)
  const [connecting, setConnecting] = useState(false)

  const [shippingProfiles, setShippingProfiles] = useState<ShippingProfile[]>([])
  const [readinessStates, setReadinessStates] = useState<ReadinessState[]>([])
  const [vorlage, setVorlage] = useState<EtsyListingVorlage | null>(null)
  const [historie, setHistorie] = useState<EtsyDraftHistorieEintrag[]>([])

  const [images, setImages] = useState<CoachImagePart[]>([])
  const [holzart, setHolzart] = useState('')
  const [masse, setMasse] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [shippingProfileId, setShippingProfileId] = useState('')
  const [readinessStateId, setReadinessStateId] = useState('')
  const [standortText, setStandortText] = useState(ETSY_DEFAULT_STANDORT)
  const [finishText, setFinishText] = useState(ETSY_DEFAULT_FINISH)

  const [schritt, setSchritt] = useState<Schritt>('aufnahme')
  const [busy, setBusy] = useState(false)
  const [busyKind, setBusyKind] = useState<'analyse' | 'optimize' | 'draft' | null>(null)

  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editPreis, setEditPreis] = useState('')
  const [preisMin, setPreisMin] = useState(0)
  const [preisEmpfohlen, setPreisEmpfohlen] = useState(0)
  const [preisMax, setPreisMax] = useState(0)
  const [preisBegruendung, setPreisBegruendung] = useState('')
  const [taxonomyId, setTaxonomyId] = useState(String(ETSY_DEFAULT_TAXONOMY_ID))
  const [taxonomyLabel, setTaxonomyLabel] = useState('Schalen')
  const [produktForm, setProduktForm] = useState('Schale')
  const [fotoCheck, setFotoCheck] = useState<EtsyFotoCheck | null>(null)
  const [draftListing, setDraftListing] = useState<EtsyGeneratedListing | null>(null)

  const [lastDraft, setLastDraft] = useState<DraftResult | null>(null)

  const ladeStatus = useCallback(async () => {
    if (hubModus) {
      onStatusRefresh?.()
      return
    }
    setStatusLoading(true)
    try {
      const res = await fetch('/api/etsy/status', { cache: 'no-store' })
      if (!res.ok) {
        setStatus({ configured: false, connected: false, shopId: null, shopName: null })
        return
      }
      setStatus((await res.json()) as Status)
    } catch {
      toast.error('Etsy-Status konnte nicht geladen werden.')
    } finally {
      setStatusLoading(false)
    }
  }, [hubModus, onStatusRefresh])

  const ladeVorlageUndHistorie = useCallback(async () => {
    try {
      const [vRes, hRes] = await Promise.all([
        fetch('/api/etsy/vorlage', { cache: 'no-store' }),
        fetch('/api/etsy/historie', { cache: 'no-store' }),
      ])
      if (vRes.ok) {
        const j = (await vRes.json()) as { vorlage?: EtsyListingVorlage }
        if (j.vorlage) {
          setVorlage(j.vorlage)
          setStandortText(j.vorlage.standortText || ETSY_DEFAULT_STANDORT)
          setFinishText(j.vorlage.finishText || ETSY_DEFAULT_FINISH)
          if (j.vorlage.shippingProfileId) setShippingProfileId(String(j.vorlage.shippingProfileId))
          if (j.vorlage.readinessStateId) setReadinessStateId(String(j.vorlage.readinessStateId))
          if (j.vorlage.taxonomyId) setTaxonomyId(String(j.vorlage.taxonomyId))
        }
      }
      if (hRes.ok) {
        const j = (await hRes.json()) as { historie?: EtsyDraftHistorieEintrag[] }
        setHistorie(j.historie ?? [])
      }
    } catch {
      /* optional */
    }
  }, [])

  const ladeShop = useCallback(async () => {
    try {
      const res = await fetch('/api/etsy/shop', { cache: 'no-store' })
      if (!res.ok) return
      const j = (await res.json()) as {
        shippingProfiles?: ShippingProfile[]
        readinessStates?: ReadinessState[]
      }
      const profiles = j.shippingProfiles ?? []
      setShippingProfiles(profiles)
      setReadinessStates(j.readinessStates ?? [])
      setShippingProfileId((prev) => {
        if (prev) return prev
        if (profiles.length === 1) return String(profiles[0].shippingProfileId)
        return prev
      })
      if (j.readinessStates?.length === 1) {
        setReadinessStateId((prev) => prev || String(j.readinessStates![0].readinessStateId))
      }
    } catch {
      /* Shop ggf. unvollständig */
    }
  }, [])

  useEffect(() => {
    if (hubModus) return
    void ladeStatus()
  }, [hubModus, ladeStatus])

  useEffect(() => {
    const verbundenEffektiv = hubModus ? Boolean(verbundenProp) : Boolean(status?.connected)
    if (!verbundenEffektiv) return
    void ladeShop()
    void ladeVorlageUndHistorie()
  }, [hubModus, verbundenProp, status?.connected, ladeShop, ladeVorlageUndHistorie])

  useEffect(() => {
    if (hubModus) return
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('etsy') === 'connected') {
      toast.success('Etsy verbunden.')
      window.history.replaceState({}, '', window.location.pathname)
      void ladeStatus()
    }
    const err = sp.get('etsy_error')
    if (err) {
      toast.error(`Etsy-Verbindung: ${err}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [hubModus, ladeStatus])

  async function verbinden() {
    setConnecting(true)
    try {
      const res = await fetch('/api/etsy/auth/start', { method: 'POST' })
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !body.url) {
        toast.error(body.error ?? 'OAuth-Start fehlgeschlagen.')
        return
      }
      await oeffneEtsyOAuthUrl(body.url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Verbindung fehlgeschlagen.')
    } finally {
      setConnecting(false)
    }
  }

  async function trennen() {
    const res = await fetch('/api/etsy/disconnect', { method: 'POST' })
    if (!res.ok) {
      toast.error('Trennen fehlgeschlagen.')
      return
    }
    toast.success('Etsy getrennt.')
    void ladeStatus()
  }

  async function speichereVorlage() {
    const payload: EtsyListingVorlage = {
      shippingProfileId: Number(shippingProfileId) || null,
      readinessStateId: Number(readinessStateId) || null,
      taxonomyId: Number(taxonomyId) || ETSY_DEFAULT_TAXONOMY_ID,
      standortText: standortText.trim() || ETSY_DEFAULT_STANDORT,
      finishText: finishText.trim() || ETSY_DEFAULT_FINISH,
      whoMade: vorlage?.whoMade || 'i_did',
      whenMade: vorlage?.whenMade || 'made_to_order',
    }
    const res = await fetch('/api/etsy/vorlage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = (await res.json()) as { error?: string; vorlage?: EtsyListingVorlage }
    if (!res.ok) {
      toast.error(j.error ?? 'Vorlage speichern fehlgeschlagen.')
      return
    }
    setVorlage(j.vorlage ?? payload)
    toast.success('Vorlage gespeichert.')
  }

  async function onFotos(files: FileList | null) {
    if (!files?.length) return
    const next = [...images]
    for (const file of Array.from(files)) {
      if (next.length >= 8) break
      try {
        next.push(await compressImageFileForCoach(file, { maxEdge: 1600, quality: 0.85 }))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Bildfehler')
      }
    }
    setImages(next)
  }

  function uebernehmeListing(listing: EtsyGeneratedListing) {
    setDraftListing(listing)
    setEditTitle(listing.title)
    setEditDescription(listing.description)
    setEditTags(listing.tags.join(', '))
    setEditPreis(String(listing.preisEmpfohlenEur))
    setPreisMin(listing.preisMinEur)
    setPreisEmpfohlen(listing.preisEmpfohlenEur)
    setPreisMax(listing.preisMaxEur)
    setPreisBegruendung(listing.preisBegruendung)
    setTaxonomyId(String(listing.taxonomyId))
    setTaxonomyLabel(listing.taxonomyLabel)
    setProduktForm(listing.produktForm)
    setFotoCheck({
      ...listing.fotoCheck,
      warnungen: filterFotoWarnungen(listing.fotoCheck.warnungen),
    })
    setSchritt('freigabe')
  }

  async function analysieren() {
    if (images.length === 0) {
      toast.error('Mindestens ein Foto hochladen.')
      return
    }
    setBusy(true)
    setBusyKind('analyse')
    setLastDraft(null)
    try {
      const res = await fetch('/api/etsy/listing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images,
          holzart: holzart.trim() || undefined,
          masse: masse.trim() || undefined,
          standortText: standortText.trim() || undefined,
          finishText: finishText.trim() || undefined,
        }),
      })
      const j = (await res.json()) as { error?: string; listing?: EtsyGeneratedListing }
      if (!res.ok || !j.listing) {
        toast.error(j.error ?? 'Analyse fehlgeschlagen.')
        return
      }
      uebernehmeListing(j.listing)
      if (filterFotoWarnungen(j.listing.fotoCheck.warnungen).length) {
        toast(`Foto-Hinweise: ${filterFotoWarnungen(j.listing.fotoCheck.warnungen).length}`, {
          icon: '📷',
        })
      } else {
        toast.success('Entwurf bereit — bitte prüfen und freigeben.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  function baueFreigabeListing(): EtsyGeneratedListing | null {
    if (!draftListing) return null
    const tags = editTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 13)
    if (!editTitle.trim() || !editDescription.trim() || tags.length < 1) return null
    const preis = Number(editPreis)
    if (!Number.isFinite(preis) || preis < 1) return null
    return {
      ...draftListing,
      title: editTitle.trim().slice(0, 140),
      description: editDescription.trim(),
      tags,
      preisEmpfohlenEur: Math.round(preis),
      taxonomyId: Number(taxonomyId) || draftListing.taxonomyId,
      taxonomyLabel,
      produktForm,
    }
  }

  async function draftAnlegen() {
    const listing = baueFreigabeListing()
    if (!listing) {
      toast.error('Titel, Beschreibung, Tags und Preis prüfen.')
      return
    }
    const spId = Number(shippingProfileId)
    if (!spId) {
      toast.error('Versandprofil wählen.')
      return
    }
    setBusy(true)
    setBusyKind('draft')
    try {
      const res = await fetch('/api/etsy/listing/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images,
          holzart: holzart.trim() || undefined,
          masse: masse.trim() || undefined,
          preisEur: listing.preisEmpfohlenEur,
          quantity: Number(quantity) || 1,
          shippingProfileId: spId,
          taxonomyId: listing.taxonomyId,
          readinessStateId: readinessStateId ? Number(readinessStateId) : undefined,
          listing,
        }),
      })
      const j = (await res.json()) as {
        error?: string
        draft?: DraftResult
        verwendeterPreisEur?: number
      }
      if (!res.ok || !j.draft) {
        toast.error(j.error ?? 'Draft fehlgeschlagen.')
        return
      }
      setLastDraft(j.draft)
      toast.success(`Draft #${j.draft.listingId} · ${j.verwendeterPreisEur ?? listing.preisEmpfohlenEur} €`)
      void ladeVorlageUndHistorie()
      setSchritt('aufnahme')
      setDraftListing(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  function scoreBadgeClass(score: number) {
    const f = scoreFarbe(score)
    if (f === 'rot') return 'bg-rose-500/20 text-rose-300'
    if (f === 'gelb') return 'bg-amber-500/20 text-amber-300'
    return 'bg-emerald-500/20 text-emerald-300'
  }

  const liveScore = useMemo(() => {
    if (schritt !== 'freigabe') return null
    const tags = editTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, ETSY_SEO_TAG_COUNT)
    return berechneEtsyDraftSeoGeoScore({
      title: editTitle,
      tags,
      description: editDescription,
      materials: holzart.trim() ? [holzart.trim()] : undefined,
      taxonomyId: Number(taxonomyId) || draftListing?.taxonomyId,
      taxonomyLabel,
      fotoCheck: fotoCheck ?? draftListing?.fotoCheck ?? null,
    })
  }, [
    schritt,
    editTitle,
    editTags,
    editDescription,
    holzart,
    taxonomyId,
    taxonomyLabel,
    draftListing?.taxonomyId,
    draftListing?.fotoCheck,
    fotoCheck,
  ])

  async function optimiertNeuGenerieren() {
    if (images.length === 0) {
      toast.error('Fotos fehlen für die Neugenerierung.')
      return
    }
    const scoreVorher = liveScore?.overall ?? 0
    const tags = editTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, ETSY_SEO_TAG_COUNT)
    const issues = [
      ...(liveScore?.regel.issues.map((i) => `[${i.severity}] ${i.field}: ${i.message}`) ?? []),
      ...(liveScore?.geoNotes ?? []),
    ].slice(0, 16)

    setBusy(true)
    setBusyKind('optimize')
    try {
      const res = await fetch('/api/etsy/listing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images,
          holzart: holzart.trim() || undefined,
          masse: masse.trim() || undefined,
          standortText: standortText.trim() || undefined,
          finishText: finishText.trim() || undefined,
          optimize: {
            title: editTitle.trim(),
            description: editDescription.trim(),
            tags,
            produktForm,
            taxonomyId: Number(taxonomyId) || undefined,
            taxonomyLabel,
            warenkorbZusammenfassung: draftListing?.warenkorbZusammenfassung,
            issues,
            preisMinEur: preisMin,
            preisEmpfohlenEur: preisEmpfohlen,
            preisMaxEur: preisMax,
            preisBegruendung: preisBegruendung,
            fotoCheck: fotoCheck ?? draftListing?.fotoCheck ?? undefined,
          },
        }),
      })
      const j = (await res.json()) as {
        error?: string
        listing?: EtsyGeneratedListing
        score?: { overall: number; seoScore: number; geoScore: number }
      }
      if (!res.ok || !j.listing) {
        toast.error(j.error ?? 'Optimierung fehlgeschlagen.')
        return
      }
      uebernehmeListing(j.listing)
      const o = j.score?.overall
      if (o != null && o > scoreVorher) {
        toast.success(`Score ${scoreVorher} → ${o}`)
      } else if (o != null && o === scoreVorher) {
        toast.success(`Score gehalten (${o}) — Entwurf gehärtet`)
      } else if (o != null) {
        toast(`Score ${scoreVorher} → ${o} — bessere Variante gewählt`, { icon: '↩️' })
      } else {
        toast.success('Optimierter Entwurf geladen.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setBusy(false)
      setBusyKind(null)
    }
  }

  const verbunden = hubModus ? Boolean(verbundenProp) : Boolean(status?.connected)

  const inhalt = (
    <>
      {!hubModus && (
        <>
          <PageHero
            density="compact"
            eyebrow="Omnia"
            title="Etsy KI Agent"
            description="Zwei Schritte: 1) Fotos analysieren & Entwurf prüfen · 2) Freigeben → Draft. Preisspanne, Taxonomy und Vorlagen inklusive."
          />

          <PageSection titleId="etsy-connect" title="Shop verbinden">
            <PageSectionPanel density="compact" className="space-y-3">
              {statusLoading ? (
                <p className="text-sm text-[var(--app-text-muted)]">Status wird geladen…</p>
              ) : !status?.configured ? (
                <p className="text-sm text-[var(--app-text-muted)]">
                  ETSY_CLIENT_ID / SECRET + Migrationen (OAuth, Vorlage/Historie) prüfen.
                </p>
              ) : verbunden ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm text-[var(--app-text)]">
                    Verbunden{status?.shopName ? `: ${status.shopName}` : ''}
                    {status?.shopId ? ` (${status.shopId})` : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => void trennen()}
                    className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-muted)]"
                  >
                    Trennen
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={connecting}
                  onClick={() => void verbinden()}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
                >
                  {connecting ? 'Weiterleitung…' : 'Mit Etsy verbinden'}
                </button>
              )}
            </PageSectionPanel>
          </PageSection>
        </>
      )}

      <PageSection titleId="etsy-vorlage" title="Vorlage (Defaults)">
        <PageSectionPanel density="compact" className="space-y-3">
          <p className="text-xs text-[var(--app-text-muted)]">
            Einmal setzen — gilt für Standort im Titel, Finish-Text und Standard-Versand.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-xs text-[var(--app-text-muted)]">Standort (Titel)</span>
              <input
                value={standortText}
                onChange={(e) => setStandortText(e.target.value)}
                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-xs text-[var(--app-text-muted)]">Finish-Text</span>
              <textarea
                value={finishText}
                onChange={(e) => setFinishText(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-xs text-[var(--app-text-muted)]">Standard-Versandprofil</span>
              {shippingProfiles.length > 0 ? (
                <select
                  value={shippingProfileId}
                  onChange={(e) => setShippingProfileId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
                >
                  <option value="">— wählen —</option>
                  {shippingProfiles.map((p) => (
                    <option key={p.shippingProfileId} value={p.shippingProfileId}>
                      {p.title} ({p.shippingProfileId})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={shippingProfileId}
                  onChange={(e) => setShippingProfileId(e.target.value)}
                  placeholder="Profil-ID"
                  className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
                />
              )}
            </label>
            {readinessStates.length > 0 && (
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs text-[var(--app-text-muted)]">Bearbeitungszeit</span>
                <select
                  value={readinessStateId}
                  onChange={(e) => setReadinessStateId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
                >
                  <option value="">— optional —</option>
                  {readinessStates.map((r) => (
                    <option key={r.readinessStateId} value={r.readinessStateId}>
                      {r.readinessState || r.readinessStateId}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <button
            type="button"
            disabled={!verbunden}
            onClick={() => void speichereVorlage()}
            className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Vorlage speichern
          </button>
        </PageSectionPanel>
      </PageSection>

      {schritt === 'aufnahme' && (
        <PageSection titleId="etsy-step1" title="Schritt 1 · Aufnahme & Analyse">
          <PageSectionPanel density="compact" className="space-y-4">
            <p className="text-xs text-[var(--app-text-muted)]">
              Ideal: Hauptbild + Detail (Maserung) + Maßstab (Hand/Münze). Die KI warnt, wenn etwas fehlt.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--app-text-muted)]">
                Produktfotos (bis 8)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={!verbunden || busy}
                onChange={(e) => void onFotos(e.target.files)}
                className="block w-full text-sm text-[var(--app-text-muted)]"
              />
              {images.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {images.map((img, i) => (
                    <button
                      key={`${i}-${img.base64.slice(0, 8)}`}
                      type="button"
                      title="Entfernen"
                      onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                      className="relative h-16 w-16 overflow-hidden rounded-lg border border-[var(--app-border)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coachImageDataUrl(img)} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-[var(--app-text-muted)]">Holzart</span>
                <input
                  value={holzart}
                  onChange={(e) => setHolzart(e.target.value)}
                  placeholder="z. B. Eiche"
                  className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-[var(--app-text-muted)]">Maße</span>
                <input
                  value={masse}
                  onChange={(e) => setMasse(e.target.value)}
                  placeholder="Ø × H"
                  className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-[var(--app-text-muted)]">Stückzahl</span>
                <input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!verbunden || busy}
              onClick={() => void analysieren()}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
            >
              {busy ? 'Analysiert…' : 'Analysieren & Entwurf erzeugen'}
            </button>
          </PageSectionPanel>
        </PageSection>
      )}

      {schritt === 'freigabe' && draftListing && (
        <PageSection titleId="etsy-step2" title="Schritt 2 · Nachbearbeitung & Freigabe">
          <PageSectionPanel density="compact" className="space-y-4">
            {fotoCheck && filterFotoWarnungen(fotoCheck.warnungen).length > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p className="font-medium text-[var(--app-text)]">Foto-Hinweise</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[var(--app-text-muted)]">
                  {filterFotoWarnungen(fotoCheck.warnungen).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-[var(--app-text-muted)]">
                  Du kannst trotzdem freigeben — oder zurück und Fotos ergänzen.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs font-medium text-[var(--app-text-muted)]">Preisspanne</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { label: 'Min', v: preisMin },
                  { label: 'Empfohlen', v: preisEmpfohlen },
                  { label: 'Max', v: preisMax },
                ].map((x) => (
                  <button
                    key={x.label}
                    type="button"
                    onClick={() => setEditPreis(String(x.v))}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      Number(editPreis) === x.v
                        ? 'border-amber-600 bg-amber-600 text-white'
                        : 'border-[var(--app-border)] text-[var(--app-text)]'
                    }`}
                  >
                    {x.label}: {x.v} €
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">{preisBegruendung}</p>
              <label className="mt-3 block text-sm">
                <span className="mb-1 block text-xs text-[var(--app-text-muted)]">Dein Preis (€)</span>
                <input
                  value={editPreis}
                  onChange={(e) => setEditPreis(e.target.value)}
                  inputMode="decimal"
                  className="w-full max-w-xs rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
                />
              </label>
            </div>

            <p className="text-sm text-[var(--app-text-muted)]">
              Form: <strong className="text-[var(--app-text)]">{produktForm}</strong>
              {' · '}
              Kategorie: {taxonomyLabel} ({taxonomyId})
            </p>

            {liveScore && (
              <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-[var(--app-text-muted)]">
                    SEO-Score
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreBadgeClass(liveScore.overall)}`}
                  >
                    {liveScore.overall}/100
                  </span>
                  <span className="text-[10px] text-[var(--app-text-muted)]">
                    {liveScore.punkteErreicht}/{liveScore.punkteMax} Pkt
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreBadgeClass(liveScore.seoScore)}`}
                  >
                    Relevanz {liveScore.seoScore}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreBadgeClass(liveScore.geoScore)}`}
                  >
                    GEO {liveScore.geoScore}
                  </span>
                  {liveScore.fotoScore != null && (
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreBadgeClass(liveScore.fotoScore)}`}
                    >
                      Fotos {liveScore.fotoScore}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-[var(--app-text)]">{liveScore.einschaetzung}</p>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  {(
                    [
                      ['Front-Load', liveScore.regel.titleFrontloadOk],
                      ['Titel-Länge', liveScore.regel.titleLengthIdeal],
                      ['13 Tags', liveScore.regel.tagsCountOk],
                      ['Long-Tail', liveScore.regel.tagsLongtailOk],
                      ['Stemming', liveScore.regel.tagsStemOk],
                      ['Attr', liveScore.regel.tagsAttrOk],
                    ] as const
                  ).map(([label, ok]) => (
                    <span
                      key={label}
                      className={`rounded px-1.5 py-0.5 ${ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
                {liveScore.limitierer.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-[var(--app-text-muted)]">
                      Offen bis 100
                    </p>
                    <ul className="mt-0.5 space-y-0.5 text-xs text-amber-200/90">
                      {liveScore.limitierer.map((l) => (
                        <li key={l}>· {l}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(liveScore.regel.issues.length > 0 || liveScore.geoNotes.length > 0) && (
                  <ul className="max-h-28 space-y-0.5 overflow-auto text-xs text-[var(--app-text-muted)]">
                    {liveScore.regel.issues.slice(0, 5).map((i, idx) => (
                      <li key={`r-${idx}`}>
                        [{i.severity}] {i.message}
                      </li>
                    ))}
                    {liveScore.geoNotes.slice(0, 3).map((n, idx) => (
                      <li key={`g-${idx}`}>{n}</li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void optimiertNeuGenerieren()}
                  className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-600 disabled:opacity-50"
                >
                  {busyKind === 'optimize' ? 'Optimiert…' : 'Auf 100 optimieren'}
                </button>
                <p className="text-[10px] text-[var(--app-text-muted)]">
                  SEO-Score = On-Page-Checklist (Relevanz + GEO + Fotos Haupt/Detail). 100 = alles grün.
                  Maßstab-Fotos sind optional und zählen nicht. 1 Free-Gemini-Call.
                </p>
              </div>
            )}

            <label className="block text-sm">
              <span className="mb-1 block text-xs text-[var(--app-text-muted)]">
                Titel ({editTitle.length}/140)
              </span>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={140}
                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-[var(--app-text-muted)]">Beschreibung</span>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={12}
                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm leading-relaxed"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-[var(--app-text-muted)]">Tags (kommagetrennt, max. 13)</span>
              <textarea
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-[var(--app-text-muted)]">Taxonomy-ID</span>
              <input
                value={taxonomyId}
                onChange={(e) => setTaxonomyId(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSchritt('aufnahme')
                  setDraftListing(null)
                }}
                className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm"
              >
                Zurück
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void draftAnlegen()}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {busyKind === 'draft' ? 'Lädt hoch…' : 'Freigeben → Draft auf Etsy'}
              </button>
            </div>
          </PageSectionPanel>
        </PageSection>
      )}

      {lastDraft && (
        <PageSection titleId="etsy-last" title="Letzter Draft">
          <PageSectionPanel density="compact">
            <p className="text-sm text-[var(--app-text)]">
              #{lastDraft.listingId}
              {lastDraft.listingUrl ? (
                <>
                  {' '}
                  —{' '}
                  <a
                    href={lastDraft.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-600 underline-offset-2 hover:underline dark:text-amber-400"
                  >
                    auf Etsy öffnen
                  </a>
                </>
              ) : (
                ' — im Shop Manager unter Entwürfe'
              )}
            </p>
          </PageSectionPanel>
        </PageSection>
      )}

      {historie.length > 0 && (
        <PageSection titleId="etsy-hist" title="Draft-Historie">
          <PageSectionPanel density="compact" className="space-y-2">
            {historie.slice(0, 15).map((h) => (
              <div
                key={h.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--app-border)] py-2 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--app-text)]">{h.title}</p>
                  <p className="text-xs text-[var(--app-text-muted)]">
                    #{h.listingId}
                    {h.holzart ? ` · ${h.holzart}` : ''}
                    {h.preisEmpfohlenEur != null
                      ? ` · Spanne ${h.preisMinEur}–${h.preisMaxEur} €`
                      : ''}
                    {' · '}
                    {new Date(h.createdAt).toLocaleString('de-DE')}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-[var(--app-text)]">{h.preisVerwendetEur} €</p>
              </div>
            ))}
          </PageSectionPanel>
        </PageSection>
      )}
    </>
  )

  if (hubModus) return inhalt

  return (
    <PageChrome density="compact" className="max-w-2xl">
      {inhalt}
    </PageChrome>
  )
}
