'use client'

import { useEffect, useMemo, useState } from 'react'
import { DonutChart } from '@/components/finanzen/donut-chart'
import { PaAreaChart } from '@/components/portfolio-analyse/parqet-charts'
import { PortfolioIsinLogo } from '@/components/portfolio-analyse/isin-logo'
import { positionenFuerBewertung } from '@/lib/portfolio-analyse/bestand'
import { dividendenProMonat, sammleIsins } from '@/lib/portfolio-analyse/auswertungen'
import { formatDatumDe, formatEur, formatProzent, sortiereBuchungenNeuesteZuerst } from '@/lib/portfolio-analyse/berechnung'
import {
  berechneLivePortfolio,
  ladeLiveKurseClient,
  symboleAusMeta,
} from '@/lib/portfolio-analyse/live-bewertung'
import { anzeigeNameFuerIsin, ladeIsinMetadaten, wknFuerIsin } from '@/lib/portfolio-analyse/isin-metadata-client'
import type { PortfolioDbBuchung, PortfolioDbSnapshot } from '@/lib/portfolio-analyse/types'
import { ASSET_KLASSE_FARBE, ASSET_KLASSE_LABEL, BUCHUNGS_TYP_LABEL } from '@/lib/portfolio-analyse/types'
import type { DonutSegment } from '@/components/finanzen/donut-chart'

type Sektion = 'uebersicht' | 'dividenden' | 'transaktionen'

const SEKTIONEN: { id: Sektion; label: string }[] = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'dividenden', label: 'Dividenden' },
  { id: 'transaktionen', label: 'Transaktionen' },
]

function pctClass(n: number | null) {
  if (n == null) return 'text-zinc-500'
  if (n > 0) return 'text-emerald-400'
  if (n < 0) return 'text-rose-400'
  return 'text-zinc-400'
}

export function PortfolioAnalyseDashboard({
  buchungen,
  snapshot,
}: {
  buchungen: PortfolioDbBuchung[]
  snapshot: PortfolioDbSnapshot | null
}) {
  const [sektion, setSektion] = useState<Sektion>('uebersicht')
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof ladeIsinMetadaten>>>(new Map())
  const [laden, setLaden] = useState(true)
  const [kursFehler, setKursFehler] = useState(false)

  const isins = useMemo(() => sammleIsins(buchungen, snapshot), [buchungen, snapshot])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLaden(true)
      setKursFehler(false)
      const m = isins.length > 0 ? await ladeIsinMetadaten(isins) : new Map()
      if (cancelled) return
      setMeta(m)
      setLaden(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [isins.join('|')])

  const [live, setLive] = useState<ReturnType<typeof berechneLivePortfolio> | null>(null)

  useEffect(() => {
    if (buchungen.length === 0) {
      setLive(null)
      return
    }
    let cancelled = false
    async function run() {
      const sym = symboleAusMeta(positionenFuerBewertung(buchungen, snapshot), meta)
      const { kurse, stand, fx } = await ladeLiveKurseClient(sym)
      if (cancelled) return
      if (sym.length > 0 && kurse.size === 0) setKursFehler(true)
      setLive(berechneLivePortfolio(buchungen, snapshot, meta, kurse, stand, fx))
    }
    void run()
    const t = setInterval(() => void run(), 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [buchungen, snapshot, meta])

  const k = live?.kennzahlen
  const positionen = live?.positionen ?? []
  const verlauf = live?.verlauf ?? []

  const allokation: DonutSegment[] = useMemo(() => {
    const summen = new Map<string, number>()
    for (const p of positionen) {
      summen.set(p.assetKlasse, (summen.get(p.assetKlasse) ?? 0) + p.wertLiveEur)
    }
    return [...summen.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([klasse, betrag]) => ({
        key: klasse,
        label: ASSET_KLASSE_LABEL[klasse as keyof typeof ASSET_KLASSE_LABEL],
        farbe: ASSET_KLASSE_FARBE[klasse as keyof typeof ASSET_KLASSE_FARBE],
        betrag: Math.round(betrag * 100) / 100,
      }))
  }, [positionen])

  const divMonat = useMemo(() => dividendenProMonat(buchungen), [buchungen])
  const buchungenListe = useMemo(() => sortiereBuchungenNeuesteZuerst(buchungen).slice(0, 120), [buchungen])

  if (laden && !live) {
    return <p className="py-16 text-center text-sm text-zinc-500">Portfolio wird geladen …</p>
  }

  return (
    <div className="space-y-0">
      <nav className="-mx-1 flex gap-6 border-b border-zinc-800/80 px-1">
        {SEKTIONEN.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSektion(s.id)}
            className={`border-b-2 pb-2.5 text-sm font-medium transition ${
              sektion === s.id
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {sektion === 'uebersicht' && (
        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-6 sm:p-8">
            <p className="text-sm font-medium text-zinc-400">Gesamtwert</p>
            <div className="mt-1 flex flex-wrap items-end gap-3">
              <p className="text-4xl font-semibold tabular-nums tracking-tight text-white sm:text-5xl">
                {k ? formatEur(k.depotwertEur) : '—'}
              </p>
              {k?.gewinnVerlustProzent != null ? (
                <span
                  className={`mb-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium tabular-nums ${pctClass(k.gewinnVerlustProzent)} bg-zinc-800/80`}
                >
                  {formatProzent(k.gewinnVerlustProzent)}
                </span>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-500">
              <span>
                Wertpapiere: <strong className="font-medium text-zinc-300">{k ? formatEur(k.wertpapiereEur) : '—'}</strong>
              </span>
              <span>
                Cash: <strong className="font-medium text-zinc-300">{k ? formatEur(k.cashEur) : '—'}</strong>
              </span>
              <span>
                Einstand offen: <strong className="font-medium text-zinc-300">{k ? formatEur(k.einstandOffenEur) : '—'}</strong>
              </span>
            </div>
            {k?.kurseQuelle === 'live' && k.kurseStand ? (
              <p className="mt-2 text-[11px] text-zinc-600">
                Kurse live (Yahoo) · Stand {new Date(k.kurseStand).toLocaleString('de-DE')}
              </p>
            ) : kursFehler ? (
              <p className="mt-2 text-[11px] text-amber-500/90">
                Live-Kurse nicht verfügbar — Werte aus Einstand/Snapshot (Einstand kann vom Marktwert abweichen).
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-zinc-600">Bewertung aus Buchungs-Einstand (kein Live-Kurs).</p>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/20 p-4 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-zinc-200">Entwicklung</h2>
            <PaAreaChart punkte={verlauf} />
          </section>

          <div className="grid gap-6 lg:grid-cols-5">
            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/20 lg:col-span-3">
              <div className="border-b border-zinc-800/60 px-4 py-3 sm:px-5">
                <h2 className="text-sm font-semibold text-zinc-200">Bestand</h2>
                <p className="text-[11px] text-zinc-500">{positionen.length} Positionen</p>
              </div>
              <ul className="max-h-[28rem] divide-y divide-zinc-800/50 overflow-y-auto">
                {positionen.length === 0 ? (
                  <li className="px-5 py-10 text-center text-sm text-zinc-500">Keine offenen Positionen aus Buchungen.</li>
                ) : (
                  positionen.map((p) => (
                    <li key={p.isin ?? p.name} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <PortfolioIsinLogo isin={p.isin} fallbackName={p.name} meta={meta} groesse="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-100">{p.anzeigeName}</p>
                        <p className="text-[11px] text-zinc-500">
                          {p.isin ? (
                            <span className="font-mono text-zinc-600">{p.isin}</span>
                          ) : null}
                          {p.wkn ? (
                            <>
                              {p.isin ? ' · ' : null}
                              <span>WKN {p.wkn}</span>
                            </>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {p.stueck.toLocaleString('de-DE', { maximumFractionDigits: 4 })} Stk
                          {p.kursLiveEur != null
                            ? ` · ${p.kursLiveEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                            : ''}{' '}
                          · {p.gewichtProzent.toFixed(1)} %
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums text-zinc-100">{formatEur(p.wertLiveEur)}</p>
                        <p
                          className={`text-xs tabular-nums ${
                            p.hatLiveKurs ? pctClass(p.gewinnVerlustProzent) : 'text-zinc-600'
                          }`}
                        >
                          {p.hatLiveKurs
                            ? p.gewinnVerlustProzent != null
                              ? formatProzent(p.gewinnVerlustProzent)
                              : '—'
                            : 'Einstand'}
                        </p>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-2xl border border-zinc-800/60 bg-zinc-900/20 p-5 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold text-zinc-200">Allokation</h2>
              <div className="flex flex-col items-center gap-4">
                <DonutChart segmente={allokation} groesse={168} dicke={24} />
                <ul className="w-full space-y-2 text-xs">
                  {allokation.map((s) => (
                    <li key={s.key} className="flex justify-between gap-2">
                      <span className="flex items-center gap-2 text-zinc-400">
                        <span className="h-2 w-2 rounded-full" style={{ background: s.farbe }} />
                        {s.label}
                      </span>
                      <span className="tabular-nums text-zinc-300">{formatEur(s.betrag)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <dl className="mt-6 space-y-2 border-t border-zinc-800/60 pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Dividenden</dt>
                  <dd className="tabular-nums text-zinc-200">{k ? formatEur(k.dividendenEur) : '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Eingezahlt netto</dt>
                  <dd className="tabular-nums text-zinc-200">
                    {k ? formatEur(k.einzahlungenEur - k.auszahlungenEur) : '—'}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      )}

      {sektion === 'dividenden' && (
        <div className="mt-6 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 p-5">
          <h2 className="text-sm font-semibold text-zinc-200">Dividenden & Zinsen</h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
            {k ? formatEur(k.dividendenEur + k.zinsenEur) : '—'}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {divMonat.map((d) => (
              <div
                key={d.monat}
                className="flex min-w-[4.5rem] flex-col items-center rounded-lg bg-zinc-800/40 px-2 py-2"
                title={formatEur(d.wert)}
              >
                <div
                  className="w-8 rounded-t bg-emerald-500/80"
                  style={{ height: `${Math.max(4, Math.min(64, (d.wert / Math.max(1, ...divMonat.map((x) => x.wert))) * 64))}px` }}
                />
                <span className="mt-1 text-[9px] text-zinc-500">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sektion === 'transaktionen' && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/20">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-900/80 text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2.5" />
                <th className="px-4 py-2.5">Datum</th>
                <th className="px-4 py-2.5">Typ</th>
                <th className="px-4 py-2.5">Wertpapier</th>
                <th className="px-4 py-2.5 text-right">Betrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {buchungenListe.map((b) => (
                <tr key={b.id} className="hover:bg-zinc-800/20">
                  <td className="px-4 py-2">
                    <PortfolioIsinLogo isin={b.isin} fallbackName={b.wertpapierName} meta={meta} groesse="sm" />
                  </td>
                  <td className="px-4 py-2 tabular-nums text-zinc-400">{formatDatumDe(b.datum)}</td>
                  <td className="px-4 py-2 text-zinc-300">{BUCHUNGS_TYP_LABEL[b.typ]}</td>
                  <td className="max-w-[240px] px-4 py-2 text-zinc-200">
                    <p className="truncate">{anzeigeNameFuerIsin(b.isin, b.wertpapierName, meta)}</p>
                    {b.isin ? (
                      <p className="truncate font-mono text-[10px] text-zinc-500">
                        {b.isin}
                        {wknFuerIsin(b.isin, meta) ? ` · WKN ${wknFuerIsin(b.isin, meta)}` : ''}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-100">{formatEur(b.betragEur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
