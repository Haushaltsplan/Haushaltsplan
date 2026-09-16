'use client'

import { useEffect, useMemo, useState } from 'react'
import { PortfolioAnalyseShell } from '@/components/portfolio-analyse/portfolio-analyse-shell.client'
import { PaCard, PA_TABLE } from '@/components/portfolio-analyse/pa-ui'
import {
  filterRenditenNachJahren,
  saisonAusRenditen,
  usWahlPhase,
  wahlZyklusAusRenditen,
} from '@/lib/portfolio-analyse/boersen-saison-logik'
import { formatProzent } from '@/lib/portfolio-analyse/berechnung'
import type {
  BoersenSaisonMonat,
  BoersenSaisonPaket,
  BoersenWahlJahrStats,
} from '@/lib/portfolio-analyse/boersen-saison-types'

function formatPctKurz(n: number): string {
  const v = n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return n > 0 ? `+${v}%` : `${v}%`
}

function RenditeBalken({
  eintraege,
  ariaLabel,
}: {
  eintraege: { key: string; label: string; wert: number }[]
  ariaLabel: string
}) {
  const werte = eintraege.map((e) => e.wert)
  const min = Math.min(0, ...werte)
  const max = Math.max(0, ...werte)
  const span = Math.max(0.5, max - min)
  const w = 720
  const h = 248
  const pad = { l: 8, r: 8, t: 28, b: 32 }
  const plotW = w - pad.l - pad.r
  const plotH = h - pad.t - pad.b
  const y = (v: number) => pad.t + ((max - v) / span) * plotH
  const zeroY = y(0)
  const gap = eintraege.length > 6 ? 8 : 16
  const barW = (plotW - gap * Math.max(0, eintraege.length - 1)) / eintraege.length

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
      <line
        x1={pad.l}
        x2={w - pad.r}
        y1={zeroY}
        y2={zeroY}
        stroke="currentColor"
        className="text-[var(--app-border-strong)]"
        strokeWidth={1}
      />
      {eintraege.map((e, i) => {
        const x = pad.l + i * (barW + gap)
        const yBar = y(e.wert)
        const top = Math.min(yBar, zeroY)
        const height = Math.max(1, Math.abs(yBar - zeroY))
        const pos = e.wert >= 0
        const fill = pos ? 'rgb(52 211 153)' : 'rgb(251 113 133)'
        const labelY = pos ? yBar - 6 : yBar + 14
        return (
          <g key={e.key}>
            <rect x={x} y={top} width={barW} height={height} rx={3} fill={fill} opacity={0.9}>
              <title>{`${e.label}: ${formatProzent(e.wert)}`}</title>
            </rect>
            <text
              x={x + barW / 2}
              y={labelY}
              textAnchor="middle"
              className={pos ? 'fill-emerald-300' : 'fill-rose-300'}
              style={{ fontSize: 11, fontWeight: 650 }}
            >
              {formatPctKurz(e.wert)}
            </text>
            <text
              x={x + barW / 2}
              y={h - 8}
              textAnchor="middle"
              className="fill-[var(--app-text-muted)]"
              style={{ fontSize: 11 }}
            >
              {e.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function SaisonBalken({ monate }: { monate: BoersenSaisonMonat[] }) {
  return (
    <RenditeBalken
      ariaLabel="Durchschnittliche Monatsrendite"
      eintraege={monate.map((m) => ({ key: String(m.monat), label: m.kurz, wert: m.durchschnittPct }))}
    />
  )
}

function WahlPhaseKarte({ phase, aktiv }: { phase: BoersenWahlJahrStats; aktiv: boolean }) {
  const pos = phase.durchschnittJahrPct >= 0
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        aktiv
          ? 'border-teal-500/35 bg-teal-500/[0.08]'
          : 'border-[var(--app-border)] bg-[var(--app-surface-muted)]/30'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--app-text-muted)]">
        {phase.kurz}
      </p>
      <p className="mt-0.5 text-sm font-medium text-[var(--app-text)]">{phase.label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${pos ? 'text-emerald-300' : 'text-rose-300'}`}>
        {formatProzent(phase.durchschnittJahrPct)}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-[var(--app-text-muted)]">
        {phase.trefferquotePct.toLocaleString('de-DE', { maximumFractionDigits: 0 })} % der Jahre positiv ·{' '}
        {phase.anzahl} Jahre
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--app-text-muted)]">{phase.hinweis}</p>
    </div>
  )
}

function FensterZeile({
  titel,
  vorher,
  danach,
  vorherLabel,
  danachLabel,
}: {
  titel: string
  vorher: { durchschnittPct: number; trefferquotePct: number; anzahl: number }
  danach: { durchschnittPct: number; trefferquotePct: number; anzahl: number }
  vorherLabel: string
  danachLabel: string
}) {
  return (
    <div className="rounded-lg border border-[var(--app-border)] px-3 py-2.5">
      <p className="text-[11px] font-semibold text-[var(--app-text)]">{titel}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">{vorherLabel}</p>
          <p
            className={`mt-0.5 text-sm font-semibold tabular-nums ${
              vorher.durchschnittPct >= 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {formatProzent(vorher.durchschnittPct)}
          </p>
          <p className="text-[11px] text-[var(--app-text-muted)]">
            {vorher.trefferquotePct.toLocaleString('de-DE', { maximumFractionDigits: 0 })} % positiv · {vorher.anzahl}×
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">{danachLabel}</p>
          <p
            className={`mt-0.5 text-sm font-semibold tabular-nums ${
              danach.durchschnittPct >= 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {formatProzent(danach.durchschnittPct)}
          </p>
          <p className="text-[11px] text-[var(--app-text-muted)]">
            {danach.trefferquotePct.toLocaleString('de-DE', { maximumFractionDigits: 0 })} % positiv · {danach.anzahl}×
          </p>
        </div>
      </div>
    </div>
  )
}

function JahrFeld({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (jahr: number) => void
}) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  function uebernehmen(raw: string) {
    const n = Number.parseInt(raw, 10)
    if (!Number.isFinite(n)) {
      setDraft(String(value))
      return
    }
    const clamped = Math.min(max, Math.max(min, n))
    setDraft(String(clamped))
    if (clamped !== value) onChange(clamped)
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-200/90">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        maxLength={4}
        value={draft}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '').slice(0, 4)
          setDraft(next)
          if (next.length === 4) {
            const n = Number.parseInt(next, 10)
            if (n >= min && n <= max && n !== value) onChange(n)
          }
        }}
        onBlur={() => uebernehmen(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="h-10 w-[7.5rem] rounded-md border-2 border-teal-400/70 bg-zinc-950 px-3 text-base font-semibold tabular-nums text-white outline-none focus:border-teal-300"
      />
    </label>
  )
}

export function PortfolioBoerseClient({ initial }: { initial?: BoersenSaisonPaket | null }) {
  const [paket, setPaket] = useState<BoersenSaisonPaket | null>(initial ?? null)
  const [laden, setLaden] = useState(!(initial?.ok && (initial.indezes?.length ?? 0) > 0))
  const [indexId, setIndexId] = useState(initial?.indezes[0]?.id ?? 'sp500')
  const [zeitraum, setZeitraum] = useState<{ von: number | null; bis: number | null }>({ von: null, bis: null })

  useEffect(() => {
    const ac = new AbortController()
    let weg = false
    void fetch('/api/portfolio-analyse/boerse-saison', { signal: ac.signal })
      .then(async (res) => {
        const json = (await res.json()) as BoersenSaisonPaket
        if (weg) return
        if (!json?.indezes?.length) {
          if (!initial?.indezes?.length) setPaket(json)
          return
        }
        setPaket(json)
        const first = json.indezes[0]?.id
        if (first) setIndexId((prev) => (json.indezes.some((i) => i.id === prev) ? prev : first))
      })
      .catch((e: unknown) => {
        if (weg) return
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (initial?.indezes?.length) return
        setPaket({
          ok: false,
          indezes: [],
          geladenAm: new Date().toISOString(),
          fehler: 'Saisondaten konnten nicht geladen werden.',
        })
      })
      .finally(() => {
        if (!weg) setLaden(false)
      })
    return () => {
      weg = true
      ac.abort()
    }
  }, [initial])

  const aktiv = useMemo(
    () => paket?.indezes.find((i) => i.id === indexId) ?? paket?.indezes[0] ?? null,
    [paket, indexId],
  )

  const zeitraumEff = useMemo(() => {
    const min = aktiv?.vonJahr
    const max = aktiv?.bisJahr
    if (min == null || max == null) return { von: null as number | null, bis: null as number | null, gesamt: true, keinOverlap: false }
    if (zeitraum.von == null && zeitraum.bis == null) return { von: min, bis: max, gesamt: true, keinOverlap: false }
    const v = zeitraum.von ?? min
    const b = zeitraum.bis ?? max
    if (b < min || v > max) return { von: min, bis: max, gesamt: true, keinOverlap: true }
    return {
      von: Math.max(min, Math.min(v, b)),
      bis: Math.min(max, Math.max(v, b)),
      gesamt: false,
      keinOverlap: false,
    }
  }, [aktiv, zeitraum])

  const gefiltert = useMemo(() => {
    const rets = aktiv?.renditen ?? []
    if (!rets.length || zeitraumEff.von == null || zeitraumEff.bis == null) return rets
    return filterRenditenNachJahren(rets, zeitraumEff.von, zeitraumEff.bis)
  }, [aktiv, zeitraumEff])

  const saison = useMemo(() => {
    if (aktiv?.renditen?.length) return saisonAusRenditen(gefiltert)
    return {
      monate: aktiv?.monate ?? [],
      vonJahr: aktiv?.vonJahr ?? null,
      bisJahr: aktiv?.bisJahr ?? null,
    }
  }, [gefiltert, aktiv])
  const wahlZyklus = useMemo(() => wahlZyklusAusRenditen(gefiltert), [gefiltert])

  const ranking = useMemo(() => {
    const sortiert = [...saison.monate].sort((a, b) => b.durchschnittPct - a.durchschnittPct)
    return { best: sortiert[0] ?? null, worst: sortiert[sortiert.length - 1] ?? null }
  }, [saison])

  const staerkstePhase = useMemo(() => {
    const phasen = wahlZyklus?.phasen.filter((p) => p.anzahl > 0) ?? []
    if (!phasen.length) return null
    return [...phasen].sort((a, b) => b.durchschnittJahrPct - a.durchschnittJahrPct)[0] ?? null
  }, [wahlZyklus])

  const aktuellesJahr = new Date().getUTCFullYear()
  const aktuellePhaseLabel =
    {
      nachwahl: 'Nachwahljahr',
      midterm: 'Midterm-Jahr',
      vorwahl: 'Vorwahljahr',
      wahljahr: 'Wahljahr',
    }[usWahlPhase(aktuellesJahr)]

  return (
    <PortfolioAnalyseShell
      title="Börse"
      description="Langfristige Saisoneffekte und der US-Wahlzyklus: durchschnittliche Rendite je Kalendermonat — positiv und negativ."
    >
      <PaCard className="space-y-5 p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold text-[var(--app-text)]">Monatsrenditen im Schnitt</h2>
        </div>

        <div className="rounded-xl border-2 border-teal-400/50 bg-teal-950/40 p-3 sm:p-4">
          <p className="text-sm font-semibold text-teal-100">Zeitraum</p>
          <p className="mt-0.5 text-[12px] text-teal-100/70">
            Jahr eintippen, z. B. 1940 und 1950 — gilt nach der vierten Ziffer.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <JahrFeld
              label="Von"
              value={zeitraumEff.von ?? aktiv?.vonJahr ?? 1871}
              min={aktiv?.vonJahr ?? 1871}
              max={aktiv?.bisJahr ?? new Date().getUTCFullYear()}
              onChange={(jahr) =>
                setZeitraum((z) => {
                  const bis = z.bis ?? aktiv?.bisJahr ?? new Date().getUTCFullYear()
                  return { von: jahr, bis: jahr > bis ? jahr : bis }
                })
              }
            />
            <JahrFeld
              label="Bis"
              value={zeitraumEff.bis ?? aktiv?.bisJahr ?? new Date().getUTCFullYear()}
              min={aktiv?.vonJahr ?? 1871}
              max={aktiv?.bisJahr ?? new Date().getUTCFullYear()}
              onChange={(jahr) =>
                setZeitraum((z) => {
                  const von = z.von ?? aktiv?.vonJahr ?? 1871
                  return { von: jahr < von ? jahr : von, bis: jahr }
                })
              }
            />
            <div className="flex flex-wrap gap-1.5 pb-0.5">
              {[
                { id: 'all', label: 'Gesamt', von: null as number | null, bis: null as number | null },
                {
                  id: '10',
                  label: '10 J',
                  von: aktiv?.vonJahr != null && aktiv.bisJahr != null ? Math.max(aktiv.vonJahr, aktiv.bisJahr - 9) : null,
                  bis: aktiv?.bisJahr ?? null,
                },
                {
                  id: '20',
                  label: '20 J',
                  von: aktiv?.vonJahr != null && aktiv.bisJahr != null ? Math.max(aktiv.vonJahr, aktiv.bisJahr - 19) : null,
                  bis: aktiv?.bisJahr ?? null,
                },
                {
                  id: '30',
                  label: '30 J',
                  von: aktiv?.vonJahr != null && aktiv.bisJahr != null ? Math.max(aktiv.vonJahr, aktiv.bisJahr - 29) : null,
                  bis: aktiv?.bisJahr ?? null,
                },
              ]
                .filter((p) => p.id === 'all' || (p.von != null && p.bis != null))
                .map((p) => {
                  const an =
                    p.von == null
                      ? zeitraumEff.gesamt
                      : !zeitraumEff.gesamt && zeitraumEff.von === p.von && zeitraumEff.bis === p.bis
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setZeitraum({ von: p.von, bis: p.bis })}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        an
                          ? 'bg-teal-400 text-zinc-950'
                          : 'bg-zinc-950/60 text-teal-100 ring-1 ring-teal-400/30 hover:bg-zinc-900'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
            </div>
          </div>
          {!(aktiv?.renditen?.length) && aktiv ? (
            <p className="mt-2 text-[11px] text-teal-100/60">Monatsreihe für den Filter wird geladen …</p>
          ) : null}
        </div>

        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--app-text-muted)]">
          Jeder Balken ist der arithmetische Durchschnitt aller abgeschlossenen {aktiv?.name ?? 'Index'}-Monate
          {zeitraumEff.von && zeitraumEff.bis ? ` von ${zeitraumEff.von} bis ${zeitraumEff.bis}` : ' in der Historie'}.
          Das ist keine Prognose — nur was der Kalender in diesem Zeitraum geliefert hat.
        </p>

        {paket && paket.indezes.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {paket.indezes.map((idx) => {
              const an = idx.id === aktiv?.id
              return (
                <button
                  key={idx.id}
                  type="button"
                  onClick={() => setIndexId(idx.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    an
                      ? 'bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/30'
                      : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]'
                  }`}
                >
                  {idx.name}
                </button>
              )
            })}
          </div>
        ) : null}

        {zeitraumEff.keinOverlap && aktiv ? (
          <p className="text-[12px] text-amber-200/90">
            {aktiv.name} hat in {zeitraum.von}–{zeitraum.bis} keine Kurse — es gilt die volle Historie ab {aktiv.vonJahr}.
          </p>
        ) : null}

        {laden ? (
          <p className="py-10 text-center text-sm text-[var(--app-text-muted)]">Historie wird geladen …</p>
        ) : null}

        {!laden && paket && !aktiv ? (
          <p className="py-10 text-center text-sm text-amber-200/90">{paket.fehler ?? 'Keine Daten.'}</p>
        ) : null}

        {aktiv ? (
          <>
            <p className="text-[11px] text-[var(--app-text-muted)]">
              {aktiv.name} ({aktiv.symbol})
              {zeitraumEff.von && zeitraumEff.bis ? ` · ${zeitraumEff.von}–${zeitraumEff.bis}` : ''} · {aktiv.hinweis}
            </p>

            {ranking.best && ranking.worst ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
                    Stärkster Monat
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--app-text)]">
                    {ranking.best.label}{' '}
                    <span className="tabular-nums text-emerald-300">{formatProzent(ranking.best.durchschnittPct)}</span>
                  </p>
                </div>
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-400/90">Schwächster Monat</p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--app-text)]">
                    {ranking.worst.label}{' '}
                    <span className="tabular-nums text-rose-300">{formatProzent(ranking.worst.durchschnittPct)}</span>
                  </p>
                </div>
              </div>
            ) : null}

            <SaisonBalken monate={saison.monate} />

            <div className="overflow-x-auto">
              <table className={PA_TABLE}>
                <thead>
                  <tr>
                    <th className="text-left">Monat</th>
                    <th className="text-right">Ø Rendite</th>
                    <th className="text-right">Median</th>
                    <th className="text-right">Positiv</th>
                    <th className="text-right">Jahre</th>
                    <th className="text-right">Min</th>
                    <th className="text-right">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {saison.monate.map((m) => {
                    const pos = m.durchschnittPct >= 0
                    return (
                      <tr key={m.monat}>
                        <td className="font-medium text-[var(--app-text)]">{m.label}</td>
                        <td
                          className={`text-right tabular-nums font-semibold ${pos ? 'text-emerald-300' : 'text-rose-300'}`}
                        >
                          {formatProzent(m.durchschnittPct)}
                        </td>
                        <td className="text-right tabular-nums text-[var(--app-text-muted)]">
                          {formatProzent(m.medianPct)}
                        </td>
                        <td className="text-right tabular-nums text-[var(--app-text-muted)]">
                          {m.trefferquotePct.toLocaleString('de-DE', { maximumFractionDigits: 0 })} %
                        </td>
                        <td className="text-right tabular-nums text-[var(--app-text-muted)]">{m.anzahl}</td>
                        <td className="text-right tabular-nums text-rose-300/80">{formatProzent(m.minPct)}</td>
                        <td className="text-right tabular-nums text-emerald-300/80">{formatProzent(m.maxPct)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </PaCard>

      {wahlZyklus ? (
        <PaCard className="mt-4 space-y-5 p-4 sm:p-5">
          <div>
            <h2 className="text-base font-semibold text-[var(--app-text)]">US-Wahlzyklus</h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--app-text-muted)]">
              US-Präsidentschaftswahlen alle vier Jahre, dazwischen die Midterms. {aktuellesJahr} ist ein{' '}
              {aktuellePhaseLabel}. Die Zahlen sind die durchschnittliche Jahresrendite des {aktiv?.name} in
              dieser Zyklusphase
              {zeitraumEff.von && zeitraumEff.bis ? ` (${zeitraumEff.von}–${zeitraumEff.bis})` : ''}. Kein Fahrplan —
              2008 war ein Wahljahr und trotzdem ein Crash-Jahr.
              {aktiv?.id === 'dax'
                ? ' Beim DAX ist das ein Mitzieheffekt über den US-Risikoappetit, kein eigener deutscher Wahlkalender.'
                : ''}
            </p>
          </div>

          <RenditeBalken
            ariaLabel="Durchschnittliche Jahresrendite im US-Wahlzyklus"
            eintraege={wahlZyklus.phasen.map((p) => ({
              key: p.phase,
              label: p.kurz,
              wert: p.durchschnittJahrPct,
            }))}
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {wahlZyklus.phasen.map((p) => (
              <WahlPhaseKarte key={p.phase} phase={p} aktiv={p.phase === staerkstePhase?.phase} />
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FensterZeile
              titel="Midterms: oft schwach bis zum Herbst, dann Erholung"
              vorher={wahlZyklus.midtermVorher}
              danach={wahlZyklus.midtermDanach}
              vorherLabel="Jan–Okt"
              danachLabel="Nov–Dez"
            />
            <FensterZeile
              titel="Wahljahr: oft Rückenwind nach dem Wahltag"
              vorher={wahlZyklus.wahljahrVorher}
              danach={wahlZyklus.wahljahrDanach}
              vorherLabel="Jan–Okt"
              danachLabel="Nov–Dez"
            />
          </div>
        </PaCard>
      ) : null}
    </PortfolioAnalyseShell>
  )
}
