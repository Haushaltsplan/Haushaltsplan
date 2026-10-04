'use client'

import { PageChrome, PageHero } from '@/components/page-shell'
import { EtsyBetrieb } from '@/components/etsy/etsy-betrieb.client'
import { EtsyCockpit } from '@/components/etsy/etsy-cockpit.client'
import { EtsyGeld } from '@/components/etsy/etsy-geld.client'
import { EtsyKeywords } from '@/components/etsy/etsy-keywords.client'
import { EtsyKonkurrenz } from '@/components/etsy/etsy-konkurrenz.client'
import { EtsyKunden } from '@/components/etsy/etsy-kunden.client'
import { EtsyKiAgentClient } from '@/components/etsy/etsy-ki-agent.client'
import { EtsySeoUeberwachung } from '@/components/etsy/etsy-seo-ueberwachung.client'
import { EtsyStrategie } from '@/components/etsy/etsy-strategie.client'
import { EtsyWachstum } from '@/components/etsy/etsy-wachstum.client'
import { EtsyZahlen } from '@/components/etsy/etsy-zahlen.client'
import type { EtsyCockpitModul } from '@/lib/etsy/etsy-cockpit-types'
import { oeffneEtsyOAuthUrl } from '@/lib/etsy/etsy-oauth-open'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import toast from 'react-hot-toast'

type Modul = 'cockpit' | EtsyCockpitModul
const MODULE: readonly Modul[] = [
  'cockpit',
  'agent',
  'seo',
  'keywords',
  'konkurrenz',
  'geld',
  'betrieb',
  'zahlen',
  'wachstum',
  'kunden',
  'strategie',
]

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
  const [modul, setModul] = useState<Modul>('cockpit')
  const [seoFokus, setSeoFokus] = useState<{ listingId: number; force?: boolean; nonce: number } | null>(null)

  const oeffne = useCallback((ziel: EtsyCockpitModul, listingId?: number, force?: boolean) => {
    if (ziel === 'seo' && listingId) setSeoFokus({ listingId, force, nonce: Date.now() })
    setModul(ziel)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
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
    if (m && (MODULE as readonly string[]).includes(m)) setModul(m as Modul)
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

  const tabsPrimär = [
    ['cockpit', 'Cockpit', 'Heute zu tun', 'border-emerald-500/60 bg-emerald-500/10'],
    ['agent', 'Neues Listing', 'Fotos → Entwurf', 'border-amber-500/60 bg-amber-500/10'],
    ['seo', 'Meine Listings', 'Prüfen & verbessern', 'border-teal-500/60 bg-teal-500/10'],
    ['keywords', 'Keywords', 'Was Käufer suchen', 'border-sky-500/60 bg-sky-500/10'],
    ['konkurrenz', 'Konkurrenz', 'Verkäufe Top 10 DE', 'border-violet-500/60 bg-violet-500/10'],
  ] as const

  const tabsShop = [
    ['geld', 'Geld', 'Marge & P&L', 'border-lime-500/60 bg-lime-500/10'],
    ['betrieb', 'Betrieb', 'Bestellungen', 'border-orange-500/60 bg-orange-500/10'],
    ['zahlen', 'Zahlen', 'Funnel & Zombies', 'border-cyan-500/60 bg-cyan-500/10'],
    ['wachstum', 'Wachstum', 'Saison & Reviews', 'border-pink-500/60 bg-pink-500/10'],
    ['kunden', 'Kunden', 'CRM & Gravur', 'border-fuchsia-500/60 bg-fuchsia-500/10'],
    ['strategie', 'Strategie', 'CEO-Briefing', 'border-yellow-500/60 bg-yellow-500/10'],
  ] as const

  return (
    <PageChrome density="compact" className="max-w-3xl">
      <PageHero
        density="compact"
        eyebrow="Omnia"
        title="Etsy"
        description="Shop-Betriebssystem: SEO, Geld, Bestellungen, Funnel, Saison und Strategie — ein Cockpit für den ganzen Laden."
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {tabsPrimär.map(([id, titel, sub, aktivStil]) => (
          <button
            key={id}
            type="button"
            onClick={() => setModul(id)}
            className={`rounded-2xl border px-3 py-3 text-left transition sm:px-4 ${
              id === 'cockpit' ? 'col-span-2 sm:col-span-1 ' : ''
            }${
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tabsShop.map(([id, titel, sub, aktivStil]) => (
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

      {modul === 'cockpit' ? (
        <EtsyCockpit verbunden={verbunden} statusLaedt={statusLoading} onOeffnen={oeffne} />
      ) : modul === 'agent' ? (
        <EtsyKiAgentClient hubModus verbunden={verbunden} onStatusRefresh={() => void ladeStatus()} />
      ) : modul === 'seo' ? (
        <EtsySeoUeberwachung verbunden={verbunden} fokus={seoFokus} />
      ) : modul === 'keywords' ? (
        <EtsyKeywords verbunden={verbunden} />
      ) : modul === 'konkurrenz' ? (
        <EtsyKonkurrenz />
      ) : modul === 'geld' ? (
        <EtsyGeld verbunden={verbunden} />
      ) : modul === 'betrieb' ? (
        <EtsyBetrieb verbunden={verbunden} />
      ) : modul === 'zahlen' ? (
        <EtsyZahlen verbunden={verbunden} onListing={(id) => oeffne('seo', id)} />
      ) : modul === 'wachstum' ? (
        <EtsyWachstum verbunden={verbunden} />
      ) : modul === 'kunden' ? (
        <EtsyKunden verbunden={verbunden} />
      ) : (
        <EtsyStrategie verbunden={verbunden} onListing={(id) => oeffne('seo', id)} />
      )}
    </PageChrome>
  )
}
