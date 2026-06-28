'use client'

import { appModalBackdropClassName, appModalPanelClassName } from '@/lib/app-modal-overlay'
import { appCardHeaderClass, appInputClass, appLabelClass, appSecondaryBtnClass } from '@/lib/app-ui'
import {
  KALENDER_KATEGORIEN,
  listeIsoDatenInklusiv,
  normalisiereKalenderKategorie,
  type KalenderEintrag,
  type KalenderKategorieId,
} from '@/lib/haushalt-kalender'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

export const KALENDER_MAX_TAGE_AUF_EINMAL = 400

export type KalenderEintragFormPayload =
  | {
      art: 'neu'
      termine: string[]
      titel: string
      notiz: string
      uhrzeit: string
      kategorie: KalenderKategorieId
    }
  | {
      art: 'bearbeiten'
      id: string
      datum: string
      titel: string
      notiz: string
      uhrzeit: string
      kategorie: KalenderKategorieId
    }

export type KalenderEintragModalModus =
  | { art: 'neu'; datum: string }
  | { art: 'bearbeiten'; eintrag: KalenderEintrag }

type Props = {
  modus: KalenderEintragModalModus
  onClose: () => void
  onSpeichern: (p: KalenderEintragFormPayload) => void | Promise<void>
  onLoeschen: (id: string) => void | Promise<void>
  /** z. B. anderes aria-labelledby für eine zweite Kalender-Instanz */
  titleId?: string
  /** Klasse für den Speichern-Button (z. B. Teal vs. Violett) */
  speichernButtonClassName?: string
  /** Wenn nur Quartals-/Investitionstermine: z. B. `['termin']` — wähle aus oder blende Kategoriebalken ganz aus. */
  kategorienNur?: KalenderKategorieId[]
}

export function KalenderEintragModal(props: Props) {
  const titleId = props.titleId ?? 'kal-eintrag-modal-title'
  const btnSpeichern = props.speichernButtonClassName ?? 'bg-teal-600 hover:bg-teal-500 shadow-teal-950/30'
  const filtre = props.kategorienNur
  const initial =
    props.modus.art === 'neu'
      ? { titel: '', notiz: '', uhrzeit: '', kategorie: (filtre?.[0] ?? 'termin') as KalenderKategorieId }
      : {
          titel: props.modus.eintrag.titel,
          notiz: props.modus.eintrag.notiz,
          uhrzeit: props.modus.eintrag.uhrzeit,
          kategorie: normalisiereKalenderKategorie(props.modus.eintrag.kategorie),
        }
  const kategInitial =
    filtre && filtre.length > 0 && !filtre.includes(initial.kategorie) ? filtre[0] : initial.kategorie
  const [titel, setTitel] = useState(initial.titel)
  const [notiz, setNotiz] = useState(initial.notiz)
  const [uhrzeit, setUhrzeit] = useState(initial.uhrzeit)
  const [kategorie, setKategorie] = useState<KalenderKategorieId>(kategInitial)
  const kategorienRows =
    filtre && filtre.length > 0 ? KALENDER_KATEGORIEN.filter((k) => filtre.includes(k.id)) : KALENDER_KATEGORIEN
  const versteckeKategorienBalken = filtre && filtre.length === 1
  const [datum, setDatum] = useState(props.modus.art === 'neu' ? props.modus.datum : props.modus.eintrag.datum)
  const [datumBis, setDatumBis] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props.onClose])

  return (
    <div
      className={appModalBackdropClassName}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose()
      }}
    >
      <div
        className={`${appModalPanelClassName} max-h-[min(90vh,32rem)] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={appCardHeaderClass}>
          <h3 id={titleId} className="text-base font-black text-[var(--app-text)]">
            {props.modus.art === 'neu' ? 'Neuer Eintrag (optional mehrere Tage)' : 'Eintrag bearbeiten'}
          </h3>
        </div>
        <form
          className="space-y-3 px-4 py-4 sm:px-5"
          onSubmit={async (ev) => {
            ev.preventDefault()
            const t = titel.trim()
            if (!t) {
              toast.error('Bitte einen Titel eingeben.')
              return
            }
            const u = uhrzeit.trim()
            if (u && !/^\d{1,2}:\d{2}$/.test(u)) {
              toast.error('Uhrzeit als HH:MM (z. B. 14:30) oder leer lassen.')
              return
            }
            if (props.modus.art === 'neu') {
              let termine: string[]
              if (datumBis.trim()) {
                const list = listeIsoDatenInklusiv(datum, datumBis.trim())
                if (list.length === 0) {
                  toast.error('Ende liegt vor dem Start oder Datumsangaben sind ungültig.')
                  return
                }
                if (list.length > KALENDER_MAX_TAGE_AUF_EINMAL) {
                  toast.error(`Maximal ${KALENDER_MAX_TAGE_AUF_EINMAL} Tage auf einmal.`)
                  return
                }
                termine = list
              } else {
                termine = [datum]
              }
              await props.onSpeichern({ art: 'neu', termine, titel: t, notiz: notiz.trim(), uhrzeit: u, kategorie })
            } else {
              await props.onSpeichern({
                art: 'bearbeiten',
                id: props.modus.eintrag.id,
                datum,
                titel: t,
                notiz: notiz.trim(),
                uhrzeit: u,
                kategorie,
              })
            }
          }}
        >
          {versteckeKategorienBalken ? null : (
            <div className="block">
              <span className={appLabelClass}>Kategorie</span>
              <div
                className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3"
                role="group"
                aria-label="Eintrags-Kategorie wählen"
              >
                {kategorienRows.map((k) => {
                  const aktiv = kategorie === k.id
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setKategorie(k.id)}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs font-bold transition ${
                        aktiv
                          ? `${k.listBorder} ${k.listBg} text-[var(--app-text)] ring-2 ring-offset-2 ring-offset-[var(--app-surface)] ring-[var(--app-border-strong)]`
                          : 'border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)]'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${k.dot}`} aria-hidden />
                      <span className="min-w-0 leading-tight">{k.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <label className={`block ${appLabelClass}`}>
            Titel
            <input
              className={`${appInputClass} mt-1 font-semibold focus:ring-teal-500/45`}
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              autoFocus
            />
          </label>
          <div className="block sm:grid sm:grid-cols-2 sm:gap-3">
            <label className={`block ${appLabelClass}`}>
              {props.modus.art === 'neu' ? 'Von' : 'Datum'}
              <input
                type="date"
                className={`${appInputClass} mt-1 font-bold focus:ring-teal-500/45`}
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
              />
            </label>
            {props.modus.art === 'neu' ? (
              <label className={`mt-2 block ${appLabelClass} sm:mt-0`}>
                Bis (optional)
                <input
                  type="date"
                  min={datum}
                  className={`${appInputClass} mt-1 font-bold focus:ring-teal-500/45`}
                  value={datumBis}
                  onChange={(e) => setDatumBis(e.target.value)}
                />
                <span className="mt-0.5 block text-[9px] font-normal text-[var(--app-text-muted)]">
                  Gleicher Titel, Uhrzeit &amp; Notiz für jeden Tag im Zeitraum
                </span>
              </label>
            ) : null}
          </div>
          <label className={`block ${appLabelClass}`}>
            Uhrzeit (optional)
            <input
              type="time"
              className={`${appInputClass} mt-1 font-bold focus:ring-teal-500/45`}
              value={uhrzeit}
              onChange={(e) => setUhrzeit(e.target.value)}
            />
          </label>
          <label className={`block ${appLabelClass}`}>
            Notiz (optional)
            <textarea
              className={`${appInputClass} mt-1 min-h-[4rem] focus:ring-teal-500/45`}
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={3}
            />
          </label>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            {props.modus.art === 'bearbeiten' ? (
              <button
                type="button"
                className="mr-auto rounded-lg border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-900/50"
                onClick={async () => {
                  if (props.modus.art !== 'bearbeiten') return
                  const ok = window.confirm('Diesen Eintrag wirklich löschen?')
                  if (ok) await props.onLoeschen(props.modus.eintrag.id)
                }}
              >
                Löschen
              </button>
            ) : null}
            <button
              type="button"
              className={appSecondaryBtnClass}
              onClick={props.onClose}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className={`rounded-lg px-4 py-2 text-sm font-black text-white shadow-sm ${btnSpeichern}`}
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
