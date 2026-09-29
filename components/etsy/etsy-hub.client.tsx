'use client'

import { PageChrome, PageHero } from '@/components/page-shell'
import { EtsyKeywords } from '@/components/etsy/etsy-keywords.client'
import { EtsyKonkurrenz } from '@/components/etsy/etsy-konkurrenz.client'
import { EtsyKiAgentClient } from '@/components/etsy/etsy-ki-agent.client'
import { EtsySeoUeberwachung } from '@/components/etsy/etsy-seo-ueberwachung.client'
import { oeffneEtsyOAuthUrl } from '@/lib/etsy/etsy-oauth-open'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import toast from 'react-hot-toast'

type Modul = 'agent' | 'seo' | 'keywords' | 'konkurrenz'

/** Hochzählen, wenn ETSY_SCOPES erweitert wird — zeigt einmalig den Hinweis „neu verbinden“. */
const SCOPE_VERSION = '2026-09-transactions'
const SCOPE_HINWEIS_KEY = 'etsy-scope-hinweis-gesehen'
const keinAbo = () => () => {}

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
  const [scopeErledigt, setScopeErledigt] = useState(false)
  const scopeOffen = useSyncExternalStore(
    keinAbo,
    () => window.localStorage.getItem(SCOPE_HINWEIS_KEY) !== SCOPE_VERSION,
    () => false,
  )
  const scopeHinweis = scopeOffen && !scopeErledigt

  function scopeHinweisErledigt() {
    window.localStorage.setItem(SCOPE_HINWEIS_KEY, SCOPE_VERSION)
    setScopeErledigt(true)
  }

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
      window.localStorage.setItem(SCOPE_HINWEIS_KEY, SCOPE_VERSION)
      window.history.replaceState({}, '', window.location.pathname)
      void ladeStatus()
    }
    const err = sp.get('etsy_error')
    if (err) {
      toast.error(`Etsy-Verbindung: ${err}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
    const m = sp.get('modul')
    if (m === 'seo' || m === 'agent' || m === 'keywords' || m === 'konkurrenz') setModul(m)
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
    <PageChrome density="compact" className="max-w-3xl">
      <PageHero
        density="compact"
        eyebrow="Omnia"
        title="Etsy"
        description="Zwei Module: neue Drafts per KI-Agent anlegen oder bestehende Listings per SEO/GEO-Audit überwachen und optimieren."
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ['agent', 'Neues Listing', 'Fotos → Entwurf', 'border-amber-500/60 bg-amber-500/10'],
            ['seo', 'Meine Listings', 'Prüfen & verbessern', 'border-teal-500/60 bg-teal-500/10'],
            ['keywords', 'Keywords', 'Was Käufer suchen', 'border-sky-500/60 bg-sky-500/10'],
            ['konkurrenz', 'Konkurrenz', 'Verkäufe Top 10 DE', 'border-violet-500/60 bg-violet-500/10'],
          ] as const
        ).map(([id, titel, sub, aktivStil]) => (
          <button
            key={id}
            type="button"
            onClick={() => setModul(id)}
            className={`rounded-2xl border px-3 py-3 text-left transition sm:px-4 ${
              modul === id
                ? aktivStil
                : 'border-[var(--app-border)] bg-[var(--app-surface)] hover:bg-[var(--app-surface-muted)]'
            }`}
          >
            <p className="text-sm font-semibold text-[var(--app-text)]">{titel}</p>
            <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{sub}</p>
          </button>
        ))}
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
              {scopeHinweis && (
                <div className="w-full rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-100">
                  <p>
                    Neu: Verkäufe pro Listing messen. Dafür braucht die App eine zusätzliche Etsy-Berechtigung —
                    einmal <strong>neu verbinden</strong> (Etsy fragt kurz nach).
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={connecting}
                      onClick={() => void verbinden()}
                      className="rounded-lg bg-sky-700 px-3 py-1.5 font-medium text-white hover:bg-sky-600 disabled:opacity-60"
                    >
                      Jetzt neu verbinden
                    </button>
                    <button
                      type="button"
                      onClick={scopeHinweisErledigt}
                      className="rounded-lg border border-sky-500/40 px-3 py-1.5 text-sky-200"
                    >
                      Später
                    </button>
                  </div>
                </div>
              )}
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
      ) : modul === 'seo' ? (
        <EtsySeoUeberwachung verbunden={verbunden} />
      ) : modul === 'keywords' ? (
        <EtsyKeywords />
      ) : (
        <EtsyKonkurrenz />
      )}
    </PageChrome>
  )
}
