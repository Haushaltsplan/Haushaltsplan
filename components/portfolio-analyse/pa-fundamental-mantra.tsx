'use client'

import type {
  FundamentalMantraAudit,
  MantraAuditErgebnis,
  MantraAuditStatus,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

const STATUS_LABEL: Record<MantraAuditStatus, string> = {
  erfuellt: 'Erfüllt',
  nicht_erfuellt: 'Nicht erfüllt',
  keine_daten: 'Keine Daten',
  qualitativ: 'Qualitativ',
}

const STATUS_CLASS: Record<MantraAuditStatus, string> = {
  erfuellt: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  nicht_erfuellt: 'bg-red-500/15 text-red-300 ring-red-500/30',
  keine_daten: 'bg-zinc-700/40 text-zinc-400 ring-zinc-600/40',
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
        {intro ? <p className="mt-1 text-sm leading-relaxed text-zinc-400">{intro}</p> : null}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-zinc-800/80 md:block">
        <table className="min-w-full divide-y divide-zinc-800/90 text-left text-sm">
          <thead className="bg-zinc-900/60">
            <tr className="text-xs uppercase tracking-wide text-zinc-400">
              <th className="px-3 py-2.5 font-semibold">Kennzahl</th>
              <th className="px-3 py-2.5 font-semibold">Ziel</th>
              <th className="px-3 py-2.5 font-semibold">Ist (LTM)</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Erklärung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {zeilen.map((item, i) => (
              <tr key={`${rowKeyPrefix}-${i}-${item.kennzahl}`} className="align-top">
                <td className="px-3 py-2.5">
                  <p className="text-xs font-medium text-zinc-500">{item.kategorie}</p>
                  <p className="font-medium text-white">{item.kennzahl}</p>
                  {item.hinweis ? (
                    <p className="mt-1 text-[11px] leading-snug text-zinc-500">{item.hinweis}</p>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-teal-400">{item.zielwert}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-zinc-200">
                  {item.istWert ?? '–'}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={item.status} />
                </td>
                <td className="max-w-md px-3 py-2.5 leading-relaxed text-zinc-400">{item.funktion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {zeilen.map((item, i) => (
          <article
            key={`${rowKeyPrefix}-m-${i}-${item.kennzahl}`}
            className="rounded-xl border border-zinc-800/90 bg-zinc-950/40 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{item.kategorie}</p>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-1 text-sm font-medium text-white">{item.kennzahl}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                <span className="text-zinc-500">Ziel: </span>
                <span className="font-semibold text-teal-400">{item.zielwert}</span>
              </span>
              <span>
                <span className="text-zinc-500">Ist: </span>
                <span className="font-medium text-zinc-200">{item.istWert ?? '–'}</span>
              </span>
            </div>
            {item.hinweis ? <p className="mt-1 text-[11px] text-zinc-500">{item.hinweis}</p> : null}
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.funktion}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function ZusammenfassungLeiste({ audit }: { audit: FundamentalMantraAudit }) {
  const { zusammenfassung: z } = audit
  const scorePct =
    z.bewertbar > 0 ? Math.round((z.erfuellt / z.bewertbar) * 100) : null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3">
      {scorePct != null ? (
        <span className="rounded-full bg-teal-500/15 px-3 py-1 text-sm font-semibold text-teal-300 ring-1 ring-teal-500/25">
          {z.erfuellt}/{z.bewertbar} erfüllt ({scorePct}%)
        </span>
      ) : (
        <span className="text-sm text-zinc-500">Noch keine bewertbaren Kennzahlen</span>
      )}
      {z.nichtErfuellt > 0 ? (
        <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-300">
          {z.nichtErfuellt} offen
        </span>
      ) : null}
      {z.keineDaten > 0 ? (
        <span className="rounded-full bg-zinc-800/80 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
          {z.keineDaten} ohne Daten
        </span>
      ) : null}
      {audit.sektorMantraTitel ? (
        <span className="ml-auto text-xs text-zinc-500">
          Sektor: <span className="text-zinc-300">{audit.sektorMantraTitel}</span>
        </span>
      ) : (
        <span className="ml-auto text-xs text-zinc-500">Nur Standard-Mantra (kein Sektor-Match)</span>
      )}
    </div>
  )
}

export function PaFundamentalMantra({ audit }: { audit: FundamentalMantraAudit }) {
  return (
    <div className="space-y-6 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-4 ring-1 ring-white/[0.03] sm:p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Mantra-Check</p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">
          Abgleich der Investment-Mantra-Vorgaben mit den verfügbaren LTM-Fundamentaldaten (Macrotrends · Yahoo).
        </p>
      </div>

      <ZusammenfassungLeiste audit={audit} />

      <MantraAuditTabelle
        titel="Standard-Mantra (Quality Compounding)"
        intro="Universelle Benchmarks für langfristige Qualitäts-Investments — unabhängig von der Branche."
        zeilen={audit.standard}
        rowKeyPrefix="standard"
      />

      {audit.sektor.length > 0 ? (
        <MantraAuditTabelle
          titel={audit.sektorMantraTitel ?? 'Sektor-Mantra'}
          intro={audit.sektorMantraIntro}
          zeilen={audit.sektor}
          rowKeyPrefix="sektor"
        />
      ) : null}
    </div>
  )
}
