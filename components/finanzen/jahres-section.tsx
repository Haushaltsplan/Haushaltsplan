'use client'

import {
  finanzKpiCardClass,
  finanzKpiCardCompactClass,
  finanzLabelMutedClass,
  finanzSecondaryBtnClass,
} from '@/components/finanzen/finanzen-ui'
import { useMemo, useState } from 'react'
import { PageSection, PageSectionPanel } from '@/components/page-shell'

type Buchung = { betrag?: number | string | null; datum?: string | null }

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function jahrVon(iso?: string | null): number | null {
  if (!iso) return null
  const m = String(iso).slice(0, 4).match(/^(\d{4})$/)
  if (m) return Number(m[1])
  const d = new Date(String(iso))
  return Number.isNaN(d.getTime()) ? null : d.getFullYear()
}

function monatIndexVon(iso?: string | null): number | null {
  if (!iso) return null
  const m = String(iso).slice(0, 7).match(/^\d{4}-(\d{2})$/)
  if (m) return Number(m[1]) - 1
  const d = new Date(String(iso))
  return Number.isNaN(d.getTime()) ? null : d.getMonth()
}

type Jahreswerte = { einnahmen: number; ausgaben: number; monate: Set<number> }

function leereWerte(): Jahreswerte {
  return { einnahmen: 0, ausgaben: 0, monate: new Set() }
}

function DeltaBadge({ wert, guteRichtung }: { wert: number; guteRichtung: 'hoch' | 'runter' }) {
  if (Math.abs(wert) < 0.005) {
    return <span className="text-[11px] font-semibold text-[var(--app-text-muted)]">±0 €</span>
  }
  const positiv = wert > 0
  const gut = guteRichtung === 'hoch' ? positiv : !positiv
  return (
    <span className={`text-[11px] font-semibold tabular-nums ${gut ? 'text-emerald-400' : 'text-rose-400'}`}>
      {positiv ? '+' : '−'}
      {eur(Math.abs(wert))}
    </span>
  )
}

/** Jahresübersicht mit Vergleich zum Vorjahr. Rechnet rein aus den vorhandenen Buchungen. */
export function JahresSection({
  einnahmen,
  ausgaben,
  ansichtMonat,
}: {
  einnahmen: Buchung[]
  ausgaben: Buchung[]
  ansichtMonat: string
}) {
  const proJahr = useMemo(() => {
    const m = new Map<number, Jahreswerte>()
    const erfasse = (rows: Buchung[], feld: 'einnahmen' | 'ausgaben') => {
      for (const r of rows) {
        const y = jahrVon(r.datum)
        if (y == null) continue
        const betrag = Number(r.betrag)
        if (!Number.isFinite(betrag)) continue
        const w = m.get(y) ?? leereWerte()
        w[feld] += betrag
        const mi = monatIndexVon(r.datum)
        if (mi != null) w.monate.add(mi)
        m.set(y, w)
      }
    }
    erfasse(einnahmen, 'einnahmen')
    erfasse(ausgaben, 'ausgaben')
    return m
  }, [einnahmen, ausgaben])

  const verfuegbareJahre = useMemo(() => [...proJahr.keys()].sort((a, b) => b - a), [proJahr])

  const startJahr = Number.parseInt(ansichtMonat.slice(0, 4), 10) || new Date().getFullYear()
  const [jahr, setJahr] = useState<number>(startJahr)

  const aktuell = proJahr.get(jahr) ?? leereWerte()
  const vorjahr = proJahr.get(jahr - 1) ?? leereWerte()

  const saldo = aktuell.einnahmen - aktuell.ausgaben
  const vorSaldo = vorjahr.einnahmen - vorjahr.ausgaben
  const monateMitDaten = Math.max(aktuell.monate.size, 1)
  const sparquote = aktuell.einnahmen > 0 ? (saldo / aktuell.einnahmen) * 100 : 0

  const minJahr = verfuegbareJahre.length ? Math.min(...verfuegbareJahre) : startJahr
  const maxJahr = verfuegbareJahre.length ? Math.max(...verfuegbareJahre) : startJahr

  return (
    <PageSection titleId="finanzen-jahr-heading" title="Jahresübersicht" density="compact">
      <PageSectionPanel density="compact">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setJahr((j) => j - 1)}
            disabled={jahr <= minJahr}
            className={`rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm font-semibold text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40`}
            aria-label="Vorheriges Jahr"
          >
            ‹
          </button>
          <p className="text-lg font-bold tabular-nums text-[var(--app-text)]">{jahr}</p>
          <button
            type="button"
            onClick={() => setJahr((j) => j + 1)}
            disabled={jahr >= maxJahr}
            className={`rounded-lg border border-[var(--app-border)] px-3 py-1.5 text-sm font-semibold text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)] disabled:cursor-not-allowed disabled:opacity-40`}
            aria-label="Nächstes Jahr"
          >
            ›
          </button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className={finanzKpiCardClass}>
            <p className={finanzLabelMutedClass}>Einnahmen</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-emerald-400">{eur(aktuell.einnahmen)}</p>
            <p className="mt-1">vs. {jahr - 1}: <DeltaBadge wert={aktuell.einnahmen - vorjahr.einnahmen} guteRichtung="hoch" /></p>
          </div>
          <div className={finanzKpiCardClass}>
            <p className={finanzLabelMutedClass}>Ausgaben</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-rose-400">{eur(aktuell.ausgaben)}</p>
            <p className="mt-1">vs. {jahr - 1}: <DeltaBadge wert={aktuell.ausgaben - vorjahr.ausgaben} guteRichtung="runter" /></p>
          </div>
          <div className={finanzKpiCardClass}>
            <p className={finanzLabelMutedClass}>Saldo</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{eur(saldo)}</p>
            <p className="mt-1">vs. {jahr - 1}: <DeltaBadge wert={saldo - vorSaldo} guteRichtung="hoch" /></p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className={finanzKpiCardCompactClass}>
            <p className={finanzLabelMutedClass}>Ø Ausgaben / Monat</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-[var(--app-text)]">{eur(aktuell.ausgaben / monateMitDaten)}</p>
          </div>
          <div className={finanzKpiCardCompactClass}>
            <p className={finanzLabelMutedClass}>Ø Sparrate / Monat</p>
            <p className={`mt-1 text-base font-semibold tabular-nums ${saldo >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{eur(saldo / monateMitDaten)}</p>
          </div>
          <div className={finanzKpiCardCompactClass}>
            <p className={finanzLabelMutedClass}>Sparquote</p>
            <p className={`mt-1 text-base font-semibold tabular-nums ${sparquote >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {sparquote.toLocaleString('de-DE', { maximumFractionDigits: 0 })}%
            </p>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-[var(--app-text-muted)]">
          {aktuell.monate.size > 0
            ? `Basierend auf ${aktuell.monate.size} ${aktuell.monate.size === 1 ? 'Monat' : 'Monaten'} mit Buchungen.`
            : 'Für dieses Jahr liegen noch keine Buchungen vor.'}
        </p>
      </PageSectionPanel>
    </PageSection>
  )
}
