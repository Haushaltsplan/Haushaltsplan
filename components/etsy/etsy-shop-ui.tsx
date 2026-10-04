'use client'

import type { ReactNode } from 'react'

/** Kleine UI-Helfer für Shop-OS-Module. */

export function ShopKpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--app-text)]">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{hint}</p> : null}
    </div>
  )
}

export function ShopSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="app-section-shell">
      <div className="app-surface-card-header flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
        <h3 className="text-base font-semibold tracking-tight text-[var(--app-text)]">{title}</h3>
        {action}
      </div>
      <div className="space-y-3 px-4 py-3 sm:px-5 sm:py-4">{children}</div>
    </section>
  )
}

export function eur(n: number | null | undefined, stellen = 0) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: stellen })
}

export function zahl(n: number | null | undefined, stellen = 0) {
  return n == null ? '—' : n.toLocaleString('de-DE', { maximumFractionDigits: stellen })
}

export async function postShop<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(j.error || `Fehler ${res.status}`)
  return j
}
