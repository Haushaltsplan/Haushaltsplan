'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { CollapsibleRowHeaderEnd, LABEL_EINKLAPPEN } from '@/components/collapsible-ui'
import {
  normalisiereRezeptKategorie,
  REZEPT_KATALOG_KATEGORIEN,
} from '@/lib/lager-rezept-katalog-kategorie'
import { supabase } from '@/lib/supabase'
import { normalisiereKcalGesamt, parseEinzelGericht, type RezeptGericht } from '@/lib/rezept-coach-types'
import { RezeptStructuredCards } from '@/components/lager-rezept-coach'

export type LagerRezeptKatalogArtikelZeile = { id?: string; name: string; menge: number; einheit: string }

const KAT_UNKAT = '__unkat__'

type KatalogRow = {
  id: string
  titel: string
  portionen: number
  gericht_json: unknown
  geschaetzte_kcal_gesamt: number | null
  bewertung: number | null
  kategorie: string | null
  erstellt_am: string
}

type Props = {
  artikel: LagerRezeptKatalogArtikelZeile[]
  refreshKey: number
}

function formatDatumDe(iso: string) {
  try {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return '—'
    return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

function kcalAnzeige(row: KatalogRow, gericht: RezeptGericht | null): string {
  const ausSpalte = normalisiereKcalGesamt(row.geschaetzte_kcal_gesamt)
  if (ausSpalte != null) return `ca. ${ausSpalte} kcal (gesamt)`
  const ausJson = gericht ? normalisiereKcalGesamt(gericht.geschaetzte_kcal_gesamt) : null
  if (ausJson != null) return `ca. ${ausJson} kcal (gesamt)`
  return '—'
}

function effektiveKategorie(row: KatalogRow, ger: RezeptGericht | null): string | null {
  if (row.kategorie != null && String(row.kategorie).trim()) {
    return normalisiereRezeptKategorie(row.kategorie)
  }
  if (ger?.kategorie) return normalisiereRezeptKategorie(ger.kategorie)
  return null
}

import { gerichtAlleZutatenImBestand } from '@/lib/rezept-lager-abgleich'

export function LagerRezeptKatalog({ artikel, refreshKey }: Props) {
  const [offen, setOffen] = useState(true)
  const [zeilen, setZeilen] = useState<KatalogRow[]>([])
  const [laden, setLaden] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [bewertungLadenId, setBewertungLadenId] = useState<string | null>(null)
  const [kategorieLadenId, setKategorieLadenId] = useState<string | null>(null)

  const [filterBewertung, setFilterBewertung] = useState<string>('alle')
  const [filterKategorie, setFilterKategorie] = useState<string>('')
  const [nurAlleLagerZutatenDa, setNurAlleLagerZutatenDa] = useState(false)

  const lade = useCallback(async () => {
    setLaden(true)
    try {
      const { data, error } = await supabase
        .from('lager_rezept_katalog')
        .select('id, titel, portionen, gericht_json, geschaetzte_kcal_gesamt, bewertung, kategorie, erstellt_am')
        .order('erstellt_am', { ascending: false })
      if (error) {
        if (error.message.includes('Could not find') || error.message.includes('schema cache')) {
          toast.error('Tabelle „lager_rezept_katalog“ fehlt — Migration in Supabase ausführen.')
        } else if (error.message.includes('kategorie') && error.message.includes('column')) {
          toast.error('Spalte „kategorie“ fehlt — Migration 20260425120000 ausführen.')
        } else {
          console.error(error)
          toast.error('Rezeptkatalog konnte nicht geladen werden.')
        }
        setZeilen([])
        return
      }
      const rows: KatalogRow[] = []
      for (const r of data || []) {
        const o = r as Record<string, unknown>
        const id = typeof o.id === 'string' ? o.id : ''
        if (!id) continue
        rows.push({
          id,
          titel: typeof o.titel === 'string' ? o.titel : 'Ohne Titel',
          portionen: Number(o.portionen) || 0,
          gericht_json: o.gericht_json,
          geschaetzte_kcal_gesamt: o.geschaetzte_kcal_gesamt == null ? null : Number(o.geschaetzte_kcal_gesamt),
          bewertung: o.bewertung == null ? null : Number(o.bewertung),
          kategorie: o.kategorie == null || o.kategorie === '' ? null : String(o.kategorie),
          erstellt_am: typeof o.erstellt_am === 'string' ? o.erstellt_am : '',
        })
      }
      setZeilen(rows)
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => {
    void lade()
  }, [lade, refreshKey])

  const geparst = useMemo(() => {
    const m = new Map<string, RezeptGericht | null>()
    for (const row of zeilen) {
      m.set(row.id, parseEinzelGericht(row.gericht_json))
    }
    return m
  }, [zeilen])

  const gefiltert = useMemo(() => {
    return zeilen.filter((row) => {
      const ger = geparst.get(row.id) ?? null
      const kat = effektiveKategorie(row, ger)

      if (filterKategorie === KAT_UNKAT) {
        if (kat != null) return false
      } else if (filterKategorie) {
        if (kat !== filterKategorie) return false
      }

      if (filterBewertung === 'ohne') {
        if (row.bewertung != null) return false
      } else if (filterBewertung.startsWith('ab_')) {
        const min = Number(filterBewertung.replace('ab_', ''))
        if (!Number.isFinite(min) || row.bewertung == null || row.bewertung < min) return false
      }

      if (nurAlleLagerZutatenDa && !gerichtAlleZutatenImBestand(ger, artikel)) return false

      return true
    })
  }, [zeilen, geparst, filterBewertung, filterKategorie, nurAlleLagerZutatenDa, artikel])

  async function bewertungSetzen(id: string, wert: string) {
    if (wert === '') {
      setBewertungLadenId(id)
      try {
        const { error } = await supabase.from('lager_rezept_katalog').update({ bewertung: null }).eq('id', id)
        if (error) throw new Error(error.message)
        setZeilen((z) => z.map((r) => (r.id === id ? { ...r, bewertung: null } : r)))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Bewertung konnte nicht entfernt werden.')
      } finally {
        setBewertungLadenId(null)
      }
      return
    }
    const n = Number(wert)
    if (!Number.isFinite(n) || n < 1 || n > 10) return
    setBewertungLadenId(id)
    try {
      const { error } = await supabase.from('lager_rezept_katalog').update({ bewertung: n }).eq('id', id)
      if (error) throw new Error(error.message)
      setZeilen((z) => z.map((r) => (r.id === id ? { ...r, bewertung: n } : r)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bewertung speichern fehlgeschlagen.')
    } finally {
      setBewertungLadenId(null)
    }
  }

  async function kategorieSetzen(id: string, wert: string) {
    const neu = wert === '' ? null : normalisiereRezeptKategorie(wert)
    setKategorieLadenId(id)
    try {
      const { error } = await supabase.from('lager_rezept_katalog').update({ kategorie: neu }).eq('id', id)
      if (error) {
        if (error.message.includes('kategorie') && error.message.includes('column')) {
          toast.error('Spalte „kategorie“ fehlt — Migration in Supabase ausführen.')
        } else {
          throw new Error(error.message)
        }
        return
      }
      setZeilen((z) => z.map((r) => (r.id === id ? { ...r, kategorie: neu } : r)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kategorie speichern fehlgeschlagen.')
    } finally {
      setKategorieLadenId(null)
    }
  }

  async function eintragLoeschen(id: string, titel: string) {
    const ok = window.confirm(`Rezept „${titel}“ aus dem Katalog löschen?`)
    if (!ok) return
    try {
      const { error } = await supabase.from('lager_rezept_katalog').delete().eq('id', id)
      if (error) throw new Error(error.message)
      setZeilen((z) => z.filter((r) => r.id !== id))
      setExpanded((e) => (e === id ? null : e))
      toast.success('Eintrag gelöscht.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
    }
  }

  const filterAktiv =
    filterBewertung !== 'alle' || Boolean(filterKategorie) || nurAlleLagerZutatenDa

  const zaehlerText =
    laden ? '…' : filterAktiv ? `${gefiltert.length} von ${zeilen.length}` : `${zeilen.length} ${zeilen.length === 1 ? 'Eintrag' : 'Einträge'}`

  return (
    <div className="overflow-hidden rounded-2xl border border-teal-900/45 bg-slate-900 shadow-lg shadow-black/25">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="group flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-800/40 md:px-6"
        aria-expanded={offen}
      >
        <div className="min-w-0">
          <h2 className="text-base font-black text-teal-200">Rezeptkatalog</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Gespeicherte KI-Rezepte · Rating 1–10 (1 schlecht, 10 am besten) · geschätzte kcal fürs Gesamtgericht
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <span className="rounded-lg border border-slate-600/90 bg-slate-950/40 px-2.5 py-1 text-[11px] font-bold text-slate-300">
            {zaehlerText}
          </span>
          <CollapsibleRowHeaderEnd open={offen} labels={LABEL_EINKLAPPEN} tone="teal" size="sm" />
        </div>
      </button>

      {offen && (
        <div className="border-t border-slate-800 px-4 pb-4 pt-2 md:px-6">
          {zeilen.length > 0 && (
            <div className="mb-3 flex flex-col gap-2 rounded-xl border border-slate-800/90 bg-slate-950/50 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Bewertung</span>
                <select
                  className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs font-bold text-slate-100"
                  value={filterBewertung}
                  onChange={(e) => setFilterBewertung(e.target.value)}
                >
                  <option value="alle">Alle Bewertungen</option>
                  <option value="ohne">Ohne Bewertung</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={`ab_${n}`}>
                      Ab {n}/10
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Kategorie</span>
                <select
                  className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs font-bold text-slate-100"
                  value={filterKategorie}
                  onChange={(e) => setFilterKategorie(e.target.value)}
                >
                  <option value="">Alle Kategorien</option>
                  <option value={KAT_UNKAT}>Unkategorisiert</option>
                  {REZEPT_KATALOG_KATEGORIEN.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/80 px-2.5 py-2 sm:shrink-0">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-500 text-teal-600 focus:ring-teal-500/40"
                  checked={nurAlleLagerZutatenDa}
                  onChange={(e) => setNurAlleLagerZutatenDa(e.target.checked)}
                />
                <span className="text-[11px] font-semibold leading-snug text-slate-300">
                  Nur Rezepte, bei denen alle Zutaten aktuell im Lager sind
                </span>
              </label>
            </div>
          )}

          {zeilen.length === 0 && !laden ? (
            <p className="py-4 text-center text-sm text-slate-500">
              Noch keine Rezepte gespeichert. Unter „KI: Rezepte …“ bei einem Gericht auf „Im Katalog speichern“ tippen.
            </p>
          ) : gefiltert.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              Keine Rezepte passen zu den Filtern. Filter zurücksetzen oder Kriterien lockern.
            </p>
          ) : (
            <ul className="space-y-2">
              {gefiltert.map((row) => {
                const ger = geparst.get(row.id) ?? null
                const istOffen = expanded === row.id
                const kat = effektiveKategorie(row, ger)
                return (
                  <li key={row.id} className="rounded-xl border border-slate-800/90 bg-slate-950/40">
                    <div className="flex flex-col gap-2 px-3 py-2.5 md:px-3.5">
                      <div className="flex flex-wrap items-start gap-2">
                        <button
                          type="button"
                          onClick={() => setExpanded((e) => (e === row.id ? null : row.id))}
                          className="min-w-0 flex-1 text-left text-sm font-bold text-slate-100 hover:text-teal-200"
                        >
                          <span className="truncate">{row.titel}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-slate-500">
                            <span>
                              {formatDatumDe(row.erstellt_am)} · {kcalAnzeige(row, ger)}
                            </span>
                            {kat ? (
                              <span className="rounded border border-teal-800/50 bg-teal-950/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-teal-200/95">
                                {kat}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void eintragLoeschen(row.id, row.titel)}
                          className="shrink-0 rounded-md border border-rose-800/50 px-2 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-500/10"
                        >
                          Löschen
                        </button>
                      </div>
                      <div className="flex flex-wrap items-end gap-3 border-t border-slate-800/60 pt-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-400">Rating</span>
                          <span className="text-sm font-black tabular-nums text-teal-200">
                            {row.bewertung != null ? `${row.bewertung}/10` : '—'}
                          </span>
                          <select
                            className="rounded-md border border-slate-600 bg-slate-900 px-1.5 py-1 text-xs font-bold text-slate-100"
                            value={row.bewertung == null ? '' : String(row.bewertung)}
                            disabled={bewertungLadenId === row.id}
                            onChange={(e) => void bewertungSetzen(row.id, e.target.value)}
                            aria-label={`Rating für ${row.titel}`}
                          >
                            <option value="">—</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                              <option key={n} value={String(n)}>
                                {n}/10
                              </option>
                            ))}
                          </select>
                        </div>
                        <label className="flex min-w-[12rem] flex-1 flex-wrap items-center gap-2 sm:max-w-xs">
                          <span className="text-[11px] font-bold text-slate-400">Kategorie</span>
                          <select
                            className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-900 px-1.5 py-1 text-xs font-bold text-slate-100"
                            value={kat ?? ''}
                            disabled={kategorieLadenId === row.id}
                            onChange={(e) => void kategorieSetzen(row.id, e.target.value)}
                          >
                            <option value="">—</option>
                            {REZEPT_KATALOG_KATEGORIEN.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                    {istOffen && ger ? (
                      <div className="border-t border-slate-800/80 px-2 py-3 md:px-3">
                        <RezeptStructuredCards
                          data={{ rezepte: [ger] }}
                          artikel={artikel}
                          buchungKey={null}
                          onBuchen={() => {}}
                          onMehrAnleitung={() => {}}
                          kiBusy={false}
                          anzeigeNur
                        />
                      </div>
                    ) : null}
                    {istOffen && !ger ? (
                      <div className="border-t border-slate-800/80 px-3 py-3 text-xs text-rose-300">
                        Gespeicherte Daten konnten nicht als Rezept gelesen werden.
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
            Kalorienangaben sind grobe Schätzungen der KI (Gesamtmenge des Gerichts), keine Nährwerttabelle. Kategorien
            kommen von der KI und kannst du pro Zeile anpassen.
          </p>
        </div>
      )}
    </div>
  )
}
