'use client'

import { appTableScrollClassName } from '@/components/page-shell'
import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { CollapsibleRowHeaderEnd, LABEL_EINKLAPPEN } from '@/components/collapsible-ui'
import { appModalBackdropClassName, appModalPanelWideScrollClassName } from '@/lib/app-modal-overlay'
import { supabase } from '@/lib/supabase'

export type LagerGekochtProduktOption = {
  id: string
  name: string
  menge: number
  einheit: string
  /** Ø-Preis je Basiseinheit (wie Lagerwert), für Kostensplit der Positionen. */
  preisJeBasis?: number | null
}

type MahlzeitRow = {
  id: string
  titel: string
  gekocht_am: string
  quelle: string
  kosten_geschaetzt_eur: number | null
}

type VerbrauchZeile = {
  produkt_id: string
  menge: number
  notiz: string | null
}

function formatEur(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatGekochtAm(iso: string) {
  try {
    return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function toDatetimeLocalValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Props = {
  produktOptionen: LagerGekochtProduktOption[]
  refreshKey: number
  onNachBuchung: () => void
}

export function LagerGekochteMahlzeiten({ produktOptionen, refreshKey, onNachBuchung }: Props) {
  const [open, setOpen] = useState(false)
  const [mahlzeiten, setMahlzeiten] = useState<MahlzeitRow[]>([])
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Record<string, VerbrauchZeile[]>>({})
  const [detailLaden, setDetailLaden] = useState<string | null>(null)

  const [manualOpen, setManualOpen] = useState(false)
  const [manualTitel, setManualTitel] = useState('')
  const [manualZeit, setManualZeit] = useState(() => toDatetimeLocalValue())
  const [manualZeilen, setManualZeilen] = useState<{ produkt_id: string; menge: string }[]>([{ produkt_id: '', menge: '' }])
  const [manualBusy, setManualBusy] = useState(false)

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of produktOptionen) m.set(p.id, p.name)
    return m
  }, [produktOptionen])

  const preisUndEinheitById = useMemo(() => {
    const m = new Map<string, { preis: number | null; einheit: string }>()
    for (const p of produktOptionen) {
      const pr = p.preisJeBasis
      const preis = pr != null && Number.isFinite(pr) && pr >= 0 ? pr : null
      m.set(p.id, { preis, einheit: p.einheit })
    }
    return m
  }, [produktOptionen])

  function anteilEurFuerZeile(produktId: string, menge: number): number | null {
    const row = preisUndEinheitById.get(produktId)
    const pr = row?.preis
    if (pr == null) return null
    return Math.round(menge * pr * 100) / 100
  }

  function formatEurJeEinheit(preis: number, einheit: string) {
    return `${formatEur(preis)}/${einheit}`
  }

  const ladeListe = useCallback(async () => {
    setLaden(true)
    setFehler(null)
    try {
      const { data, error } = await supabase
        .from('lager_mahlzeit')
        .select('id, titel, gekocht_am, quelle, kosten_geschaetzt_eur')
        .order('gekocht_am', { ascending: false })
        .limit(100)

      if (error) {
        const msg = error.message || 'Liste konnte nicht geladen werden.'
        if (msg.includes('lager_mahlzeit') || (error as { code?: string }).code === 'PGRST205') {
          setFehler('Tabelle „lager_mahlzeit“ fehlt noch — bitte Migration in Supabase ausführen und Schema neu laden.')
        } else {
          setFehler(msg)
        }
        setMahlzeiten([])
        return
      }
      setMahlzeiten((data || []) as MahlzeitRow[])
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void ladeListe()
  }, [open, refreshKey, ladeListe])

  const ladeDetail = useCallback(
    async (id: string) => {
      setDetailLaden(id)
      try {
        const { data, error } = await supabase
          .from('lager_verbrauch')
          .select('produkt_id, menge, notiz')
          .eq('mahlzeit_id', id)
          .order('erstellt_am', { ascending: true })

        if (error) {
          toast.error(error.message || 'Details konnten nicht geladen werden.')
          return
        }
        setDetail((d) => ({ ...d, [id]: (data || []) as VerbrauchZeile[] }))
      } finally {
        setDetailLaden(null)
      }
    },
    [],
  )

  useEffect(() => {
    if (!expandedId) return
    if (detail[expandedId]) return
    void ladeDetail(expandedId)
  }, [expandedId, detail, ladeDetail])

  useEffect(() => {
    if (!manualOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !manualBusy) setManualOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [manualOpen, manualBusy])

  const summeKosten = useMemo(() => {
    let s = 0
    for (const m of mahlzeiten) {
      const k = Number(m.kosten_geschaetzt_eur)
      if (Number.isFinite(k)) s += k
    }
    return Math.round(s * 100) / 100
  }, [mahlzeiten])

  async function bucheManuell() {
    const titel = manualTitel.trim()
    if (!titel) {
      toast.error('Bitte einen Titel eingeben.')
      return
    }
    const zeilen: { produkt_id: string; menge: number; notiz: string | null }[] = []
    for (const z of manualZeilen) {
      const pid = z.produkt_id.trim()
      const menge = Number(String(z.menge).replace(',', '.'))
      if (!pid && !z.menge.trim()) continue
      if (!pid || !Number.isFinite(menge) || menge <= 0) {
        toast.error('Jede Zeile braucht Produkt und eine positive Menge.')
        return
      }
      const opt = produktOptionen.find((p) => p.id === pid)
      if (!opt) {
        toast.error('Ungültiges Produkt.')
        return
      }
      if (menge > opt.menge + 1e-6) {
        toast.error(`Zu wenig Bestand für „${opt.name}“.`)
        return
      }
      zeilen.push({ produkt_id: pid, menge, notiz: `Mahlzeit: ${titel}`.slice(0, 500) })
    }
    if (!zeilen.length) {
      toast.error('Mindestens eine Zutaten-Zeile.')
      return
    }

    let gekochtIso: string | undefined
    try {
      const d = new Date(manualZeit)
      if (!Number.isFinite(d.getTime())) throw new Error('bad')
      gekochtIso = d.toISOString()
    } catch {
      toast.error('Ungültiges Datum/Zeit.')
      return
    }

    setManualBusy(true)
    try {
      const res = await fetch('/api/lager/mahlzeit/buchen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titel,
          gekocht_am: gekochtIso,
          quelle: 'manuell',
          zeilen,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 501) {
        toast.error(typeof body.error === 'string' ? body.error : 'Service Role fehlt.')
        return
      }
      if (!res.ok) {
        toast.error(typeof body.error === 'string' ? body.error : 'Buchung fehlgeschlagen.')
        return
      }
      const k = typeof body.kosten_geschaetzt_eur === 'number' ? body.kosten_geschaetzt_eur : null
      toast.success(
        k != null && Number.isFinite(k)
          ? `Mahlzeit gebucht — geschätzte Zutatenkosten: ${formatEur(k)}`
          : 'Mahlzeit gebucht.',
      )
      setManualOpen(false)
      setManualTitel('')
      setManualZeit(toDatetimeLocalValue())
      setManualZeilen([{ produkt_id: '', menge: '' }])
      setExpandedId(null)
      setDetail({})
      void ladeListe()
      onNachBuchung()
    } catch {
      toast.error('Netzwerkfehler.')
    } finally {
      setManualBusy(false)
    }
  }

  return (
    <div className="rounded-[2rem] border border-[var(--app-border)] bg-[var(--app-surface-muted)] shadow-xl shadow-black/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-[var(--app-surface-hover)] md:px-8"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-lg font-black text-violet-200">Gekocht &amp; gegessen</h2>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            Rückblick auf Mahlzeiten und{' '}
            <span className="font-semibold text-[var(--app-text-muted)]">geschätzte</span> Zutatenkosten (Ø aus Kassenzettel-Einkäufen).
          </p>
        </div>
        <CollapsibleRowHeaderEnd open={open} labels={LABEL_EINKLAPPEN} tone="violet" />
      </button>

      {open && (
        <div className="border-t border-[var(--app-border)] px-4 pb-5 pt-3 md:px-8">
          {fehler && (
            <p className="mb-3 rounded-xl border border-amber-800/60 bg-amber-950/35 p-3 text-xs leading-relaxed text-amber-100">
              {fehler}
            </p>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-[var(--app-text-muted)]">
              Summe angezeigter Einträge: <span className="font-bold text-violet-200">{formatEur(summeKosten)}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={laden}
                onClick={() => void ladeListe()}
                className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-hover)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--app-text)] hover:bg-[var(--app-surface-hover)] disabled:opacity-40"
              >
                Aktualisieren
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualOpen(true)
                  setManualZeit(toDatetimeLocalValue())
                }}
                className="rounded-lg border border-violet-700/55 bg-violet-950/40 px-2.5 py-1.5 text-[11px] font-bold text-violet-100 hover:bg-violet-900/35"
              >
                Mahlzeit manuell verbuchen
              </button>
            </div>
          </div>

          {laden && <p className="text-xs text-[var(--app-text-muted)]">Lade Einträge …</p>}

          {!laden && !fehler && mahlzeiten.length === 0 && (
            <p className="text-sm text-[var(--app-text-muted)]">
              Noch keine gebuchten Mahlzeiten. Beim Rezept-Coach auf „Zutaten aus Vorrat ausbuchen“ tippen — oder hier manuell
              verbuchen.
            </p>
          )}

          {!laden && mahlzeiten.length > 0 && (
            <ul className="space-y-2">
              {mahlzeiten.map((m) => {
                const exp = expandedId === m.id
                const lines = detail[m.id]
                return (
                  <li key={m.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]">
                    <button
                      type="button"
                      onClick={() => setExpandedId(exp ? null : m.id)}
                      className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-[var(--app-surface-muted)] md:px-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--app-text)]">{m.titel}</p>
                        <p className="text-[11px] text-[var(--app-text-muted)]">
                          {formatGekochtAm(m.gekocht_am)}
                          {m.quelle === 'rezept' ? ' · aus Rezept' : m.quelle === 'manuell' ? ' · manuell' : ` · ${m.quelle}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-black tabular-nums text-violet-200">
                          {formatEur(Number(m.kosten_geschaetzt_eur))}
                        </p>
                        <p className="text-[10px] text-[var(--app-text-muted)]">geschätzt</p>
                      </div>
                    </button>
                    {exp && (
                      <div className="border-t border-[var(--app-border)] px-3 py-2 text-xs text-[var(--app-text-muted)] md:px-4">
                        {detailLaden === m.id && <p className="text-[var(--app-text-muted)]">Lade Zutaten …</p>}
                        {lines && lines.length > 0 && (
                          <div className="mt-1 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">
                              Positionen & Kostensplit
                            </p>
                            <div className={`${appTableScrollClassName} rounded-lg border border-[var(--app-border)]`}>
                              <table className="app-data-table w-full min-w-[18rem] border-collapse text-left text-[11px]">
                                <thead>
                                  <tr className="border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[9px] font-black uppercase tracking-wider text-[var(--app-text-muted)]">
                                    <th className="px-2 py-1.5">Zutat</th>
                                    <th className="px-2 py-1.5 text-right">Menge</th>
                                    <th className="px-2 py-1.5 text-right">Ø-Preis</th>
                                    <th className="px-2 py-1.5 text-right">Anteil</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lines.map((z, i) => {
                                    const meta = preisUndEinheitById.get(z.produkt_id)
                                    const einh = meta?.einheit ?? produktOptionen.find((p) => p.id === z.produkt_id)?.einheit ?? ''
                                    const anteil = anteilEurFuerZeile(z.produkt_id, z.menge)
                                    return (
                                      <tr key={`${m.id}-${i}`} className="border-b border-[var(--app-border)] last:border-0">
                                        <td className="max-w-[11rem] px-2 py-1.5 align-top text-[var(--app-text)]">
                                          <span className="font-semibold">{nameById.get(z.produkt_id) || z.produkt_id.slice(0, 8)}</span>
                                          {z.notiz ? <span className="mt-0.5 block font-normal text-[var(--app-text-muted)]">{z.notiz}</span> : null}
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono tabular-nums text-[var(--app-text)]">
                                          −{z.menge} {einh}
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-[var(--app-text-muted)]">
                                          {meta?.preis != null ? formatEurJeEinheit(meta.preis, einh) : '—'}
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold tabular-nums text-violet-200/95">
                                          {anteil != null ? formatEur(anteil) : '—'}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {(() => {
                              let summe = 0
                              let hat = false
                              for (const z of lines) {
                                const a = anteilEurFuerZeile(z.produkt_id, z.menge)
                                if (a != null) {
                                  summe += a
                                  hat = true
                                }
                              }
                              summe = Math.round(summe * 100) / 100
                              const gespeichert = Number(m.kosten_geschaetzt_eur)
                              return (
                                <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-2 py-2 text-[10px] leading-relaxed text-[var(--app-text-muted)]">
                                  {hat ? (
                                    <>
                                      <span className="font-semibold text-[var(--app-text-muted)]">Summe Positionen (jetziger Ø-Preis):</span>{' '}
                                      <span className="tabular-nums text-violet-200">{formatEur(summe)}</span>
                                      {Number.isFinite(gespeichert) ? (
                                        <>
                                          {' '}
                                          ·{' '}
                                          <span className="font-semibold text-[var(--app-text-muted)]">beim Verbuchen:</span>{' '}
                                          <span className="tabular-nums text-[var(--app-text)]">{formatEur(gespeichert)}</span>
                                        </>
                                      ) : null}
                                    </>
                                  ) : (
                                    <span>Keine Ø-Preise für diese Produkte — Anteil nicht berechenbar.</span>
                                  )}
                                  <span className="mt-1 block text-[var(--app-text-muted)]">
                                    Der Split nutzt die gleichen Ø-Einkaufspreise wie die Lagerkarten; kleine Abweichungen zur
                                    gespeicherten Summe sind durch Rundung oder neuere Käufe möglich.
                                  </span>
                                </div>
                              )
                            })()}
                          </div>
                        )}
                        {lines && lines.length === 0 && <p className="text-[var(--app-text-muted)]">Keine Verbrauchszeilen verknüpft.</p>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <p className="mt-4 text-[10px] leading-relaxed text-[var(--app-text-muted)]">
            Kosten = Summe über alle Zutaten (verbrauchte Menge × gewichteter Ø-Einkaufspreis aus Kassenzetteln). Ohne
            Einkaufshistorie wird 0 € geschätzt.
          </p>
        </div>
      )}

      {manualOpen && (
        <div
          className={appModalBackdropClassName}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !manualBusy) setManualOpen(false)
          }}
        >
          <div role="dialog" aria-modal="true" className={`${appModalPanelWideScrollClassName} p-4 sm:p-5`}>
            <h3 className="text-base font-black text-violet-200">Mahlzeit manuell verbuchen</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--app-text-muted)]">
              Bestand wird wie beim Rezept-Coach reduziert; die Mahlzeit erscheint in der Liste mit Kostenschätzung.
            </p>

            <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Gericht / Mahlzeit</label>
            <input
              type="text"
              value={manualTitel}
              onChange={(e) => setManualTitel(e.target.value)}
              placeholder="z. B. Veganes Chili"
              className="mt-1 w-full rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)] outline-none focus:ring-2 focus:ring-violet-500/40"
            />

            <label className="mt-3 block text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Wann gegessen?</label>
            <input
              type="datetime-local"
              value={manualZeit}
              onChange={(e) => setManualZeit(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text)] outline-none focus:ring-2 focus:ring-violet-500/40"
            />

            <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Zutaten aus Vorrat (Basiseinheit)</p>
            <div className="mt-2 space-y-2">
              {manualZeilen.map((z, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <select
                      value={z.produkt_id}
                      onChange={(e) => {
                        const v = e.target.value
                        setManualZeilen((rows) => rows.map((r, j) => (j === idx ? { ...r, produkt_id: v } : r)))
                      }}
                      className="w-full rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-2 py-2 text-xs text-[var(--app-text)] outline-none focus:ring-2 focus:ring-violet-500/40"
                    >
                      <option value="">Produkt wählen …</option>
                      {produktOptionen.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.menge} {p.einheit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Menge"
                    value={z.menge}
                    onChange={(e) => {
                      const v = e.target.value
                      setManualZeilen((rows) => rows.map((r, j) => (j === idx ? { ...r, menge: v } : r)))
                    }}
                    className="w-24 rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-2 py-2 text-xs text-[var(--app-text)] outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setManualZeilen((rows) => rows.filter((_, j) => j !== idx))}
                    disabled={manualZeilen.length <= 1}
                    className="rounded-lg border border-[var(--app-border-strong)] px-2 py-2 text-[11px] font-bold text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setManualZeilen((rows) => [...rows, { produkt_id: '', menge: '' }])}
              className="mt-2 text-[11px] font-bold text-violet-300 hover:underline"
            >
              + Zeile
            </button>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={manualBusy}
                onClick={() => setManualOpen(false)}
                className="rounded-xl border border-[var(--app-border-strong)] px-4 py-2 text-xs font-bold text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] disabled:opacity-40"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={manualBusy}
                onClick={() => void bucheManuell()}
                className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white hover:bg-violet-500 disabled:opacity-40"
              >
                {manualBusy ? 'Buche …' : 'Verbuchen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
