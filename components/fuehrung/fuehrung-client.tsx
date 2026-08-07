'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  PageChrome,
  PageHero,
  PageSection,
  PageSectionPanel,
  PageSubTabs,
} from '@/components/page-shell'
import { FuehrungMitarbeiterPanel } from '@/components/fuehrung/fuehrung-mitarbeiter'
import { FuehrungWochenPanel } from '@/components/fuehrung/fuehrung-wochen'
import {
  FUEHRUNG_ABEND_FRAGEN,
  FUEHRUNG_KONTEXT,
  FUEHRUNG_PLAN_SLOTS,
  FUEHRUNG_PRINZIPIEN,
  FUEHRUNG_SKRIPTE,
  FUEHRUNG_WOCHEN,
} from '@/lib/fuehrung/content'
import { berechneAbendCheckStreak } from '@/lib/fuehrung/streak'
import {
  abendCheckOffen,
  aktuelleWochenNr,
  challengeEndeIso,
  defaultFuehrungState,
  heuteIso,
  ladeFuehrungState,
  leererTag,
  speichereFuehrungState,
  summeMetriken,
  tagHatAbendCheckStoff,
  tageBisEnde,
  type FuehrungState,
} from '@/lib/fuehrung/store'
import { baueWochenReview, istSonntag } from '@/lib/fuehrung/wochen-review'
import { appInputClass, appSecondaryBtnClass } from '@/lib/app-ui'

type TabId = 'heute' | 'plan' | 'mitarbeiter' | 'saetze'

const TABS: { id: TabId; label: string; shortLabel: string; accent: 'teal' | 'sky' | 'emerald' | 'violet' }[] =
  [
    { id: 'heute', label: 'Heute', shortLabel: 'Heute', accent: 'teal' },
    { id: 'plan', label: 'Plan', shortLabel: 'Plan', accent: 'emerald' },
    { id: 'mitarbeiter', label: 'Mitarbeiter', shortLabel: 'Team', accent: 'sky' },
    { id: 'saetze', label: 'Sätze', shortLabel: 'Sätze', accent: 'violet' },
  ]

function isTabId(v: string | null): v is TabId {
  return TABS.some((t) => t.id === v)
}

/** Alte Deep-Links → neue Tabs. */
function mapLegacyTab(v: string | null): TabId | null {
  if (isTabId(v)) return v
  if (!v) return null
  if (v === 'werkzeug') return 'saetze'
  if (v === 'fokus' || v === 'log' || v === 'personen' || v === 'sparring' || v === 'review' || v === 'bilanz' || v === 'notizen')
    return 'plan'
  return null
}

export function FuehrungClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const tabParam = searchParams.get('tab')
  const [tab, setTab] = useState<TabId>(mapLegacyTab(tabParam) ?? 'heute')
  const [state, setState] = useState<FuehrungState>(defaultFuehrungState)
  const [ready, setReady] = useState(false)
  const [mantraEdit, setMantraEdit] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const heute = heuteIso()

  useEffect(() => {
    setState(ladeFuehrungState())
    setReady(true)
  }, [])

  useEffect(() => {
    const mapped = mapLegacyTab(tabParam)
    if (mapped) setTab(mapped)
  }, [tabParam])

  useEffect(() => {
    if (!ready) return
    speichereFuehrungState(state)
  }, [state, ready])

  function selectTab(id: TabId) {
    setTab(id)
    const qs = id === 'heute' ? '' : `?tab=${id}`
    router.replace(`${pathname}${qs}`, { scroll: false })
  }

  const tag = state.tage[heute] ?? leererTag(heute)
  const wocheNr = aktuelleWochenNr(state.challengeStart, heute, FUEHRUNG_PLAN_SLOTS)
  const lernNr = FUEHRUNG_WOCHEN.find((w) => w.nr === wocheNr)?.lernNr ?? null
  const restTage = tageBisEnde(state.challengeStart, state.challengeTage, heute)
  const ende = challengeEndeIso(state.challengeStart, state.challengeTage)
  const metriken = useMemo(
    () => summeMetriken(state.tage, state.situationen),
    [state.tage, state.situationen],
  )
  const streak = useMemo(() => berechneAbendCheckStreak(state.tage, heute), [state.tage, heute])
  const fragenHeute = state.mitarbeiterFragen.filter((f) => f.datum === heute).length
  const wochenReview = useMemo(() => baueWochenReview(state, heute), [state, heute])
  const sonntagReviewOffen =
    ready && istSonntag() && state.lastWochenReviewKey !== wochenReview.wochenKey
  const abendOffen = ready && abendCheckOffen(state)

  function patchTag(patch: Partial<typeof tag>) {
    setState((s) => {
      const cur = s.tage[heute] ?? leererTag(heute)
      return { ...s, tage: { ...s.tage, [heute]: { ...cur, ...patch, datum: heute } } }
    })
  }

  function togglePrinzip(id: string) {
    const set = new Set(tag.prinzipIds)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    patchTag({ prinzipIds: [...set] })
  }

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId(null), 1600)
    } catch {
      /* ignore */
    }
  }

  if (!ready) {
    return (
      <PageChrome density="compact" className="max-w-3xl">
        <p className="text-sm text-[var(--app-text-muted)]">Laden …</p>
      </PageChrome>
    )
  }

  return (
    <PageChrome density="compact" className="max-w-3xl">
      <PageHero
        density="compact"
        eyebrow="Omnia · Persönlich"
        title="Führung"
        description={
          <>
            {FUEHRUNG_KONTEXT.rolle}. Woche 1: wahrnehmen — wie oft holen dich Mitarbeiter wirklich?
          </>
        }
      />

      {sonntagReviewOffen ? (
        <button
          type="button"
          onClick={() => selectTab('plan')}
          className="w-full rounded-[var(--app-radius-lg)] border border-teal-500/40 bg-teal-500/10 px-4 py-3 text-left"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
            Sonntag · Wochen-Review
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--app-text)]">
            Unter Plan → Lernwoche 6 (Bilanz) öffnen
          </p>
        </button>
      ) : null}

      {abendOffen ? (
        <button
          type="button"
          onClick={() => selectTab('heute')}
          className="w-full rounded-[var(--app-radius-lg)] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Abend-Check offen
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--app-text)]">
            2 Minuten — Tag abschließen
          </p>
        </button>
      ) : null}

      <div className="overflow-hidden rounded-[var(--app-radius-lg)] border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-[var(--app-surface)] to-[var(--app-surface)] px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
              Führungs-Plan
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--app-text)]">
              {restTage > 0
                ? `${restTage} Tage · ${lernNr != null ? `Lernwoche ${lernNr}/6` : 'Pause (Urlaub)'}`
                : lernNr != null
                  ? `Lernwoche ${lernNr}/6 · Zeitraum vorbei`
                  : 'Pause · Zeitraum vorbei'}
            </p>
            <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
              Ziel {ende.split('-').reverse().join('.')} · Fragen heute: {fragenHeute}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-center">
            <Kpi label="Fragen heute" value={fragenHeute} />
            <Kpi label="Streak" value={streak} />
            <Kpi label="Redirects" value={metriken.redirects} />
          </div>
        </div>
      </div>

      <PageSubTabs
        selectId="fuehrung-tabs"
        tabs={TABS}
        active={tab}
        onChange={selectTab}
        ariaLabel="Führung Bereiche"
      />

      {tab === 'heute' && (
        <div className="space-y-3">
          <PageSection titleId="fuehrung-mantra" title="Mantra" density="compact">
            <PageSectionPanel density="compact">
              {mantraEdit ? (
                <div className="space-y-2">
                  <textarea
                    value={state.mantra}
                    onChange={(e) => setState((s) => ({ ...s, mantra: e.target.value }))}
                    rows={7}
                    className={`${appInputClass} resize-y`}
                  />
                  <button
                    type="button"
                    className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white"
                    onClick={() => setMantraEdit(false)}
                  >
                    Fertig
                  </button>
                </div>
              ) : (
                <div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--app-text)]">
                    {state.mantra}
                  </p>
                  <button
                    type="button"
                    className={`mt-3 ${appSecondaryBtnClass}`}
                    onClick={() => setMantraEdit(true)}
                  >
                    Anpassen
                  </button>
                </div>
              )}
            </PageSectionPanel>
          </PageSection>

          <PageSection titleId="fuehrung-prinzipien" title="Heute leben" density="compact">
            <PageSectionPanel density="compact" className="space-y-2">
              {FUEHRUNG_PRINZIPIEN.map((p) => {
                const on = tag.prinzipIds.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePrinzip(p.id)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left ${
                      on
                        ? 'border-teal-500/40 bg-teal-500/10'
                        : 'border-[var(--app-border)] bg-[var(--app-surface-muted)]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                        on ? 'bg-teal-600 text-white' : 'bg-[var(--app-surface)] ring-1 ring-[var(--app-border)]'
                      }`}
                    >
                      {on ? '✓' : ''}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[var(--app-text)]">{p.titel}</span>
                      <span className="mt-0.5 block text-xs text-[var(--app-text-muted)]">{p.text}</span>
                    </span>
                  </button>
                )
              })}
            </PageSectionPanel>
          </PageSection>

          <PageSection titleId="fuehrung-heute-zaehler" title="Kurz notiert" density="compact">
            <PageSectionPanel density="compact" className="space-y-3">
              <button
                type="button"
                onClick={() => selectTab('mitarbeiter')}
                className="w-full rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-2.5 text-left text-sm font-semibold text-[var(--app-text)]"
              >
                Mitarbeiter-Fragen heute: {fragenHeute} → erfassen
              </button>
              <label className="block">
                <span className="app-eyebrow text-[10px]">Win</span>
                <input
                  value={tag.win}
                  onChange={(e) => patchTag({ win: e.target.value })}
                  className={`${appInputClass} mt-1`}
                  placeholder="Was lief gut?"
                />
              </label>
              <label className="block">
                <span className="app-eyebrow text-[10px]">Ausrutscher</span>
                <input
                  value={tag.ausrutscher}
                  onChange={(e) => patchTag({ ausrutscher: e.target.value })}
                  className={`${appInputClass} mt-1`}
                  placeholder="Wo hast du dich benutzen lassen?"
                />
              </label>
            </PageSectionPanel>
          </PageSection>

          <PageSection titleId="fuehrung-abend" title="Abend-Check" density="compact">
            <PageSectionPanel density="compact">
              <p className="mb-2 text-xs font-medium text-teal-700 dark:text-teal-300">
                Streak: {streak} Tag{streak === 1 ? '' : 'e'}
              </p>
              <ul className="space-y-1 text-sm text-[var(--app-text-muted)]">
                {FUEHRUNG_ABEND_FRAGEN.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
              {!tagHatAbendCheckStoff(tag) && fragenHeute === 0 ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Noch wenig Stoff — Mitarbeiter-Fragen oder Win eintragen.
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => patchTag({ abendCheckErledigt: !tag.abendCheckErledigt })}
                className={`mt-3 w-full rounded-xl px-3 py-2.5 text-sm font-semibold ${
                  tag.abendCheckErledigt
                    ? 'bg-teal-600/20 text-teal-700 ring-1 ring-teal-500/40 dark:text-teal-300'
                    : 'bg-teal-600 text-white hover:bg-teal-500'
                }`}
              >
                {tag.abendCheckErledigt ? 'Abend-Check erledigt ✓' : 'Abend-Check abhaken'}
              </button>
            </PageSectionPanel>
          </PageSection>
        </div>
      )}

      {tab === 'plan' && (
        <FuehrungWochenPanel
          state={state}
          setState={setState}
          onOpenMitarbeiter={() => selectTab('mitarbeiter')}
        />
      )}

      {tab === 'mitarbeiter' && <FuehrungMitarbeiterPanel state={state} setState={setState} />}

      {tab === 'saetze' && (
        <div className="space-y-3">
          <PageSection titleId="fuehrung-wahrheit" title="Die Balance" density="compact">
            <PageSectionPanel density="compact">
              <p className="text-sm leading-relaxed text-[var(--app-text)]">{FUEHRUNG_KONTEXT.wahrheit}</p>
            </PageSectionPanel>
          </PageSection>
          <PageSection titleId="fuehrung-skripte" title="Bereite Sätze" density="compact">
            <div className="divide-y divide-[var(--app-border)]">
              {FUEHRUNG_SKRIPTE.map((s) => (
                <PageSectionPanel key={s.id} density="compact">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
                    {s.situation}
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-[var(--app-text)]">„{s.satz}“</p>
                  <button
                    type="button"
                    className={`mt-2 ${appSecondaryBtnClass}`}
                    onClick={() => void copyText(s.id, s.satz)}
                  >
                    {copiedId === s.id ? 'Kopiert' : 'Kopieren'}
                  </button>
                </PageSectionPanel>
              ))}
            </div>
          </PageSection>
        </div>
      )}
    </PageChrome>
  )
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[var(--app-surface-muted)] px-3 py-2 ring-1 ring-[var(--app-border)]">
      <p className="text-lg font-bold tabular-nums text-teal-600 dark:text-teal-400">{value}</p>
      <p className="text-[10px] font-medium text-[var(--app-text-muted)]">{label}</p>
    </div>
  )
}
