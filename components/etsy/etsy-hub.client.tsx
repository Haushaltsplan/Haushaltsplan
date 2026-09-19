'use client'

import { PageChrome, PageHero } from '@/components/page-shell'
import { EtsyKiAgentClient } from '@/components/etsy/etsy-ki-agent.client'
import { EtsySeoUeberwachung } from '@/components/etsy/etsy-seo-ueberwachung.client'
import { oeffneEtsyOAuthUrl } from '@/lib/etsy/etsy-oauth-open'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type Modul = 'agent' | 'seo'

type Status = {
  configured: boolean
  connected: boolean
  shopId: number | null
  shopName: string | null
}

export function EtsyHubClient() {
  const [modul, setModul] = useState<Modul>('agent')
  const [status, setStatus] = useState<Status | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const ladeStatus = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    void ladeStatus()
  }, [ladeStatus])

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
    const m = sp.get('modul')
    if (m === 'seo' || m === 'agent') setModul(m)
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
    void ladeStatus()
  }

  const verbunden = Boolean(status?.connected)

  return (
    <PageChrome density="compact" className="max-w-2xl">
      <PageHero
        density="compact"
        eyebrow="Omnia"
        title="Etsy"
        description="Zwei Module: neue Drafts per KI-Agent anlegen oder bestehende Listings per SEO/GEO-Audit überwachen und optimieren."
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setModul('agent')}
          className={`rounded-2xl border px-4 py-3 text-left transition ${
            modul === 'agent'
              ? 'border-amber-500/60 bg-amber-500/10'
              : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-surface-muted)]'
          }`}
        >
          <p className="text-sm font-semibold text-[var(--app-text)]">KI Agent</p>
          <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">Fotos → Draft</p>
        </button>
        <button
          type="button"
          onClick={() => setModul('seo')}
          className={`rounded-2xl border px-4 py-3 text-left transition ${
            modul === 'seo'
              ? 'border-teal-500/60 bg-teal-500/10'
              : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-surface-muted)]'
          }`}
        >
          <p className="text-sm font-semibold text-[var(--app-text)]">SEO Überwachung</p>
          <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">Audit & Update</p>
        </button>
      </div>

      <section className="app-section-shell">
        <div className="app-surface-card-header px-4 py-2.5 sm:px-5">
          <h2 className="text-base font-semibold tracking-tight text-[var(--app-text)]">Shop verbinden</h2>
        </div>
        <div className="px-4 py-3 sm:px-5 sm:py-4">
          {statusLoading ? (
            <p className="text-sm text-[var(--app-text-muted)]">Status wird geladen…</p>
          ) : !status?.configured ? (
            <p className="text-sm text-[var(--app-text-muted)]">
              ETSY_CLIENT_ID / SECRET in Env setzen und Migrationen ausführen.
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
        </div>
      </section>

      {modul === 'agent' ? (
        <EtsyKiAgentClient hubModus verbunden={verbunden} onStatusRefresh={() => void ladeStatus()} />
      ) : (
        <EtsySeoUeberwachung verbunden={verbunden} />
      )}
    </PageChrome>
  )
}
