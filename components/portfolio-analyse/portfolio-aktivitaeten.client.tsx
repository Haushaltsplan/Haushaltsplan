'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaBadge, PaCard } from '@/components/portfolio-analyse/pa-ui'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import {
  aktivitaetenStatistik,
  buchungenZuCsv,
  filterAktivitaeten,
  gruppiereAktivitaeten,
} from '@/lib/portfolio-analyse/aktivitaeten-gruppe'
import { formatDatumDe, formatEur } from '@/lib/portfolio-analyse/berechnung'
import { anzeigeNameFuerIsin, wknFuerIsin } from '@/lib/portfolio-analyse/isin-metadata-client'
import {
  ASSET_KLASSE_LABEL,
  BUCHUNGS_TYP_LABEL,
  type BuchungsTyp,
  type PortfolioDbBuchung,
} from '@/lib/portfolio-analyse/types'

function badgeVariant(typ: BuchungsTyp): 'buy' | 'sell' | 'dividend' | 'neutral' {
  if (typ === 'kauf') return 'buy'
  if (typ === 'verkauf') return 'sell'
  if (typ === 'dividende' || typ === 'zins') return 'dividend'
  return 'neutral'
}

function formatDatumZeit(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  return `${m[3]}.${m[2]}.`
}

export function PortfolioAktivitaetenClient() {
  const { buchungen, meta, hatDaten, laden } = usePortfolioAnalyse()
  const [typFilter, setTypFilter] = useState<BuchungsTyp | 'alle'>('alle')
  const [isinFilter, setIsinFilter] = useState<string>('alle')
  const [offenJahre, setOffenJahre] = useState<Set<number>>(() => new Set())
  const [offenMonate, setOffenMonate] = useState<Set<string>>(() => new Set())

  const gefiltert = useMemo(
    () => filterAktivitaeten(buchungen, { typ: typFilter, isin: isinFilter }),
    [buchungen, typFilter, isinFilter],
  )

  const stats = useMemo(() => aktivitaetenStatistik(buchungen), [buchungen])
  const gruppen = useMemo(() => gruppiereAktivitaeten(gefiltert), [gefiltert])

  const assetOptionen = useMemo(() => {
    const map = new Map<string, string>()
    for (const b of buchungen) {
      if (!b.isin) continue
      const isin = b.isin.toUpperCase()
      if (!map.has(isin)) map.set(isin, anzeigeNameFuerIsin(isin, b.wertpapierName, meta))
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'de'))
  }, [buchungen, meta])

  useEffect(() => {
    if (gruppen.length === 0) return
    setOffenJahre((prev) => (prev.size > 0 ? prev : new Set([gruppen[0].jahr])))
    const mk = gruppen[0]?.monate[0]?.key
    if (mk) setOffenMonate((prev) => (prev.size > 0 ? prev : new Set([mk])))
  }, [gruppen])

  function toggleJahr(jahr: number) {
    setOffenJahre((prev) => {
      const n = new Set(prev)
      if (n.has(jahr)) n.delete(jahr)
      else n.add(jahr)
      return n
    })
  }

  function toggleMonat(key: string) {
    setOffenMonate((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  function csvExport() {
    const blob = new Blob([buchungenZuCsv(gefiltert)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `portfolio-aktivitaeten-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PortfolioAnalyseShell
      title="Aktivitäten"
      description="Alle Buchungen nach Jahr und Monat — filterbar und als CSV exportierbar."
    >
      {!laden && !hatDaten ? null : (
        <PageSection titleId="pa-aktivitaeten-heading" title="Transaktionen">
          <PageSectionPanel>
            {!hatDaten ? (
              <p className="text-sm text-zinc-500">
                <Link href="/portfolioanalyse/import" className="text-teal-400 hover:underline">
                  Daten importieren
                </Link>
              </p>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <p className="text-sm text-zinc-500">
                    {stats.kaeufe} Käufe · {stats.verkaeufe} Verkäufe · {stats.dividenden} Dividenden
                    {stats.andere > 0 ? ` · ${stats.andere} Andere` : ''}
                  </p>
                  <button
                    type="button"
                    onClick={csvExport}
                    className="rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800/60"
                  >
                    Export als CSV
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  <select
                    value={typFilter}
                    onChange={(e) => setTypFilter(e.target.value as BuchungsTyp | 'alle')}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200"
                  >
                    <option value="alle">Alle Aktivitäten</option>
                    {(Object.keys(BUCHUNGS_TYP_LABEL) as BuchungsTyp[]).map((t) => (
                      <option key={t} value={t}>
                        {BUCHUNGS_TYP_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={isinFilter}
                    onChange={(e) => setIsinFilter(e.target.value)}
                    className="max-w-xs rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200"
                  >
                    <option value="alle">Alle Assets</option>
                    {assetOptionen.map(([isin, name]) => (
                      <option key={isin} value={isin}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  {gruppen.length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-500">Keine Buchungen für diese Filter.</p>
                  ) : (
                    gruppen.map((jahr) => (
                      <PaCard key={jahr.jahr} className="overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleJahr(jahr.jahr)}
                          className="flex w-full flex-wrap items-center gap-3 border-b border-zinc-800/60 px-4 py-3 text-left hover:bg-zinc-800/20"
                        >
                          <span className="text-lg font-semibold text-zinc-100">{jahr.jahr}</span>
                          <span className="text-xs text-zinc-500">
                            {jahr.anzahl} Aktivitäten · Käufe {formatEur(jahr.kaeufeSumme)} · Verkäufe{' '}
                            {formatEur(jahr.verkaeufeSumme)} · Div. {formatEur(jahr.dividendenSumme)}
                          </span>
                          <span className="ml-auto text-zinc-500">{offenJahre.has(jahr.jahr) ? '▼' : '▶'}</span>
                        </button>
                        {offenJahre.has(jahr.jahr)
                          ? jahr.monate.map((monat) => (
                              <div key={monat.key}>
                                <button
                                  type="button"
                                  onClick={() => toggleMonat(monat.key)}
                                  className="flex w-full flex-wrap items-center gap-2 border-b border-zinc-800/40 bg-zinc-950/30 px-5 py-2.5 text-left text-sm hover:bg-zinc-800/20"
                                >
                                  <span className="font-medium capitalize text-zinc-300">{monat.label}</span>
                                  <span className="text-xs text-zinc-500">
                                    {monat.anzahl} · {formatEur(monat.kaeufeSumme)} /{' '}
                                    {formatEur(monat.verkaeufeSumme)} / {formatEur(monat.dividendenSumme)}
                                  </span>
                                  <span className="ml-auto text-zinc-600">
                                    {offenMonate.has(monat.key) ? '▼' : '▶'}
                                  </span>
                                </button>
                                {offenMonate.has(monat.key) ? (
                                  <ul className="divide-y divide-zinc-800/40">
                                    {monat.buchungen.map((b) => (
                                      <AktivitaetenZeile key={b.id} b={b} meta={meta} />
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            ))
                          : null}
                      </PaCard>
                    ))
                  )}
                </div>
              </div>
            )}
          </PageSectionPanel>
        </PageSection>
      )}
    </PortfolioAnalyseShell>
  )
}

function AktivitaetenZeile({
  b,
  meta,
}: {
  b: PortfolioDbBuchung
  meta: ReturnType<typeof usePortfolioAnalyse>['meta']
}) {
  const name = anzeigeNameFuerIsin(b.isin, b.wertpapierName, meta)
  const wkn = b.isin ? wknFuerIsin(b.isin, meta) : null

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3 sm:flex-nowrap">
      <div className="flex min-w-[7rem] items-center gap-2">
        <PaBadge variant={badgeVariant(b.typ)}>{BUCHUNGS_TYP_LABEL[b.typ]}</PaBadge>
        <span className="text-xs tabular-nums text-zinc-500">{formatDatumZeit(b.datum)}</span>
      </div>
      <PortfolioIsinLogo isin={b.isin} fallbackName={name} meta={meta} groesse="md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-100">{name}</p>
        <p className="text-[11px] text-zinc-500">
          {ASSET_KLASSE_LABEL[b.assetKlasse]}
          {b.isin ? (
            <>
              {' '}
              · <span className="font-mono">{b.isin}</span>
              {wkn ? ` · WKN ${wkn}` : ''}
            </>
          ) : null}
        </p>
      </div>
      <div className="ml-auto text-right">
        <p className="text-sm font-semibold tabular-nums text-zinc-100">{formatEur(b.betragEur)}</p>
        {b.stueck != null && b.stueck > 0 ? (
          <p className="mt-0.5 text-[11px] text-zinc-500">
            <span className="rounded-full bg-zinc-800/80 px-2 py-0.5">
              {b.stueck.toLocaleString('de-DE', { maximumFractionDigits: 4 })}×{' '}
              {b.kursEur != null
                ? b.kursEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '—'}
              €
            </span>
          </p>
        ) : null}
      </div>
    </li>
  )
}
