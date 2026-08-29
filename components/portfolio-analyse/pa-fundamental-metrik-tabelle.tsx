'use client'

import { useEffect, useRef } from 'react'
import { appTableScrollInlineClassName } from '@/components/page-shell'
import {
  formatFundamentalWert,
  formatYoyPct,
  yoyAenderungPct,
  yoyVorperiodeIso,
} from '@/lib/portfolio-analyse/fundamentaldaten-format'
import type {
  FundamentalMetrikZeile,
  FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

const TABLE_SCROLL =
  `${appTableScrollInlineClassName} relative isolate scroll-smooth [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgb(82_82_91/0.55)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--app-surface-muted)]/50 hover:[&::-webkit-scrollbar-thumb]:bg-[var(--app-surface-muted)]/70`

const STICKY_SPALTE =
  'sticky left-0 border-r border-[var(--app-border)] shadow-[4px_0_10px_-4px_rgb(0_0_0/0.45)]'

const YOY_KOSTEN = new Set([
  'aktien',
  'sbc',
  'capex',
  'rd',
  'sga',
  'da',
  'gesamtverbindlichkeiten',
  'gesamtverschuldung',
  'kurzfrist_verbindl',
  'dso',
  'dio',
])

export type MetrikTabellenGruppe = {
  id: string
  titel: string
  zeilen: FundamentalMetrikZeile[]
}

function periodeSpaltenLabel(p: FundamentalPeriode, modus: 'jahr' | 'datum'): string {
  if (modus === 'jahr' && /^\d{4}-\d{2}-\d{2}$/.test(p.iso)) return p.iso.slice(0, 4)
  return p.label
}

function stickySpaltenHintergrund(ri: number, aktiv: boolean): string {
  const basis = ri % 2 === 1 ? 'bg-[var(--app-bg-accent)]' : 'bg-[var(--app-bg)]'
  if (aktiv) return `${basis} shadow-[inset_3px_0_0_rgb(245_158_11/0.85)]`
  return basis
}

function yoyKlasse(
  pct: number,
  polaritaet: 'wachstum' | 'kosten' | 'neutral',
): string {
  if (polaritaet === 'neutral' || Math.abs(pct) < 0.5) return 'text-[var(--app-text-muted)]'
  const steigend = pct > 0
  const gut = polaritaet === 'wachstum' ? steigend : !steigend
  return gut ? 'text-emerald-400/90' : 'text-rose-400/90'
}

function yoyPolaritaet(z: FundamentalMetrikZeile): 'wachstum' | 'kosten' | 'neutral' {
  if (z.gruppe === 'bewertung_trailing' || z.gruppe === 'bewertung_forward') return 'kosten'
  if (YOY_KOSTEN.has(z.id)) return 'kosten'
  if (
    z.gruppe === 'finanzdaten' ||
    z.gruppe === 'cashflow' ||
    z.gruppe === 'margen' ||
    z.gruppe === 'rentabilitaet' ||
    z.gruppe === 'umschlag'
  ) {
    return 'wachstum'
  }
  return 'neutral'
}

const CHART_ICON = (
  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
)

export function PaFundamentalMetrikTabelle({
  gruppen,
  perioden,
  aktivIds,
  onToggleZeile,
  labelModus = 'datum',
  yoy = true,
  yoyVergleich = 'vorjahr',
  eingebettet = false,
}: {
  gruppen: MetrikTabellenGruppe[]
  perioden: FundamentalPeriode[]
  aktivIds: Set<string>
  onToggleZeile: (id: string) => void
  /** Bewertung/Jahresansicht: Jahreszahl (z. B. 2025) statt Geschäftsjahresende */
  labelModus?: 'jahr' | 'datum'
  yoy?: boolean
  /** quartal: vs. Vorjahresquartal; jahr: vs. vorherige Spalte */
  yoyVergleich?: 'vorjahr' | 'vorperiode'
  eingebettet?: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const sichtbareGruppen = gruppen.filter((g) => g.zeilen.length > 0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = el.scrollWidth
  }, [perioden, sichtbareGruppen.length])

  if (sichtbareGruppen.length === 0) return null

  const startIndexNachGruppe = sichtbareGruppen.reduce<number[]>((acc, g) => {
    const prev = acc.length === 0 ? 0 : acc[acc.length - 1]! + sichtbareGruppen[acc.length - 1]!.zeilen.length
    acc.push(prev)
    return acc
  }, [])

  return (
    <div className={eingebettet ? 'min-w-0' : 'min-w-0 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]'}>
      <div ref={scrollRef} className={`${TABLE_SCROLL} max-w-full`}>
        <table className="app-data-table w-max min-w-full border-collapse text-xs">
          <thead>
            <tr className="text-[var(--app-text-muted)]">
              <th
                className={`${STICKY_SPALTE} z-20 min-w-[200px] bg-[var(--app-bg)] px-3 py-2 text-left font-medium`}
              >
                Kennzahl
              </th>
              {perioden.map((p) => (
                <th
                  key={p.iso}
                  className={`min-w-[84px] whitespace-nowrap bg-[var(--app-surface-muted)] px-2.5 py-2 text-right font-medium ${
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
                  {p.istSchaetzung && labelModus === 'jahr' ? 'e' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sichtbareGruppen.map((gruppe, gi) => {
              const startIndex = startIndexNachGruppe[gi] ?? 0
              return (
                <GruppeZeilen
                  key={gruppe.id}
                  gruppe={gruppe}
                  perioden={perioden}
                  aktivIds={aktivIds}
                  onToggleZeile={onToggleZeile}
                  yoy={yoy}
                  yoyVergleich={yoyVergleich}
                  startIndex={startIndex}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GruppeZeilen({
  gruppe,
  perioden,
  aktivIds,
  onToggleZeile,
  yoy,
  yoyVergleich,
  startIndex,
}: {
  gruppe: MetrikTabellenGruppe
  perioden: FundamentalPeriode[]
  aktivIds: Set<string>
  onToggleZeile: (id: string) => void
  yoy: boolean
  yoyVergleich: 'vorjahr' | 'vorperiode'
  startIndex: number
}) {
  return (
    <>
      <tr>
        <td
          className={`${STICKY_SPALTE} z-10 bg-[var(--app-bg)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-500`}
        >
          {gruppe.titel}
        </td>
        {perioden.map((p) => (
          <td key={p.iso} className="bg-amber-500/[0.06] px-2.5 py-1.5" />
        ))}
      </tr>
      {gruppe.zeilen.map((z, gi) => {
        const ri = startIndex + gi
        const aktiv = aktivIds.has(z.id)
        const polaritaet = yoyPolaritaet(z)
        return (
          <tr
            key={z.id}
            id={`metrik-zeile-${z.id}`}
            className={`cursor-pointer border-t border-[var(--app-border)]/70 transition hover:bg-amber-500/[0.06] ${
              ri % 2 === 1 ? 'bg-[var(--app-surface-muted)]/30' : 'bg-transparent'
            } ${aktiv ? 'bg-amber-500/[0.08]' : ''}`}
            onClick={() => onToggleZeile(z.id)}
          >
            <td className={`${STICKY_SPALTE} z-10 px-3 py-1.5 ${stickySpaltenHintergrund(ri, aktiv)}`}>
              <span className="flex items-center gap-2 text-[var(--app-text)]">
                <span className={aktiv ? 'text-amber-400' : 'text-[var(--app-text-muted)]'}>{CHART_ICON}</span>
                {z.label}
              </span>
            </td>
            {perioden.map((p) => {
              const wert = z.werte[p.iso]
              const vorIso =
                yoyVergleich === 'vorperiode' && !/^(Q[1-4]|H[12])\b/i.test(p.label)
                  ? (() => {
                      const i = perioden.findIndex((x) => x.iso === p.iso)
                      return i > 0 ? perioden[i - 1]!.iso : null
                    })()
                  : yoyVorperiodeIso(p.iso, perioden)
              const vorjahr = vorIso ? z.werte[vorIso] : null
              const pct = yoy ? yoyAenderungPct(wert, vorjahr) : null
              const vsLabel = vorIso
                ? perioden.find((x) => x.iso === vorIso)?.label ?? vorIso
                : null
              return (
                <td
                  key={p.iso}
                  className={`whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums text-[var(--app-text)] ${
                    p.istLtm
                      ? 'font-medium text-amber-100/90'
                      : p.istNtm
                        ? 'font-medium text-violet-100/90'
                        : p.istSchaetzung
                          ? 'font-medium text-sky-100/90'
                          : ''
                  }`}
                >
                  <span className="block">
                    {formatFundamentalWert(wert, z.einheit, {
                      nm: z.nmWerte?.[p.iso],
                    })}
                  </span>
                  {pct != null ? (
                    <span
                      className={`block text-[9px] font-medium leading-tight ${yoyKlasse(pct, polaritaet)}`}
                      title={vsLabel ? `vs. ${vsLabel}` : undefined}
                    >
                      {formatYoyPct(pct)}
                    </span>
                  ) : null}
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )
}
