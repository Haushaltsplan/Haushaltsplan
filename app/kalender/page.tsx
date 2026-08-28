'use client'

import { KalenderEintragModal, type KalenderEintragFormPayload, type KalenderEintragModalModus } from '@/components/kalender-eintrag-modal'
import {
  KALENDER_KATEGORIEN,
  KALENDER_SYNC_EVENT,
  baueMonatsZellen,
  filterEintraegeFuerTag,
  formatMonatTitelDe,
  geburtstagIsoImJahr,
  heuteAlsIsoDatum,
  isoDatumAusJahrMonatTag,
  kalenderKategorieMeta,
  ladeKalenderEintraege,
  ladeKalenderEintraegeVonQuelleMitMeta,
  monatPlusDelta,
  normalisiereKalenderKategorie,
  parseIsoDatum,
  type KalenderEintrag,
  type KalenderMonatKopf,
  speichereKalenderEintraegeMitCloud,
  sortiereEintraegeNachUhrzeitDannTitel,
} from '@/lib/haushalt-kalender'
import { KalenderFotoImport } from '@/components/kalender-foto-import'
import { PageChrome, PageHero } from '@/components/page-shell'
import {
  appCardClass,
  appCardHeaderClass,
  appGhostBtnClass,
  appLoadingClass,
} from '@/lib/app-ui'
import { bayernFeiertageFuerJahr } from '@/lib/bayern-feiertage'
import { istSupabaseClientKonfiguriert } from '@/lib/supabase'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'

const WOCHENTAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

/** DataTransfer-Typ für Ziehen einer Kalenderkategorie auf einen Tag */
const KALENDER_DND_MIME = 'application/x-mh-kal-kat' as const

function neuesKalenderId() {
  return globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function jetztAlsMonatKopf(): KalenderMonatKopf {
  const d = new Date()
  return { jahr: d.getFullYear(), monat: d.getMonth() + 1 }
}

function eintragKurzzeile(ev: KalenderEintrag) {
  const t = (ev.titel || 'Ohne Titel').trim()
  const u = ev.uhrzeit.trim()
  return u ? `${u} ${t}` : t
}

export default function KalenderPage() {
  const [sicht, setSicht] = useState<KalenderMonatKopf>(jetztAlsMonatKopf)
  const [eintraege, setEintraege] = useState<KalenderEintrag[]>([])
  const [ausgewaehlt, setAusgewaehlt] = useState<string | null>(null)
  const [modal, setModal] = useState<KalenderEintragModalModus | null>(null)
  const [kalenderBereit, setKalenderBereit] = useState(false)
  const [dragOverIso, setDragOverIso] = useState<string | null>(null)

  const monatErsterMount = useRef(true)

  useEffect(() => {
    const end = () => setDragOverIso(null)
    window.addEventListener('dragend', end)
    return () => window.removeEventListener('dragend', end)
  }, [])

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

  /** Wenn der Cloud-Abgleich nachträglich in localStorage schreibt, während der erste Render leer war. */
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

  const legeKategorieAufTag = useCallback(
    (iso: string, kategorieRaw: string) => {
      const kategorie = normalisiereKalenderKategorie(kategorieRaw)
      const km = kalenderKategorieMeta(kategorie)
      const neu: KalenderEintrag = {
        id: neuesKalenderId(),
        datum: iso,
        titel: km.label,
        notiz: '',
        uhrzeit: '',
        kategorie,
      }
      waehleDatum(iso)
      void persist([...eintraege, neu])
      toast.success(
        `${km.label} — ${new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`,
      )
    },
    [eintraege, persist],
  )

  const heuteIso = heuteAlsIsoDatum()
  const ausgewaehltNorm = ausgewaehlt ?? heuteIso

  const zellen = useMemo(() => baueMonatsZellen(sicht.jahr, sicht.monat), [sicht.jahr, sicht.monat])

  const proTagEintraege = useMemo(() => {
    const m = new Map<string, KalenderEintrag[]>()
    for (const e of eintraege) {
      if (e.kategorie === 'geburtstag') {
        const iso = geburtstagIsoImJahr(e.datum, sicht.jahr)
        if (!iso) continue
        const p = parseIsoDatum(iso)
        if (!p || p.monat !== sicht.monat) continue
        const list = m.get(iso) || []
        list.push(iso === e.datum ? e : { ...e, datum: iso })
        m.set(iso, list)
        continue
      }
      const list = m.get(e.datum) || []
      list.push(e)
      m.set(e.datum, list)
    }
    for (const [iso, list] of m) {
      m.set(iso, [...list].sort(sortiereEintraegeNachUhrzeitDannTitel))
    }
    return m
  }, [eintraege, sicht.jahr, sicht.monat])

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

  function einfuegeBayernFeiertageFuerAktuellesJahr() {
    const jahr = sicht.jahr
    const rows = bayernFeiertageFuerJahr(jahr)
    if (rows.length === 0) {
      toast.error('Keine Feiertage für dieses Jahr berechenbar.')
      return
    }
    const bekannt = new Set(
      eintraege
        .filter((e) => e.kategorie === 'feiertag')
        .map((e) => `${e.datum}\t${e.titel.trim()}`),
    )
    const neu: KalenderEintrag[] = []
    for (const r of rows) {
      const key = `${r.datum}\t${r.name}`
      if (bekannt.has(key)) continue
      bekannt.add(key)
      neu.push({
        id: neuesKalenderId(),
        datum: r.datum,
        titel: r.name,
        notiz: 'Gesetzlicher Feiertag in Bayern',
        uhrzeit: '',
        kategorie: 'feiertag',
      })
    }
    if (neu.length === 0) {
      toast('Alle bayerischen Feiertage für dieses Jahr sind bereits im Kalender.')
      return
    }
    void persist([...eintraege, ...neu])
    toast.success(`${neu.length} Feiertag(e) für ${jahr} eingefügt (Kategorie: Feiertag).`)
  }

  function oeffneNeuFuerTag(tag: number) {
    const iso = isoDatumAusJahrMonatTag(sicht.jahr, sicht.monat, tag)
    waehleDatum(iso)
    setModal({ art: 'neu', datum: iso })
  }

  return (
    <PageChrome>
      <PageHero eyebrow="Kalender" title="Termine & Übersicht" />

      {!kalenderBereit ? (
        <div className={appLoadingClass}>Kalender wird geladen …</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start">
        <div className={appCardClass}>
          <div className={`${appCardHeaderClass} flex flex-wrap items-center justify-between gap-3`}>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={monatDavor}
                className={appGhostBtnClass}
                aria-label="Vorheriger Monat"
              >
                ←
              </button>
              <button
                type="button"
                onClick={monatDanach}
                className={appGhostBtnClass}
                aria-label="Nächster Monat"
              >
                →
              </button>
            </div>
            <h2 className="min-w-0 flex-1 text-center text-base font-black capitalize tracking-tight text-[var(--app-text)] sm:text-lg">
              {formatMonatTitelDe(sicht)}
            </h2>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={einfuegeBayernFeiertageFuerAktuellesJahr}
                className="rounded-lg border border-amber-600/50 bg-amber-950/50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-200 transition hover:bg-amber-900/60 sm:text-xs"
                title="Gesetzliche Feiertage für Bayern in dieses Jahr eintragen (Kategorie Feiertag)"
              >
                Feiertage {sicht.jahr}
              </button>
              <button
                type="button"
                onClick={springeHeute}
                className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-sm shadow-teal-950/30 transition hover:bg-teal-500"
              >
                Heute
              </button>
            </div>
          </div>

          <div className="border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-2 sm:px-3">
            <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-[var(--app-text-muted)] sm:text-[10px]">
              Kategorie auf einen Tag ziehen
            </p>
            <div className="flex flex-wrap gap-1.5" role="list" aria-label="Kategorien zum Ziehen">
              {KALENDER_KATEGORIEN.map((k) => (
                <div
                  key={k.id}
                  role="listitem"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(KALENDER_DND_MIME, k.id)
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  className={`flex cursor-grab select-none items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-1 text-[10px] font-bold text-[var(--app-text)] shadow-sm active:cursor-grabbing sm:text-xs ${k.listBorder}`}
                  title={`${k.label} auf Kalendertag ziehen (Desktop)`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${k.dot}`} aria-hidden />
                  {k.label}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-[var(--app-border)] text-center text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)] sm:text-[11px]">
            {WOCHENTAGE_KURZ.map((w) => (
              <div key={w} className="px-0.5 py-2 sm:py-2.5">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {zellen.map((z, i) => {
              if (z == null) {
                return <div key={`e-${i}`} className="min-h-[4.5rem] border-b border-r border-[var(--app-border)] bg-[var(--app-surface)]/40 sm:min-h-[6rem]" />
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
                  onDragOver={(e) => {
                    if (![...e.dataTransfer.types].includes(KALENDER_DND_MIME)) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'copy'
                    setDragOverIso(iso)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOverIso(null)
                    const kid = e.dataTransfer.getData(KALENDER_DND_MIME)
                    if (!kid) return
                    legeKategorieAufTag(iso, kid)
                  }}
                  className={`min-h-[4.5rem] border-b border-r border-[var(--app-border)] p-0.5 text-left align-top transition sm:min-h-[6rem] sm:p-1.5 ${
                    isSel ? 'bg-teal-950/45 ring-1 ring-inset ring-teal-500/50' : 'hover:bg-[var(--app-surface-hover)]'
                  } ${isHeute && !isSel ? 'bg-sky-950/30' : ''} ${
                    dragOverIso === iso ? 'ring-2 ring-inset ring-teal-400/90' : ''
                  }`}
                  title={
                    n > 0
                      ? `Einfach: Tag wählen · Doppelklick: neuer Eintrag — Kategorie hierher ziehen — ${n} Einträge: ${amTag.map((e) => eintragKurzzeile(e)).join(' · ')}`
                      : 'Einfach: Tag wählen · Doppelklick: neuer Eintrag · Kategorie hierher ziehen'
                  }
                  aria-label={
                    n > 0
                      ? `Tag ${z}, ${n} ${n === 1 ? 'Eintrag' : 'Einträge'}: ${amTag.map((e) => eintragKurzzeile(e)).join('. ')}`
                      : `Tag ${z}, keine Einträge`
                  }
                >
                  <span
                    className={`inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-md text-[11px] font-bold tabular-nums sm:h-6 sm:text-sm ${
                      isHeute ? 'bg-sky-600 text-white' : 'text-[var(--app-text)]'
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
                            <span className="line-clamp-2 min-w-0 break-words text-left text-[7px] leading-tight text-[var(--app-text)] sm:text-[8px]">
                              {ev.uhrzeit.trim() ? (
                                <>
                                  <span className="whitespace-nowrap font-mono text-[var(--app-text-muted)]">{ev.uhrzeit}</span>
                                  <span className="text-[var(--app-text)]"> {ev.titel.trim() || 'Ohne Titel'}</span>
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
                          <span className="line-clamp-2 min-w-0 break-words text-left text-[7px] leading-tight text-[var(--app-text)] sm:text-[8px]">
                            {amTag[2].uhrzeit.trim() ? (
                              <>
                                <span className="whitespace-nowrap font-mono text-[var(--app-text-muted)]">{amTag[2].uhrzeit}</span>
                                <span className="text-[var(--app-text)]"> {amTag[2].titel.trim() || 'Ohne Titel'}</span>
                              </>
                            ) : (
                              amTag[2].titel.trim() || 'Ohne Titel'
                            )}
                          </span>
                        </div>
                      ) : null}
                      {n > 2 ? (
                        n === 3 ? (
                          <p className="mt-0.5 pl-1 text-[7px] font-bold leading-tight text-[var(--app-text-muted)] sm:hidden">
                            +1 weiterer
                          </p>
                        ) : (
                          <>
                            <p className="mt-0.5 pl-1 text-[7px] font-bold leading-tight text-[var(--app-text-muted)] sm:hidden">
                              +{n - 2} weitere
                            </p>
                            <p className="mt-0.5 hidden pl-1 text-[7px] font-bold leading-tight text-[var(--app-text-muted)] sm:block">
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
        </div>

        <aside className={appCardClass}>
          <div className={appCardHeaderClass}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--app-text-muted)]">Ausgewählter Tag</p>
            <p className="mt-0.5 text-sm font-bold text-[var(--app-text)]">
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
              <p className="text-sm text-[var(--app-text-muted)]">Keine Einträge an diesem Tag.</p>
            ) : (
              <ul className="space-y-2">
                {listAmTag.map((e) => {
                  const km = kalenderKategorieMeta(e.kategorie)
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setModal({ art: 'bearbeiten', eintrag: e })}
                        className={`w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] pl-2 pr-3 py-2.5 text-left transition hover:border-teal-600/50 hover:bg-[var(--app-surface-hover)] ${km.listBorder} ${km.listBg}`}
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
                              <span className="min-w-0 break-words text-left text-sm font-semibold text-[var(--app-text)]">
                                {e.titel}
                              </span>
                              {e.uhrzeit.trim() ? (
                                <span className="shrink-0 rounded-md bg-[var(--app-surface-muted)] px-1.5 py-0.5 text-[10px] font-mono font-bold text-[var(--app-text)]">
                                  {e.uhrzeit}
                                </span>
                              ) : null}
                            </div>
                            {e.notiz.trim() ? (
                              <p className="mt-1 line-clamp-3 text-xs text-[var(--app-text-muted)]">{e.notiz}</p>
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
          <div className="border-t border-[var(--app-border)] px-3 py-3 sm:px-4">
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

      {kalenderBereit ? (
        <KalenderFotoImport
          onImport={(zeilen) => {
            const neu: KalenderEintrag[] = zeilen.map((z) => ({
              id: neuesKalenderId(),
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
        <KalenderEintragModal
          modus={modal}
          titleId="kal-modal-title"
          onClose={() => setModal(null)}
          onSpeichern={async (eingabe: KalenderEintragFormPayload) => {
            if (eingabe.art === 'neu') {
              const kat = normalisiereKalenderKategorie(eingabe.kategorie)
              const neues: KalenderEintrag[] = eingabe.termine.map((d) => ({
                id: neuesKalenderId(),
                datum: d,
                titel: eingabe.titel,
                notiz: eingabe.notiz,
                uhrzeit: eingabe.uhrzeit,
                kategorie: kat,
              }))
              await persist([...eintraege, ...neues])
              toast.success(
                neues.length === 1
                  ? 'Eintrag gespeichert.'
                  : `${neues.length} Einträge für ${neues.length} Tage gespeichert.`,
              )
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
    </PageChrome>
  )
}
