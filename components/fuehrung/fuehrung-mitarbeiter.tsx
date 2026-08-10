'use client'

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import {
  addDaysIso,
  FUEHRUNG_WOCHENTAGE_MO_DO,
  printMitarbeiterGespraech,
  sammleFragenAusTage,
} from '@/lib/fuehrung/mitarbeiter-export'
import {
  heuteIso,
  mitarbeiterFragenStats,
  mitarbeiterTagAm,
  newId,
  summeMitarbeiterFragenAmTag,
  summeMitarbeiterFragenSplit,
  upsertMitarbeiterTag,
  type FuehrungState,
} from '@/lib/fuehrung/store'
import { wochenStartIso } from '@/lib/fuehrung/wochen-review'
import { appInputClass, appSecondaryBtnClass } from '@/lib/app-ui'

function AnzahlStepper({
  value,
  onChange,
  accent,
}: {
  value: number
  onChange: (n: number) => void
  accent: 'ok' | 'warn'
}) {
  const plusClass = accent === 'ok' ? 'bg-teal-600 text-white' : 'bg-amber-600 text-white'
  return (
    <div className="mt-1 flex items-center gap-2">
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-surface-muted)] text-lg font-bold text-[var(--app-text)] ring-1 ring-[var(--app-border)]"
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        −
      </button>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={`${appInputClass} w-16 text-center text-base font-bold tabular-nums`}
      />
      <button
        type="button"
        className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold ${plusClass}`}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  )
}

function defaultTagOffset(heute: string, montag: string): number {
  for (const t of FUEHRUNG_WOCHENTAGE_MO_DO) {
    if (addDaysIso(montag, t.offset) === heute) return t.offset
  }
  if (heute < montag) return 0
  const donnerstag = addDaysIso(montag, 3)
  if (heute > donnerstag) return 3
  return 0
}

export function FuehrungMitarbeiterPanel({
  state,
  setState,
}: {
  state: FuehrungState
  setState: Dispatch<SetStateAction<FuehrungState>>
}) {
  const heute = heuteIso()
  const montag = wochenStartIso(heute)
  const donnerstag = addDaysIso(montag, 3)
  const exportBis = heute < donnerstag ? heute : donnerstag

  const [tagOffset, setTagOffset] = useState(() => defaultTagOffset(heute, montag))
  const [neuerName, setNeuerName] = useState('')
  const [kiFrage, setKiFrage] = useState('')
  const [kiReply, setKiReply] = useState<string | null>(null)
  const [kiLoading, setKiLoading] = useState(false)
  const [kiError, setKiError] = useState<string | null>(null)

  const aktivDatum = addDaysIso(montag, tagOffset)
  const aktivLabel =
    FUEHRUNG_WOCHENTAGE_MO_DO.find((t) => t.offset === tagOffset)?.label ?? 'Tag'
  const istHeute = aktivDatum === heute

  const tagSplit = summeMitarbeiterFragenSplit(state.mitarbeiterTage, aktivDatum, aktivDatum)
  const wocheStats = useMemo(
    () => mitarbeiterFragenStats(state.mitarbeiter, state.mitarbeiterTage, montag, exportBis),
    [state.mitarbeiter, state.mitarbeiterTage, montag, exportBis],
  )
  const wocheSplit = useMemo(
    () => summeMitarbeiterFragenSplit(state.mitarbeiterTage, montag, exportBis),
    [state.mitarbeiterTage, montag, exportBis],
  )

  function addMitarbeiter() {
    const name = neuerName.trim()
    if (!name) return
    if (state.mitarbeiter.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      setNeuerName('')
      return
    }
    setState((s) => ({
      ...s,
      mitarbeiter: [{ id: newId(), name, createdAt: new Date().toISOString() }, ...s.mitarbeiter],
    }))
    setNeuerName('')
  }

  function removeMitarbeiter(id: string) {
    setState((s) => ({
      ...s,
      mitarbeiter: s.mitarbeiter.filter((m) => m.id !== id),
      mitarbeiterTage: s.mitarbeiterTage.filter((t) => t.mitarbeiterId !== id),
    }))
  }

  function patchTag(
    mitarbeiterId: string,
    patch: Parameters<typeof upsertMitarbeiterTag>[3],
  ) {
    setState((s) => ({
      ...s,
      mitarbeiterTage: upsertMitarbeiterTag(s.mitarbeiterTage, mitarbeiterId, aktivDatum, patch),
    }))
  }

  async function askKi() {
    const message = kiFrage.trim()
    if (message.length < 3) return
    setKiLoading(true)
    setKiError(null)
    setKiReply(null)
    const fragen = sammleFragenAusTage(state.mitarbeiterTage, montag, exportBis)
    const context = {
      heute,
      wochenStart: montag,
      aktiverTag: aktivDatum,
      fragenWoche: wocheSplit.gesamt,
      fragenWocheWichtig: wocheSplit.wichtig,
      fragenWocheUnnoetig: wocheSplit.unnoetig,
      fragenGebuendeltWichtig: fragen.wichtig,
      fragenGebuendeltUnnoetig: fragen.unnoetig,
      rankingWoche: wocheStats.filter((x) => x.anzahl > 0),
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

  function copyFuerGespraech() {
    const fragen = sammleFragenAusTage(state.mitarbeiterTage, montag, exportBis)
    const lines = [
      `FRAGEN AN DIE FÜHRUNG · ${montag} – ${exportBis}`,
      `Gesamt: ${wocheSplit.gesamt} (wichtig ${wocheSplit.wichtig} · unnötig ${wocheSplit.unnoetig})`,
      '',
      ...FUEHRUNG_WOCHENTAGE_MO_DO.map((t) => {
        const d = addDaysIso(montag, t.offset)
        if (d > exportBis) return `${t.label}: —`
        const s = summeMitarbeiterFragenSplit(state.mitarbeiterTage, d, d)
        return `${t.label}: ${s.gesamt} (wichtig ${s.wichtig} · unnötig ${s.unnoetig})`
      }),
      '',
      'Wichtig:',
      ...(fragen.wichtig.length
        ? fragen.wichtig.map((f) => `· ${f.text}${f.anzahl > 1 ? ` ×${f.anzahl}` : ''}`)
        : ['· —']),
      '',
      'Unnötig / ohne mich lösbar:',
      ...(fragen.unnoetig.length
        ? fragen.unnoetig.map((f) => `· ${f.text}${f.anzahl > 1 ? ` ×${f.anzahl}` : ''}`)
        : ['· —']),
    ]
    void navigator.clipboard.writeText(lines.join('\n'))
  }

  return (
    <div className="space-y-3">
      <div className="rounded-[var(--app-radius-lg)] border border-teal-500/25 bg-teal-500/5 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
          Wahrnehmen · Mo–Do
        </p>
        <p className="mt-1 text-sm text-[var(--app-text)]">
          Wird lokal gespeichert. Pro Tag: <strong>wichtig</strong> vs. <strong>unnötig</strong>. Der
          PDF-Export zeigt nur Gesamtstatistik und Fragen — ohne Namen.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[var(--app-surface-muted)] px-2 py-2 text-center ring-1 ring-[var(--app-border)]">
            <p className="text-xl font-bold tabular-nums text-[var(--app-text)]">{wocheSplit.gesamt}</p>
            <p className="text-[10px] text-[var(--app-text-muted)]">Mo–Do gesamt</p>
          </div>
          <div className="rounded-xl bg-teal-500/10 px-2 py-2 text-center ring-1 ring-teal-500/25">
            <p className="text-xl font-bold tabular-nums text-teal-800 dark:text-teal-200">
              {wocheSplit.wichtig}
            </p>
            <p className="text-[10px] text-[var(--app-text-muted)]">Wichtig</p>
          </div>
          <div className="rounded-xl bg-amber-500/10 px-2 py-2 text-center ring-1 ring-amber-500/25">
            <p className="text-xl font-bold tabular-nums text-amber-900 dark:text-amber-200">
              {wocheSplit.unnoetig}
            </p>
            <p className="text-[10px] text-[var(--app-text-muted)]">Unnötig</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500"
            onClick={() => printMitarbeiterGespraech(state, montag, exportBis)}
          >
            PDF / Drucken für Gespräch
          </button>
          {wocheSplit.gesamt > 0 ? (
            <button type="button" className={appSecondaryBtnClass} onClick={copyFuerGespraech}>
              Statistik kopieren
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {FUEHRUNG_WOCHENTAGE_MO_DO.map((t) => {
          const datum = addDaysIso(montag, t.offset)
          const n = summeMitarbeiterFragenAmTag(state.mitarbeiterTage, datum)
          const aktiv = tagOffset === t.offset
          const heuteTag = datum === heute
          return (
            <button
              key={t.offset}
              type="button"
              onClick={() => setTagOffset(t.offset)}
              className={`rounded-xl px-1 py-2.5 text-center ring-1 transition ${
                aktiv
                  ? 'bg-teal-600 text-white ring-teal-600'
                  : 'bg-[var(--app-surface)] text-[var(--app-text)] ring-[var(--app-border)] hover:bg-[var(--app-surface-muted)]'
              }`}
            >
              <p className={`text-[10px] font-bold uppercase tracking-wide ${aktiv ? 'text-white/80' : 'text-[var(--app-text-muted)]'}`}>
                {t.kurz}
                {heuteTag ? ' · heute' : ''}
              </p>
              <p className="mt-0.5 text-sm font-semibold">{t.label}</p>
              <p className={`mt-0.5 text-xs tabular-nums ${aktiv ? 'text-white/90' : 'text-[var(--app-text-muted)]'}`}>
                {n > 0 ? `${n} Fragen` : '—'}
              </p>
            </button>
          )
        })}
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

      <p className="text-sm font-medium text-[var(--app-text)]">
        Einträge für {aktivLabel}
        {istHeute ? ' (heute)' : ''}
        <span className="font-normal text-[var(--app-text-muted)]">
          {' '}
          · {tagSplit.gesamt} Fragen ({tagSplit.wichtig} wichtig · {tagSplit.unnoetig} unnötig)
        </span>
      </p>

      {state.mitarbeiter.length === 0 ? (
        <PageSection titleId="fuehrung-ma-empty" title="Noch niemand" density="compact">
          <PageSectionPanel density="compact">
            <p className="text-sm italic text-[var(--app-text-muted)]">
              Mitarbeiter anlegen → Tag wählen → wichtig / unnötig zählen und Notizen festhalten.
            </p>
          </PageSectionPanel>
        </PageSection>
      ) : (
        state.mitarbeiter.map((m) => {
          const tag = mitarbeiterTagAm(state.mitarbeiterTage, m.id, aktivDatum)
          const wichtig = tag?.anzahlWichtig ?? 0
          const unnoetig = tag?.anzahlUnnoetig ?? 0
          const notizenWichtig = tag?.notizenWichtig ?? ''
          const notizenUnnoetig = tag?.notizenUnnoetig ?? ''
          const woche = wocheStats.find((x) => x.id === m.id)
          return (
            <PageSection key={m.id} titleId={`fuehrung-ma-${m.id}`} title={m.name} density="compact">
              <PageSectionPanel density="compact" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[var(--app-text-muted)]">
                    Mo–Do:{' '}
                    <span className="font-bold text-[var(--app-text)]">{woche?.anzahl ?? 0}</span>
                    {' · '}
                    <span className="text-teal-700 dark:text-teal-300">
                      {woche?.anzahlWichtig ?? 0} wichtig
                    </span>
                    {' · '}
                    <span className="text-amber-800 dark:text-amber-300">
                      {woche?.anzahlUnnoetig ?? 0} unnötig
                    </span>
                  </p>
                  <button
                    type="button"
                    className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
                    onClick={() => removeMitarbeiter(m.id)}
                  >
                    Entfernen
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-teal-500/5 p-3 ring-1 ring-teal-500/20">
                    <p className="app-eyebrow text-[10px] text-teal-800 dark:text-teal-200">
                      Wirklich wichtig · {aktivLabel}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
                      Brauchte dich / Führung
                    </p>
                    <AnzahlStepper
                      value={wichtig}
                      accent="ok"
                      onChange={(n) => patchTag(m.id, { anzahlWichtig: n })}
                    />
                    <label className="mt-2 block">
                      <span className="app-eyebrow text-[10px]">Notizen</span>
                      <textarea
                        value={notizenWichtig}
                        onChange={(e) => patchTag(m.id, { notizenWichtig: e.target.value })}
                        rows={3}
                        placeholder={'z. B.\n· Preisentscheidung Kunde\n· Eskalation Lieferverzögerung'}
                        className={`${appInputClass} mt-1 resize-y`}
                      />
                    </label>
                  </div>

                  <div className="rounded-xl bg-amber-500/5 p-3 ring-1 ring-amber-500/20">
                    <p className="app-eyebrow text-[10px] text-amber-900 dark:text-amber-200">
                      Unnötig · {aktivLabel}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">
                      Hätte ohne dich gelöst werden können
                    </p>
                    <AnzahlStepper
                      value={unnoetig}
                      accent="warn"
                      onChange={(n) => patchTag(m.id, { anzahlUnnoetig: n })}
                    />
                    <label className="mt-2 block">
                      <span className="app-eyebrow text-[10px]">Notizen</span>
                      <textarea
                        value={notizenUnnoetig}
                        onChange={(e) => patchTag(m.id, { notizenUnnoetig: e.target.value })}
                        rows={3}
                        placeholder={'z. B.\n· Welcher Artikel ist X\n· Nochmal nach Prozess gefragt'}
                        className={`${appInputClass} mt-1 resize-y`}
                      />
                    </label>
                  </div>
                </div>
              </PageSectionPanel>
            </PageSection>
          )
        })
      )}

      <PageSection titleId="fuehrung-ma-ki" title="KI fragen (Free Tier)" density="compact">
        <PageSectionPanel density="compact" className="space-y-2">
          <p className="text-xs text-[var(--app-text-muted)]">
            z. B. „Wie formuliere ich das Montagsgespräch?“ oder „Welche Fragen wirken unnötig?“
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
