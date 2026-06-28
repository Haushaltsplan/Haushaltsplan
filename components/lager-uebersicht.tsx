'use client'

import { useMemo } from 'react'
import {
  istUnterMindestbestand,
  mhdKurzLabel,
  mhdStatus,
  tageBisMhd,
} from '@/lib/lager-mhd'

export type LagerUebersichtItem = {
  id: string
  name: string
  menge: number
  einheit: string
  mhd?: string | null
  mindestbestand?: number | null
}

type Props = {
  items: LagerUebersichtItem[]
  artikelGesamt: number
  mitBestand: number
  vorratswert: number
  onOeffnen: (id: string) => void
}

function formatEur(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function Kachel({
  label,
  wert,
  ton,
  hint,
}: {
  label: string
  wert: string | number
  ton: 'neutral' | 'emerald' | 'amber' | 'rose' | 'violet' | 'sky'
  hint?: string
}) {
  const toene: Record<string, string> = {
    neutral: 'border-[var(--app-border-strong)] bg-[var(--app-surface-muted)]/45 text-[var(--app-text)]',
    emerald: 'border-emerald-800/45 bg-emerald-950/25 text-emerald-100',
    amber: 'border-amber-800/50 bg-amber-950/30 text-amber-100',
    rose: 'border-rose-800/50 bg-rose-950/30 text-rose-100',
    violet: 'border-violet-800/50 bg-violet-950/35 text-violet-100',
    sky: 'border-sky-800/45 bg-sky-950/25 text-sky-100',
  }
  const labelTon: Record<string, string> = {
    neutral: 'text-[var(--app-text-muted)]',
    emerald: 'text-emerald-400',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
    violet: 'text-violet-300',
    sky: 'text-sky-400',
  }
  return (
    <div className={`flex min-h-[4.75rem] min-w-0 flex-col justify-center rounded-xl border px-2.5 py-2.5 sm:min-h-0 sm:px-3 sm:py-3 ${toene[ton]}`}>
      <span className={`truncate text-[9px] font-bold uppercase tracking-wide sm:text-[10px] ${labelTon[ton]}`}>{label}</span>
      <span className="mt-0.5 truncate text-xl font-black tabular-nums leading-tight sm:text-2xl">{wert}</span>
      {hint ? <span className="mt-1 truncate text-[10px] text-[var(--app-text-muted)]">{hint}</span> : null}
    </div>
  )
}

function Gruppe({
  titel,
  ton,
  items,
  zusatz,
  onOeffnen,
}: {
  titel: string
  ton: 'amber' | 'rose' | 'sky'
  items: LagerUebersichtItem[]
  zusatz: (it: LagerUebersichtItem) => string
  onOeffnen: (id: string) => void
}) {
  if (items.length === 0) return null
  const rahmen: Record<string, string> = {
    amber: 'border-amber-800/40 bg-amber-950/15',
    rose: 'border-rose-800/45 bg-rose-950/20',
    sky: 'border-sky-800/40 bg-sky-950/15',
  }
  const chip: Record<string, string> = {
    amber: 'border-amber-700/50 bg-amber-900/30 text-amber-100 hover:bg-amber-800/40',
    rose: 'border-rose-700/50 bg-rose-900/30 text-rose-100 hover:bg-rose-800/40',
    sky: 'border-sky-700/50 bg-sky-900/30 text-sky-100 hover:bg-sky-800/40',
  }
  const punkt: Record<string, string> = { amber: 'bg-amber-400', rose: 'bg-rose-400', sky: 'bg-sky-400' }
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${rahmen[ton]}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${punkt[ton]}`} aria-hidden />
        <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--app-text)]">{titel}</span>
        <span className="text-[11px] font-semibold tabular-nums text-[var(--app-text-muted)]">{items.length}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => onOeffnen(it.id)}
            title="Artikel öffnen"
            className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-left text-[12px] font-semibold transition ${chip[ton]}`}
          >
            <span className="min-w-0 truncate">{it.name}</span>
            <span className="shrink-0 rounded bg-black/25 px-1 text-[10px] font-bold tabular-nums opacity-90">
              {zusatz(it)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function LagerUebersicht({ items, artikelGesamt, mitBestand, vorratswert, onOeffnen }: Props) {
  const { abgelaufen, bald, nachkaufen } = useMemo(() => {
    const mitVorrat = items.filter((it) => it.menge > 0)
    const abgelaufen = mitVorrat
      .filter((it) => mhdStatus(it.mhd) === 'abgelaufen')
      .sort((a, b) => (tageBisMhd(a.mhd) ?? 0) - (tageBisMhd(b.mhd) ?? 0))
    const bald = mitVorrat
      .filter((it) => mhdStatus(it.mhd) === 'bald')
      .sort((a, b) => (tageBisMhd(a.mhd) ?? 0) - (tageBisMhd(b.mhd) ?? 0))
    const nachkaufen = items
      .filter((it) => istUnterMindestbestand(it.menge, it.mindestbestand))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    return { abgelaufen, bald, nachkaufen }
  }, [items])

  const alleRuhig = abgelaufen.length === 0 && bald.length === 0 && nachkaufen.length === 0

  return (
    <div className="space-y-3">
      <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-2.5">
        <Kachel label="Vorratswert" wert={formatEur(vorratswert)} ton="violet" />
        <Kachel label="Artikel" wert={artikelGesamt} ton="neutral" hint={`${mitBestand} mit Bestand`} />
        <Kachel label="Bald ablaufend" wert={bald.length} ton="amber" hint="≤ 7 Tage" />
        <Kachel label="Abgelaufen" wert={abgelaufen.length} ton="rose" hint="MHD überschritten" />
        <Kachel label="Nachkaufen" wert={nachkaufen.length} ton="sky" hint="unter Mindestbestand" />
      </div>

      {alleRuhig ? (
        <div className="rounded-xl border border-emerald-800/35 bg-emerald-950/15 px-4 py-3 text-[13px] text-emerald-200/90">
          Alles im grünen Bereich — nichts läuft bald ab, kein Artikel unter dem Mindestbestand.
        </div>
      ) : (
        <div className="space-y-2.5">
          <Gruppe
            titel="Abgelaufen"
            ton="rose"
            items={abgelaufen}
            zusatz={(it) => mhdKurzLabel(it.mhd)}
            onOeffnen={onOeffnen}
          />
          <Gruppe
            titel="Bald ablaufend"
            ton="amber"
            items={bald}
            zusatz={(it) => mhdKurzLabel(it.mhd)}
            onOeffnen={onOeffnen}
          />
          <Gruppe
            titel="Nachkaufen"
            ton="sky"
            items={nachkaufen}
            zusatz={(it) => `${it.menge}/${it.mindestbestand} ${it.einheit}`}
            onOeffnen={onOeffnen}
          />
        </div>
      )}
    </div>
  )
}
