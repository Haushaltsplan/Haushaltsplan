'use client'

import { appTableScrollClassName } from '@/components/page-shell'
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
        <table className="min-w-full divide-y divide-[var(--app-border)] text-left text-sm">
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

export function PaFundamentalMantra({ audit }: { audit: FundamentalMantraAudit }) {
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
        <div className="space-y-3">
          {audit.moatCheck.map((p) => (
            <article
              key={p.id}
              className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3"
            >
              <p className="text-sm font-medium text-white">{p.titel}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">{p.beschreibung}</p>
              <p className="mt-2 text-sm text-amber-200/90">
                Killer-Frage: <span className="text-[var(--app-text)]">{p.killerFrage}</span>
              </p>
            </article>
          ))}
          <p className="rounded-xl border border-teal-500/20 bg-teal-500/5 px-4 py-3 text-sm text-[var(--app-text)]">
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
        <div className="space-y-2">
          {audit.sellTriggerWatch.map((w) => (
            <article
              key={w.id}
              className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-white">{w.titel}</p>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${WATCH_CLASS[w.status]}`}
                >
                  {WATCH_LABEL[w.status]}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">{w.beschreibung}</p>
              <p className="mt-2 text-sm text-[var(--app-text)]">{w.begruendung}</p>
            </article>
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
