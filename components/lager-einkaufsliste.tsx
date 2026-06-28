'use client'

import { appTableScrollClassName } from '@/components/page-shell'
import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { CollapsibleRowHeaderEnd, LABEL_EINKLAPPEN } from '@/components/collapsible-ui'
import {
  verbrauchKennzahlenFuerProdukt,
  vorschlagsMengeEinkauf,
  type LagerVerbrauchHistorieZeile,
} from '@/lib/lager-einkaufsliste-verbrauch'
import { basisEinheitFuerPreisanzeige, istLagerBasisEinheit, produktEinheitZuBasis, type LagerBasisEinheit } from '@/lib/lager-einheiten'
import { istUnterMindestbestand, mhdStatus } from '@/lib/lager-mhd'
import { abonniereMerker, entferneMerker, entferneNamensMerker, gemerkteIds, gemerkteNamen } from '@/lib/einkaufsliste-merker'

const SESSION_KEY = 'mein-haushalt:einkaufsliste-v1'

type PersistShape = {
  /** Aus der Liste entfernte Produkt-IDs (bis wieder Bestand > 0 war). */
  hidden: string[]
  /** Manuelle Einkaufsmengen (Basiseinheit). */
  mengen: Record<string, number>
}

type Lb = { aktuelle_menge?: number }
type ProduktKurz = {
  id: string
  name: string
  einheit: string
  basis_einheit?: string | null
  lagerbestand?: Lb | Lb[] | null
  durchschnittspreis?: number | null
  letzterEinkaufspreis?: number | null
  mindestbestand?: number | null
  mhd?: string | null
  immer_da?: boolean | null
}

function lagerMenge(p: Pick<ProduktKurz, 'lagerbestand'>): number {
  const lb = p.lagerbestand
  if (Array.isArray(lb)) return Number(lb[0]?.aktuelle_menge) || 0
  if (lb && typeof lb === 'object' && 'aktuelle_menge' in lb) return Number((lb as Lb).aktuelle_menge) || 0
  return 0
}

function basisEinheitAnzeige(p: ProduktKurz): LagerBasisEinheit {
  const b = p.basis_einheit
  if (b && istLagerBasisEinheit(b)) return b
  return produktEinheitZuBasis(p.einheit)
}

function formatEur(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatEurJeBasiseinheit(n: number | null | undefined, basis: LagerBasisEinheit) {
  if (n == null || !Number.isFinite(n)) return '—'
  const eur = formatEur(n)
  const u = basisEinheitFuerPreisanzeige(basis)
  return `${eur}/${u}`
}

function formatMengeDe(n: number) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('de-DE', { maximumFractionDigits: 3 })
}

function loadPersist(): PersistShape {
  if (typeof window === 'undefined') return { hidden: [], mengen: {} }
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return { hidden: [], mengen: {} }
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') return { hidden: [], mengen: {} }
    const rec = o as Record<string, unknown>
    const hidden = Array.isArray(rec.hidden) ? rec.hidden.filter((x): x is string => typeof x === 'string') : []
    const mengen: Record<string, number> = {}
    if (rec.mengen && typeof rec.mengen === 'object') {
      for (const [k, v] of Object.entries(rec.mengen as Record<string, unknown>)) {
        const n = Number(v)
        if (typeof k === 'string' && Number.isFinite(n) && n > 0) mengen[k] = n
      }
    }
    return { hidden, mengen }
  } catch {
    return { hidden: [], mengen: {} }
  }
}

function savePersist(p: PersistShape) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

type Props = {
  produkte: ProduktKurz[]
  verbrauchHistorie: LagerVerbrauchHistorieZeile[]
  refreshKey: number
}

export function LagerEinkaufsliste({ produkte, verbrauchHistorie, refreshKey }: Props) {
  const [offen, setOffen] = useState(true)
  const [hidden, setHidden] = useState<string[]>([])
  const [mengen, setMengen] = useState<Record<string, number>>({})
  const [gemerkt, setGemerkt] = useState<string[]>([])
  const [gemerkteNamenListe, setGemerkteNamenListe] = useState<string[]>([])
  /** Nach `refreshKey`: einmal kein Speichern, damit nicht alte UI-Zustände frisch geladene Session überschreiben. */
  const skipPersistOnce = useRef(false)

  useEffect(() => {
    skipPersistOnce.current = true
    const p = loadPersist()
    setHidden(p.hidden)
    setMengen(p.mengen)
  }, [refreshKey])

  useEffect(() => {
    if (skipPersistOnce.current) {
      skipPersistOnce.current = false
      return
    }
    savePersist({ hidden, mengen })
  }, [hidden, mengen])

  useEffect(() => {
    setGemerkt(gemerkteIds())
    setGemerkteNamenListe(gemerkteNamen())
    return abonniereMerker(() => {
      setGemerkt(gemerkteIds())
      setGemerkteNamenListe(gemerkteNamen())
    })
  }, [refreshKey])

  const idsMitBestand = useMemo(() => {
    const s = new Set<string>()
    for (const p of produkte) {
      if (lagerMenge(p) > 0) s.add(p.id)
    }
    return s
  }, [produkte])

  /** Nachkauf: Einträge mit Bestand wieder aus „versteckt“ / Mengen-Overrides nehmen. */
  useEffect(() => {
    setHidden((h) => h.filter((id) => !idsMitBestand.has(id)))
    setMengen((m) => {
      const next = { ...m }
      for (const id of Object.keys(next)) {
        if (idsMitBestand.has(id)) delete next[id]
      }
      return next
    })
  }, [idsMitBestand])

  /** Nach Bon-Import / Einbuchung: Merker für Artikel mit Bestand entfernen. */
  useEffect(() => {
    for (const id of idsMitBestand) {
      if (gemerkt.includes(id)) entferneMerker(id)
    }
  }, [idsMitBestand, gemerkt])

  const gemerktSet = useMemo(() => new Set(gemerkt), [gemerkt])

  const kandidaten = useMemo(() => {
    return produkte
      .map((p) => {
        const m = lagerMenge(p)
        const st = mhdStatus(p.mhd ?? null)
        const ablauf = m > 0 && (st === 'bald' || st === 'abgelaufen')
        const leer = m <= 0
        const unterMin = istUnterMindestbestand(m, p.mindestbestand ?? null)
        const immerDa = Boolean(p.immer_da) && (leer || unterMin)
        const merk = gemerktSet.has(p.id)

        let grund: 'ablauf' | 'leer' | 'min' | 'immer_da' | 'merker' | null = null
        if (ablauf) grund = 'ablauf'
        else if (immerDa && leer) grund = 'immer_da'
        else if (leer) grund = 'leer'
        else if (unterMin) grund = p.immer_da ? 'immer_da' : 'min'
        else if (immerDa) grund = 'immer_da'
        else if (merk) grund = 'merker'

        return { p, grund }
      })
      .filter((x) => x.grund != null && !hidden.includes(x.p.id))
      .sort((a, b) => {
        const prio = { ablauf: 0, leer: 1, min: 2, immer_da: 3, merker: 4 }
        const pa = prio[a.grund!] ?? 9
        const pb = prio[b.grund!] ?? 9
        if (pa !== pb) return pa - pb
        return a.p.name.localeCompare(b.p.name, 'de')
      })
  }, [produkte, hidden, gemerktSet])

  const zeilen = useMemo(() => {
    return kandidaten.map(({ p, grund }) => {
      const basis = basisEinheitAnzeige(p)
      const einheit = basisEinheitFuerPreisanzeige(basis)
      const k = verbrauchKennzahlenFuerProdukt(verbrauchHistorie, p.id)
      const vorschlag = vorschlagsMengeEinkauf(k)
      const menge = mengen[p.id] ?? vorschlag
      return { p, basis, einheit, k, menge, vorschlag, grund }
    })
  }, [kandidaten, verbrauchHistorie, mengen])

  const namensZeilen = useMemo(() => {
    return gemerkteNamenListe.filter((n) => n.trim()).map((name) => ({ name: name.trim() }))
  }, [gemerkteNamenListe])

  const gesamtAnzahl = zeilen.length + namensZeilen.length

  function setMengeFuerId(id: string, wert: number) {
    const n = Number(wert)
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Menge muss größer als 0 sein.')
      return
    }
    const ger = Math.round(n * 1000) / 1000
    setMengen((prev) => ({ ...prev, [id]: ger }))
  }

  function entfernen(id: string) {
    setHidden((h) => (h.includes(id) ? h : [...h, id]))
    setMengen((m) => {
      if (!(id in m)) return m
      const n = { ...m }
      delete n[id]
      return n
    })
    entferneMerker(id)
  }

  function namensEintragEntfernen(name: string) {
    entferneNamensMerker(name)
    setGemerkteNamenListe(gemerkteNamen())
  }

  function ausgeblendeteZurueck() {
    setHidden([])
    toast.success('Ausgeblendete wieder eingeblendet.')
  }

  return (
    <div className="overflow-hidden rounded-xl border border-amber-800/40 bg-[var(--app-surface-muted)] shadow-md shadow-black/20">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-[var(--app-surface-hover)] sm:px-4"
        aria-expanded={offen}
      >
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-amber-100 sm:text-base">Einkaufsliste</h2>
          <p className="text-[10px] text-[var(--app-text-muted)] sm:text-[11px]">
            Ablauf · leer · unter Min. · Immer-da · gemerkt
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
          <span className="rounded-md border border-amber-900/50 bg-amber-950/40 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-100">
            {gesamtAnzahl}
          </span>
          <CollapsibleRowHeaderEnd open={offen} labels={LABEL_EINKLAPPEN} tone="amber" size="sm" />
        </div>
      </button>

      {offen && (
        <div className="border-t border-[var(--app-border)] px-3 pb-3 pt-2 sm:px-4">
          {hidden.length > 0 && (
            <button
              type="button"
              onClick={() => void ausgeblendeteZurueck()}
              className="mb-2 text-[11px] font-bold text-[var(--app-text-muted)] underline decoration-[var(--app-border-strong)] hover:text-[var(--app-text)]"
            >
              Ausgeblendete zurückholen ({hidden.length})
            </button>
          )}

          {zeilen.length === 0 && namensZeilen.length === 0 ? (
            <p className="py-3 text-center text-xs text-[var(--app-text-muted)]">
              Nichts auf der Liste{hidden.length ? ' (oder ausgeblendet)' : ''}. Hier erscheinen bald ablaufende Artikel,
              leere Bestände, Unter-Mindestbestand, Immer-da-Favoriten und per 🛒 Gemerktes.
            </p>
          ) : (
            <div className={`${appTableScrollClassName} rounded-lg border border-[var(--app-border)]`}>
              <table className="w-full min-w-[44rem] border-collapse text-left text-[11px] sm:text-xs">
                <thead>
                  <tr className="border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[9px] font-bold uppercase tracking-wide text-[var(--app-text-muted)] sm:text-[10px]">
                    <th className="px-2 py-2 sm:px-3">Produkt</th>
                    <th className="px-2 py-2 text-right sm:px-3">Letzter €</th>
                    <th className="px-2 py-2 text-right sm:px-3">Ø €</th>
                    <th className="px-2 py-2 text-right sm:px-3">Ø / Woche</th>
                    <th className="px-2 py-2 text-right sm:px-3">Ø / Monat</th>
                    <th className="px-2 py-2 text-right sm:px-3">Menge</th>
                    <th className="px-2 py-2 text-right sm:px-3">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border)]">
                  {zeilen.map(({ p, basis, einheit, k, menge, vorschlag, grund }) => (
                    <tr key={p.id} className="bg-[var(--app-surface-muted)]/30">
                      <td className="max-w-[14rem] px-2 py-1.5 sm:px-3">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-semibold text-[var(--app-text)]">{p.name}</span>
                          {grund === 'ablauf' ? (
                            <span className="shrink-0 rounded border border-amber-700/50 bg-amber-900/30 px-1 text-[9px] font-bold text-amber-200">läuft ab</span>
                          ) : grund === 'min' ? (
                            <span className="shrink-0 rounded border border-sky-700/50 bg-sky-900/30 px-1 text-[9px] font-bold text-sky-200">unter Min.</span>
                          ) : grund === 'immer_da' ? (
                            <span className="shrink-0 rounded border border-teal-700/50 bg-teal-900/30 px-1 text-[9px] font-bold text-teal-200">Immer da</span>
                          ) : grund === 'merker' ? (
                            <span className="shrink-0 rounded border border-violet-700/50 bg-violet-900/30 px-1 text-[9px] font-bold text-violet-200">gemerkt</span>
                          ) : null}
                        </div>
                        <div className="truncate text-[10px] text-[var(--app-text-muted)]">{einheit}</div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-sky-100/90 sm:px-3">
                        {formatEurJeBasiseinheit(p.letzterEinkaufspreis ?? null, basis)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-amber-100/90 sm:px-3">
                        {formatEurJeBasiseinheit(p.durchschnittspreis ?? null, basis)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-[var(--app-text)] sm:px-3">
                        {k.summe28Tage > 0 ? `${formatMengeDe(k.durchschnittProWoche)} ${einheit}` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-[var(--app-text)] sm:px-3">
                        {k.summe90Tage > 0 ? `${formatMengeDe(k.durchschnittProMonat)} ${einheit}` : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right sm:px-3">
                        <div className="inline-flex flex-col items-end gap-0.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            defaultValue={String(menge).replace('.', ',')}
                            key={`${p.id}-${refreshKey}-${menge}`}
                            className="w-[5.5rem] rounded border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-1.5 py-0.5 text-right text-xs tabular-nums text-[var(--app-text)]"
                            aria-label={`Menge ${p.name}`}
                            onBlur={(e) => {
                              const raw = parseDeZahlLocal(e.target.value)
                              if (raw == null) {
                                e.target.value = String(menge).replace('.', ',')
                                return
                              }
                              setMengeFuerId(p.id, raw)
                            }}
                          />
                          {mengen[p.id] == null ? (
                            <span className="text-[9px] text-[var(--app-text-muted)]">Vorschlag: {formatMengeDe(vorschlag)}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right sm:px-3">
                        <button
                          type="button"
                          onClick={() => entfernen(p.id)}
                          className="rounded border border-[var(--app-border-strong)] px-2 py-0.5 text-[11px] font-bold text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)]"
                        >
                          Ausblenden
                        </button>
                      </td>
                    </tr>
                  ))}
                  {namensZeilen.map(({ name }) => (
                    <tr key={`name:${name}`} className="bg-violet-950/20">
                      <td className="max-w-[14rem] px-2 py-1.5 sm:px-3" colSpan={5}>
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-semibold text-[var(--app-text)]">{name}</span>
                          <span className="shrink-0 rounded border border-violet-700/50 bg-violet-900/30 px-1 text-[9px] font-bold text-violet-200">
                            aus Rezept
                          </span>
                        </div>
                        <div className="truncate text-[10px] text-[var(--app-text-muted)]">Noch kein Lager-Artikel — beim Einkauf anlegen</div>
                      </td>
                      <td className="px-2 py-1.5 text-right text-[var(--app-text-muted)] sm:px-3">—</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right sm:px-3">
                        <button
                          type="button"
                          onClick={() => namensEintragEntfernen(name)}
                          className="rounded border border-[var(--app-border-strong)] px-2 py-0.5 text-[11px] font-bold text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)]"
                        >
                          Entfernen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-2 text-[10px] leading-relaxed text-[var(--app-text-muted)]">
            Ø/Woche = Verbrauch der letzten 28 Tage ÷ 4; Ø/Monat = letzte 90 Tage ÷ 3 (jeweils Basiseinheit). Nach Bon-Import
            steigt der Bestand — Position fällt automatisch von der Liste. Ausgeblendete bleiben in dieser Sitzung gespeichert.
          </p>
        </div>
      )}
    </div>
  )
}

function parseDeZahlLocal(s: string): number | null {
  const t = String(s).trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
