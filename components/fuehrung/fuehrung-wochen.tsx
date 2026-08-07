'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import {
  FuehrungErinnerungenPanel,
  FuehrungReviewPanel,
  FuehrungSparringPanel,
} from '@/components/fuehrung/fuehrung-extras'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import { baueFuehrungBilanz } from '@/lib/fuehrung/bilanz'
import { FUEHRUNG_PLAN_SLOTS, FUEHRUNG_WOCHEN } from '@/lib/fuehrung/content'
import { aktuelleWochenNr, heuteIso, newId, type FuehrungState } from '@/lib/fuehrung/store'
import { appInputClass, appSecondaryBtnClass } from '@/lib/app-ui'

export function FuehrungWochenPanel({
  state,
  setState,
  onOpenMitarbeiter,
}: {
  state: FuehrungState
  setState: Dispatch<SetStateAction<FuehrungState>>
  onOpenMitarbeiter: () => void
}) {
  const heute = heuteIso()
  const aktuell = aktuelleWochenNr(state.challengeStart, heute, FUEHRUNG_PLAN_SLOTS)
  const [offen, setOffen] = useState<number>(aktuell)
  const [bilanzCopied, setBilanzCopied] = useState(false)
  const bilanzText = baueFuehrungBilanz(state, heute)
  const aktuelleLern =
    FUEHRUNG_WOCHEN.find((w) => w.nr === aktuell)?.lernNr ?? null

  function toggleAufgabe(nr: number, idx: number) {
    const key = String(nr)
    setState((s) => {
      const cur = new Set(s.wochenFortschritt[key] ?? [])
      if (cur.has(idx)) cur.delete(idx)
      else cur.add(idx)
      return {
        ...s,
        wochenFortschritt: { ...s.wochenFortschritt, [key]: [...cur].sort((a, b) => a - b) },
      }
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--app-text-muted)]">
        Slot {aktuell}/{FUEHRUNG_PLAN_SLOTS}
        {aktuelleLern != null ? ` · Lernwoche ${aktuelleLern}/6` : ' · Pause'}
        . Nach dem Urlaub geht es mit Lernwoche 3 weiter.
      </p>

      {FUEHRUNG_WOCHEN.map((w) => {
        const done = new Set(state.wochenFortschritt[String(w.nr)] ?? [])
        const isOpen = offen === w.nr
        const isAktuell = w.nr === aktuell
        const label =
          w.pause || w.lernNr == null
            ? 'Pause'
            : `Lernwoche ${w.lernNr}`
        return (
          <section
            key={w.nr}
            className={`overflow-hidden rounded-[var(--app-radius-lg)] border ${
              w.pause
                ? isAktuell
                  ? 'border-sky-500/40 bg-sky-500/5'
                  : 'border-sky-500/20 bg-[var(--app-surface)]'
                : isAktuell
                  ? 'border-teal-500/40 bg-teal-500/5'
                  : 'border-[var(--app-border)] bg-[var(--app-surface)]'
            }`}
          >
            <button
              type="button"
              onClick={() => setOffen(isOpen ? 0 : w.nr)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
                  {label}
                  {isAktuell ? ' · jetzt' : ''}
                </p>
                <p className="text-sm font-semibold text-[var(--app-text)]">
                  {w.titel}{' '}
                  <span className="font-normal text-[var(--app-text-muted)]">
                    · {done.size}/{w.aufgaben.length}
                  </span>
                </p>
              </div>
              <span className="text-[var(--app-text-muted)]">{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen ? (
              <div className="space-y-3 border-t border-[var(--app-border)] px-4 py-3">
                <p className="text-sm text-[var(--app-text-muted)]">{w.fokus}</p>
                <ul className="space-y-2">
                  {w.aufgaben.map((a, i) => (
                    <li key={i}>
                      <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--app-text)]">
                        <input
                          type="checkbox"
                          checked={done.has(i)}
                          onChange={() => toggleAufgabe(w.nr, i)}
                          className="mt-1"
                        />
                        <span className={done.has(i) ? 'text-[var(--app-text-muted)] line-through' : ''}>
                          {a}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>

                {w.lernNr === 1 ? (
                  <button
                    type="button"
                    onClick={onOpenMitarbeiter}
                    className="w-full rounded-xl bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-teal-500"
                  >
                    Mitarbeiter-Fragen erfassen →
                  </button>
                ) : null}

                {w.lernNr === 2 ? (
                  <FuehrungSparringPanel
                    state={state}
                    onSave={(eintrag) =>
                      setState((s) => ({ ...s, sparring: [eintrag, ...s.sparring].slice(0, 40) }))
                    }
                  />
                ) : null}

                {w.pause ? (
                  <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                      24.–28. August
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--app-text)]">
                      Pause — danach weiter mit Lernwoche 3 (Fokus schützen).
                    </p>
                  </div>
                ) : null}

                {w.lernNr === 3 ? (
                  <PageSection titleId="w-fokus-hinweis" title="Fokus (kurz)" density="compact">
                    <PageSectionPanel density="compact">
                      <p className="text-sm text-[var(--app-text-muted)]">
                        2× 45–60 Min am Stück ohne Soforthilfe. Signal: Kopfhörer / Tür. Nur echte
                        Eskalationen.
                      </p>
                    </PageSectionPanel>
                  </PageSection>
                ) : null}

                {w.lernNr === 6 ? (
                  <div className="space-y-3">
                    <FuehrungReviewPanel
                      state={state}
                      onDismissWeek={(key) =>
                        setState((s) => ({ ...s, lastWochenReviewKey: key }))
                      }
                    />
                    <PageSection titleId="w-bilanz" title="Chef-Bilanz" density="compact">
                      <PageSectionPanel density="compact">
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--app-surface-muted)] p-3 text-xs text-[var(--app-text)] ring-1 ring-[var(--app-border)]">
                          {bilanzText}
                        </pre>
                        <button
                          type="button"
                          className="mt-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(bilanzText)
                              setBilanzCopied(true)
                              window.setTimeout(() => setBilanzCopied(false), 1600)
                            } catch {
                              /* ignore */
                            }
                          }}
                        >
                          {bilanzCopied ? 'Kopiert' : 'Bilanz kopieren'}
                        </button>
                      </PageSectionPanel>
                    </PageSection>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        )
      })}

      <details className="rounded-[var(--app-radius-lg)] border border-[var(--app-border)] bg-[var(--app-surface)]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--app-text)]">
          Mehr · Erinnerungen & Notizen
        </summary>
        <div className="space-y-3 border-t border-[var(--app-border)] px-2 py-3 sm:px-3">
          <FuehrungErinnerungenPanel
            state={state}
            onChange={(patch) =>
              setState((s) => ({ ...s, erinnerungen: { ...s.erinnerungen, ...patch } }))
            }
          />
          <NotizenKurz state={state} setState={setState} />
        </div>
      </details>
    </div>
  )
}

function NotizenKurz({
  state,
  setState,
}: {
  state: FuehrungState
  setState: Dispatch<SetStateAction<FuehrungState>>
}) {
  const [titel, setTitel] = useState('')
  const [text, setText] = useState('')

  return (
    <PageSection titleId="fuehrung-notizen-kurz" title="Notizen" density="compact">
      <PageSectionPanel density="compact" className="space-y-2">
        <input
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          placeholder="Titel"
          className={appInputClass}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Notiz …"
          className={`${appInputClass} resize-y`}
        />
        <button
          type="button"
          className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          disabled={!text.trim()}
          onClick={() => {
            const now = new Date().toISOString()
            setState((s) => ({
              ...s,
              notizen: [
                {
                  id: newId(),
                  titel: titel.trim() || 'Notiz',
                  text: text.trim(),
                  createdAt: now,
                  updatedAt: now,
                },
                ...s.notizen,
              ].slice(0, 120),
            }))
            setTitel('')
            setText('')
          }}
        >
          Speichern
        </button>
        {state.notizen.slice(0, 5).map((n) => (
          <div key={n.id} className="rounded-lg bg-[var(--app-surface-muted)] px-2 py-2 text-sm">
            <p className="font-semibold text-[var(--app-text)]">{n.titel}</p>
            <p className="line-clamp-2 text-[var(--app-text-muted)]">{n.text}</p>
            <button
              type="button"
              className={`mt-1 ${appSecondaryBtnClass}`}
              onClick={() =>
                setState((s) => ({ ...s, notizen: s.notizen.filter((x) => x.id !== n.id) }))
              }
            >
              Löschen
            </button>
          </div>
        ))}
      </PageSectionPanel>
    </PageSection>
  )
}
