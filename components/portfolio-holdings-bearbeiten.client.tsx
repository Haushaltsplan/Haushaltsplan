'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { PortfolioPositionMitNotiz } from '@/lib/investment-portfolio-types'
import { portfolioStandardZeilenMitMeta } from '@/lib/investment-portfolio-standard-zeilen'
import { DetailsDisclosureTriggerEnd } from '@/components/collapsible-ui'

const NOTIERUNGEN = ['USD', 'EUR', 'GBP', 'CHF', 'CAD'] as const

function neueZeilenId(): string {
  try {
    return `usr:${crypto.randomUUID()}`
  } catch {
    return `usr:${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

export function PortfolioHoldingsBearbeitenClient({
  bearbeitbarePositionen,
  verwendetStandardliste,
}: {
  bearbeitbarePositionen: PortfolioPositionMitNotiz[]
  verwendetStandardliste: boolean
}) {
  const router = useRouter()
  const [rows, setRows] = useState(bearbeitbarePositionen)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setRows(bearbeitbarePositionen)
  }, [bearbeitbarePositionen])

  async function speichern() {
    setPending(true)
    try {
      const res = await fetch('/api/investment-portfolio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionen: rows }),
      })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || j.ok === false) {
        toast.error(typeof j.message === 'string' ? j.message : `Speichern fehlgeschlagen (${res.status})`)
        return
      }
      toast.success('Portfolio gespeichert')
      router.refresh()
    } catch {
      toast.error('Speichern nicht möglich (Netzwerk).')
    } finally {
      setPending(false)
    }
  }

  return (
    <details className="group mt-4 rounded-xl border border-zinc-800/90 bg-zinc-950/35">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 outline-none hover:bg-zinc-900/40 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Bearbeiten</p>
          <p className="mt-0.5 text-sm font-medium text-white">Unternehmen hinzufügen, löschen und Notizen</p>
          {verwendetStandardliste ? (
            <p className="mt-1 text-[11px] leading-relaxed text-amber-100/85">
              Aktuell die eingebaute Standardliste — erst nach „Speichern“ wird deine eigene Liste festgehalten (Supabase oder{' '}
              <span className="font-mono text-zinc-400">data/investment-portfolio.json</span>).
            </p>
          ) : null}
        </div>
        <DetailsDisclosureTriggerEnd size="sm" />
      </summary>

      <div className="space-y-4 border-t border-zinc-800/80 px-3 pb-4 pt-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              setRows((r) => [
                ...r,
                {
                  id: neueZeilenId(),
                  name: '',
                  symbolYahoo: '',
                  notierung: 'USD',
                  notiz: '',
                },
              ])
            }
            className="rounded-lg border border-teal-900/40 bg-teal-950/25 px-3 py-2 text-xs font-semibold text-teal-100/95 transition hover:border-teal-800/55 hover:bg-teal-950/40 disabled:opacity-40"
          >
            Zeile hinzufügen
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm('Standardliste wiederherstellen? Ungespeicherte Änderungen in diesem Editor bleiben bis zum Speichern.')) return
              setRows(portfolioStandardZeilenMitMeta())
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-40"
          >
            Standardliste laden
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={speichern}
            className="rounded-lg border border-white/15 bg-white/[0.09] px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-black/20 transition hover:bg-white/[0.14] disabled:opacity-40"
          >
            {pending ? 'Speichern …' : 'Speichern'}
          </button>
        </div>

        <div className="max-h-[min(70vh,520px)] space-y-3 overflow-y-auto pr-1">
          {rows.length === 0 ? (
            <p className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-4 text-center text-xs text-zinc-500">
              Keine Positionen — „Zeile hinzufügen“ oder „Standardliste laden“, dann speichern.
            </p>
          ) : (
            rows.map((row, idx) => (
              <div
                key={row.id}
                className="rounded-xl border border-zinc-800/90 bg-zinc-950/55 p-3 shadow-inner shadow-black/10"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Position {idx + 1}</span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))}
                    className="rounded-md border border-red-950/60 bg-red-950/20 px-2 py-1 text-[11px] font-semibold text-red-200/95 hover:bg-red-950/35 disabled:opacity-40"
                  >
                    Entfernen
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-zinc-500">Name</span>
                    <input
                      disabled={pending}
                      value={row.name}
                      onChange={(e) =>
                        setRows((r) => r.map((x) => (x.id === row.id ? { ...x, name: e.target.value } : x)))
                      }
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-sm text-white outline-none ring-teal-700/40 focus:ring-2"
                      placeholder="Unternehmen"
                      autoComplete="off"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-zinc-500">Yahoo-Symbol</span>
                    <input
                      disabled={pending}
                      value={row.symbolYahoo}
                      onChange={(e) =>
                        setRows((r) =>
                          r.map((x) => (x.id === row.id ? { ...x, symbolYahoo: e.target.value.toUpperCase() } : x)),
                        )
                      }
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 font-mono text-sm text-white outline-none ring-teal-700/40 focus:ring-2"
                      placeholder="z. B. MSFT"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  <label className="block space-y-1 sm:col-span-1">
                    <span className="text-[11px] font-medium text-zinc-500">Notierung</span>
                    <select
                      disabled={pending}
                      value={NOTIERUNGEN.includes(row.notierung as (typeof NOTIERUNGEN)[number]) ? row.notierung : 'USD'}
                      onChange={(e) =>
                        setRows((r) => r.map((x) => (x.id === row.id ? { ...x, notierung: e.target.value } : x)))
                      }
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-sm text-white outline-none ring-teal-700/40 focus:ring-2"
                    >
                      {NOTIERUNGEN.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="mt-2 block space-y-1">
                  <span className="text-[11px] font-medium text-zinc-500">Notiz</span>
                  <textarea
                    disabled={pending}
                    value={row.notiz}
                    onChange={(e) =>
                      setRows((r) => r.map((x) => (x.id === row.id ? { ...x, notiz: e.target.value } : x)))
                    }
                    rows={3}
                    className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-sm leading-relaxed text-zinc-100 outline-none ring-teal-700/40 focus:ring-2"
                    placeholder="Thesen, Bewertung, Erinnerungen …"
                  />
                </label>
              </div>
            ))
          )}
        </div>
      </div>
    </details>
  )
}
