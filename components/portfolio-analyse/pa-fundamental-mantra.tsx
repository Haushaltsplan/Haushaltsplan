'use client'

import { useEffect, useMemo, useState } from 'react'
import { appTableScrollClassName } from '@/components/page-shell'
import {
  ladeMantraVerlaufClient,
  type MantraVerlaufPunktClient,
} from '@/lib/portfolio-analyse/fundamentaldaten-client'
import type {
  FundamentalMantraAudit,
  MantraAuditErgebnis,
  MantraAuditStatus,
  MantraAmpel,
  SellTriggerWatchStatus,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

const AMPEL_CLASS: Record<MantraAmpel, string> = {
  gruen: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40',
  gelb: 'bg-amber-500/20 text-amber-200 ring-amber-500/40',
  rot: 'bg-red-500/20 text-red-300 ring-red-500/40',
  grau: 'bg-[var(--app-surface-muted)]/40 text-[var(--app-text-muted)] ring-[var(--app-border-strong)]/40',
}

const AMPEL_LABEL: Record<MantraAmpel, string> = {
  gruen: 'Grün',
  gelb: 'Gelb',
  rot: 'Rot',
  grau: 'Grau',
}

const WATCH_CLASS: Record<SellTriggerWatchStatus, string> = {
  warnung: 'bg-red-500/15 text-red-300 ring-red-500/30',
  beobachten: 'bg-amber-500/15 text-amber-200 ring-amber-500/30',
  ok: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  keine_daten: 'bg-[var(--app-surface-muted)]/40 text-[var(--app-text-muted)] ring-[var(--app-border-strong)]/40',
}

const WATCH_LABEL: Record<SellTriggerWatchStatus, string> = {
  warnung: 'Warnung',
  beobachten: 'Beobachten',
  ok: 'OK',
  keine_daten: 'Keine Daten',
}

const STATUS_LABEL: Record<MantraAuditStatus, string> = {
  erfuellt: 'Erfüllt',
  nicht_erfuellt: 'Nicht erfüllt',
  keine_daten: 'Keine Daten',
  qualitativ: 'Qualitativ',
}

const STATUS_CLASS: Record<MantraAuditStatus, string> = {
  erfuellt: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  nicht_erfuellt: 'bg-red-500/15 text-red-300 ring-red-500/30',
  keine_daten: 'bg-[var(--app-surface-muted)]/40 text-[var(--app-text-muted)] ring-[var(--app-border-strong)]/40',
  qualitativ: 'bg-amber-500/15 text-amber-200 ring-amber-500/30',
}

function StatusBadge({ status }: { status: MantraAuditStatus }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function MantraAuditTabelle({
  titel,
  intro,
  zeilen,
  rowKeyPrefix,
}: {
  titel: string
  intro?: string | null
  zeilen: MantraAuditErgebnis[]
  rowKeyPrefix: string
}) {
  if (zeilen.length === 0) return null

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-white">{titel}</h3>
        {intro ? <p className="mt-1 text-sm leading-relaxed text-[var(--app-text-muted)]">{intro}</p> : null}
      </div>

      <div className={`hidden ${appTableScrollClassName} rounded-xl border border-[var(--app-border)] md:block`}>
        <table className="app-data-table min-w-full divide-y divide-[var(--app-border)] text-left text-sm">
          <thead className="bg-[var(--app-surface-muted)]">
            <tr className="text-xs uppercase tracking-wide text-[var(--app-text-muted)]">
              <th className="px-3 py-2.5 font-semibold">Kennzahl</th>
              <th className="px-3 py-2.5 font-semibold">Benchmark</th>
              <th className="px-3 py-2.5 font-semibold">Ist (LTM)</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--app-border)]">
            {zeilen.map((item, i) => (
              <tr key={`${rowKeyPrefix}-${i}-${item.kennzahl}`} className="align-top">
                <td className="px-3 py-2.5">
                  <p className="text-xs font-medium text-[var(--app-text-muted)]">{item.kategorie}</p>
                  <p className="font-medium text-white">{item.kennzahl}</p>
                  {item.hinweis ? (
                    <p className="mt-1 text-[11px] leading-snug text-[var(--app-text-muted)]">{item.hinweis}</p>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-teal-400">{item.zielwert}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-[var(--app-text)]">
                  {item.istWert ?? '–'}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={item.status} />
                </td>
                <td className="max-w-md px-3 py-2.5 leading-relaxed text-[var(--app-text-muted)]">{item.funktion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {zeilen.map((item, i) => (
          <article
            key={`${rowKeyPrefix}-m-${i}-${item.kennzahl}`}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">{item.kategorie}</p>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-1 text-sm font-medium text-white">{item.kennzahl}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                <span className="text-[var(--app-text-muted)]">Benchmark: </span>
                <span className="font-semibold text-teal-400">{item.zielwert}</span>
              </span>
              <span>
                <span className="text-[var(--app-text-muted)]">Ist: </span>
                <span className="font-medium text-[var(--app-text)]">{item.istWert ?? '–'}</span>
              </span>
            </div>
            {item.hinweis ? <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">{item.hinweis}</p> : null}
            <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">{item.funktion}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function AmpelBadge({ ampel, scorePct }: { ampel: MantraAmpel; scorePct: number | null }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${AMPEL_CLASS[ampel]}`}
    >
      <span className="h-2.5 w-2.5 rounded-full bg-current opacity-80" />
      {AMPEL_LABEL[ampel]}
      {scorePct != null ? ` · ${scorePct}% Dashboard` : ''}
    </span>
  )
}

function ZusammenfassungLeiste({ audit }: { audit: FundamentalMantraAudit }) {
  const { zusammenfassung: z } = audit
  const scorePct =
    z.bewertbar > 0 ? Math.round((z.erfuellt / z.bewertbar) * 100) : null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <AmpelBadge ampel={audit.ampel} scorePct={audit.ampelScorePct} />
        <span className="text-xs text-[var(--app-text-muted)]">{audit.ampelHinweis}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3">
      {scorePct != null ? (
        <span className="rounded-full bg-teal-500/15 px-3 py-1 text-sm font-semibold text-teal-300 ring-1 ring-teal-500/25">
          {z.erfuellt}/{z.bewertbar} erfüllt ({scorePct}%)
        </span>
      ) : (
        <span className="text-sm text-[var(--app-text-muted)]">Noch keine bewertbaren Kennzahlen</span>
      )}
      {z.nichtErfuellt > 0 ? (
        <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-300">
          {z.nichtErfuellt} offen
        </span>
      ) : null}
      {z.keineDaten > 0 ? (
        <span className="rounded-full bg-[var(--app-surface-hover)] px-2.5 py-0.5 text-xs font-medium text-[var(--app-text-muted)]">
          {z.keineDaten} ohne Daten
        </span>
      ) : null}
      {z.qualitativ > 0 ? (
        <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-200">
          {z.qualitativ} qualitativ
        </span>
      ) : null}
      </div>
    </div>
  )
}

function MantraVerlaufSparkline({
  verlauf,
  breite = 280,
  hoehe = 56,
}: {
  verlauf: MantraVerlaufPunktClient[]
  breite?: number
  hoehe?: number
}) {
  const scores = verlauf.map((v) => v.ampelScorePct ?? v.scoreMantra ?? 0)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1
  const pad = 4
  const w = breite - pad * 2
  const h = hoehe - pad * 2

  const punkte = verlauf.map((v, i) => {
    const score = v.ampelScorePct ?? v.scoreMantra ?? 0
    const x = pad + (i / Math.max(1, verlauf.length - 1)) * w
    const y = pad + h - ((score - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const letzter = scores.at(-1) ?? 0
  const erster = scores.at(0) ?? 0
  const trend = letzter > erster ? '↑' : letzter < erster ? '↓' : '→'
  const trendClass =
    letzter > erster ? 'text-emerald-400' : letzter < erster ? 'text-rose-400' : 'text-[var(--app-text-muted)]'

  return (
    <div className="flex items-center gap-3">
      <svg width={breite} height={hoehe} className="shrink-0 overflow-visible" aria-hidden>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-teal-400"
          points={punkte.join(' ')}
        />
        {verlauf.map((v, i) => {
          const score = v.ampelScorePct ?? v.scoreMantra ?? 0
          const x = pad + (i / Math.max(1, verlauf.length - 1)) * w
          const y = pad + h - ((score - min) / range) * h
          const fill =
            v.ampel === 'gruen'
              ? '#34d399'
              : v.ampel === 'gelb'
                ? '#fbbf24'
                : v.ampel === 'rot'
                  ? '#f87171'
                  : '#71717a'
          return <circle key={v.periodeIso} cx={x} cy={y} r={3.5} fill={fill} />
        })}
      </svg>
      <span className={`text-lg font-semibold tabular-nums ${trendClass}`}>{trend}</span>
    </div>
  )
}

function MantraVerlaufSektion({ ticker }: { ticker: string }) {
  const [verlauf, setVerlauf] = useState<MantraVerlaufPunktClient[]>([])
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLaden(true)
    void ladeMantraVerlaufClient(ticker)
      .then((punkte) => {
        if (!cancelled) setVerlauf(punkte)
      })
      .finally(() => {
        if (!cancelled) setLaden(false)
      })
    return () => {
      cancelled = true
    }
  }, [ticker])

  const fruehwarnung = useMemo(() => {
    if (verlauf.length < 2) return null
    const scores = verlauf.map((v) => v.ampelScorePct ?? v.scoreMantra).filter((s): s is number => s != null)
    if (scores.length < 2) return null
    const delta = scores.at(-1)! - scores[0]!
    const sellTriggerOffen = verlauf.some((v) => !v.sellTriggerOk)
    if (delta <= -8 || (delta <= -5 && sellTriggerOffen)) {
      return 'Sinkender Mantra-Score bei intakter oder steigender Bewertung ist ein klassisches Ausstiegssignal — Sell-Triggers und Moat prüfen.'
    }
    return null
  }, [verlauf])

  if (laden) {
    return (
      <p className="text-sm text-[var(--app-text-muted)]">Mantra-Verlauf wird geladen …</p>
    )
  }

  if (verlauf.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-text-muted)]">
        Noch kein Quartals-Verlauf gespeichert. Beim nächsten Abruf der Fundamentaldaten wird ein Snapshot angelegt —
        über mehrere Quartale entsteht so die Historie.
      </p>
    )
  }

  const aktuell = verlauf.at(-1)!
  const scores = verlauf.map((v) => v.ampelScorePct ?? v.scoreMantra).filter((s): s is number => s != null)

  return (
    <section className="space-y-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-white">Mantra-Score über Quartale</h3>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
          Dashboard-Score (0–100) pro Quartal — sinkende Qualität bei steigendem Kurs als Frühwarnsignal nutzen.
        </p>
      </div>

      {fruehwarnung ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {fruehwarnung}
        </p>
      ) : null}

      {verlauf.length >= 2 ? (
        <MantraVerlaufSparkline verlauf={verlauf} />
      ) : (
        <p className="text-sm text-[var(--app-text-muted)]">Erster Snapshot — ab dem nächsten Quartal erscheint der Verlauf.</p>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <p className="text-[11px] text-[var(--app-text-muted)]">Aktuell ({aktuell.periodeLabel})</p>
          <p className="font-semibold text-white">
            {aktuell.ampelScorePct != null ? `${aktuell.ampelScorePct}%` : '–'}{' '}
            <span className="text-[var(--app-text-muted)]">· {AMPEL_LABEL[aktuell.ampel as MantraAmpel] ?? aktuell.ampel}</span>
          </p>
        </div>
        {scores.length >= 2 ? (
          <>
            <div>
              <p className="text-[11px] text-[var(--app-text-muted)]">Min / Max</p>
              <p className="font-semibold text-white">
                {Math.min(...scores)} / {Math.max(...scores)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--app-text-muted)]">Erster Snapshot</p>
              <p className="font-semibold text-white">{verlauf[0]!.periodeLabel}</p>
            </div>
          </>
        ) : null}
      </div>

      {verlauf.length >= 2 ? (
        <div className={`hidden ${appTableScrollClassName} rounded-lg border border-[var(--app-border)] md:block`}>
          <table className="app-data-table min-w-full text-left text-sm">
            <thead className="bg-[var(--app-surface-muted)] text-xs uppercase tracking-wide text-[var(--app-text-muted)]">
              <tr>
                <th className="px-3 py-2 font-semibold">Periode</th>
                <th className="px-3 py-2 font-semibold">Score</th>
                <th className="px-3 py-2 font-semibold">Ampel</th>
                <th className="px-3 py-2 font-semibold">Erfüllt</th>
                <th className="px-3 py-2 font-semibold">Sell-Trigger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--app-border)]">
              {[...verlauf].reverse().map((v) => (
                <tr key={v.periodeIso}>
                  <td className="px-3 py-2 text-white">{v.periodeLabel}</td>
                  <td className="px-3 py-2 tabular-nums">{v.ampelScorePct ?? v.scoreMantra ?? '–'}</td>
                  <td className="px-3 py-2">{AMPEL_LABEL[v.ampel as MantraAmpel] ?? v.ampel}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {v.erfuellt}
                    {v.nichtErfuellt > 0 ? ` / ${v.nichtErfuellt} offen` : ''}
                  </td>
                  <td className="px-3 py-2">{v.sellTriggerOk ? 'OK' : 'Warnung'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

export function PaFundamentalMantra({ audit, ticker }: { audit: FundamentalMantraAudit; ticker: string }) {
  return (
    <div className="space-y-6 overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4 ring-1 ring-white/[0.03] sm:p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">Mantra-Check</p>
        <h2 className="mt-1 text-base font-semibold text-white">{audit.frameworkTitel}</h2>
        <p className="mt-1 text-xs text-[var(--app-text-muted)]">{audit.frameworkUntertitel}</p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--app-text-muted)]">
          Abgleich des quantitativen Dashboards mit LTM-Daten aus Macrotrends, Yahoo Finance und berechneten
          Kennzahlen. Moat-Check und Sell-Triggers sind qualitative Referenz für Deep Research.
        </p>
      </div>

      <blockquote className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm italic leading-relaxed text-[var(--app-text)]">
        {audit.anker}
      </blockquote>

      <ZusammenfassungLeiste audit={audit} />

      <MantraVerlaufSektion ticker={ticker} />

      <MantraAuditTabelle
        titel="2. Quantitatives Dashboard"
        intro="Dynamische Kriterien — etablierte Compounder vs. junge Wachstumsfirmen."
        zeilen={audit.standard}
        rowKeyPrefix="dashboard"
      />

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-white">3. Moat-Check (qualitativ)</h3>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            Nicht automatisch bewertbar — in Earnings Calls, Quartalsreports und Deep Research prüfen.
          </p>
        </div>
        <div className="divide-y divide-[var(--app-border)]">
          {audit.moatCheck.map((p) => (
            <div key={p.id} className="py-3 first:pt-0 last:pb-0">
              <p className="text-sm font-medium text-white">{p.titel}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--app-text-muted)]">{p.beschreibung}</p>
              <p className="mt-1 text-sm text-amber-200/90">
                Killer-Frage: <span className="text-[var(--app-text)]">{p.killerFrage}</span>
              </p>
            </div>
          ))}
          <p className="pt-3 text-sm text-[var(--app-text)]">
            <span className="font-medium text-teal-300">Junge Plattformen: </span>
            {audit.moatPlattformZusatz}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-white">4. Sell-Trigger-Watch</h3>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            Regelbasiert aus LTM-Daten — ohne monatlichen LLM-Scan. Fließt in die Ampel ein.
          </p>
        </div>
        <div className="divide-y divide-[var(--app-border)]">
          {audit.sellTriggerWatch.map((w) => (
            <div key={w.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-white">{w.titel}</p>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${WATCH_CLASS[w.status]}`}
                >
                  {WATCH_LABEL[w.status]}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">{w.beschreibung}</p>
              <p className="mt-1 text-sm text-[var(--app-text)]">{w.begruendung}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-white">5. Sell-Triggers (Referenz)</h3>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">{audit.sellTriggersHinweis}</p>
        </div>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-[var(--app-text)]">
          {audit.sellTriggers.map((t) => (
            <li key={t.id}>
              <span className="font-medium text-white">{t.titel}: </span>
              {t.beschreibung}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
