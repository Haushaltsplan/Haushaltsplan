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
import {
  FuehrungErinnerungenPanel,
  FuehrungReviewPanel,
  FuehrungSparringPanel,
} from '@/components/fuehrung/fuehrung-extras'
import { baueFuehrungBilanz } from '@/lib/fuehrung/bilanz'
import {
  FUEHRUNG_ABEND_FRAGEN,
  FUEHRUNG_KONTEXT,
  FUEHRUNG_PRINZIPIEN,
  FUEHRUNG_REAKTIONEN,
  FUEHRUNG_SITUATION_TYPEN,
  FUEHRUNG_SKRIPTE,
  FUEHRUNG_WOCHEN,
} from '@/lib/fuehrung/content'
import { berechneAbendCheckStreak } from '@/lib/fuehrung/streak'
import {
  abendCheckOffen,
  aktuelleWochenNr,
  challengeEndeIso,
  defaultFuehrungState,
  FUEHRUNG_FOKUS_DEFAULT_MIN,
  formatMmSs,
  fokusRestSekunden,
  heuteIso,
  ladeFuehrungState,
  leererTag,
  newId,
  speichereFuehrungState,
  summeMetriken,
  tagHatAbendCheckStoff,
  tageBisEnde,
  type FuehrungReaktion,
  type FuehrungSituationTyp,
  type FuehrungState,
} from '@/lib/fuehrung/store'
import { baueWochenReview, istSonntag } from '@/lib/fuehrung/wochen-review'
import { appInputClass, appSecondaryBtnClass } from '@/lib/app-ui'

type TabId =
  | 'heute'
  | 'fokus'
  | 'log'
  | 'personen'
  | 'sparring'
  | 'review'
  | 'bilanz'
  | 'werkzeug'
  | 'plan'
  | 'notizen'

const TABS: { id: TabId; label: string; shortLabel: string; accent: 'teal' | 'sky' | 'emerald' | 'violet' }[] =
  [
    { id: 'heute', label: 'Heute', shortLabel: 'Heute', accent: 'teal' },
    { id: 'fokus', label: 'Fokus', shortLabel: 'Fokus', accent: 'sky' },
    { id: 'log', label: 'Situationen', shortLabel: 'Log', accent: 'emerald' },
    { id: 'personen', label: 'Personen', shortLabel: 'Team', accent: 'violet' },
    { id: 'sparring', label: 'KI-Sparring', shortLabel: 'KI', accent: 'teal' },
    { id: 'review', label: 'Wochen-Review', shortLabel: 'Review', accent: 'emerald' },
    { id: 'bilanz', label: 'Bilanz', shortLabel: 'Bilanz', accent: 'sky' },
    { id: 'werkzeug', label: 'Sätze', shortLabel: 'Sätze', accent: 'violet' },
    { id: 'plan', label: '6 Wochen', shortLabel: 'Plan', accent: 'emerald' },
    { id: 'notizen', label: 'Notizen', shortLabel: 'Notizen', accent: 'teal' },
  ]

function formatDeDatum(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function isTabId(v: string | null): v is TabId {
  return TABS.some((t) => t.id === v)
}

export function FuehrungClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const tabParam = searchParams.get('tab')
  const [tab, setTab] = useState<TabId>(isTabId(tabParam) ? tabParam : 'heute')

  function selectTab(id: TabId) {
    setTab(id)
    const qs = id === 'heute' ? '' : `?tab=${id}`
    router.replace(`${pathname}${qs}`, { scroll: false })
  }
  const [state, setState] = useState<FuehrungState>(defaultFuehrungState)
  const [ready, setReady] = useState(false)
  const [mantraEdit, setMantraEdit] = useState(false)
  const [journalText, setJournalText] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [notizTitel, setNotizTitel] = useState('')
  const [notizText, setNotizText] = useState('')
  const [notizEditId, setNotizEditId] = useState<string | null>(null)
  const [fokusMin, setFokusMin] = useState(FUEHRUNG_FOKUS_DEFAULT_MIN)
  const [fokusTick, setFokusTick] = useState(0)
  const [sitTyp, setSitTyp] = useState<FuehrungSituationTyp>('unterbrechung')
  const [sitReaktion, setSitReaktion] = useState<FuehrungReaktion>('redirect')
  const [sitPerson, setSitPerson] = useState('')
  const [sitText, setSitText] = useState('')
  const [personName, setPersonName] = useState('')
  const [personMuster, setPersonMuster] = useState('')
  const [personStrategie, setPersonStrategie] = useState('')
  const [personNotiz, setPersonNotiz] = useState('')
  const [personEditId, setPersonEditId] = useState<string | null>(null)
  const [bilanzCopied, setBilanzCopied] = useState(false)

  const heute = heuteIso()

  useEffect(() => {
    setState(ladeFuehrungState())
    setReady(true)
  }, [])

  useEffect(() => {
    if (isTabId(tabParam)) setTab(tabParam)
  }, [tabParam])

  useEffect(() => {
    if (!ready) return
    speichereFuehrungState(state)
  }, [state, ready])

  useEffect(() => {
    if (!state.aktiverFokus) return
    const id = window.setInterval(() => setFokusTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [state.aktiverFokus])

  const tag = state.tage[heute] ?? leererTag(heute)
  const wocheNr = aktuelleWochenNr(state.challengeStart, heute)
  const restTage = tageBisEnde(state.challengeStart, state.challengeTage, heute)
  const ende = challengeEndeIso(state.challengeStart, state.challengeTage)
  const metriken = useMemo(
    () => summeMetriken(state.tage, state.situationen),
    [state.tage, state.situationen],
  )
  const streak = useMemo(() => berechneAbendCheckStreak(state.tage, heute), [state.tage, heute])
  const wochenReview = useMemo(() => baueWochenReview(state, heute), [state, heute])
  const sonntagReviewOffen =
    ready && istSonntag() && state.lastWochenReviewKey !== wochenReview.wochenKey
  const abendOffen = ready && abendCheckOffen(state)
  const bilanzText = useMemo(() => baueFuehrungBilanz(state, heute), [state, heute])
  const fokusRest = useMemo(() => {
    if (!state.aktiverFokus) return 0
    return fokusRestSekunden(state.aktiverFokus)
  }, [state.aktiverFokus, fokusTick])

  const fokusAbgeschlossenHeute = state.fokusBloecke.filter(
    (f) => f.datum === heute && f.abgeschlossen,
  ).length
  const situationenHeute = state.situationen.filter((s) => s.datum === heute)

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

  function toggleWochenAufgabe(nr: number, idx: number) {
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

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId(null), 1600)
    } catch {
      /* ignore */
    }
  }

  function addJournal() {
    const text = journalText.trim()
    if (!text) return
    setState((s) => ({
      ...s,
      journal: [
        { id: newId(), datum: heute, text, createdAt: new Date().toISOString() },
        ...s.journal,
      ].slice(0, 80),
    }))
    setJournalText('')
  }

  function resetNotizForm() {
    setNotizTitel('')
    setNotizText('')
    setNotizEditId(null)
  }

  function speichereNotiz() {
    const text = notizText.trim()
    if (!text) return
    const titel = notizTitel.trim() || 'Notiz'
    const now = new Date().toISOString()
    if (notizEditId) {
      setState((s) => ({
        ...s,
        notizen: s.notizen.map((n) =>
          n.id === notizEditId ? { ...n, titel, text, updatedAt: now } : n,
        ),
      }))
    } else {
      setState((s) => ({
        ...s,
        notizen: [
          { id: newId(), titel, text, createdAt: now, updatedAt: now },
          ...s.notizen,
        ].slice(0, 120),
      }))
    }
    resetNotizForm()
  }

  function startFokus() {
    const dauer = Math.min(120, Math.max(15, fokusMin || FUEHRUNG_FOKUS_DEFAULT_MIN))
    setState((s) => ({
      ...s,
      aktiverFokus: { gestartetAt: new Date().toISOString(), dauerMin: dauer },
    }))
  }

  function beendeFokus(abgeschlossen: boolean) {
    setState((s) => {
      if (!s.aktiverFokus) return s
      const block = {
        id: newId(),
        datum: heute,
        dauerMin: s.aktiverFokus.dauerMin,
        gestartetAt: s.aktiverFokus.gestartetAt,
        beendetAt: new Date().toISOString(),
        abgeschlossen,
        notiz: '',
      }
      return {
        ...s,
        aktiverFokus: null,
        fokusBloecke: [block, ...s.fokusBloecke].slice(0, 200),
      }
    })
  }

  function addSituation() {
    const person = state.personen.find((p) => p.name === sitPerson.trim())
    setState((s) => {
      const sit = {
        id: newId(),
        datum: heute,
        typ: sitTyp,
        reaktion: sitReaktion,
        personId: person?.id ?? null,
        personName: sitPerson.trim(),
        text: sitText.trim(),
        createdAt: new Date().toISOString(),
      }
      const cur = s.tage[heute] ?? leererTag(heute)
      let redirects = cur.redirects
      let neins = cur.neins
      if (sitReaktion === 'redirect') redirects += 1
      if (sitReaktion === 'nein' || sitReaktion === 'spaeter') neins += 1
      return {
        ...s,
        situationen: [sit, ...s.situationen].slice(0, 400),
        tage: {
          ...s.tage,
          [heute]: { ...cur, redirects, neins, datum: heute },
        },
      }
    })
    setSitText('')
  }

  function speicherePerson() {
    const name = personName.trim()
    if (!name) return
    const now = new Date().toISOString()
    if (personEditId) {
      setState((s) => ({
        ...s,
        personen: s.personen.map((p) =>
          p.id === personEditId
            ? {
                ...p,
                name,
                muster: personMuster.trim(),
                strategie: personStrategie.trim(),
                notiz: personNotiz.trim(),
                updatedAt: now,
              }
            : p,
        ),
      }))
    } else {
      setState((s) => ({
        ...s,
        personen: [
          {
            id: newId(),
            name,
            muster: personMuster.trim(),
            strategie: personStrategie.trim(),
            notiz: personNotiz.trim(),
            createdAt: now,
            updatedAt: now,
          },
          ...s.personen,
        ].slice(0, 80),
      }))
    }
    setPersonName('')
    setPersonMuster('')
    setPersonStrategie('')
    setPersonNotiz('')
    setPersonEditId(null)
  }

  async function copyBilanz() {
    try {
      await navigator.clipboard.writeText(bilanzText)
      setBilanzCopied(true)
      window.setTimeout(() => setBilanzCopied(false), 2000)
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
            {FUEHRUNG_KONTEXT.rolle}. Freundlich bleiben — nicht der einfachste Weg für alle anderen
            sein.
          </>
        }
      />

      {sonntagReviewOffen ? (
        <button
          type="button"
          onClick={() => selectTab('review')}
          className="w-full rounded-[var(--app-radius-lg)] border border-teal-500/40 bg-teal-500/10 px-4 py-3 text-left transition hover:bg-teal-500/15"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-300">
            Sonntag · Wochen-Review
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--app-text)]">
            {wochenReview.redirects} Redirects · {wochenReview.fokusMin} Min Fokus · Streak {streak}
          </p>
        </button>
      ) : null}

      {abendOffen ? (
        <button
          type="button"
          onClick={() => selectTab('heute')}
          className="w-full rounded-[var(--app-radius-lg)] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left transition hover:bg-amber-500/15"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
            Abend-Check offen
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--app-text)]">
            2 Minuten: Prinzipien, Zähler, Win — dann abhaken.
          </p>
        </button>
      ) : null}

      <div className="overflow-hidden rounded-[var(--app-radius-lg)] border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-[var(--app-surface)] to-[var(--app-surface)] px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
              6-Wochen-Challenge
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--app-text)]">
              {restTage > 0
                ? `${restTage} Tage bis zur Bilanz mit dem Chef`
                : restTage === 0
                  ? 'Heute ist Bilanz-Tag'
                  : 'Challenge-Zeitraum vorbei — weiterführen lohnt sich'}
            </p>
            <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
              Woche {wocheNr}/6 · Ziel {formatDeDatum(ende)}
              {state.aktiverFokus ? ` · Fokus ${formatMmSs(fokusRest)}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-center">
            <Kpi label="Redirects" value={metriken.redirects} />
            <Kpi label="Nein/Später" value={metriken.neins} />
            <Kpi label="Streak" value={streak} />
            <Kpi label="Fokus heute" value={fokusAbgeschlossenHeute} />
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{
              width: `${Math.min(
                100,
                Math.max(0, ((state.challengeTage - Math.max(0, restTage)) / state.challengeTage) * 100),
              )}%`,
            }}
          />
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
                    rows={8}
                    className={`${appInputClass} resize-y leading-relaxed`}
                  />
                  <button
                    type="button"
                    className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500"
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
                    Mantra anpassen
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
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      on
                        ? 'border-teal-500/40 bg-teal-500/10'
                        : 'border-[var(--app-border)] bg-[var(--app-surface-muted)] hover:border-[var(--app-border-strong)]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                        on
                          ? 'bg-teal-600 text-white'
                          : 'bg-[var(--app-surface)] text-[var(--app-text-muted)] ring-1 ring-[var(--app-border)]'
                      }`}
                    >
                      {on ? '✓' : ''}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[var(--app-text)]">{p.titel}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-[var(--app-text-muted)]">
                        {p.text}
                      </span>
                    </span>
                  </button>
                )
              })}
            </PageSectionPanel>
          </PageSection>

          <PageSection titleId="fuehrung-zaehler" title="Heute gezählt" density="compact">
            <PageSectionPanel density="compact">
              <div className="grid grid-cols-2 gap-3">
                <Counter
                  label="Redirects"
                  value={tag.redirects}
                  onChange={(n) => patchTag({ redirects: n })}
                />
                <Counter
                  label="Nein / Später"
                  value={tag.neins}
                  onChange={(n) => patchTag({ neins: n })}
                />
              </div>
              <p className="mt-2 text-[11px] text-[var(--app-text-muted)]">
                Situationen heute: {situationenHeute.length} · Fokusblöcke: {fokusAbgeschlossenHeute}
              </p>
              <label className="mt-3 block">
                <span className="app-eyebrow text-[10px]">Ein Win heute</span>
                <input
                  value={tag.win}
                  onChange={(e) => patchTag({ win: e.target.value })}
                  placeholder="z. B. Lagerfrage mit Gegenfrage gelöst"
                  className={`${appInputClass} mt-1`}
                />
              </label>
              <label className="mt-3 block">
                <span className="app-eyebrow text-[10px]">Ein Ausrutscher</span>
                <input
                  value={tag.ausrutscher}
                  onChange={(e) => patchTag({ ausrutscher: e.target.value })}
                  placeholder="z. B. wieder alles selbst gemacht bei …"
                  className={`${appInputClass} mt-1`}
                />
              </label>
              <label className="mt-3 block">
                <span className="app-eyebrow text-[10px]">Tagesnotiz</span>
                <textarea
                  value={tag.notiz}
                  onChange={(e) => patchTag({ notiz: e.target.value })}
                  rows={3}
                  placeholder="Freie Notiz zum heutigen Tag …"
                  className={`${appInputClass} mt-1 resize-y`}
                />
              </label>
            </PageSectionPanel>
          </PageSection>

          <PageSection titleId="fuehrung-abend" title="Abend-Check (2 Min)" density="compact">
            <PageSectionPanel density="compact">
              <p className="mb-2 text-xs font-medium text-teal-700 dark:text-teal-300">
                Streak: {streak} Tag{streak === 1 ? '' : 'e'} in Folge
              </p>
              <ul className="space-y-1.5 text-sm text-[var(--app-text-muted)]">
                {FUEHRUNG_ABEND_FRAGEN.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
              {!tagHatAbendCheckStoff(tag) ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  Noch wenig eingetragen — Win oder Zähler helfen für die Bilanz.
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

          <FuehrungErinnerungenPanel
            state={state}
            onChange={(patch) =>
              setState((s) => ({ ...s, erinnerungen: { ...s.erinnerungen, ...patch } }))
            }
          />

          <PageSection titleId="fuehrung-woche-kurz" title={`Woche ${wocheNr}`} density="compact">
            <PageSectionPanel density="compact">
              {(() => {
                const w = FUEHRUNG_WOCHEN[wocheNr - 1]
                if (!w) return null
                const done = new Set(state.wochenFortschritt[String(w.nr)] ?? [])
                return (
                  <div>
                    <p className="text-sm font-semibold text-[var(--app-text)]">
                      {w.titel}: {w.fokus}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {w.aufgaben.map((a, i) => (
                        <li key={i}>
                          <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--app-text)]">
                            <input
                              type="checkbox"
                              checked={done.has(i)}
                              onChange={() => toggleWochenAufgabe(w.nr, i)}
                              className="mt-1"
                            />
                            <span className={done.has(i) ? 'text-[var(--app-text-muted)] line-through' : ''}>
                              {a}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })()}
            </PageSectionPanel>
          </PageSection>
        </div>
      )}

      {tab === 'fokus' && (
        <div className="space-y-3">
          <PageSection titleId="fuehrung-fokus-timer" title="Fokusblock" density="compact">
            <PageSectionPanel density="compact">
              {state.aktiverFokus ? (
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
                    Läuft · {state.aktiverFokus.dauerMin} Min geplant
                  </p>
                  <p className="mt-2 font-mono text-5xl font-bold tabular-nums tracking-tight text-[var(--app-text)]">
                    {formatMmSs(fokusRest)}
                  </p>
                  <p className="mt-2 text-xs text-[var(--app-text-muted)]">
                    Nur echte Eskalationen. Alles andere: Später.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500"
                      onClick={() => beendeFokus(true)}
                    >
                      Abschließen
                    </button>
                    <button
                      type="button"
                      className={appSecondaryBtnClass}
                      onClick={() => beendeFokus(false)}
                    >
                      Abbrechen
                    </button>
                  </div>
                  {fokusRest === 0 ? (
                    <p className="mt-3 text-sm font-medium text-teal-600 dark:text-teal-400">
                      Zeit um — Block abschließen?
                    </p>
                  ) : null}
                </div>
              ) : (
                <div>
                  <label className="block">
                    <span className="app-eyebrow text-[10px]">Dauer (Minuten)</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {[30, 45, 60, 90].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setFokusMin(m)}
                          className={`rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${
                            fokusMin === m
                              ? 'bg-teal-600 text-white ring-teal-600'
                              : 'bg-[var(--app-surface-muted)] text-[var(--app-text)] ring-[var(--app-border)]'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </label>
                  <button
                    type="button"
                    onClick={startFokus}
                    className="mt-4 w-full rounded-xl bg-teal-600 px-3 py-3 text-sm font-semibold text-white hover:bg-teal-500"
                  >
                    Fokus starten · {fokusMin} Min
                  </button>
                  <p className="mt-2 text-xs text-[var(--app-text-muted)]">
                    Signal nach außen: Kopfhörer / „nicht stören“. Innere Regel: keine Soforthilfe.
                  </p>
                </div>
              )}
            </PageSectionPanel>
          </PageSection>

          <PageSection titleId="fuehrung-fokus-hist" title="Bisherige Blöcke" density="compact">
            {state.fokusBloecke.length === 0 ? (
              <PageSectionPanel density="compact">
                <p className="text-sm italic text-[var(--app-text-muted)]">Noch keine Fokusblöcke.</p>
              </PageSectionPanel>
            ) : (
              <div className="divide-y divide-[var(--app-border)]">
                {state.fokusBloecke.slice(0, 20).map((f) => (
                  <PageSectionPanel key={f.id} density="compact">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--app-text)]">
                        {formatDeDatum(f.datum)} · {f.dauerMin} Min
                      </p>
                      <span
                        className={`text-[10px] font-bold uppercase ${
                          f.abgeschlossen
                            ? 'text-teal-600 dark:text-teal-400'
                            : 'text-[var(--app-text-muted)]'
                        }`}
                      >
                        {f.abgeschlossen ? 'OK' : 'abgebrochen'}
                      </span>
                    </div>
                  </PageSectionPanel>
                ))}
              </div>
            )}
          </PageSection>
        </div>
      )}

      {tab === 'log' && (
        <div className="space-y-3">
          <PageSection titleId="fuehrung-sit-neu" title="Situation erfassen" density="compact">
            <PageSectionPanel density="compact" className="space-y-3">
              <div>
                <p className="app-eyebrow text-[10px]">Typ</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {FUEHRUNG_SITUATION_TYPEN.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSitTyp(t.id)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                        sitTyp === t.id
                          ? 'bg-teal-600 text-white'
                          : 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]'
                      }`}
                    >
                      {t.kurz}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="app-eyebrow text-[10px]">Deine Reaktion</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {FUEHRUNG_REAKTIONEN.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSitReaktion(r.id)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                        sitReaktion === r.id
                          ? r.gut
                            ? 'bg-teal-600 text-white'
                            : 'bg-amber-600 text-white'
                          : 'bg-[var(--app-surface-muted)] text-[var(--app-text-muted)]'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="app-eyebrow text-[10px]">Person / Bereich</span>
                <input
                  list="fuehrung-personen-list"
                  value={sitPerson}
                  onChange={(e) => setSitPerson(e.target.value)}
                  placeholder="Name oder z. B. Lager"
                  className={`${appInputClass} mt-1`}
                />
                <datalist id="fuehrung-personen-list">
                  {state.personen.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="app-eyebrow text-[10px]">Kurznotiz (optional)</span>
                <input
                  value={sitText}
                  onChange={(e) => setSitText(e.target.value)}
                  placeholder="Was war der Auslöser?"
                  className={`${appInputClass} mt-1`}
                />
              </label>
              <button
                type="button"
                onClick={addSituation}
                className="w-full rounded-xl bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-teal-500"
              >
                Situation speichern
              </button>
            </PageSectionPanel>
          </PageSection>

          <PageSection titleId="fuehrung-sit-list" title="Log" density="compact">
            {state.situationen.length === 0 ? (
              <PageSectionPanel density="compact">
                <p className="text-sm italic text-[var(--app-text-muted)]">
                  Noch keine Situationen — ab Woche 1 hier mitzählen.
                </p>
              </PageSectionPanel>
            ) : (
              <div className="divide-y divide-[var(--app-border)]">
                {state.situationen.slice(0, 60).map((s) => {
                  const typ = FUEHRUNG_SITUATION_TYPEN.find((t) => t.id === s.typ)?.label ?? s.typ
                  const reak = FUEHRUNG_REAKTIONEN.find((r) => r.id === s.reaktion)
                  return (
                    <PageSectionPanel key={s.id} density="compact">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
                            {formatDeDatum(s.datum)} · {typ}
                            {s.personName ? ` · ${s.personName}` : ''}
                          </p>
                          <p className="mt-1 text-sm font-medium text-[var(--app-text)]">
                            {reak?.label ?? s.reaktion}
                          </p>
                          {s.text ? (
                            <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{s.text}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                          onClick={() =>
                            setState((st) => ({
                              ...st,
                              situationen: st.situationen.filter((x) => x.id !== s.id),
                            }))
                          }
                        >
                          Löschen
                        </button>
                      </div>
                    </PageSectionPanel>
                  )
                })}
              </div>
            )}
          </PageSection>
        </div>
      )}

      {tab === 'personen' && (
        <div className="space-y-3">
          <PageSection
            titleId="fuehrung-person-form"
            title={personEditId ? 'Person bearbeiten' : 'Person / Muster'}
            density="compact"
          >
            <PageSectionPanel density="compact" className="space-y-3">
              <label className="block">
                <span className="app-eyebrow text-[10px]">Name</span>
                <input
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="Vorname oder Team"
                  className={`${appInputClass} mt-1`}
                />
              </label>
              <label className="block">
                <span className="app-eyebrow text-[10px]">Muster</span>
                <input
                  value={personMuster}
                  onChange={(e) => setPersonMuster(e.target.value)}
                  placeholder="z. B. fragt immer, ohne selbst zu prüfen"
                  className={`${appInputClass} mt-1`}
                />
              </label>
              <label className="block">
                <span className="app-eyebrow text-[10px]">Deine Strategie</span>
                <input
                  value={personStrategie}
                  onChange={(e) => setPersonStrategie(e.target.value)}
                  placeholder="z. B. immer zuerst Gegenfrage"
                  className={`${appInputClass} mt-1`}
                />
              </label>
              <label className="block">
                <span className="app-eyebrow text-[10px]">Notiz</span>
                <textarea
                  value={personNotiz}
                  onChange={(e) => setPersonNotiz(e.target.value)}
                  rows={3}
                  className={`${appInputClass} mt-1 resize-y`}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={speicherePerson}
                  disabled={!personName.trim()}
                  className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
                >
                  Speichern
                </button>
                {personEditId ? (
                  <button
                    type="button"
                    className={appSecondaryBtnClass}
                    onClick={() => {
                      setPersonEditId(null)
                      setPersonName('')
                      setPersonMuster('')
                      setPersonStrategie('')
                      setPersonNotiz('')
                    }}
                  >
                    Abbrechen
                  </button>
                ) : null}
              </div>
            </PageSectionPanel>
          </PageSection>

          <PageSection titleId="fuehrung-person-list" title="Team-Muster" density="compact">
            {state.personen.length === 0 ? (
              <PageSectionPanel density="compact">
                <p className="text-sm italic text-[var(--app-text-muted)]">
                  Noch keine Personen — trage ein, wer dich besonders oft holt.
                </p>
              </PageSectionPanel>
            ) : (
              <div className="divide-y divide-[var(--app-border)]">
                {state.personen.map((p) => {
                  const count = state.situationen.filter(
                    (s) => s.personId === p.id || s.personName === p.name,
                  ).length
                  return (
                    <PageSectionPanel key={p.id} density="compact">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--app-text)]">
                            {p.name}
                            {count ? (
                              <span className="ml-2 text-[10px] font-medium text-[var(--app-text-muted)]">
                                {count}× im Log
                              </span>
                            ) : null}
                          </p>
                          {p.muster ? (
                            <p className="mt-1 text-xs text-[var(--app-text-muted)]">Muster: {p.muster}</p>
                          ) : null}
                          {p.strategie ? (
                            <p className="mt-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                              Strategie: {p.strategie}
                            </p>
                          ) : null}
                          {p.notiz ? (
                            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--app-text)]">
                              {p.notiz}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={appSecondaryBtnClass}
                            onClick={() => {
                              setPersonEditId(p.id)
                              setPersonName(p.name)
                              setPersonMuster(p.muster)
                              setPersonStrategie(p.strategie)
                              setPersonNotiz(p.notiz)
                            }}
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                            onClick={() =>
                              setState((s) => ({
                                ...s,
                                personen: s.personen.filter((x) => x.id !== p.id),
                              }))
                            }
                          >
                            Löschen
                          </button>
                        </div>
                      </div>
                    </PageSectionPanel>
                  )
                })}
              </div>
            )}
          </PageSection>
        </div>
      )}

      {tab === 'sparring' && (
        <FuehrungSparringPanel
          state={state}
          onSave={(eintrag) =>
            setState((s) => ({ ...s, sparring: [eintrag, ...s.sparring].slice(0, 40) }))
          }
        />
      )}

      {tab === 'review' && (
        <FuehrungReviewPanel
          state={state}
          onDismissWeek={(key) => setState((s) => ({ ...s, lastWochenReviewKey: key }))}
        />
      )}

      {tab === 'bilanz' && (
        <div className="space-y-3">
          <PageSection titleId="fuehrung-bilanz" title="Fürs Chef-Gespräch" density="compact">
            <PageSectionPanel density="compact">
              <p className="text-xs text-[var(--app-text-muted)]">
                Automatisch aus deinen Einträgen — kopieren und mitnehmen oder vorlesen.
              </p>
              <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--app-surface-muted)] p-3 text-xs leading-relaxed text-[var(--app-text)] ring-1 ring-[var(--app-border)]">
                {bilanzText}
              </pre>
              <button
                type="button"
                onClick={copyBilanz}
                className="mt-3 rounded-xl bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-teal-500"
              >
                {bilanzCopied ? 'Kopiert' : 'Bilanz kopieren'}
              </button>
            </PageSectionPanel>
          </PageSection>
        </div>
      )}

      {tab === 'werkzeug' && (
        <div className="space-y-3">
          <PageSection titleId="fuehrung-wahrheit" title="Die Balance" density="compact">
            <PageSectionPanel density="compact">
              <p className="text-sm leading-relaxed text-[var(--app-text)]">{FUEHRUNG_KONTEXT.wahrheit}</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--app-text-muted)]">
                {FUEHRUNG_KONTEXT.ausloeser}
              </p>
            </PageSectionPanel>
          </PageSection>

          <PageSection titleId="fuehrung-skripte" title="Bereite Sätze" density="compact">
            <div className="divide-y divide-[var(--app-border)]">
              {FUEHRUNG_SKRIPTE.map((s) => (
                <PageSectionPanel key={s.id} density="compact">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--app-text-muted)]">
                    {s.situation}
                  </p>
                  <p className="mt-1.5 text-sm font-medium leading-relaxed text-[var(--app-text)]">
                    „{s.satz}“
                  </p>
                  <button
                    type="button"
                    className={`mt-2 ${appSecondaryBtnClass}`}
                    onClick={() => copyText(s.id, s.satz)}
                  >
                    {copiedId === s.id ? 'Kopiert' : 'Kopieren'}
                  </button>
                </PageSectionPanel>
              ))}
            </div>
          </PageSection>

          <PageSection titleId="fuehrung-regeln" title="Entscheidungsregel" density="compact">
            <PageSectionPanel density="compact" className="space-y-2 text-sm leading-relaxed">
              <p>
                <strong className="text-[var(--app-text)]">Sofort selbst:</strong>{' '}
                <span className="text-[var(--app-text-muted)]">
                  Führungsentscheidung, Risiko, Geld, Eskalation, nur du darfst.
                </span>
              </p>
              <p>
                <strong className="text-[var(--app-text)]">Zurückgeben:</strong>{' '}
                <span className="text-[var(--app-text-muted)]">
                  Wissen, das im Team liegen sollte; „Wie geht X?“
                </span>
              </p>
              <p>
                <strong className="text-[var(--app-text)]">Später:</strong>{' '}
                <span className="text-[var(--app-text-muted)]">
                  Fokusblock; nicht dringend; besserer Ansprechpartner existiert.
                </span>
              </p>
            </PageSectionPanel>
          </PageSection>
        </div>
      )}

      {tab === 'plan' && (
        <div className="space-y-3">
          {FUEHRUNG_WOCHEN.map((w) => {
            const done = new Set(state.wochenFortschritt[String(w.nr)] ?? [])
            const aktiv = w.nr === wocheNr
            return (
              <PageSection
                key={w.nr}
                titleId={`fuehrung-woche-${w.nr}`}
                title={`Woche ${w.nr} · ${w.titel}${aktiv ? ' · jetzt' : ''}`}
                density="compact"
              >
                <PageSectionPanel density="compact">
                  <p className="text-sm text-[var(--app-text-muted)]">{w.fokus}</p>
                  <ul className="mt-3 space-y-2">
                    {w.aufgaben.map((a, i) => (
                      <li key={i}>
                        <label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--app-text)]">
                          <input
                            type="checkbox"
                            checked={done.has(i)}
                            onChange={() => toggleWochenAufgabe(w.nr, i)}
                            className="mt-1"
                          />
                          <span className={done.has(i) ? 'text-[var(--app-text-muted)] line-through' : ''}>
                            {a}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </PageSectionPanel>
              </PageSection>
            )
          })}
        </div>
      )}

      {tab === 'notizen' && (
        <div className="space-y-3">
          <PageSection
            titleId="fuehrung-notiz-neu"
            title={notizEditId ? 'Notiz bearbeiten' : 'Neue Notiz'}
            density="compact"
          >
            <PageSectionPanel density="compact">
              <label className="block">
                <span className="app-eyebrow text-[10px]">Titel</span>
                <input
                  value={notizTitel}
                  onChange={(e) => setNotizTitel(e.target.value)}
                  placeholder="optional"
                  className={`${appInputClass} mt-1`}
                />
              </label>
              <label className="mt-3 block">
                <span className="app-eyebrow text-[10px]">Notiz</span>
                <textarea
                  value={notizText}
                  onChange={(e) => setNotizText(e.target.value)}
                  rows={5}
                  className={`${appInputClass} mt-1 resize-y`}
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={speichereNotiz}
                  disabled={!notizText.trim()}
                  className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
                >
                  {notizEditId ? 'Speichern' : 'Notiz speichern'}
                </button>
                {notizEditId ? (
                  <button type="button" className={appSecondaryBtnClass} onClick={resetNotizForm}>
                    Abbrechen
                  </button>
                ) : null}
              </div>
            </PageSectionPanel>
          </PageSection>

          <PageSection titleId="fuehrung-notiz-list" title="Alle Notizen" density="compact">
            {state.notizen.length === 0 ? (
              <PageSectionPanel density="compact">
                <p className="text-sm italic text-[var(--app-text-muted)]">Noch keine Notizen.</p>
              </PageSectionPanel>
            ) : (
              <div className="divide-y divide-[var(--app-border)]">
                {state.notizen.map((n) => (
                  <PageSectionPanel key={n.id} density="compact">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--app-text)]">{n.titel}</p>
                        <p className="text-[10px] text-[var(--app-text-muted)]">
                          {formatDeDatum(n.updatedAt.slice(0, 10))}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={appSecondaryBtnClass}
                          onClick={() => {
                            setNotizEditId(n.id)
                            setNotizTitel(n.titel)
                            setNotizText(n.text)
                          }}
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                          onClick={() =>
                            setState((s) => ({
                              ...s,
                              notizen: s.notizen.filter((x) => x.id !== n.id),
                            }))
                          }
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--app-text)]">
                      {n.text}
                    </p>
                  </PageSectionPanel>
                ))}
              </div>
            )}
          </PageSection>

          <PageSection titleId="fuehrung-journal-neu" title="Journal / Reflexion" density="compact">
            <PageSectionPanel density="compact">
              <textarea
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                rows={3}
                placeholder="Was ist passiert — und was machst du nächstes Mal anders?"
                className={`${appInputClass} resize-y`}
              />
              <button
                type="button"
                onClick={addJournal}
                disabled={!journalText.trim()}
                className="mt-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
              >
                Reflexion speichern
              </button>
            </PageSectionPanel>
          </PageSection>

          {state.journal.length > 0 ? (
            <PageSection titleId="fuehrung-journal-list" title="Reflexionen" density="compact">
              <div className="divide-y divide-[var(--app-border)]">
                {state.journal.map((j) => (
                  <PageSectionPanel key={j.id} density="compact">
                    <p className="text-[10px] font-bold uppercase text-[var(--app-text-muted)]">
                      {formatDeDatum(j.datum)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--app-text)]">{j.text}</p>
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          journal: s.journal.filter((x) => x.id !== j.id),
                        }))
                      }
                    >
                      Löschen
                    </button>
                  </PageSectionPanel>
                ))}
              </div>
            </PageSection>
          ) : null}
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

function Counter({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2.5">
      <p className="text-[10px] font-medium leading-tight text-[var(--app-text-muted)]">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--app-surface)] text-lg font-bold text-[var(--app-text)] ring-1 ring-[var(--app-border)]"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          −
        </button>
        <span className="text-xl font-bold tabular-nums text-[var(--app-text)]">{value}</span>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-lg font-bold text-white"
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  )
}
