'use client'

import { useEffect, useRef } from 'react'
import { appTableScrollInlineClassName } from '@/components/page-shell'
import { formatFundamentalWert } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import type {
  FundamentalMetrikZeile,
  FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

const TABLE_SCROLL =
  `${appTableScrollInlineClassName} relative isolate scroll-smooth [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgb(82_82_91/0.55)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--app-surface-muted)]/50 hover:[&::-webkit-scrollbar-thumb]:bg-[var(--app-surface-muted)]/70`

const STICKY_SPALTE =
  'sticky left-0 border-r border-[var(--app-border)] shadow-[4px_0_10px_-4px_rgb(0_0_0/0.45)]'

function periodeSpaltenLabel(p: FundamentalPeriode, modus: 'jahr' | 'datum'): string {
  if (modus === 'jahr' && /^\d{4}-\d{2}-\d{2}$/.test(p.iso)) return p.iso.slice(0, 4)
  return p.label
}

function stickySpaltenHintergrund(ri: number, aktiv: boolean): string {
  const basis = ri % 2 === 1 ? 'bg-[var(--app-bg-accent)]' : 'bg-[var(--app-bg)]'
  if (aktiv) return `${basis} shadow-[inset_3px_0_0_rgb(245_158_11/0.85)]`
  return basis
}

const CHART_ICON = (
  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
)

export function PaFundamentalMetrikTabelle({
  titel,
  perioden,
  zeilen,
  aktivIds,
  onToggleZeile,
  labelModus = 'datum',
}: {
  titel: string
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  aktivIds: Set<string>
  onToggleZeile: (id: string) => void
  /** Bewertung: Jahreszahl (z. B. 2025) statt Geschäftsjahresende */
  labelModus?: 'jahr' | 'datum'
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = el.scrollWidth
  }, [perioden, zeilen])

  if (zeilen.length === 0) return null

  return (
    <div className="min-w-0 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]">
      <div className="border-b border-[var(--app-border)] px-4 py-2.5">
        <h3 className="text-sm font-semibold text-[var(--app-text)]">{titel}</h3>
      </div>
      <div ref={scrollRef} className={`${TABLE_SCROLL} max-w-full`}>
        <table className="app-data-table w-max min-w-full border-collapse text-xs">
          <thead>
            <tr className="text-[var(--app-text-muted)]">
              <th
                className={`${STICKY_SPALTE} z-20 min-w-[220px] bg-[var(--app-bg)] px-3 py-2 text-left font-medium`}
              >
                Kennzahl
              </th>
              {perioden.map((p) => (
                <th
                  key={p.iso}
                  className={`min-w-[88px] whitespace-nowrap bg-[var(--app-surface-muted)] px-3 py-2 text-right font-medium ${
                    p.istLtm
                      ? 'text-amber-400/90'
                      : p.istNtm
                        ? 'text-violet-400/90'
                        : p.istSchaetzung
                          ? 'text-sky-400/90'
                          : ''
                  }`}
                >
                  {periodeSpaltenLabel(p, labelModus)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z, ri) => {
              const aktiv = aktivIds.has(z.id)
              return (
                <tr
                  key={z.id}
                  className={`cursor-pointer border-t border-[var(--app-border)] transition hover:bg-amber-500/[0.06] ${
                    ri % 2 === 1 ? 'bg-[var(--app-surface-muted)]/30' : 'bg-transparent'
                  } ${aktiv ? 'bg-amber-500/[0.08]' : ''}`}
                  onClick={() => onToggleZeile(z.id)}
                >
                  <td className={`${STICKY_SPALTE} z-10 px-3 py-2 ${stickySpaltenHintergrund(ri, aktiv)}`}>
                    <span className="flex items-center gap-2 text-[var(--app-text)]">
                      <span className={aktiv ? 'text-amber-400' : 'text-[var(--app-text-muted)]'}>{CHART_ICON}</span>
                      {z.label}
                    </span>
                  </td>
                  {perioden.map((p) => (
                    <td
                      key={p.iso}
                      className={`whitespace-nowrap px-3 py-2 text-right tabular-nums text-[var(--app-text)] ${
                        p.istLtm
                          ? 'font-medium text-amber-100/90'
                          : p.istNtm
                            ? 'font-medium text-violet-100/90'
                            : p.istSchaetzung
                              ? 'font-medium text-sky-100/90'
                              : ''
                      }`}
                    >
                      {formatFundamentalWert(z.werte[p.iso], z.einheit, {
                        nm: z.nmWerte?.[p.iso],
                      })}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
