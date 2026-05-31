'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import { DonutChart } from '@/components/finanzen/donut-chart'
import { BalkenChart, type MonatsBalken } from '@/components/finanzen/balken-chart'
import { summiereNachKategorie, effektiveKategorie } from '@/lib/finanz-kategorisierung'

type Buchung = {
  kategorie?: string | null
  beschreibung?: string | null
  betrag?: number | string | null
  datum?: string | null
  kategorie_key?: string | null
}

type DonutModus = 'ausgaben' | 'einnahmen'

type AnalyseSegment = {
  key: string
  label: string
  farbe: string
  betrag: number
  anteil: number
  rows: Buchung[]
}

/** Farbpalette für Einnahmequellen (Donut nach Quelle). */
const EINNAHMEN_PALETTE = ['#34d399', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c', '#4ade80']

function nachDatumAbsteigend(a: Buchung, b: Buchung) {
  return new Date(String(b.datum ?? '')).getTime() - new Date(String(a.datum ?? '')).getTime()
}

function monatsKey(iso?: string | null): string | null {
  if (!iso) return null
  const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-\d{2}$/)
  if (m) return `${m[1]}-${m[2]}`
  const d = new Date(String(iso))
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monatLabelKurz(yyyymm: string): string {
  const [y, mo] = yyyymm.split('-').map((x) => Number.parseInt(x, 10))
  try {
    return new Date(y, mo - 1, 1).toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')
  } catch {
    return yyyymm
  }
}

function monatVerschieben(yyyymm: string, delta: number): string {
  const [y, mo] = yyyymm.split('-').map((x) => Number.parseInt(x, 10))
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatDatumKurz(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(String(iso))
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

/** „Grund“ aus der Beschreibung für die Detailanzeige (ohne Systemtext). */
function detailNotiz(beschreibung?: string | null): string {
  const b = String(beschreibung ?? '')
  if (/dauerauftrag \(auto\)/i.test(b)) return 'Dauerauftrag'
  if (/monatsplan/i.test(b)) return 'geplant'
  const m = b.match(/grund:\s*([^•]+)/i)
  return (m ? m[1] : b).trim()
}

export function AnalyseSection({
  einnahmen,
  ausgaben,
  einnahmenAnsicht,
  ausgabenAnsicht,
  ansichtMonat,
  geplanteEinnahmen,
  geplanteAusgaben,
}: {
  einnahmen: Buchung[]
  ausgaben: Buchung[]
  einnahmenAnsicht: Buchung[]
  ausgabenAnsicht: Buchung[]
  ansichtMonat: string
  geplanteEinnahmen: number
  geplanteAusgaben: number
}) {
  const gesEin = useMemo(
    () => einnahmenAnsicht.reduce((a, r) => a + (Number.isFinite(Number(r.betrag)) ? Number(r.betrag) : 0), 0),
    [einnahmenAnsicht],
  )
  const gesAus = useMemo(
    () => ausgabenAnsicht.reduce((a, r) => a + (Number.isFinite(Number(r.betrag)) ? Number(r.betrag) : 0), 0),
    [ausgabenAnsicht],
  )

  const [donutModus, setDonutModus] = useState<DonutModus>('ausgaben')
  const [offenerKey, setOffenerKey] = useState<string | null>(null)

  // Beim Monats- oder Moduswechsel die aufgeklappte Position zurücksetzen.
  useEffect(() => {
    setOffenerKey(null)
  }, [ansichtMonat, donutModus])

  // Ausgaben: Segmente nach Oberkategorie (inkl. manueller Korrektur).
  const ausgabenSegmente = useMemo<AnalyseSegment[]>(() => {
    const summen = summiereNachKategorie(ausgabenAnsicht, false)
    const rowsByKey = new Map<string, Buchung[]>()
    for (const r of ausgabenAnsicht) {
      const key = effektiveKategorie(r, false)
      const arr = rowsByKey.get(key) ?? []
      arr.push(r)
      rowsByKey.set(key, arr)
    }
    for (const [, arr] of rowsByKey) arr.sort(nachDatumAbsteigend)
    return summen.map((s) => ({
      key: s.key,
      label: s.label,
      farbe: s.farbe,
      betrag: s.betrag,
      anteil: s.anteil,
      rows: rowsByKey.get(s.key) ?? [],
    }))
  }, [ausgabenAnsicht])

  // Einnahmen: Segmente nach Quelle (Top 8 + „Sonstige“).
  const einnahmenSegmente = useMemo<AnalyseSegment[]>(() => {
    const m = new Map<string, Buchung[]>()
    for (const r of einnahmenAnsicht) {
      const name = String(r.kategorie ?? '').trim() || 'Ohne Angabe'
      const arr = m.get(name) ?? []
      arr.push(r)
      m.set(name, arr)
    }
    const eintraege = [...m.entries()]
      .map(([name, rows]) => ({
        name,
        rows: [...rows].sort(nachDatumAbsteigend),
        betrag: rows.reduce((a, b) => a + (Number(b.betrag) || 0), 0),
      }))
      .sort((a, b) => b.betrag - a.betrag)
    const gesamt = eintraege.reduce((a, e) => a + e.betrag, 0)
    const top = eintraege.slice(0, 8)
    const rest = eintraege.slice(8)
    const segmente: AnalyseSegment[] = top.map((e, i) => ({
      key: `quelle:${e.name}`,
      label: e.name,
      farbe: EINNAHMEN_PALETTE[i % EINNAHMEN_PALETTE.length],
      betrag: e.betrag,
      anteil: gesamt > 0 ? e.betrag / gesamt : 0,
      rows: e.rows,
    }))
    if (rest.length > 0) {
      const restBetrag = rest.reduce((a, e) => a + e.betrag, 0)
      segmente.push({
        key: 'quelle:__rest',
        label: 'Sonstige',
        farbe: '#64748b',
        betrag: restBetrag,
        anteil: gesamt > 0 ? restBetrag / gesamt : 0,
        rows: rest.flatMap((e) => e.rows).sort(nachDatumAbsteigend),
      })
    }
    return segmente
  }, [einnahmenAnsicht])

  const istAusgaben = donutModus === 'ausgaben'
  const aktiveSegmente = istAusgaben ? ausgabenSegmente : einnahmenSegmente
  const offenesSegment = offenerKey ? aktiveSegmente.find((s) => s.key === offenerKey) ?? null : null

  const monatsReihe = useMemo<MonatsBalken[]>(() => {
    const keys: string[] = []
    for (let i = 11; i >= 0; i--) keys.push(monatVerschieben(ansichtMonat, -i))
    const einMap: Record<string, number> = {}
    const ausMap: Record<string, number> = {}
    for (const r of einnahmen) {
      const k = monatsKey(r.datum)
      if (k) einMap[k] = (einMap[k] || 0) + (Number.isFinite(Number(r.betrag)) ? Number(r.betrag) : 0)
    }
    for (const r of ausgaben) {
      const k = monatsKey(r.datum)
      if (k) ausMap[k] = (ausMap[k] || 0) + (Number.isFinite(Number(r.betrag)) ? Number(r.betrag) : 0)
    }
    return keys.map((k) => ({
      monat: k,
      label: monatLabelKurz(k),
      einnahmen: Math.round((einMap[k] || 0) * 100) / 100,
      ausgaben: Math.round((ausMap[k] || 0) * 100) / 100,
    }))
  }, [einnahmen, ausgaben, ansichtMonat])

  const sparquote = gesEin > 0 ? (gesEin - gesAus) / gesEin : 0
  const groessteKategorie = ausgabenSegmente[0] ?? null

  const erwarteterSaldo = Math.round((gesEin + geplanteEinnahmen - (gesAus + geplanteAusgaben)) * 100) / 100
  const habenOffenePosten = geplanteEinnahmen > 0 || geplanteAusgaben > 0

  return (
    <PageSection titleId="finanzen-analyse-heading" title="Analyse" density="compact">
      <PageSectionPanel density="compact">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Donut: Ausgaben nach Kategorie / Einnahmen nach Quelle (anklicken zeigt die Buchungen) */}
          <div className="rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900 to-slate-950 p-4 shadow-xl shadow-black/30 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${istAusgaben ? 'text-rose-400/90' : 'text-emerald-400/90'}`}>
                {istAusgaben ? 'Ausgaben nach Kategorie' : 'Einnahmen nach Quelle'}
              </p>
              <div className="inline-flex rounded-lg border border-slate-700/80 bg-slate-950/60 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setDonutModus('ausgaben')}
                  className={`rounded-md px-2.5 py-1 transition ${istAusgaben ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Ausgaben
                </button>
                <button
                  type="button"
                  onClick={() => setDonutModus('einnahmen')}
                  className={`rounded-md px-2.5 py-1 transition ${!istAusgaben ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Einnahmen
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
              <DonutChart segmente={aktiveSegmente} />
              <ul className="min-w-0 flex-1 space-y-0.5">
                {aktiveSegmente.length === 0 ? (
                  <li className="text-[12px] text-slate-600">
                    {istAusgaben ? 'Keine Ausgaben in diesem Monat.' : 'Keine Einnahmen in diesem Monat.'}
                  </li>
                ) : (
                  aktiveSegmente.map((k) => {
                    const aktiv = offenerKey === k.key
                    return (
                      <li key={k.key}>
                        <button
                          type="button"
                          onClick={() => setOffenerKey((prev) => (prev === k.key ? null : k.key))}
                          aria-expanded={aktiv}
                          className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-[12px] transition ${
                            aktiv ? 'bg-slate-800/70 ring-1 ring-slate-600/60' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: k.farbe }} aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-slate-300">{k.label}</span>
                          <span className="shrink-0 tabular-nums text-slate-400">{Math.round(k.anteil * 100)}%</span>
                          <span className="shrink-0 tabular-nums font-semibold text-slate-200">{eur(k.betrag)}</span>
                          <span
                            className={`shrink-0 text-slate-500 transition-transform ${aktiv ? 'rotate-90' : ''}`}
                            aria-hidden
                          >
                            ›
                          </span>
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
            </div>

            {offenesSegment && (
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/55 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[12px] font-semibold text-slate-200">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: offenesSegment.farbe }} aria-hidden />
                    {offenesSegment.label}
                    <span className="font-normal text-slate-500">({offenesSegment.rows.length})</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setOffenerKey(null)}
                    className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  >
                    Schließen
                  </button>
                </div>
                {offenesSegment.rows.length === 0 ? (
                  <p className="text-[12px] text-slate-600">Keine Buchungen.</p>
                ) : (
                  <ul className="space-y-1">
                    {offenesSegment.rows.map((b, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 border-b border-slate-800/50 py-1.5 text-[12px] last:border-0"
                      >
                        <span className="w-14 shrink-0 tabular-nums text-slate-500">{formatDatumKurz(b.datum)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-slate-200">{String(b.kategorie ?? '—')}</span>
                          {detailNotiz(b.beschreibung) && (
                            <span className="block truncate text-[11px] text-slate-500">{detailNotiz(b.beschreibung)}</span>
                          )}
                        </span>
                        <span className={`shrink-0 tabular-nums font-semibold ${istAusgaben ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {istAusgaben ? '−' : '+'}
                          {eur(Number(b.betrag) || 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Kennzahlen + Prognose */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-800/90 bg-slate-950/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Sparquote</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${sparquote >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(sparquote * 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}%
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">Anteil gespart vom Einkommen</p>
              </div>
              <div className="rounded-2xl border border-slate-800/90 bg-slate-950/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Größter Block</p>
                <p className="mt-1 truncate text-base font-semibold text-slate-100" title={groessteKategorie?.label}>
                  {groessteKategorie ? groessteKategorie.label : '—'}
                </p>
                <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                  {groessteKategorie ? eur(groessteKategorie.betrag) : 'keine Ausgaben'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-sky-800/50 bg-sky-950/20 p-4 shadow-inner">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300/90">Prognose Monatsende</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${erwarteterSaldo >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {eur(erwarteterSaldo)}
              </p>
              {habenOffenePosten ? (
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Inkl. noch ausstehender Daueraufträge: {geplanteEinnahmen > 0 ? `+${eur(geplanteEinnahmen)} ` : ''}
                  {geplanteAusgaben > 0 ? `−${eur(geplanteAusgaben)}` : ''}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-500">Alle geplanten Daueraufträge sind bereits gebucht.</p>
              )}
            </div>
          </div>
        </div>

        {/* 12-Monats-Verlauf */}
        <div className="mt-4 rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900 to-slate-950 p-4 shadow-xl shadow-black/30 sm:p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-400/90">Verlauf (12 Monate)</p>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-green-500" />Einnahmen</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />Ausgaben</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-sky-400" />Saldo</span>
            </div>
          </div>
          <BalkenChart daten={monatsReihe} />
        </div>
      </PageSectionPanel>
    </PageSection>
  )
}
