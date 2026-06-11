'use client'

import { PA_SCROLL_ELEGANT } from '@/components/portfolio-analyse/pa-ui'
import { formatFundamentalWert } from '@/lib/portfolio-analyse/fundamentaldaten-format'
import type {
  FundamentalMetrikZeile,
  FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

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
}: {
  titel: string
  perioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  aktivIds: Set<string>
  onToggleZeile: (id: string) => void
}) {
  if (zeilen.length === 0) return null

  return (
    <div className="min-w-0 rounded-xl border border-zinc-800/80 bg-zinc-950/60">
      <div className="border-b border-zinc-800 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-zinc-100">{titel}</h3>
      </div>
      <div className={`${PA_SCROLL_ELEGANT} max-w-full`}>
        <table className="w-max min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-900/90 text-zinc-400">
              <th className="sticky left-0 z-10 min-w-[220px] border-r border-zinc-800 bg-zinc-900/95 px-3 py-2 text-left font-medium">
                Kennzahl
              </th>
              {perioden.map((p) => (
                <th
                  key={p.iso}
                  className={`min-w-[88px] whitespace-nowrap px-3 py-2 text-right font-medium ${
                    p.istLtm
                      ? 'text-amber-400/90'
                      : p.istNtm
                        ? 'text-violet-400/90'
                        : p.istSchaetzung
                          ? 'text-sky-400/90'
                          : ''
                  }`}
                >
                  {p.label}
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
                  className={`cursor-pointer border-t border-zinc-800/60 transition hover:bg-amber-500/[0.06] ${
                    ri % 2 === 1 ? 'bg-zinc-900/30' : 'bg-transparent'
                  } ${aktiv ? 'bg-amber-500/[0.08]' : ''}`}
                  onClick={() => onToggleZeile(z.id)}
                >
                  <td className="sticky left-0 z-10 border-r border-zinc-800/60 bg-inherit px-3 py-2">
                    <span className="flex items-center gap-2 text-zinc-200">
                      <span className={aktiv ? 'text-amber-400' : 'text-zinc-600'}>{CHART_ICON}</span>
                      {z.label}
                    </span>
                  </td>
                  {perioden.map((p) => (
                    <td
                      key={p.iso}
                      className={`whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-300 ${
                        p.istLtm
                          ? 'font-medium text-amber-100/90'
                          : p.istNtm
                            ? 'font-medium text-violet-100/90'
                            : p.istSchaetzung
                              ? 'font-medium text-sky-100/90'
                              : ''
                      }`}
                    >
                      {formatFundamentalWert(z.werte[p.iso], z.einheit)}
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
