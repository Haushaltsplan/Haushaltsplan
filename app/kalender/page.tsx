'use client'

import { appModalBackdropClassName, appModalPanelClassName } from '@/lib/app-modal-overlay'
import {
  KALENDER_KATEGORIEN,
  KALENDER_SYNC_EVENT,
  baueMonatsZellen,
  filterEintraegeFuerTag,
  formatMonatTitelDe,
  heuteAlsIsoDatum,
  isoDatumAusJahrMonatTag,
  kalenderKategorieMeta,
  ladeKalenderEintraege,
  ladeKalenderEintraegeVonQuelleMitMeta,
  monatPlusDelta,
  normalisiereKalenderKategorie,
  parseIsoDatum,
  type KalenderEintrag,
  type KalenderKategorieId,
  type KalenderMonatKopf,
  speichereKalenderEintraegeMitCloud,
  sortiereEintraegeNachUhrzeitDannTitel,
} from '@/lib/haushalt-kalender'
import { KalenderFotoImport } from '@/components/kalender-foto-import'
import { TerminMorgenReminderEinstellungen } from '@/components/termin-morgen-reminder'
import { istSupabaseClientKonfiguriert } from '@/lib/supabase'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'

const WOCHENTAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

function jetztAlsMonatKopf(): KalenderMonatKopf {
  const d = new Date()
  return { jahr: d.getFullYear(), monat: d.getMonth() + 1 }
}

type ModalModus = { art: 'neu'; datum: string } | { art: 'bearbeiten'; eintrag: KalenderEintrag }

function eintragKurzzeile(ev: KalenderEintrag) {
  const t = (ev.titel || 'Ohne Titel').trim()
  const u = ev.uhrzeit.trim()
  return u ? `${u} ${t}` : t
}

export default function KalenderPage() {
  const [sicht, setSicht] = useState<KalenderMonatKopf>(jetztAlsMonatKopf)
  const [eintraege, setEintraege] = useState<KalenderEintrag[]>([])
  const [ausgewaehlt, setAusgewaehlt] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalModus | null>(null)
  const [kalenderBereit, setKalenderBereit] = useState(false)

  const monatErsterMount = useRef(true)

  useEffect(() => {
    let cancelled = false
    void ladeKalenderEintraegeVonQuelleMitMeta().then(({ eintraege, warnung }) => {
      if (cancelled) return
      setEintraege(eintraege)
      setKalenderBereit(true)
      if (warnung) toast.error(`Kalender-Sync: ${warnung}`)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /** Wenn `KalenderCloudBootstrap` o.ä. nachträglich in localStorage schreibt, während der erste Render leer war. */
  useEffect(() => {
    const onSync = () => {
      setEintraege(ladeKalenderEintraege())
    }
    try {
      window.addEventListener(KALENDER_SYNC_EVENT, onSync)
    } catch {
      // ignore
    }
    return () => {
      try {
        window.removeEventListener(KALENDER_SYNC_EVENT, onSync)
      } catch {
        // ignore
      }
    }
  }, [])

  /** Wieder in die App wechseln (Handy) → frisch von Supabase laden. */
  useEffect(() => {
    if (typeof document === 'undefined' || !istSupabaseClientKonfiguriert()) return
    const onSichtbar = () => {
      if (document.visibilityState !== 'visible') return
      void ladeKalenderEintraegeVonQuelleMitMeta().then(({ eintraege }) => {
        setEintraege(eintraege)
      })
    }
    document.addEventListener('visibilitychange', onSichtbar)
    return () => document.removeEventListener('visibilitychange', onSichtbar)
  }, [])

  useEffect(() => {
    if (monatErsterMount.current) {
      monatErsterMount.current = false
      return
    }
    setAusgewaehlt((prev) => {
      const iso = prev ?? heuteAlsIsoDatum()
      const d = parseIsoDatum(iso)
      if (!d) return isoDatumAusJahrMonatTag(sicht.jahr, sicht.monat, 1)
      if (d.jahr === sicht.jahr && d.monat === sicht.monat) return iso
      return isoDatumAusJahrMonatTag(sicht.jahr, sicht.monat, 1)
    })
  }, [sicht])

  const persist = useCallback(async (next: KalenderEintrag[]) => {
    setEintraege(next)
    const r = await speichereKalenderEintraegeMitCloud(next)
    if (!r.cloudOk && r.message) {
      toast.error(`Kalender-Sync: ${r.message}`)
    }
  }, [])

  const heuteIso = heuteAlsIsoDatum()
  const ausgewaehltNorm = ausgewaehlt ?? heuteIso

  const zellen = useMemo(() => baueMonatsZellen(sicht.jahr, sicht.monat), [sicht.jahr, sicht.monat])

  const proTagEintraege = useMemo(() => {
    const m = new Map<string, KalenderEintrag[]>()
    for (const e of eintraege) {
      const list = m.get(e.datum) || []
      list.push(e)
      m.set(e.datum, list)
    }
    for (const [iso, list] of m) {
      m.set(
        iso,
        [...list].sort(sortiereEintraegeNachUhrzeitDannTitel),
      )
    }
    return m
  }, [eintraege])

  const listAmTag = useMemo(
    () => filterEintraegeFuerTag(eintraege, ausgewaehltNorm).sort(sortiereEintraegeNachUhrzeitDannTitel),
    [eintraege, ausgewaehltNorm],
  )

  function waehleDatum(iso: string) {
    setAusgewaehlt(iso)
  }

  function monatDavor() {
    setSicht((s) => monatPlusDelta(s, -1))
  }

  function monatDanach() {
    setSicht((s) => monatPlusDelta(s, 1))
  }

  function springeHeute() {
    setSicht(jetztAlsMonatKopf())
    setAusgewaehlt(heuteAlsIsoDatum())
  }

  function oeffneNeuFuerTag(tag: number) {
    const iso = isoDatumAusJahrMonatTag(sicht.jahr, sicht.monat, tag)
    waehleDatum(iso)
    setModal({ art: 'neu', datum: iso })
  }

  return (
    <div className="min-w-0 space-y-5 animate-in fade-in duration-500">
      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-black/25 sm:p-5">
        <h1 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Kalender</h1>
        <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
          Kategorien mit festen Farben (z. B. Geburtstag, Termin, Urlaub).
          {istSupabaseClientKonfiguriert() ? (
            <>
              {' '}
              <strong className="font-medium text-teal-200/90">Synchron über Supabase</strong> — dieselben Einträge am PC und
              auf dem Handy (ein gemeinsames Haushalts-Projekt).
            </>
          ) : (
            <>
              {' '}
              Ohne Supabase-Konfiguration nur in diesem Browser gespeichert (kein Abgleich zwischen Geräten).
            </>
          )}
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-slate-500 sm:gap-x-4 sm:text-[11px]">
          {KALENDER_KATEGORIEN.map((k) => (
            <li key={k.id} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${k.dot}`} aria-hidden />
              <span className="text-slate-400">{k.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {!kalenderBereit ? (
        <div className="flex min-h-[14rem] items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/90 px-4 text-sm text-slate-400">
          Kalender wird geladen …
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start">
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-lg shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-3 py-3 sm:px-4">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={monatDavor}
                className="rounded-lg border border-slate-600 bg-slate-800/60 px-2.5 py-1.5 text-sm font-bold text-slate-200 transition hover:bg-slate-800"
                aria-label="Vorheriger Monat"
              >
                ←
              </button>
              <button
                type="button"
                onClick={monatDanach}
                className="rounded-lg border border-slate-600 bg-slate-800/60 px-2.5 py-1.5 text-sm font-bold text-slate-200 transition hover:bg-slate-800"
                aria-label="Nächster Monat"
              >
                →
              </button>
            </div>
            <h2 className="min-w-0 flex-1 text-center text-base font-black capitalize tracking-tight text-slate-100 sm:text-lg">
              {formatMonatTitelDe(sicht)}
            </h2>
            <button
              type="button"
              onClick={springeHeute}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-sm shadow-teal-950/30 transition hover:bg-teal-500"
            >
              Heute
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-800/80 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:text-[11px]">
            {WOCHENTAGE_KURZ.map((w) => (
              <div key={w} className="px-0.5 py-2 sm:py-2.5">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {zellen.map((z, i) => {
              if (z == null) {
                return <div key={`e-${i}`} className="min-h-[5rem] border-b border-r border-slate-800/60 bg-slate-950/25 sm:min-h-[6.5rem]" />
              }
              const iso = isoDatumAusJahrMonatTag(sicht.jahr, sicht.monat, z)
              const amTag = proTagEintraege.get(iso) || []
              const n = amTag.length
              const isHeute = iso === heuteIso
              const isSel = iso === ausgewaehltNorm
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    waehleDatum(iso)
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault()
                    oeffneNeuFuerTag(z)
                  }}
                  className={`min-h-[5rem] border-b border-r border-slate-800/60 p-0.5 text-left align-top transition sm:min-h-[6.5rem] sm:p-1.5 ${
                    isSel ? 'bg-teal-950/45 ring-1 ring-inset ring-teal-500/50' : 'hover:bg-slate-800/40'
                  } ${isHeute && !isSel ? 'bg-sky-950/30' : ''}`}
                  title={
                    n > 0
                      ? `Einfach: Tag wählen · Doppelklick: neuer Eintrag — ${n} Einträge: ${amTag.map((e) => eintragKurzzeile(e)).join(' · ')}`
                      : 'Einfach: Tag wählen · Doppelklick: neuer Eintrag'
                  }
                  aria-label={
                    n > 0
                      ? `Tag ${z}, ${n} ${n === 1 ? 'Eintrag' : 'Einträge'}: ${amTag.map((e) => eintragKurzzeile(e)).join('. ')}`
                      : `Tag ${z}, keine Einträge`
                  }
                >
                  <span
                    className={`inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-md text-[11px] font-bold tabular-nums sm:h-6 sm:text-sm ${
                      isHeute ? 'bg-sky-600 text-white' : 'text-slate-200'
                    }`}
                  >
                    {z}
                  </span>
                  {n > 0 ? (
                    <div className="mt-0.5 min-h-0 min-w-0" aria-hidden>
                      {amTag.slice(0, 2).map((ev) => {
                        const st = kalenderKategorieMeta(ev.kategorie)
                        return (
                          <div key={ev.id} className="mt-0.5 flex min-w-0 items-start gap-0.5 sm:mt-0.5">
                            <span className={`mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${st.dot}`} title={st.label} />
                            <span className="line-clamp-2 min-w-0 break-words text-left text-[7px] leading-tight text-slate-200 sm:text-[8px]">
                              {ev.uhrzeit.trim() ? (
                                <>
                                  <span className="whitespace-nowrap font-mono text-slate-500">{ev.uhrzeit}</span>
                                  <span className="text-slate-300"> {ev.titel.trim() || 'Ohne Titel'}</span>
                                </>
                              ) : (
                                ev.titel.trim() || 'Ohne Titel'
                              )}
                            </span>
                          </div>
                        )
                      })}
                      {amTag[2] != null ? (
                        <div className="mt-0.5 hidden min-w-0 items-start gap-0.5 sm:flex" key={amTag[2].id}>
                          <span
                            className={`mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${kalenderKategorieMeta(amTag[2].kategorie).dot}`}
                            title={kalenderKategorieMeta(amTag[2].kategorie).label}
                          />
                          <span className="line-clamp-2 min-w-0 break-words text-left text-[7px] leading-tight text-slate-200 sm:text-[8px]">
                            {amTag[2].uhrzeit.trim() ? (
                              <>
                                <span className="whitespace-nowrap font-mono text-slate-500">{amTag[2].uhrzeit}</span>
                                <span className="text-slate-300"> {amTag[2].titel.trim() || 'Ohne Titel'}</span>
                              </>
                            ) : (
                              amTag[2].titel.trim() || 'Ohne Titel'
                            )}
                          </span>
                        </div>
                      ) : null}
                      {n > 2 ? (
                        n === 3 ? (
                          <p className="mt-0.5 pl-1 text-[7px] font-bold leading-tight text-slate-500 sm:hidden">
                            +1 weiterer
                          </p>
                        ) : (
                          <>
                            <p className="mt-0.5 pl-1 text-[7px] font-bold leading-tight text-slate-500 sm:hidden">
                              +{n - 2} weitere
                            </p>
                            <p className="mt-0.5 hidden pl-1 text-[7px] font-bold leading-tight text-slate-500 sm:block">
                              +{n - 3} weitere
                            </p>
                          </>
                        )
                      ) : null}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
          <p className="border-t border-slate-800/80 px-3 py-2 text-[10px] text-slate-500 sm:px-4">
            Im Monatsraster: Titel (und Uhrzeit) pro Tag lesen; bei vielen Einträgen <span className="whitespace-nowrap">„+N weitere“</span>.
            Tipp: Doppelklick auf einen Tag, um schnell einen Eintrag anzulegen. Rechts: vollständige Liste inkl. Notiz.
          </p>
        </div>

        <aside className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-lg shadow-black/20">
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Ausgewählter Tag</p>
            <p className="mt-0.5 text-sm font-bold text-slate-100">
              {new Date(ausgewaehltNorm + 'T12:00:00').toLocaleDateString('de-DE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <div className="max-h-[min(50vh,28rem)] space-y-2 overflow-y-auto px-3 py-3 sm:px-4">
            {listAmTag.length === 0 ? (
              <p className="text-sm text-slate-500">Keine Einträge an diesem Tag.</p>
            ) : (
              <ul className="space-y-2">
                {listAmTag.map((e) => {
                  const km = kalenderKategorieMeta(e.kategorie)
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setModal({ art: 'bearbeiten', eintrag: e })}
                        className={`w-full rounded-xl border border-slate-700/90 bg-slate-800/40 pl-2 pr-3 py-2.5 text-left transition hover:border-teal-600/50 hover:bg-slate-800/80 ${km.listBorder} ${km.listBg}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`mt-0.5 h-8 w-1 shrink-0 rounded-full ${km.leftBar}`}
                            aria-hidden
                            title={km.label}
                          />
                          <div className="min-w-0 flex-1">
                            <span
                              className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${km.badge}`}
                            >
                              {km.label}
                            </span>
                            <div className="mt-1 flex items-start justify-between gap-2">
                              <span className="min-w-0 break-words text-left text-sm font-semibold text-slate-100">
                                {e.titel}
                              </span>
                              {e.uhrzeit.trim() ? (
                                <span className="shrink-0 rounded-md bg-slate-950/50 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-200">
                                  {e.uhrzeit}
                                </span>
                              ) : null}
                            </div>
                            {e.notiz.trim() ? (
                              <p className="mt-1 line-clamp-3 text-xs text-slate-400">{e.notiz}</p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-slate-800 px-3 py-3 sm:px-4">
            <button
              type="button"
              onClick={() => {
                setModal({ art: 'neu', datum: ausgewaehltNorm })
              }}
              className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-black text-white shadow-md shadow-teal-950/30 transition hover:bg-teal-500"
            >
              Eintrag hinzufügen
            </button>
          </div>
        </aside>
        </div>
      )}

      <TerminMorgenReminderEinstellungen />

      {kalenderBereit ? (
        <KalenderFotoImport
          onImport={(zeilen) => {
            const neu: KalenderEintrag[] = zeilen.map((z) => ({
              id: globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              titel: z.titel,
              datum: z.datum,
              notiz: '',
              uhrzeit: z.uhrzeit,
              kategorie: normalisiereKalenderKategorie(z.kategorie),
            }))
            void persist([...eintraege, ...neu])
          }}
        />
      ) : null}

      {modal ? (
        <EintragModal
          modus={modal}
          onClose={() => setModal(null)}
          onSpeichern={async (eingabe) => {
            if (eingabe.art === 'neu') {
              const neu: KalenderEintrag = {
                id: globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                datum: eingabe.datum,
                titel: eingabe.titel,
                notiz: eingabe.notiz,
                uhrzeit: eingabe.uhrzeit,
                kategorie: normalisiereKalenderKategorie(eingabe.kategorie),
              }
              await persist([...eintraege, neu])
              toast.success('Eintrag gespeichert.')
            } else {
              const next = eintraege.map((e) =>
                e.id === eingabe.id
                  ? {
                      ...e,
                      datum: eingabe.datum,
                      titel: eingabe.titel,
                      notiz: eingabe.notiz,
                      uhrzeit: eingabe.uhrzeit,
                      kategorie: normalisiereKalenderKategorie(eingabe.kategorie),
                    }
                  : e,
              )
              await persist(next)
              toast.success('Änderung gespeichert.')
            }
            setModal(null)
          }}
          onLoeschen={async (id) => {
            const next = eintraege.filter((e) => e.id !== id)
            await persist(next)
            toast.success('Eintrag gelöscht.')
            setModal(null)
          }}
        />
      ) : null}
    </div>
  )
}

type EintragFormPayload =
  | { art: 'neu'; datum: string; titel: string; notiz: string; uhrzeit: string; kategorie: KalenderKategorieId }
  | { art: 'bearbeiten'; id: string; datum: string; titel: string; notiz: string; uhrzeit: string; kategorie: KalenderKategorieId }

function EintragModal(props: {
  modus: ModalModus
  onClose: () => void
  onSpeichern: (p: EintragFormPayload) => void | Promise<void>
  onLoeschen: (id: string) => void | Promise<void>
}) {
  const initial =
    props.modus.art === 'neu'
      ? { titel: '', notiz: '', uhrzeit: '', kategorie: 'termin' as KalenderKategorieId }
      : {
          titel: props.modus.eintrag.titel,
          notiz: props.modus.eintrag.notiz,
          uhrzeit: props.modus.eintrag.uhrzeit,
          kategorie: normalisiereKalenderKategorie(props.modus.eintrag.kategorie),
        }
  const [titel, setTitel] = useState(initial.titel)
  const [notiz, setNotiz] = useState(initial.notiz)
  const [uhrzeit, setUhrzeit] = useState(initial.uhrzeit)
  const [kategorie, setKategorie] = useState<KalenderKategorieId>(initial.kategorie)
  const [datum, setDatum] = useState(props.modus.art === 'neu' ? props.modus.datum : props.modus.eintrag.datum)

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
      aria-labelledby="kal-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose()
      }}
    >
      <div
        className={`${appModalPanelClassName} max-h-[min(90vh,32rem)] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-800 px-4 py-3 sm:px-5">
          <h3 id="kal-modal-title" className="text-base font-black text-slate-100">
            {props.modus.art === 'neu' ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}
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
              await props.onSpeichern({ art: 'neu', datum, titel: t, notiz: notiz.trim(), uhrzeit: u, kategorie })
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
          <div className="block">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Kategorie</span>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="group" aria-label="Eintrags-Kategorie wählen">
              {KALENDER_KATEGORIEN.map((k) => {
                const aktiv = kategorie === k.id
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKategorie(k.id)}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs font-bold transition ${
                      aktiv
                        ? `${k.listBorder} ${k.listBg} text-slate-100 ring-2 ring-offset-2 ring-offset-slate-900 ring-slate-500/30`
                        : 'border-slate-700/90 bg-slate-950/60 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${k.dot}`} aria-hidden />
                    <span className="min-w-0 leading-tight">{k.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
            Titel
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 py-2 px-2.5 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/45"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              autoFocus
            />
          </label>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
            Datum
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 py-2 px-2.5 text-sm font-bold text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/45"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
            />
          </label>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
            Uhrzeit (optional)
            <input
              type="time"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 py-2 px-2.5 text-sm font-bold text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/45"
              value={uhrzeit}
              onChange={(e) => setUhrzeit(e.target.value)}
            />
          </label>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
            Notiz (optional)
            <textarea
              className="mt-1 min-h-[4rem] w-full rounded-lg border border-slate-700 bg-slate-950 py-2 px-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-teal-500/45"
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
              className="rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-2 text-sm font-bold text-slate-200"
              onClick={props.onClose}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-black text-white shadow-sm shadow-teal-950/30"
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
