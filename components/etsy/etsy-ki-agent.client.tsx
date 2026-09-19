'use client'

import { PageChrome, PageHero, PageSection, PageSectionPanel } from '@/components/page-shell'
import { compressImageFileForCoach, coachImageDataUrl, type CoachImagePart } from '@/lib/finance-coach-images'
import { oeffneEtsyOAuthUrl } from '@/lib/etsy/etsy-oauth-open'
import { ETSY_DEFAULT_TAXONOMY_ID } from '@/lib/etsy/etsy-types'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Status = {
  configured: boolean
  connected: boolean
  shopId: number | null
  shopName: string | null
}

type ShippingProfile = { shippingProfileId: number; title: string }
type ReadinessState = { readinessStateId: number; readinessState: string }

type GeneratedListing = {
  title: string
  description: string
  tags: string[]
  warenkorbZusammenfassung: string
}

type DraftResult = {
  listingId: number
  shopId: number
  title: string
  tags: string[]
  listingUrl: string | null
}

export function EtsyKiAgentClient() {
  const [status, setStatus] = useState<Status | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const [shippingProfiles, setShippingProfiles] = useState<ShippingProfile[]>([])
  const [readinessStates, setReadinessStates] = useState<ReadinessState[]>([])

  const [images, setImages] = useState<CoachImagePart[]>([])
  const [holzart, setHolzart] = useState('')
  const [masse, setMasse] = useState('')
  const [preisEur, setPreisEur] = useState('49')
  const [quantity, setQuantity] = useState('1')
  const [shippingProfileId, setShippingProfileId] = useState('')
  const [taxonomyId, setTaxonomyId] = useState(String(ETSY_DEFAULT_TAXONOMY_ID))
  const [readinessStateId, setReadinessStateId] = useState('')

  const [busy, setBusy] = useState(false)
  const [lastListing, setLastListing] = useState<GeneratedListing | null>(null)
  const [lastDraft, setLastDraft] = useState<DraftResult | null>(null)

  const ladeStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const res = await fetch('/api/etsy/status', { cache: 'no-store' })
      if (!res.ok) {
        setStatus({ configured: false, connected: false, shopId: null, shopName: null })
        return
      }
      const s = (await res.json()) as Status
      setStatus(s)
    } catch {
      toast.error('Etsy-Status konnte nicht geladen werden.')
    } finally {
      setStatusLoading(false)
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
      if (profiles.length === 1) {
        setShippingProfileId(String(profiles[0].shippingProfileId))
      }
      if (j.readinessStates?.length === 1) {
        setReadinessStateId(String(j.readinessStates[0].readinessStateId))
      }
    } catch {
      /* Shop ggf. noch unvollständig */
    }
  }, [])

  useEffect(() => {
    void ladeStatus()
  }, [ladeStatus])

  useEffect(() => {
    if (!status?.connected) return
    void ladeShop()
  }, [status?.connected, ladeShop])

  useEffect(() => {
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
  }, [ladeStatus])

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
    setShippingProfiles([])
    setReadinessStates([])
    void ladeStatus()
  }

  async function onFotos(files: FileList | null) {
    if (!files?.length) return
    const next = [...images]
    for (const file of Array.from(files)) {
      if (next.length >= 8) break
      try {
        const part = await compressImageFileForCoach(file, { maxEdge: 1600, quality: 0.85 })
        next.push(part)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Bild konnte nicht gelesen werden.')
      }
    }
    setImages(next)
  }

  async function sendeDraft(dryRun: boolean) {
    if (images.length === 0) {
      toast.error('Mindestens ein Foto hochladen.')
      return
    }
    const spId = Number(shippingProfileId)
    if (!Number.isFinite(spId) || spId <= 0) {
      toast.error('Versandprofil wählen (im Etsy-Shop anlegen, dann Seite neu laden).')
      return
    }

    setBusy(true)
    setLastDraft(null)
    try {
      const res = await fetch('/api/etsy/listing/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images,
          holzart: holzart.trim() || undefined,
          masse: masse.trim() || undefined,
          preisEur: Number(preisEur),
          quantity: Number(quantity) || 1,
          shippingProfileId: spId,
          taxonomyId: Number(taxonomyId) || ETSY_DEFAULT_TAXONOMY_ID,
          readinessStateId: readinessStateId ? Number(readinessStateId) : undefined,
          dryRun,
        }),
      })
      const j = (await res.json()) as {
        error?: string
        listing?: GeneratedListing
        draft?: DraftResult
      }
      if (!res.ok) {
        toast.error(j.error ?? 'Anfrage fehlgeschlagen.')
        return
      }
      if (j.listing) setLastListing(j.listing)
      if (j.draft) {
        setLastDraft(j.draft)
        toast.success(`Draft #${j.draft.listingId} angelegt.`)
      } else if (dryRun) {
        toast.success('Texte generiert (ohne Upload).')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setBusy(false)
    }
  }

  const verbunden = Boolean(status?.connected)

  return (
    <PageChrome density="compact" className="max-w-2xl">
      <PageHero
        density="compact"
        eyebrow="Omnia"
        title="Etsy KI Agent"
        description="Fotos + Basisdaten → SEO-Texte (dein Gem) → Draft im Shop. Zahlung im Shop kann später freigeschaltet werden; Drafts gehen vorher."
      />

      <PageSection titleId="etsy-connect" title="Shop verbinden">
        <PageSectionPanel density="compact" className="space-y-3">
          {statusLoading ? (
            <p className="text-sm text-[var(--app-text-muted)]">Status wird geladen…</p>
          ) : !status?.configured ? (
            <p className="text-sm text-[var(--app-text-muted)]">
              Noch nicht konfiguriert. In <code className="text-xs">.env.local</code> und Vercel:{' '}
              <code className="text-xs">ETSY_CLIENT_ID</code>, <code className="text-xs">ETSY_CLIENT_SECRET</code>,{' '}
              optional <code className="text-xs">ETSY_REDIRECT_URI</code> / <code className="text-xs">NEXT_PUBLIC_APP_URL</code>.
              Außerdem Migration <code className="text-xs">etsy_oauth</code> in Supabase ausführen.
            </p>
          ) : verbunden ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-[var(--app-text)]">
                Verbunden{status?.shopName ? `: ${status.shopName}` : ''}
                {status?.shopId ? ` (Shop ${status.shopId})` : ''}
              </p>
              <button
                type="button"
                onClick={() => void trennen()}
                className="rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
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

      <PageSection titleId="etsy-form" title="Neuer Draft">
        <PageSectionPanel density="compact" className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--app-text-muted)]">Produktfotos (bis 8)</label>
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
                    key={`${i}-${img.base64.slice(0, 12)}`}
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
                placeholder="z. B. Ø 18 cm × H 6 cm"
                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-[var(--app-text-muted)]">Preis (€)</span>
              <input
                value={preisEur}
                onChange={(e) => setPreisEur(e.target.value)}
                inputMode="decimal"
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
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-xs text-[var(--app-text-muted)]">Versandprofil</span>
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
                  placeholder="ID manuell (Shop → Versandprofile)"
                  className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
                />
              )}
            </label>
            {readinessStates.length > 0 && (
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-xs text-[var(--app-text-muted)]">Bearbeitungszeit (Readiness)</span>
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
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-xs text-[var(--app-text-muted)]">
                Taxonomy-ID (Standard Schalen ≈ {ETSY_DEFAULT_TAXONOMY_ID})
              </span>
              <input
                value={taxonomyId}
                onChange={(e) => setTaxonomyId(e.target.value)}
                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!verbunden || busy}
              onClick={() => void sendeDraft(true)}
              className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-medium text-[var(--app-text)] hover:bg-[var(--app-surface-muted)] disabled:opacity-50"
            >
              {busy ? 'Arbeitet…' : 'Nur Texte generieren'}
            </button>
            <button
              type="button"
              disabled={!verbunden || busy}
              onClick={() => void sendeDraft(false)}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
            >
              {busy ? 'Arbeitet…' : 'Als Draft auf Etsy anlegen'}
            </button>
          </div>
        </PageSectionPanel>
      </PageSection>

      {(lastListing || lastDraft) && (
        <PageSection titleId="etsy-result" title="Ergebnis">
          <PageSectionPanel density="compact" className="space-y-3">
            {lastDraft && (
              <p className="text-sm text-[var(--app-text)]">
                Draft-ID <strong>{lastDraft.listingId}</strong>
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
                  ' — im Shop Manager unter Entwürfe prüfen'
                )}
              </p>
            )}
            {lastListing && (
              <>
                <div>
                  <p className="text-xs font-medium text-[var(--app-text-muted)]">Titel</p>
                  <p className="text-sm text-[var(--app-text)]">{lastListing.title}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--app-text-muted)]">Tags</p>
                  <p className="text-sm text-[var(--app-text-muted)]">{lastListing.tags.join(', ')}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--app-text-muted)]">Beschreibung</p>
                  <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--app-surface-muted)] p-3 text-xs leading-relaxed text-[var(--app-text)]">
                    {lastListing.description}
                  </pre>
                </div>
              </>
            )}
          </PageSectionPanel>
        </PageSection>
      )}
    </PageChrome>
  )
}
