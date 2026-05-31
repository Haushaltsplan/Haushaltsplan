'use client'

import { useMemo } from 'react'
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

/** Nächstes Fälligkeitsdatum für einen Tag-im-Monat ab heute. */
function naechsteFaelligkeit(tag: number): Date {
  const jetzt = new Date()
  const wunsch = Math.min(Math.max(Math.round(tag) || 1, 1), 31)
  const tageDieserMonat = new Date(jetzt.getFullYear(), jetzt.getMonth() + 1, 0).getDate()
  const tagDieserMonat = Math.min(wunsch, tageDieserMonat)
  if (jetzt.getDate() <= tagDieserMonat) {
    return new Date(jetzt.getFullYear(), jetzt.getMonth(), tagDieserMonat)
  }
  const tageNaechster = new Date(jetzt.getFullYear(), jetzt.getMonth() + 2, 0).getDate()
  return new Date(jetzt.getFullYear(), jetzt.getMonth() + 1, Math.min(wunsch, tageNaechster))
}

function formatDatum(d: Date) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}

export function AboSection({ dauerauftraege }: { dauerauftraege: Dauerauftrag[] }) {
  const abos = useMemo(() => {
    return dauerauftraege
      .filter((d) => String(d.typ || '').toLowerCase().trim() !== 'einnahme')
      // Spar-/Anlage-Daueraufträge (Aktien, Bausparer, Fonds, Rente …) gehören nicht zu Fixkosten.
      .filter((d) => ordneKategorieZu(d.kategorie, null, false) !== 'sparen')
      .map((d) => {
        const betrag = Number(d.betrag) || 0
        const tag = Number(d.tag_des_monats) || 1
        return { ...d, betragNum: betrag, faellig: naechsteFaelligkeit(tag) }
      })
      .sort((a, b) => b.betragNum - a.betragNum)
  }, [dauerauftraege])

  const monatsSumme = useMemo(() => abos.reduce((a, b) => a + b.betragNum, 0), [abos])
  const jahresSumme = Math.round(monatsSumme * 12 * 100) / 100

  return (
    <PageSection titleId="finanzen-abos-heading" title="Abos & Fixkosten" density="compact">
      <PageSectionPanel density="compact">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Pro Monat</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-rose-400">{eur(monatsSumme)}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{abos.length} laufende Daueraufträge (Ausgaben)</p>
          </div>
          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Hochrechnung pro Jahr</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-300">{eur(jahresSumme)}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">monatliche Fixkosten × 12</p>
          </div>
        </div>

        {abos.length === 0 ? (
          <p className="mt-3 rounded-xl border border-slate-800/90 bg-slate-950/35 p-8 text-center text-sm italic text-slate-600">
            Keine laufenden Ausgaben-Daueraufträge. Lege welche unter „Daueraufträge“ an.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {abos.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-slate-800/90 bg-slate-950/45 p-3"
              >
                <KategorieMark kategorie={String(a.kategorie)} groesse="sm" className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-slate-100">{a.kategorie}</p>
                  <p className="text-[11px] text-slate-500">nächste Abbuchung: {formatDatum(a.faellig)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-bold tabular-nums text-rose-400">{eur(a.betragNum)}</p>
                  <p className="text-[10px] text-slate-500 tabular-nums">{eur(a.betragNum * 12)}/Jahr</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PageSectionPanel>
    </PageSection>
  )
}
