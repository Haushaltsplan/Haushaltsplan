'use client'

import { useMemo } from 'react'
import {
  finanzKpiCardClass,
  finanzLabelMutedClass,
  finanzListItemClass,
  finanzTitleClass,
} from '@/components/finanzen/finanzen-ui'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import { KategorieMark } from '@/lib/kategorie-icon'
import { ordneKategorieZu } from '@/lib/finanz-kategorisierung'

type Dauerauftrag = {
  id: string | number
  typ?: string
  kategorie: string
  betrag: number | string
  tag_des_monats: number | string
}

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

/**
 * Übersicht der monatlichen Spar-/Anlage-Daueraufträge (Aktien, Bausparer, Fonds, Rente …).
 * Spiegelbild zur Abo-/Fixkostensektion – rein aus den Daueraufträgen abgeleitet.
 */
export function SparenSection({ dauerauftraege }: { dauerauftraege: Dauerauftrag[] }) {
  const posten = useMemo(() => {
    return dauerauftraege
      .filter((d) => String(d.typ || '').toLowerCase().trim() !== 'einnahme')
      .filter((d) => ordneKategorieZu(d.kategorie, null, false) === 'sparen')
      .map((d) => ({ ...d, betragNum: Number(d.betrag) || 0 }))
      .sort((a, b) => b.betragNum - a.betragNum)
  }, [dauerauftraege])

  const monatsSumme = useMemo(() => posten.reduce((a, b) => a + b.betragNum, 0), [posten])
  const jahresSumme = Math.round(monatsSumme * 12 * 100) / 100

  if (posten.length === 0) return null

  return (
    <PageSection titleId="finanzen-sparen-heading" title="Sparen & Anlage" density="compact">
      <PageSectionPanel density="compact">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={finanzKpiCardClass}>
            <p className={finanzLabelMutedClass}>Sparrate pro Monat</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-teal-300">{eur(monatsSumme)}</p>
            <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">{posten.length} laufende Spar-/Anlageaufträge</p>
          </div>
          <div className={finanzKpiCardClass}>
            <p className={finanzLabelMutedClass}>Hochrechnung pro Jahr</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">{eur(jahresSumme)}</p>
            <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">monatliche Sparrate × 12</p>
          </div>
        </div>

        <ul className="mt-3 space-y-2">
          {posten.map((p) => (
            <li key={p.id} className={finanzListItemClass}>
              <KategorieMark kategorie={String(p.kategorie)} groesse="sm" className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className={finanzTitleClass}>{p.kategorie}</p>
                <p className="text-[11px] text-[var(--app-text-muted)]">
                  monatlich am {Math.min(Math.max(Number(p.tag_des_monats) || 1, 1), 31)}.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[14px] font-bold tabular-nums text-teal-300">{eur(p.betragNum)}</p>
                <p className="text-[10px] tabular-nums text-[var(--app-text-muted)]">{eur(p.betragNum * 12)}/Jahr</p>
              </div>
            </li>
          ))}
        </ul>
      </PageSectionPanel>
    </PageSection>
  )
}
