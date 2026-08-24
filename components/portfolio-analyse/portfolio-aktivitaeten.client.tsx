'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { usePortfolioAnalyse } from '@/components/portfolio-analyse/pa-data-provider'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaBadge, PaCard } from '@/components/portfolio-analyse/pa-ui'
import {
  aktivitaetenStatistik,
  buchungenZuCsv,
  filterAktivitaeten,
  gruppiereAktivitaeten,
} from '@/lib/portfolio-analyse/aktivitaeten-gruppe'
import { formatDatumDe, formatEur, formatKursEur, formatStueck } from '@/lib/portfolio-analyse/berechnung'
import { anzeigeHandelsBuchung } from '@/lib/portfolio-analyse/parqet-handelswerte'
import { anzeigeNameFuerIsin, wknFuerIsin } from '@/lib/portfolio-analyse/isin-metadata-client'
import { fundamentaldatenHref } from '@/lib/portfolio-analyse/fundamentaldaten-navigation'
import { loeschePortfolioBuchung } from '@/lib/portfolio-analyse/portfolio-analyse-db'
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
  const { buchungen, meta, hatDaten, laden, neuLaden } = usePortfolioAnalyse()
  const [typFilter, setTypFilter] = useState<BuchungsTyp | 'alle'>('alle')
  const [isinFilter, setIsinFilter] = useState<string>('alle')
  const [offenJahre, setOffenJahre] = useState<Set<number>>(() => new Set())
  const [offenMonate, setOffenMonate] = useState<Set<string>>(() => new Set())
  const [loeschenId, setLoeschenId] = useState<string | null>(null)

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

  async function buchungLoeschen(b: PortfolioDbBuchung) {
    const name = anzeigeNameFuerIsin(b.isin, b.wertpapierName, meta)
    const label = `${BUCHUNGS_TYP_LABEL[b.typ]} · ${name} · ${formatDatumDe(b.datum)} · ${formatEur(anzeigeHandelsBuchung(b).betragEur)}`
    if (
      !window.confirm(
        `Diese Buchung unwiderruflich löschen?\n\n${label}\n\nDer Bestand wird danach neu berechnet.`,
      )
    ) {
      return
    }
    setLoeschenId(b.id)
    try {
      const res = await loeschePortfolioBuchung(b.id)
      if (!res.ok) {
        toast.error(res.message ?? 'Löschen fehlgeschlagen.')
        return
      }
      toast.success('Buchung gelöscht.')
      await neuLaden()
    } finally {
      setLoeschenId(null)
    }
  }

  return (
    <PortfolioAnalyseShell
      title="Aktivitäten"
      description="Alle Buchungen nach Jahr und Monat — filterbar und als CSV exportierbar."
    >
      {!laden && !hatDaten ? null : (
        <PaCard variant="elevated" className="min-w-0 overflow-hidden p-4 sm:p-6">
            {!hatDaten ? (
              <p className="text-sm text-[var(--app-text-muted)]">
                <Link href="/portfolioanalyse/import" className="text-teal-400 hover:underline">
                  Daten importieren
                </Link>
              </p>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <p className="text-sm text-[var(--app-text-muted)]">
                    {stats.kaeufe} Käufe · {stats.verkaeufe} Verkäufe · {stats.dividenden} Dividenden
                    {stats.andere > 0 ? ` · ${stats.andere} Andere` : ''}
                  </p>
                  <button
                    type="button"
                    onClick={csvExport}
                    className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-4 py-2 text-sm text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]"
                  >
                    Export als CSV
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  <select
                    value={typFilter}
                    onChange={(e) => setTypFilter(e.target.value as BuchungsTyp | 'alle')}
                    className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)]"
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
                    className="max-w-xs rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)]"
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
                    <p className="py-8 text-center text-sm text-[var(--app-text-muted)]">Keine Buchungen für diese Filter.</p>
                  ) : (
                    gruppen.map((jahr) => (
                      <PaCard key={jahr.jahr} variant="elevated" className="overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleJahr(jahr.jahr)}
                          className="flex w-full flex-wrap items-center gap-3 border-b border-[var(--app-border)] px-4 py-3 text-left hover:bg-[var(--app-surface-hover)]/20"
                        >
                          <span className="text-lg font-semibold text-[var(--app-text)]">{jahr.jahr}</span>
                          <span className="text-xs text-[var(--app-text-muted)]">
                            {jahr.anzahl} Aktivitäten · Käufe {formatEur(jahr.kaeufeSumme)} · Verkäufe{' '}
                            {formatEur(jahr.verkaeufeSumme)} · Div. {formatEur(jahr.dividendenSumme)}
                          </span>
                          <span className="ml-auto text-[var(--app-text-muted)]">{offenJahre.has(jahr.jahr) ? '▼' : '▶'}</span>
                        </button>
                        {offenJahre.has(jahr.jahr)
                          ? jahr.monate.map((monat) => (
                              <div key={monat.key}>
                                <button
                                  type="button"
                                  onClick={() => toggleMonat(monat.key)}
                                  className="flex w-full flex-wrap items-center gap-2 border-b border-[var(--app-border)]/40 bg-[var(--app-surface-muted)]/30 px-5 py-2.5 text-left text-sm hover:bg-[var(--app-surface-hover)]/20"
                                >
                                  <span className="font-medium capitalize text-[var(--app-text)]">{monat.label}</span>
                                  <span className="text-xs text-[var(--app-text-muted)]">
                                    {monat.anzahl} · {formatEur(monat.kaeufeSumme)} /{' '}
                                    {formatEur(monat.verkaeufeSumme)} / {formatEur(monat.dividendenSumme)}
                                  </span>
                                  <span className="ml-auto text-[var(--app-text-muted)]">
                                    {offenMonate.has(monat.key) ? '▼' : '▶'}
                                  </span>
                                </button>
                                {offenMonate.has(monat.key) ? (
                                  <ul className="divide-y divide-[var(--app-border)]">
                                    {monat.buchungen.map((b) => (
                                      <AktivitaetenZeile
                                        key={b.id}
                                        b={b}
                                        meta={meta}
                                        loeschenBusy={loeschenId === b.id}
                                        onLoeschen={() => void buchungLoeschen(b)}
                                      />
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
        </PaCard>
      )}
    </PortfolioAnalyseShell>
  )
}

function AktivitaetenZeile({
  b,
  meta,
  loeschenBusy,
  onLoeschen,
}: {
  b: PortfolioDbBuchung
  meta: ReturnType<typeof usePortfolioAnalyse>['meta']
  loeschenBusy?: boolean
  onLoeschen: () => void
}) {
  const router = useRouter()
  const name = anzeigeNameFuerIsin(b.isin, b.wertpapierName, meta)
  const wkn = b.isin ? wknFuerIsin(b.isin, meta) : null
  const href =
    b.assetKlasse === 'aktie' && b.isin ? fundamentaldatenHref({ isin: b.isin }) : null
  const handel = anzeigeHandelsBuchung(b)
  const stueckAnzeige = handel.stueck > 0 ? handel.stueck : null

  return (
    <li
      className={`flex flex-wrap items-center gap-3 px-5 py-3 sm:flex-nowrap ${href ? 'hover:bg-white/[0.02]' : ''}`}
    >
      <div
        className={`flex min-w-[7rem] items-center gap-2 ${href ? 'cursor-pointer' : ''}`}
        onClick={href ? () => router.push(href) : undefined}
      >
        <PaBadge variant={badgeVariant(b.typ)}>{BUCHUNGS_TYP_LABEL[b.typ]}</PaBadge>
        <span className="text-xs tabular-nums text-[var(--app-text-muted)]">{formatDatumZeit(b.datum)}</span>
      </div>
      <div
        className={`flex min-w-0 flex-1 items-center gap-3 ${href ? 'cursor-pointer' : ''}`}
        onClick={href ? () => router.push(href) : undefined}
      >
        <PortfolioIsinLogo isin={b.isin} fallbackName={name} meta={meta} groesse="md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--app-text)]">{name}</p>
          <p className="text-[11px] text-[var(--app-text-muted)]">
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
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div
          className={`text-right ${href ? 'cursor-pointer' : ''}`}
          onClick={href ? () => router.push(href) : undefined}
        >
          <p className="text-sm font-semibold tabular-nums text-[var(--app-text)]">{formatEur(handel.betragEur)}</p>
          {stueckAnzeige != null && stueckAnzeige > 0 ? (
            <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
              <span className="rounded-full bg-[var(--app-surface-hover)] px-2 py-0.5">
                {formatStueck(stueckAnzeige)}×{' '}
                {handel.kursEur != null ? formatKursEur(handel.kursEur) : '—'}€
              </span>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={loeschenBusy}
          title="Buchung löschen"
          aria-label={`${BUCHUNGS_TYP_LABEL[b.typ]} ${name} löschen`}
          onClick={(e) => {
            e.stopPropagation()
            onLoeschen()
          }}
          className="shrink-0 rounded-lg px-2 py-1 text-[var(--app-text-muted)] hover:bg-rose-950/30 hover:text-rose-300 disabled:opacity-50"
        >
          {loeschenBusy ? '…' : '×'}
        </button>
      </div>
    </li>
  )
}
