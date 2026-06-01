'use client'

import { useEffect, useMemo, useState } from 'react'
import { DonutChart } from '@/components/finanzen/donut-chart'
import {
  PaCashflowBalken,
  PaChartKarte,
  PaHorizontalBalken,
  PaLinienChart,
  PaMonatsBalken,
} from '@/components/portfolio-analyse/charts'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import {
  assetKlassenDonut,
  buchungsTypDonut,
  cashflowProMonat,
  dividendenKalender,
  dividendenProMonat,
  einzahlungenKumuliert,
  kaeufeVerkaeufeProMonat,
  konzentrationTop5,
  personalDividendenRendite,
  positionenAngereichern,
  positionenDonutTop10,
  sammleIsins,
  vermoegensverlauf,
} from '@/lib/portfolio-analyse/auswertungen'
import {
  berechneKennzahlen,
  formatDatumDe,
  formatEur,
  formatProzent,
  sortiereBuchungenNeuesteZuerst,
} from '@/lib/portfolio-analyse/berechnung'
import type { IsinMetadata } from '@/lib/portfolio-analyse/isin-lookup-server'
import { anzeigeNameFuerIsin, ladeIsinMetadaten } from '@/lib/portfolio-analyse/isin-metadata-client'
import type { PortfolioDbBuchung, PortfolioDbSnapshot } from '@/lib/portfolio-analyse/types'
import { ASSET_KLASSE_LABEL, BUCHUNGS_TYP_LABEL } from '@/lib/portfolio-analyse/types'

type TabId = 'dashboard' | 'performance' | 'cashflow' | 'dividenden' | 'allokation' | 'buchungen'

const TABS: { id: TabId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'performance', label: 'Performance' },
  { id: 'cashflow', label: 'Cashflow' },
  { id: 'dividenden', label: 'Dividenden' },
  { id: 'allokation', label: 'Allokation' },
  { id: 'buchungen', label: 'Buchungen' },
]

function KennzahlKarte({ label, wert, sub }: { label: string; wert: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-white">{wert}</p>
      {sub ? <p className="mt-0.5 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  )
}

export function PortfolioAnalyseDashboard({
  buchungen,
  snapshot,
}: {
  buchungen: PortfolioDbBuchung[]
  snapshot: PortfolioDbSnapshot | null
}) {
  const [tab, setTab] = useState<TabId>('dashboard')
  const [meta, setMeta] = useState<Map<string, IsinMetadata>>(new Map())
  const [metaLaden, setMetaLaden] = useState(false)

  const isins = useMemo(() => sammleIsins(buchungen, snapshot), [buchungen, snapshot])
  const kennzahlen = useMemo(() => berechneKennzahlen(buchungen, snapshot), [buchungen, snapshot])
  const positionenRaw = snapshot?.positionen ?? []

  useEffect(() => {
    if (isins.length === 0) return
    let cancelled = false
    setMetaLaden(true)
    void ladeIsinMetadaten(isins).then((m) => {
      if (!cancelled) {
        setMeta(m)
        setMetaLaden(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [isins.join('|')])

  const positionen = useMemo(
    () => positionenAngereichern(positionenRaw, buchungen, meta, kennzahlen.depotwertEur),
    [positionenRaw, buchungen, meta, kennzahlen.depotwertEur],
  )

  const verlauf = useMemo(() => vermoegensverlauf(buchungen, snapshot), [buchungen, snapshot])
  const cashflowMonat = useMemo(() => cashflowProMonat(buchungen), [buchungen])
  const dividendenMonat = useMemo(() => dividendenProMonat(buchungen), [buchungen])
  const handelMonat = useMemo(() => kaeufeVerkaeufeProMonat(buchungen), [buchungen])
  const einzahlKum = useMemo(() => einzahlungenKumuliert(buchungen), [buchungen])
  const divKalender = useMemo(() => dividendenKalender(buchungen), [buchungen])
  const buchungenSortiert = useMemo(() => sortiereBuchungenNeuesteZuerst(buchungen).slice(0, 100), [buchungen])

  const jahreSpanne = useMemo(() => {
    if (buchungen.length === 0) return 1
    const min = buchungen.reduce((a, b) => (a.datum < b.datum ? a : b)).datum
    const max = buchungen.reduce((a, b) => (a.datum > b.datum ? a : b)).datum
    const y1 = Number(min.slice(0, 4))
    const y2 = Number(max.slice(0, 4))
    return Math.max(1, y2 - y1 + (Number(max.slice(5, 7)) - Number(min.slice(5, 7))) / 12)
  }, [buchungen])

  const divRendite = personalDividendenRendite(
    kennzahlen.dividendenEur + kennzahlen.zinsenEur,
    kennzahlen.depotwertEur,
    jahreSpanne,
  )

  const vermoegenSerie = useMemo(
    () => [
      {
        key: 'gesamt',
        label: 'Geschätztes Vermögen',
        farbe: '#22d3ee',
        punkte: verlauf.map((p) => ({ label: p.label, wert: p.geschaetztGesamt })),
      },
      {
        key: 'ein',
        label: 'Netto eingezahlt',
        farbe: '#6366f1',
        punkte: einzahlKum.map((p) => ({ label: p.label, wert: p.wert })),
      },
    ],
    [verlauf, einzahlKum],
  )

  return (
    <div className="space-y-6">
      {metaLaden ? (
        <p className="text-xs text-teal-500/80">Wertpapiernamen und Logos werden geladen …</p>
      ) : null}

      <div className="flex flex-wrap gap-1 rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === t.id
                ? 'bg-teal-950/60 text-teal-100 ring-1 ring-teal-500/30'
                : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <KennzahlKarte label="Depotwert" wert={formatEur(kennzahlen.depotwertEur)} />
            <KennzahlKarte label="Investiert" wert={formatEur(kennzahlen.investiertEur)} />
            <KennzahlKarte
              label="Gewinn / Verlust"
              wert={formatEur(kennzahlen.gewinnVerlustEur)}
              sub={formatProzent(kennzahlen.gewinnVerlustProzent)}
            />
            <KennzahlKarte label="Dividenden + Zinsen" wert={formatEur(kennzahlen.dividendenEur + kennzahlen.zinsenEur)} />
            <KennzahlKarte label="Einzahlungen" wert={formatEur(kennzahlen.einzahlungenEur)} />
            <KennzahlKarte label="Auszahlungen" wert={formatEur(kennzahlen.auszahlungenEur)} />
            <KennzahlKarte label="Positionen" wert={String(kennzahlen.anzahlPositionen)} />
            <KennzahlKarte
              label="Div.-Rendite p.a. (geschätzt)"
              wert={divRendite != null ? formatProzent(divRendite) : '—'}
              sub="auf Basis erfasster Erträge"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <PaChartKarte titel="Vermögensentwicklung" hint="Letzter Punkt = Depotwert aus Import, davor Kostenbasis + Cash">
              <PaLinienChart serien={vermoegenSerie} />
            </PaChartKarte>
            <PaChartKarte titel="Cashflow je Monat">
              <PaCashflowBalken daten={cashflowMonat} />
            </PaChartKarte>
          </div>

          {positionen.length > 0 ? (
            <PaChartKarte titel="Top-Positionen" hint="Mit Logo und Gewinn/Verlust zum Einstand">
              <div className="overflow-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="text-zinc-500">
                    <tr>
                      <th className="pb-2 pr-2" />
                      <th className="pb-2 pr-2">Wertpapier</th>
                      <th className="pb-2 pr-2 text-right">Anteil</th>
                      <th className="pb-2 pr-2 text-right">Wert</th>
                      <th className="pb-2 text-right">G/V</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positionen.slice(0, 12).map((p) => (
                      <tr key={p.isin ?? p.anzeigeName} className="border-t border-zinc-800/60">
                        <td className="py-2 pr-2">
                          <PortfolioIsinLogo isin={p.isin} fallbackName={p.name} meta={meta} groesse="sm" />
                        </td>
                        <td className="max-w-[200px] py-2 pr-2">
                          <p className="truncate font-medium text-zinc-200">{p.anzeigeName}</p>
                          {p.isin ? <p className="font-mono text-[10px] text-zinc-600">{p.isin}</p> : null}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums text-zinc-400">{p.gewichtProzent.toFixed(1)} %</td>
                        <td className="py-2 pr-2 text-right tabular-nums text-zinc-100">{formatEur(p.wertEur)}</td>
                        <td className="py-2 text-right tabular-nums">
                          {p.gewinnVerlustEur != null ? (
                            <span className={p.gewinnVerlustEur >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {formatEur(p.gewinnVerlustEur)}
                              {p.gewinnVerlustProzent != null ? ` (${formatProzent(p.gewinnVerlustProzent)})` : ''}
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PaChartKarte>
          ) : null}
        </div>
      )}

      {tab === 'performance' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PaChartKarte titel="Vermögensverlauf" hint="Geschätzt aus Buchungen; Marktwert am Ende wenn Snapshot vorhanden">
            <PaLinienChart
              serien={[
                {
                  key: 'wp',
                  label: 'Wertpapiere (Einstand)',
                  farbe: '#a78bfa',
                  punkte: verlauf.map((p) => ({ label: p.label, wert: p.wertpapiereKosten })),
                },
                {
                  key: 'cash',
                  label: 'Cash (Saldo)',
                  farbe: '#34d399',
                  punkte: verlauf.map((p) => ({ label: p.label, wert: p.cash })),
                },
                {
                  key: 'ges',
                  label: 'Gesamt',
                  farbe: '#22d3ee',
                  punkte: verlauf.map((p) => ({ label: p.label, wert: p.geschaetztGesamt })),
                },
              ]}
            />
          </PaChartKarte>
          <PaChartKarte titel="Käufe vs. Verkäufe je Monat">
            <PaCashflowBalken
              daten={handelMonat.map((d) => ({
                label: d.label,
                eingang: d.verkaeufe,
                ausgang: d.kaeufe,
              }))}
            />
          </PaChartKarte>
          <PaChartKarte titel="Kumulierte Netto-Einzahlungen" className="lg:col-span-2">
            <PaLinienChart
              serien={[
                {
                  key: 'netto',
                  label: 'Einzahlungen − Auszahlungen',
                  farbe: '#6366f1',
                  punkte: einzahlKum.map((p) => ({ label: p.label, wert: p.wert })),
                },
              ]}
            />
          </PaChartKarte>
        </div>
      )}

      {tab === 'cashflow' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PaChartKarte titel="Geldfluss je Monat" hint="Grün = Eingänge (Einzahlung, Verkauf, Dividende, Zins)">
            <PaCashflowBalken daten={cashflowMonat} />
          </PaChartKarte>
          <PaChartKarte titel="Buchungen nach Typ">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <DonutChart segmente={buchungsTypDonut(buchungen)} groesse={150} />
              <ul className="space-y-1 text-xs text-zinc-400">
                {buchungsTypDonut(buchungen).map((s) => (
                  <li key={s.key} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.farbe }} />
                    {s.label}: {formatEur(s.betrag)}
                  </li>
                ))}
              </ul>
            </div>
          </PaChartKarte>
        </div>
      )}

      {tab === 'dividenden' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PaChartKarte titel="Dividenden & Zinsen je Monat">
            <PaMonatsBalken daten={dividendenMonat.map((d) => ({ label: d.label, wert: d.wert }))} farbe="#34d399" />
          </PaChartKarte>
          <PaChartKarte titel="Kennzahlen Erträge">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                <dt className="text-zinc-500">Dividenden gesamt</dt>
                <dd className="tabular-nums text-zinc-100">{formatEur(kennzahlen.dividendenEur)}</dd>
              </div>
              <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                <dt className="text-zinc-500">Zinsen gesamt</dt>
                <dd className="tabular-nums text-zinc-100">{formatEur(kennzahlen.zinsenEur)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Geschätzte Rendite p.a.</dt>
                <dd className="tabular-nums text-teal-300">{divRendite != null ? formatProzent(divRendite) : '—'}</dd>
              </div>
            </dl>
          </PaChartKarte>
          <PaChartKarte titel="Letzte Dividenden" hint="Aus deinen importierten Buchungen" className="lg:col-span-2">
            <ul className="divide-y divide-zinc-800/60">
              {divKalender.length === 0 ? (
                <li className="py-4 text-center text-xs text-zinc-600">Noch keine Dividenden erfasst.</li>
              ) : (
                divKalender.map((d) => (
                  <li key={`${d.datum}-${d.isin}`} className="flex items-center gap-3 py-2">
                    <PortfolioIsinLogo isin={d.isin} fallbackName={d.name} meta={meta} groesse="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">
                        {anzeigeNameFuerIsin(d.isin, d.name, meta)}
                      </p>
                      <p className="text-[10px] text-zinc-500">{formatDatumDe(d.datum)}</p>
                    </div>
                    <span className="tabular-nums text-sm text-emerald-400">{formatEur(d.betrag)}</span>
                  </li>
                ))
              )}
            </ul>
          </PaChartKarte>
        </div>
      )}

      {tab === 'allokation' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <PaChartKarte titel="Nach Anlageklasse">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <DonutChart segmente={assetKlassenDonut(positionenRaw)} groesse={160} />
              <ul className="space-y-1 text-xs text-zinc-400">
                {assetKlassenDonut(positionenRaw).map((s) => (
                  <li key={s.key} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.farbe }} />
                    {s.label}: {formatEur(s.betrag)}
                  </li>
                ))}
              </ul>
            </div>
          </PaChartKarte>
          <PaChartKarte titel="Top 10 Positionen">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <DonutChart segmente={positionenDonutTop10(positionen)} groesse={160} />
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-zinc-400">
                {positionenDonutTop10(positionen).map((s) => (
                  <li key={s.key} className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.farbe }} />
                    <span className="truncate">{s.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </PaChartKarte>
          <PaChartKarte titel="Konzentration Top 5" hint="Gewicht am Depotwert" className="lg:col-span-2">
            <PaHorizontalBalken
              daten={konzentrationTop5(positionen).map((t) => ({
                label: t.label,
                wert: t.wert,
                farbe: t.farbe,
              }))}
            />
          </PaChartKarte>
          {positionen.length > 0 ? (
            <PaChartKarte titel="Alle Positionen" className="lg:col-span-2">
              <div className="overflow-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="text-zinc-500">
                    <tr>
                      <th className="pb-2" />
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Klasse</th>
                      <th className="pb-2 text-right">Stück</th>
                      <th className="pb-2 text-right">Kurs</th>
                      <th className="pb-2 text-right">Wert</th>
                      <th className="pb-2 text-right">Gewicht</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positionen.map((p) => (
                      <tr key={p.isin ?? p.anzeigeName} className="border-t border-zinc-800/60">
                        <td className="py-2 pr-2">
                          <PortfolioIsinLogo isin={p.isin} fallbackName={p.name} meta={meta} groesse="sm" />
                        </td>
                        <td className="max-w-[180px] py-2 pr-2">
                          <p className="truncate font-medium text-zinc-200">{p.anzeigeName}</p>
                          <p className="font-mono text-[10px] text-zinc-600">{p.isin ?? '—'}</p>
                        </td>
                        <td className="py-2 text-zinc-400">{ASSET_KLASSE_LABEL[p.assetKlasse]}</td>
                        <td className="py-2 text-right tabular-nums text-zinc-300">
                          {p.stueck.toLocaleString('de-DE', { maximumFractionDigits: 4 })}
                        </td>
                        <td className="py-2 text-right tabular-nums text-zinc-400">
                          {p.kursEur != null ? formatEur(p.kursEur) : '—'}
                        </td>
                        <td className="py-2 text-right tabular-nums font-medium text-zinc-100">{formatEur(p.wertEur)}</td>
                        <td className="py-2 text-right tabular-nums text-zinc-400">{p.gewichtProzent.toFixed(1)} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PaChartKarte>
          ) : (
            <p className="text-sm text-zinc-500 lg:col-span-2">
              Kein Depot-Snapshot — importiere ein PDF mit Positionen oder nutze die Buchungsauswertung.
            </p>
          )}
        </div>
      )}

      {tab === 'buchungen' && (
        <PaChartKarte titel="Transaktionen" hint={`${buchungen.length} Buchungen gesamt, ${buchungenSortiert.length} angezeigt`}>
          <div className="max-h-[32rem] overflow-auto rounded-xl border border-zinc-800/80">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                <tr>
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2">Datum</th>
                  <th className="px-3 py-2">Typ</th>
                  <th className="px-3 py-2">Wertpapier</th>
                  <th className="px-3 py-2 text-right">Stück</th>
                  <th className="px-3 py-2 text-right">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {buchungenSortiert.map((b) => (
                  <tr key={b.id} className="border-t border-zinc-800/60">
                    <td className="px-3 py-1.5">
                      <PortfolioIsinLogo isin={b.isin} fallbackName={b.wertpapierName} meta={meta} groesse="sm" />
                    </td>
                    <td className="px-3 py-1.5 tabular-nums text-zinc-400">{formatDatumDe(b.datum)}</td>
                    <td className="px-3 py-1.5 text-zinc-300">{BUCHUNGS_TYP_LABEL[b.typ]}</td>
                    <td className="max-w-[200px] px-3 py-1.5">
                      <p className="truncate text-zinc-200">
                        {anzeigeNameFuerIsin(b.isin, b.wertpapierName, meta)}
                      </p>
                      {b.isin ? <p className="font-mono text-[10px] text-zinc-600">{b.isin}</p> : null}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-zinc-400">
                      {b.stueck != null ? b.stueck.toLocaleString('de-DE', { maximumFractionDigits: 6 }) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-zinc-100">{formatEur(b.betragEur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PaChartKarte>
      )}
    </div>
  )
}
