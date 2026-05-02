'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { InvestmentMoverKarteDaten } from '@/components/investment-mover-karte-types'
import {
  InvestmentMoverKarteBodyClient,
  InvestmentMoverKarteMetrikSpalte,
} from '@/components/investment-mover-karte-body.client'
import { StockLogo } from '@/components/stock-logo'
import type { PortfolioPositionMitNotiz } from '@/lib/investment-portfolio-types'
import { parsePortfolioApiPayload } from '@/lib/investment-portfolio-validierung'
import type { PortfolioKurseBericht } from '@/lib/portfolio-kurse'

const NOTIERUNGEN = ['USD', 'EUR', 'GBP', 'CHF', 'CAD'] as const

function neueZeilenId(): string {
  try {
    return `usr:${crypto.randomUUID()}`
  } catch {
    return `usr:${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

function nachTagSplitten(positionen: InvestmentMoverKarteDaten[]) {
  const positiv = positionen
    .filter((z) => z.aenderungProzent != null && z.aenderungProzent > 0)
    .sort((a, b) => (b.aenderungProzent ?? 0) - (a.aenderungProzent ?? 0))
  const negativ = positionen
    .filter((z) => z.aenderungProzent != null && z.aenderungProzent < 0)
    .sort((a, b) => (a.aenderungProzent ?? 0) - (b.aenderungProzent ?? 0))
  const neutral = positionen
    .filter((z) => z.aenderungProzent == null || z.aenderungProzent === 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  return { positiv, negativ, neutral }
}

function skeletonKarte(row: PortfolioPositionMitNotiz): InvestmentMoverKarteDaten {
  const sym = row.symbolYahoo.trim()
  const nm = row.name.trim()
  return {
    portfolioZeilenId: row.id,
    portfolioKarte: true,
    symbol: sym || '—',
    name: nm || 'Neu',
    brancheAnzeige: null,
    aenderungProzent: null,
    kurs: null,
    notierung: row.notierung || 'USD',
    ytdProzent: null,
    fuenfJahreProzent: null,
    zehnJahreProzent: null,
    athAbstandProzent: null,
    notiz: row.notiz.trim() ? row.notiz.trim() : null,
  }
}

function mergedKarten(rows: PortfolioPositionMitNotiz[], positionen: InvestmentMoverKarteDaten[]): InvestmentMoverKarteDaten[] {
  const pm = new Map(
    positionen.filter((z) => z.portfolioZeilenId).map((z) => [z.portfolioZeilenId!, z]),
  )
  return rows.map((row) => {
    const hit = pm.get(row.id)
    const basis = hit ?? skeletonKarte(row)
    return {
      ...basis,
      portfolioZeilenId: row.id,
      portfolioKarte: true,
      symbol: row.symbolYahoo.trim() || basis.symbol,
      name: row.name.trim() || basis.name,
      notierung: (row.notierung || basis.notierung || 'USD').trim(),
      notiz: row.notiz.trim() ? row.notiz.trim() : null,
    }
  })
}

function IconStift(props: ComponentPropsWithoutRef<'button'>) {
  return (
    <button type="button" {...props}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
        />
      </svg>
    </button>
  )
}

function IconMuell(props: ComponentPropsWithoutRef<'button'>) {
  return (
    <button type="button" {...props}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
        />
      </svg>
    </button>
  )
}

function IconPlus(props: ComponentPropsWithoutRef<'button'>) {
  return (
    <button type="button" {...props}>
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    </button>
  )
}

function IconCheck(props: ComponentPropsWithoutRef<'button'>) {
  return (
    <button type="button" {...props}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    </button>
  )
}

function IconX(props: ComponentPropsWithoutRef<'button'>) {
  return (
    <button type="button" {...props}>
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </button>
  )
}

function PortfolioPositionZeile({
  z,
  row,
  editing,
  pending,
  onEdit,
  onCancelEdit,
  onPersistReplaceRow,
  onPersistRemoveRow,
}: {
  z: InvestmentMoverKarteDaten
  row: PortfolioPositionMitNotiz
  editing: boolean
  pending: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onPersistReplaceRow: (next: PortfolioPositionMitNotiz) => Promise<boolean>
  onPersistRemoveRow: () => Promise<boolean>
}) {
  const [draft, setDraft] = useState(row)

  useEffect(() => {
    if (editing) setDraft({ ...row })
  }, [editing, row])

  const btn =
    'rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-30'

  const toolbarLesen = (
    <>
      <IconStift aria-label="Bearbeiten" disabled={pending || editing} onClick={onEdit} className={btn} />
      <IconMuell
        aria-label="Löschen"
        disabled={pending || editing}
        onClick={() => {
          if (!confirm(`„${row.name || row.symbolYahoo}“ entfernen?`)) return
          void onPersistRemoveRow()
        }}
        className={`${btn} hover:text-red-300`}
      />
    </>
  )

  if (editing) {
    const nt =
      NOTIERUNGEN.includes(draft.notierung as (typeof NOTIERUNGEN)[number]) ? draft.notierung : 'USD'
    return (
      <li className="rounded-xl border border-zinc-800/90 bg-zinc-950/50 px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
            <StockLogo symbol={draft.symbolYahoo.trim() || '?'} />
            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
              <input
                value={draft.name}
                disabled={pending}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Name"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-white outline-none ring-teal-700/40 focus:ring-2"
              />
              <input
                value={draft.symbolYahoo}
                disabled={pending}
                onChange={(e) => setDraft((d) => ({ ...d, symbolYahoo: e.target.value.toUpperCase() }))}
                placeholder="Ticker"
                spellCheck={false}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-mono text-sm text-white outline-none ring-teal-700/40 focus:ring-2"
              />
              <select
                value={nt}
                disabled={pending}
                onChange={(e) => setDraft((d) => ({ ...d, notierung: e.target.value }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-white outline-none ring-teal-700/40 focus:ring-2 sm:col-span-2"
              >
                {NOTIERUNGEN.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <textarea
                value={draft.notiz}
                disabled={pending}
                onChange={(e) => setDraft((d) => ({ ...d, notiz: e.target.value }))}
                placeholder="Notiz"
                rows={2}
                className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm leading-snug text-zinc-100 outline-none ring-teal-700/40 focus:ring-2 sm:col-span-2"
              />
            </div>
          </div>
          <div className="flex shrink-0 items-start gap-1">
            <IconCheck
              aria-label="Speichern"
              disabled={pending}
              className={`${btn} text-teal-400 hover:text-teal-300`}
              onClick={() => void onPersistReplaceRow(draft)}
            />
            <IconX aria-label="Abbrechen" disabled={pending} className={btn} onClick={onCancelEdit} />
            <InvestmentMoverKarteMetrikSpalte z={z} />
          </div>
        </div>
        {z.kurs != null ? (
          <p className="mt-2 text-xs tabular-nums text-zinc-400">
            Kurs ca. {z.kurs.toFixed(2)} {z.notierung ?? 'USD'}
          </p>
        ) : null}
      </li>
    )
  }

  return (
    <li className="rounded-xl border border-zinc-800/90 bg-zinc-950/50 px-3 py-3">
      <InvestmentMoverKarteBodyClient z={z} kopfExtrasObenRechts={<span className="flex shrink-0 gap-0.5">{toolbarLesen}</span>} />
    </li>
  )
}

export function PortfolioHoldingsInteraktiv({ bericht }: { bericht: PortfolioKurseBericht }) {
  const router = useRouter()
  const [rows, setRows] = useState(bericht.bearbeitbarePositionen)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setRows(bericht.bearbeitbarePositionen)
    setEditingId(null)
  }, [bericht])

  const merged = useMemo(() => mergedKarten(rows, bericht.positionen), [rows, bericht.positionen])
  const { positiv, negativ, neutral } = nachTagSplitten(merged)

  const rowNachId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows])

  async function persistRows(next: PortfolioPositionMitNotiz[]): Promise<boolean> {
    const parsed = parsePortfolioApiPayload({ positionen: next })
    if (!parsed.ok) {
      toast.error(parsed.message)
      return false
    }
    setPending(true)
    try {
      const res = await fetch('/api/investment-portfolio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionen: parsed.rows }),
      })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || j.ok === false) {
        toast.error(typeof j.message === 'string' ? j.message : `Speichern fehlgeschlagen (${res.status})`)
        return false
      }
      toast.success('Gespeichert')
      setEditingId(null)
      router.refresh()
      return true
    } catch {
      toast.error('Speichern nicht möglich.')
      return false
    } finally {
      setPending(false)
    }
  }

  const btnGhost = 'rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white disabled:opacity-30'

  function zeilenListe(liste: InvestmentMoverKarteDaten[]) {
    return liste.flatMap((z) => {
      const id = z.portfolioZeilenId
      const row = id ? rowNachId.get(id) : undefined
      if (!id || !row) return []
      return [
        <PortfolioPositionZeile
          key={id}
          z={z}
          row={row}
          editing={editingId === id}
          pending={pending}
          onEdit={() => setEditingId(id)}
          onCancelEdit={() => setEditingId(null)}
          onPersistReplaceRow={async (next) => {
            const replaced = rows.map((r) => (r.id === id ? next : r))
            return persistRows(replaced)
          }}
          onPersistRemoveRow={async () => persistRows(rows.filter((r) => r.id !== id))}
        />,
      ]
    })
  }

  return (
    <>
      {bericht.fehler ? (
        <p className="mt-3 rounded-lg border border-orange-900/35 bg-orange-950/15 px-3 py-2 text-xs leading-relaxed text-orange-100/95">
          {bericht.fehler}
        </p>
      ) : null}

      <div className="mt-3 flex justify-end">
        <IconPlus
          aria-label="Position hinzufügen"
          disabled={pending}
          className={btnGhost}
          onClick={() => {
            const id = neueZeilenId()
            setRows((r) => [...r, { id, name: '', symbolYahoo: '', notierung: 'USD', notiz: '' }])
            setEditingId(id)
          }}
        />
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="min-w-0">
          <h3 className="mb-2 border-b border-teal-900/40 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-400/95">
            Plus
          </h3>
          {positiv.length === 0 ? (
            <p className="rounded-lg border border-zinc-800/80 bg-zinc-950/30 px-3 py-5 text-center text-xs text-zinc-500">—</p>
          ) : (
            <ul className="grid gap-2">{zeilenListe(positiv)}</ul>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="mb-2 border-b border-red-950/50 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-400/85">
            Minus
          </h3>
          {negativ.length === 0 ? (
            <p className="rounded-lg border border-zinc-800/80 bg-zinc-950/30 px-3 py-5 text-center text-xs text-zinc-500">—</p>
          ) : (
            <ul className="grid gap-2">{zeilenListe(negativ)}</ul>
          )}
        </div>
      </div>

      {neutral.length > 0 ? (
        <div className="mt-6 border-t border-zinc-800/80 pt-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">±0</h3>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{zeilenListe(neutral)}</ul>
        </div>
      ) : null}
    </>
  )
}
