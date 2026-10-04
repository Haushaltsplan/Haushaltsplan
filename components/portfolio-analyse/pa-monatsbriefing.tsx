'use client'

import { useEffect, useState } from 'react'
import { PaBadge, PaCard } from '@/components/portfolio-analyse/pa-ui'
import type { MonatsbriefingErgebnis } from '@/lib/portfolio-analyse/monatsbriefing-types'

export function PaMonatsbriefing() {
  const [daten, setDaten] = useState<MonatsbriefingErgebnis | null>(null)
  const [laden, setLaden] = useState(false)
  const [offen, setOffen] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    if (!offen || daten) return
    let cancelled = false
    async function run() {
      setLaden(true)
      setFehler(null)
      try {
        const res = await fetch('/api/portfolio-analyse/monatsbriefing')
        const j = (await res.json()) as { ok?: boolean; briefing?: MonatsbriefingErgebnis; message?: string }
        if (cancelled) return
        if (!res.ok || !j.briefing) {
          setFehler(j.message ?? 'Monatsbriefing fehlgeschlagen.')
          return
        }
        setDaten(j.briefing)
      } catch (e) {
        if (!cancelled) setFehler(e instanceof Error ? e.message : 'Fehler')
      } finally {
        if (!cancelled) setLaden(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [offen, daten])

  return (
    <PaCard className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[var(--app-text)]">Monatsbriefing</h2>
          <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
            Radar · Earnings · Alerts · Klumpen
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-[var(--app-border)] px-2.5 py-1 text-[11px] text-[var(--app-text)]"
          onClick={() => setOffen((v) => !v)}
        >
          {offen ? 'Zuklappen' : 'Anzeigen'}
        </button>
      </div>

      {offen && laden ? <p className="mt-3 text-sm text-[var(--app-text-muted)]">Lade…</p> : null}
      {offen && fehler ? <p className="mt-3 text-sm text-rose-300">{fehler}</p> : null}

      {offen && daten ? (
        <div className="mt-4 space-y-4 text-sm">
          <p className="text-[12px] text-[var(--app-text-muted)]">{daten.hinweise[0]}</p>

          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--app-text-muted)]">
              Radar {daten.monatKey}
            </p>
            <div className="flex flex-wrap gap-2">
              <PaBadge variant="positive">{daten.radar.gruen} grün</PaBadge>
              <PaBadge variant="neutral">{daten.radar.gelb} gelb</PaBadge>
              <PaBadge variant="negative">{daten.alertsOffen} Alerts offen</PaBadge>
            </div>
            {daten.radar.kaufempfehlungKurz ? (
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--app-text-muted)]">
                {daten.radar.kaufempfehlungKurz}
              </p>
            ) : null}
            <ul className="mt-2 space-y-1">
              {daten.radar.topScores.map((t) => (
                <li key={t.ticker} className="flex justify-between gap-2 text-[12px]">
                  <span className="text-[var(--app-text)]">
                    {t.name} <span className="text-[var(--app-text-muted)]">{t.ticker}</span>
                  </span>
                  <span className="tabular-nums text-[var(--app-text-muted)]">
                    {t.score} · {t.ampel}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {daten.earningsWoche.length > 0 ? (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--app-text-muted)]">
                Earnings (14 Tage)
              </p>
              <ul className="space-y-1">
                {daten.earningsWoche.map((e) => (
                  <li key={`${e.symbol}-${e.terminDatumIso}`} className="text-[12px] text-[var(--app-text)]">
                    {e.name}{' '}
                    <span className="tabular-nums text-[var(--app-text-muted)]">
                      {e.terminDatumIso}
                      {e.tageBis === 0 ? ' · heute' : ` · in ${e.tageBis}d`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {daten.klumpen.length > 0 ? (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--app-text-muted)]">
                Top-Positionen
              </p>
              <ul className="space-y-1">
                {daten.klumpen.map((k) => (
                  <li key={k.label} className="flex justify-between text-[12px]">
                    <span>{k.label}</span>
                    <span className="tabular-nums text-[var(--app-text-muted)]">{k.gewichtPct} %</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </PaCard>
  )
}
