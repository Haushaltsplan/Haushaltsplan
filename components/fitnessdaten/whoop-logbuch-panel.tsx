'use client'

import {
  LOGBUCH_FRAGEN,
  antwortVollstaendig,
  formatLogbuchAntwortKurz,
  heuteIsoLocal,
  isoAddDays,
  kannTagVor,
  kannTagZurueck,
  labelTagNavigation,
  ladeLogbuchTag,
  logbuchDatumMitEintrag,
  logbuchTagVollstaendig,
  speichereLogbuchAntwort,
  type LogbuchAntwort,
  type LogbuchFrageId,
  type LogbuchTagRecord,
} from '@/lib/fitnessdaten/logbuch'
import { fenster7TageUmDatum } from '@/lib/fitnessdaten/daily-records'
import { useCallback, useEffect, useState } from 'react'

type Props = {
  selectedDate: string
  onDateChange: (iso: string) => void
  onSaved?: () => void
}

function wochentagKurz(iso: string): string {
  return new Date(iso + 'T12:00:00')
    .toLocaleDateString('de-DE', { weekday: 'short' })
    .toUpperCase()
    .slice(0, 2)
}

function LogbuchFrageKarte({
  frageId,
  frage,
  wannLabel,
  mengeLabel,
  wannPlaceholder,
  mengePlaceholder,
  antwort,
  onSpeichern,
}: {
  frageId: LogbuchFrageId
  frage: string
  wannLabel: string
  mengeLabel: string
  wannPlaceholder: string
  mengePlaceholder: string
  antwort?: LogbuchAntwort
  onSpeichern: (id: LogbuchFrageId, a: LogbuchAntwort) => void
}) {
  const [detailOffen, setDetailOffen] = useState(false)
  const [wann, setWann] = useState(antwort?.wann ?? '')
  const [menge, setMenge] = useState(antwort?.menge ?? '')

  useEffect(() => {
    setWann(antwort?.wann ?? '')
    setMenge(antwort?.menge ?? '')
    setDetailOffen(Boolean(antwort?.ja && !antwortVollstaendig(antwort)))
  }, [antwort, frageId])

  const klickNein = () => {
    setDetailOffen(false)
    onSpeichern(frageId, { ja: false, wann: null, menge: null })
  }

  const klickJa = () => {
    if (antwort?.ja && antwortVollstaendig(antwort)) {
      setDetailOffen(true)
      setWann(antwort.wann ?? '')
      setMenge(antwort.menge ?? '')
      return
    }
    setDetailOffen(true)
    onSpeichern(frageId, { ja: true, wann: wann || null, menge: menge || null })
  }

  const speichereDetail = () => {
    onSpeichern(frageId, {
      ja: true,
      wann: wann.trim() || null,
      menge: menge.trim() || null,
    })
    if (wann.trim() && menge.trim()) setDetailOffen(false)
  }

  const beantwortet = antwort != null
  const jaAktiv = antwort?.ja === true
  const neinAktiv = antwort?.ja === false

  return (
    <li className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
      <p className="text-[13px] font-medium leading-snug text-white">{frage}</p>

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={klickJa}
          className={`flex-1 rounded-full border py-2 text-[11px] font-bold uppercase tracking-wider transition ${
            jaAktiv
              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
              : 'border-white/[0.10] bg-white/[0.04] text-[var(--app-text-muted)] hover:bg-white/[0.08]'
          }`}
        >
          Ja
        </button>
        <button
          type="button"
          onClick={klickNein}
          className={`flex-1 rounded-full border py-2 text-[11px] font-bold uppercase tracking-wider transition ${
            neinAktiv
              ? 'border-white/30 bg-white/10 text-white'
              : 'border-white/[0.10] bg-white/[0.04] text-[var(--app-text-muted)] hover:bg-white/[0.08]'
          }`}
        >
          Nein
        </button>
      </div>

      {beantwortet && !detailOffen ? (
        <p className="mt-2 text-[11px] text-[var(--app-text-muted)]">{formatLogbuchAntwortKurz(antwort)}</p>
      ) : null}

      {(detailOffen || (jaAktiv && !antwortVollstaendig(antwort))) ? (
        <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">
              {wannLabel}
            </span>
            <input
              type="text"
              value={wann}
              onChange={(e) => setWann(e.target.value)}
              placeholder={wannPlaceholder}
              className="mt-1 w-full rounded-lg border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-[var(--app-text-muted)] focus:border-emerald-500/40 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">
              {mengeLabel}
            </span>
            <input
              type="text"
              value={menge}
              onChange={(e) => setMenge(e.target.value)}
              placeholder={mengePlaceholder}
              className="mt-1 w-full rounded-lg border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-[var(--app-text-muted)] focus:border-emerald-500/40 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={speichereDetail}
            disabled={!wann.trim() || !menge.trim()}
            className="w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-2 text-[11px] font-bold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Speichern
          </button>
        </div>
      ) : null}
    </li>
  )
}

export function WhoopLogbuchPanel({ selectedDate, onDateChange, onSaved }: Props) {
  const [record, setRecord] = useState<LogbuchTagRecord>(() => ladeLogbuchTag(selectedDate))
  const [eintraege, setEintraege] = useState(() => logbuchDatumMitEintrag())

  const woche = fenster7TageUmDatum(selectedDate)

  useEffect(() => {
    setRecord(ladeLogbuchTag(selectedDate))
    setEintraege(logbuchDatumMitEintrag())
  }, [selectedDate])

  const speichern = useCallback(
    (frageId: LogbuchFrageId, antwort: LogbuchAntwort) => {
      const neu = speichereLogbuchAntwort(selectedDate, frageId, antwort)
      setRecord(neu)
      setEintraege(logbuchDatumMitEintrag())
      onSaved?.()
    },
    [onSaved, selectedDate],
  )

  const tagZurueck = () => {
    if (kannTagZurueck(selectedDate)) onDateChange(isoAddDays(selectedDate, -1))
  }

  const tagVor = () => {
    if (kannTagVor(selectedDate)) onDateChange(isoAddDays(selectedDate, 1))
  }

  const vollstaendig = logbuchTagVollstaendig(record)
  const fortschritt = LOGBUCH_FRAGEN.filter((f) => antwortVollstaendig(record.antworten[f.id])).length

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111113] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--app-text-muted)]">Mein Logbuch</p>
        <span className="text-[10px] tabular-nums text-[var(--app-text-muted)]">
          {fortschritt}/{LOGBUCH_FRAGEN.length}
        </span>
      </div>

      {/* Tages-Navigation */}
      <div className="mt-3 flex items-center justify-center gap-0.5">
        <button
          type="button"
          onClick={tagZurueck}
          disabled={!kannTagZurueck(selectedDate)}
          aria-label="Vorheriger Tag"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[15px] text-[var(--app-text-muted)] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => onDateChange(heuteIsoLocal())}
          className="min-w-[5.5rem] rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white transition hover:bg-white/[0.08]"
        >
          {labelTagNavigation(selectedDate)}
        </button>
        <button
          type="button"
          onClick={tagVor}
          disabled={!kannTagVor(selectedDate)}
          aria-label="Nächster Tag"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[15px] text-[var(--app-text-muted)] transition hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
        >
          ›
        </button>
      </div>

      {/* Wochen-Übersicht */}
      <div className="mt-3 flex justify-between">
        {woche.map((d) => {
          const hatEintrag = eintraege.has(d.date)
          const istAktiv = d.date === selectedDate
          const komplett = hatEintrag && logbuchTagVollstaendig(ladeLogbuchTag(d.date))
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onDateChange(d.date)}
              className="flex flex-col items-center gap-1.5 rounded-lg p-0.5 transition hover:bg-white/[0.04]"
            >
              <span className="text-[9px] font-bold text-[var(--app-text-muted)]">{wochentagKurz(d.date)}</span>
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm"
                style={{
                  borderColor: komplett ? '#00E676' : hatEintrag ? '#eab308' : istAktiv ? '#ffffff50' : '#27272a',
                  backgroundColor: komplett ? '#00E676' : hatEintrag ? 'rgba(234,179,8,0.2)' : istAktiv ? 'rgba(255,255,255,0.08)' : 'transparent',
                }}
              >
                {komplett ? (
                  <span className="text-[11px] font-bold text-black">✓</span>
                ) : hatEintrag ? (
                  <span className="text-[10px] font-bold text-amber-300">·</span>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>

      {vollstaendig ? (
        <p className="mt-3 text-center text-[10px] font-semibold text-emerald-400/90">Tag vollständig ausgefüllt</p>
      ) : (
        <p className="mt-3 text-center text-[10px] text-[var(--app-text-muted)]">
          Beantworte alle Fragen für {labelTagNavigation(selectedDate).toLowerCase()}
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {LOGBUCH_FRAGEN.map((def) => (
          <LogbuchFrageKarte
            key={def.id}
            frageId={def.id}
            frage={def.frage}
            wannLabel={def.wannLabel}
            mengeLabel={def.mengeLabel}
            wannPlaceholder={def.wannPlaceholder}
            mengePlaceholder={def.mengePlaceholder}
            antwort={record.antworten[def.id]}
            onSpeichern={speichern}
          />
        ))}
      </ul>
    </div>
  )
}
