'use client'

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import {
  fragenFuerMitarbeiterAmTag,
  heuteIso,
  mitarbeiterFragenStats,
  newId,
  type FuehrungState,
} from '@/lib/fuehrung/store'
import { wochenStartIso } from '@/lib/fuehrung/wochen-review'
import { appInputClass, appSecondaryBtnClass } from '@/lib/app-ui'

function formatDe(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
  })
}

export function FuehrungMitarbeiterPanel({
  state,
  setState,
}: {
  state: FuehrungState
  setState: Dispatch<SetStateAction<FuehrungState>>
}) {
  const heute = heuteIso()
  const von = wochenStartIso(heute)
  const [neuerName, setNeuerName] = useState('')
  const [themaById, setThemaById] = useState<Record<string, string>>({})
  const [kiFrage, setKiFrage] = useState('')
  const [kiReply, setKiReply] = useState<string | null>(null)
  const [kiLoading, setKiLoading] = useState(false)
  const [kiError, setKiError] = useState<string | null>(null)

  const heuteTotal = state.mitarbeiterFragen.filter((f) => f.datum === heute).length
  const wocheStats = useMemo(
    () => mitarbeiterFragenStats(state.mitarbeiter, state.mitarbeiterFragen, von, heute),
    [state.mitarbeiter, state.mitarbeiterFragen, von, heute],
  )
  const wocheTotal = wocheStats.reduce((s, x) => s + x.anzahl, 0)

  function addMitarbeiter() {
    const name = neuerName.trim()
    if (!name) return
    if (state.mitarbeiter.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      setNeuerName('')
      return
    }
    setState((s) => ({
      ...s,
      mitarbeiter: [
        { id: newId(), name, createdAt: new Date().toISOString() },
        ...s.mitarbeiter,
      ],
    }))
    setNeuerName('')
  }

  function removeMitarbeiter(id: string) {
    setState((s) => ({
      ...s,
      mitarbeiter: s.mitarbeiter.filter((m) => m.id !== id),
      mitarbeiterFragen: s.mitarbeiterFragen.filter((f) => f.mitarbeiterId !== id),
    }))
  }

  function addFrage(mitarbeiterId: string) {
    const thema = (themaById[mitarbeiterId] ?? '').trim()
    if (!thema) return
    setState((s) => ({
      ...s,
      mitarbeiterFragen: [
        {
          id: newId(),
          mitarbeiterId,
          datum: heute,
          thema,
          createdAt: new Date().toISOString(),
        },
        ...s.mitarbeiterFragen,
      ].slice(0, 2000),
    }))
    setThemaById((prev) => ({ ...prev, [mitarbeiterId]: '' }))
  }

  function removeFrage(id: string) {
    setState((s) => ({
      ...s,
      mitarbeiterFragen: s.mitarbeiterFragen.filter((f) => f.id !== id),
    }))
  }

  async function askKi() {
    const message = kiFrage.trim()
    if (message.length < 3) return
    setKiLoading(true)
    setKiError(null)
    setKiReply(null)
    const context = {
      heute,
      wochenStart: von,
      fragenHeute: heuteTotal,
      fragenWoche: wocheTotal,
      rankingWoche: wocheStats.filter((x) => x.anzahl > 0),
      heuteProPerson: state.mitarbeiter.map((m) => ({
        name: m.name,
        anzahl: fragenFuerMitarbeiterAmTag(state.mitarbeiterFragen, m.id, heute).length,
        themen: fragenFuerMitarbeiterAmTag(state.mitarbeiterFragen, m.id, heute).map((f) => f.thema),
      })),
      letzteThemen: state.mitarbeiterFragen.slice(0, 40).map((f) => ({
        name: state.mitarbeiter.find((m) => m.id === f.mitarbeiterId)?.name ?? '?',
        datum: f.datum,
        thema: f.thema,
      })),
    }
    try {
      const res = await fetch('/api/fuehrung/mitarbeiter-ki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context }),
      })
      const data = await res.json()
      if (!res.ok) {
        setKiError(typeof data.error === 'string' ? data.error : 'Fehler')
        return
      }
      setKiReply(typeof data.reply === 'string' ? data.reply : '')
    } catch {
      setKiError('Netzwerkfehler')
    } finally {
      setKiLoading(false)
    }
  }

  function copyRanking() {
    const lines = [
      `MITARBEITER-FRAGEN · Woche ab ${von}`,
      `Gesamt diese Woche: ${wocheTotal} · Heute: ${heuteTotal}`,
      '',
      ...wocheStats
        .filter((x) => x.anzahl > 0)
        .map((x, i) => `${i + 1}. ${x.name}: ${x.anzahl}×`),
      '',
      'Themen (Auszug):',
      ...state.mitarbeiterFragen
        .filter((f) => f.datum >= von && f.datum <= heute)
        .slice(0, 30)
        .map((f) => {
          const name = state.mitarbeiter.find((m) => m.id === f.mitarbeiterId)?.name ?? '?'
          return `· ${formatDe(f.datum)} ${name}: ${f.thema}`
        }),
    ]
    void navigator.clipboard.writeText(lines.join('\n'))
  }

  return (
    <div className="space-y-3">
      <div className="rounded-[var(--app-radius-lg)] border border-teal-500/25 bg-teal-500/5 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
          Woche 1 · Wahrnehmen
        </p>
        <p className="mt-1 text-sm text-[var(--app-text)]">
          Nur zählen und notieren — noch nicht bewerten. Ziel: sehen, wie oft und wie unnötig Fragen
          sind.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-[var(--app-surface-muted)] px-3 py-2 text-center ring-1 ring-[var(--app-border)]">
            <p className="text-xl font-bold tabular-nums text-[var(--app-text)]">{heuteTotal}</p>
            <p className="text-[10px] text-[var(--app-text-muted)]">Fragen heute</p>
          </div>
          <div className="rounded-xl bg-[var(--app-surface-muted)] px-3 py-2 text-center ring-1 ring-[var(--app-border)]">
            <p className="text-xl font-bold tabular-nums text-[var(--app-text)]">{wocheTotal}</p>
            <p className="text-[10px] text-[var(--app-text-muted)]">Fragen diese Woche</p>
          </div>
        </div>
        {wocheTotal > 0 ? (
          <button type="button" className={`mt-3 ${appSecondaryBtnClass}`} onClick={copyRanking}>
            Ranking für Gespräch kopieren
          </button>
        ) : null}
      </div>

      <PageSection titleId="fuehrung-ma-add" title="Mitarbeiter" density="compact">
        <PageSectionPanel density="compact">
          <div className="flex flex-wrap gap-2">
            <input
              value={neuerName}
              onChange={(e) => setNeuerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addMitarbeiter()
              }}
              placeholder="Name hinzufügen"
              className={`${appInputClass} min-w-[12rem] flex-1`}
            />
            <button
              type="button"
              onClick={addMitarbeiter}
              disabled={!neuerName.trim()}
              className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
            >
              Hinzufügen
            </button>
          </div>
        </PageSectionPanel>
      </PageSection>

      {state.mitarbeiter.length === 0 ? (
        <PageSection titleId="fuehrung-ma-empty" title="Noch niemand" density="compact">
          <PageSectionPanel density="compact">
            <p className="text-sm italic text-[var(--app-text-muted)]">
              Füge die Personen hinzu, die dich am häufigsten holen — dann pro Frage Thema eintragen.
            </p>
          </PageSectionPanel>
        </PageSection>
      ) : (
        state.mitarbeiter.map((m) => {
          const heuteFragen = fragenFuerMitarbeiterAmTag(state.mitarbeiterFragen, m.id, heute)
          const wocheN = wocheStats.find((x) => x.id === m.id)?.anzahl ?? 0
          return (
            <PageSection key={m.id} titleId={`fuehrung-ma-${m.id}`} title={m.name} density="compact">
              <PageSectionPanel density="compact" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-[var(--app-text)]">
                    <span className="font-bold tabular-nums text-teal-600 dark:text-teal-400">
                      {heuteFragen.length}
                    </span>{' '}
                    heute ·{' '}
                    <span className="font-bold tabular-nums">{wocheN}</span> diese Woche
                  </p>
                  <button
                    type="button"
                    className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                    onClick={() => removeMitarbeiter(m.id)}
                  >
                    Entfernen
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={themaById[m.id] ?? ''}
                    onChange={(e) => setThemaById((p) => ({ ...p, [m.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addFrage(m.id)
                    }}
                    placeholder="Was genau wollte er/sie wissen?"
                    className={`${appInputClass} min-w-[14rem] flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => addFrage(m.id)}
                    disabled={!(themaById[m.id] ?? '').trim()}
                    className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
                  >
                    + Frage
                  </button>
                </div>
                {heuteFragen.length > 0 ? (
                  <ul className="space-y-1.5">
                    {heuteFragen.map((f) => (
                      <li
                        key={f.id}
                        className="flex items-start justify-between gap-2 rounded-lg bg-[var(--app-surface-muted)] px-2.5 py-2 text-sm text-[var(--app-text)]"
                      >
                        <span>{f.thema}</span>
                        <button
                          type="button"
                          className="shrink-0 text-xs text-rose-600 dark:text-rose-400"
                          onClick={() => removeFrage(f.id)}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs italic text-[var(--app-text-muted)]">Heute noch keine Frage.</p>
                )}
              </PageSectionPanel>
            </PageSection>
          )
        })
      )}

      <PageSection titleId="fuehrung-ma-ki" title="KI fragen (Free Tier)" density="compact">
        <PageSectionPanel density="compact" className="space-y-2">
          <p className="text-xs text-[var(--app-text-muted)]">
            z. B. „Wie formuliere ich das Ranking fürs Gespräch?“ oder „Welche Fragen wirken unnötig?“
          </p>
          <textarea
            value={kiFrage}
            onChange={(e) => setKiFrage(e.target.value)}
            rows={3}
            className={`${appInputClass} resize-y`}
            placeholder="Deine Frage an die KI …"
          />
          <button
            type="button"
            onClick={() => void askKi()}
            disabled={kiLoading || kiFrage.trim().length < 3}
            className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
          >
            {kiLoading ? '…' : 'Fragen'}
          </button>
          {kiError ? <p className="text-xs text-rose-600 dark:text-rose-400">{kiError}</p> : null}
          {kiReply ? (
            <div className="whitespace-pre-wrap rounded-xl bg-[var(--app-surface-muted)] p-3 text-sm leading-relaxed text-[var(--app-text)] ring-1 ring-[var(--app-border)]">
              {kiReply}
            </div>
          ) : null}
        </PageSectionPanel>
      </PageSection>
    </div>
  )
}
