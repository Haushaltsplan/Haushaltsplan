'use client'

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  COACH_MAX_IMAGES_PER_SEND,
  compressImageFileForCoach,
  type CoachImagePart,
} from '@/lib/finance-coach-images'
import type { Kassenzeile } from '@/lib/kassenzettel-gemini'
import { LAGER_PRODUKT_KATEGORIEN } from '@/lib/lager-produkt-kategorie'

type Props = { disabled?: boolean; onBuchungFertig: () => void }

/** Supabase/PostgREST: Spalten aus Migration noch nicht in der Cloud-DB oder Schema-Cache veraltet. */
function istLagerSchemaCacheFehler(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes('schema cache') ||
    m.includes('basis_einheit') ||
    m.includes('basis_menge') ||
    m.includes('kauf_menge') ||
    m.includes('kauf_einheit') ||
    m.includes('kategorie')
  )
}

function artikelAusWarnung(w: string): string | null {
  const t = w.trim()
  const idx = t.indexOf(':')
  if (idx > 0 && idx < 80) return t.slice(0, idx).trim()
  return null
}

export function LagerKassenzettelPanel({ disabled, onBuchungFertig }: Props) {
  const [hinweis, setHinweis] = useState('')
  const [images, setImages] = useState<CoachImagePart[]>([])
  const [positionen, setPositionen] = useState<Kassenzeile[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [aufgeklappt, setAufgeklappt] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (images.length > 0 || (positionen != null && positionen.length > 0)) setAufgeklappt(true)
  }, [images.length, positionen])

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const next = [...images]
    for (const file of [...files]) {
      if (next.length >= COACH_MAX_IMAGES_PER_SEND) {
        toast.error(`Maximal ${COACH_MAX_IMAGES_PER_SEND} Bilder.`)
        break
      }
      try {
        next.push(await compressImageFileForCoach(file))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Bild fehlgeschlagen.')
      }
    }
    setImages(next)
    setPositionen(null)
  }

  const analysieren = async () => {
    if (!images.length) {
      toast.error('Bitte mindestens ein Foto vom Kassenbon wählen.')
      return
    }
    setLoading(true)
    setPositionen(null)
    try {
      const res = await fetch('/api/lager/kassenzettel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'analyse', images, hinweis: hinweis.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Analyse fehlgeschlagen.')
        return
      }
      const pos = Array.isArray(data.positionen) ? data.positionen : []
      if (!pos.length) {
        toast.error('Keine Positionen erkannt — anderes Foto oder kurzer Hinweis im Textfeld.')
        return
      }
      setPositionen(pos as Kassenzeile[])
      toast.success(`${pos.length} Positionen erkannt.`)
    } catch {
      toast.error('Netzwerkfehler.')
    } finally {
      setLoading(false)
    }
  }

  const buchen = async () => {
    if (!positionen?.length) return
    setLoading(true)
    try {
      const res = await fetch('/api/lager/kassenzettel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'buchen', positionen }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Buchung fehlgeschlagen.')
        return
      }
      const n = typeof data.anzahlGebucht === 'number' ? data.anzahlGebucht : 0
      const warn = Array.isArray(data.warnungen) ? (data.warnungen as string[]) : []
      const gesamtZeilen = typeof data.anzahlZeilen === 'number' ? data.anzahlZeilen : positionen.length

      const schemaZeilen = warn.filter((w) => istLagerSchemaCacheFehler(w))
      const andereWarn = warn.filter((w) => !istLagerSchemaCacheFehler(w))

      if (schemaZeilen.length > 0) {
        const beispiele = Array.from(
          new Set(schemaZeilen.map(artikelAusWarnung).filter((x): x is string => Boolean(x))),
        ).slice(0, 4)
        const beispielText =
          beispiele.length > 0 ? ` Betroffene Artikel u. a.: ${beispiele.join(', ')}${schemaZeilen.length > 4 ? ' …' : ''}.` : ''
        toast.error(
          `Vorrats-Schema in Supabase fehlt oder ist veraltet (${schemaZeilen.length} Zeilen).` +
            beispielText +
            ' In Supabase → SQL Editor die Migrationen ausführen: „supabase/migrations/20260419120000_lager_basis_einheiten.sql“ und „20260422100000_produkte_kategorie.sql“. Danach 1–2 Minuten warten oder Projekt neu laden, bis der Schema-Cache aktualisiert ist.',
          { duration: 16_000 },
        )
      }
      andereWarn.forEach((w) => toast(w, { icon: '⚠️' }))
      if (n > 0) {
        toast.success(`${n} Positionen in die Speisekammer gebucht${warn.length ? ` (${warn.length} mit Hinweis)` : ''}.`)
        setImages([])
        setPositionen(null)
        setHinweis('')
        onBuchungFertig()
      } else if (schemaZeilen.length === 0) {
        toast.error(
          warn.length
            ? `Keine Zeile gebucht (${gesamtZeilen} erkannt). Prüfe die Meldungen oben — oft fehlt SUPABASE_SERVICE_ROLE_KEY in .env.local oder die Datenbank-Migration.`
            : 'Keine Zeile gebucht. Prüfe .env.local (SUPABASE_SERVICE_ROLE_KEY) und die Vorrats-Tabellen in Supabase.',
          { duration: 8000 },
        )
      }
    } catch {
      toast.error('Netzwerkfehler.')
    } finally {
      setLoading(false)
    }
  }

  const updateZeile = (i: number, patch: Partial<Kassenzeile>) => {
    setPositionen((prev) => {
      if (!prev) return prev
      const copy = [...prev]
      copy[i] = { ...copy[i], ...patch }
      return copy
    })
  }

  const hatEntwurf = images.length > 0 || (positionen != null && positionen.length > 0)

  return (
    <div className="rounded-xl border border-violet-800/45 bg-slate-900/95 p-3 shadow-md shadow-black/20 sm:p-3.5">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold tracking-tight text-violet-200 sm:text-base">Kassenzettel → Speisekammer</h2>
          <p className="text-[10px] leading-snug text-slate-500 sm:text-[11px]">Foto vom Bon · KI · Positionen prüfen · buchen</p>
        </div>
        {hatEntwurf ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-400">
            {images.length > 0 ? (
              <span className="rounded-md border border-violet-800/50 bg-violet-950/40 px-2 py-0.5 text-violet-200">
                {images.length} Foto{images.length === 1 ? '' : 's'}
              </span>
            ) : null}
            {positionen != null && positionen.length > 0 ? (
              <span className="rounded-md border border-sky-800/50 bg-sky-950/35 px-2 py-0.5 text-sky-200">
                {positionen.length} Pos.
              </span>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setAufgeklappt((o) => !o)}
          className="shrink-0 rounded-lg border border-slate-600 bg-slate-800/80 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-700"
        >
          {aufgeklappt ? 'Einklappen' : 'Aufklappen'}
        </button>
      </div>

      {aufgeklappt && (
        <div className="mt-3 space-y-3 border-t border-slate-800/80 pt-3">
          <details className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-2 py-1.5 text-[11px] text-slate-500">
            <summary className="cursor-pointer select-none font-semibold text-slate-400 hover:text-slate-300">
              Technik & Voraussetzungen
            </summary>
            <p className="mt-2 leading-relaxed">
              Benötigt <code className="rounded bg-slate-900 px-1 text-slate-300">GEMINI_API_KEY</code>, optional{' '}
              <code className="rounded bg-slate-900 px-1 text-slate-300">GEMINI_MODEL</code>, zum Buchen{' '}
              <code className="rounded bg-slate-900 px-1 text-slate-300">SUPABASE_SERVICE_ROLE_KEY</code> und aktuelle
              Vorrats-Migrationen in Supabase.
            </p>
          </details>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
        multiple
        className="hidden"
        onChange={(e) => {
          void addFiles(e.target.files)
          e.target.value = ''
        }}
      />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || loading || images.length >= COACH_MAX_IMAGES_PER_SEND}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-violet-600/55 bg-violet-950/40 px-3 py-2 text-xs font-bold text-violet-100 hover:bg-violet-900/40 disabled:opacity-40"
            >
              Fotos wählen
            </button>
            {images.length > 0 && (
              <button
                type="button"
                disabled={disabled || loading}
                onClick={() => {
                  setImages([])
                  setPositionen(null)
                }}
                className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-slate-800"
              >
                Zurücksetzen
              </button>
            )}
          </div>

          {images.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {images.map((im, idx) => (
                <div key={idx} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${im.mimeType};base64,${im.base64}`}
                    alt=""
                    className="h-14 w-14 rounded-lg border border-slate-600 object-cover sm:h-16 sm:w-16"
                  />
                  <button
                    type="button"
                    onClick={() => setImages((xs) => xs.filter((_, j) => j !== idx))}
                    className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white"
                    aria-label="Entfernen"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            value={hinweis}
            onChange={(e) => setHinweis(e.target.value)}
            disabled={disabled || loading}
            rows={1}
            placeholder="Optional: Markt, Hinweis …"
            className="min-h-[2.35rem] w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-violet-500/35 disabled:opacity-50 sm:text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || loading || !images.length}
              onClick={() => void analysieren()}
              className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-black text-white hover:bg-sky-500 disabled:opacity-40 sm:text-sm"
            >
              Bon analysieren
            </button>
            <button
              type="button"
              disabled={disabled || loading || !positionen?.length}
              onClick={() => void buchen()}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-40 sm:text-sm"
            >
              In Speisekammer buchen
            </button>
          </div>

          {positionen && positionen.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full min-w-[36rem] text-left text-xs sm:text-[13px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/50 text-[9px] font-semibold uppercase tracking-tight text-slate-500 sm:text-[10px]">
                    <th className="px-2 py-1.5 sm:px-3">Artikel</th>
                    <th className="hidden px-2 py-1.5 sm:table-cell sm:px-3">Kat.</th>
                    <th className="px-2 py-1.5 sm:px-3">Einh.</th>
                    <th className="px-2 py-1.5 text-right sm:px-3">Menge</th>
                    <th className="px-2 py-1.5 text-right sm:px-3">E. €</th>
                    <th className="px-2 py-1.5 text-right sm:px-3">Σ €</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {positionen.map((z, i) => (
                    <tr key={i} className="bg-slate-950/40">
                      <td className="px-2 py-1 sm:px-3">
                        <input
                          value={z.artikel}
                          onChange={(e) => updateZeile(i, { artikel: e.target.value })}
                          className="w-full rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100 sm:text-sm"
                        />
                      </td>
                      <td className="hidden px-2 py-1 sm:table-cell sm:px-3">
                        <select
                          value={z.kategorie ?? 'Sonstiges'}
                          onChange={(e) => updateZeile(i, { kategorie: e.target.value })}
                          className="max-w-[9rem] rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-100 sm:text-xs"
                        >
                          {LAGER_PRODUKT_KATEGORIEN.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1 sm:px-3">
                        <input
                          value={z.einheit ?? ''}
                          onChange={(e) => updateZeile(i, { einheit: e.target.value || null })}
                          className="w-full min-w-[4rem] rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs text-slate-100"
                          placeholder="Stück"
                        />
                      </td>
                      <td className="px-2 py-1 text-right sm:px-3">
                        <input
                          type="number"
                          step="any"
                          min={0.001}
                          value={z.menge}
                          onChange={(e) => updateZeile(i, { menge: Number(e.target.value) })}
                          className="w-[4.5rem] rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-right text-xs text-slate-100 sm:w-24"
                        />
                      </td>
                      <td className="px-2 py-1 text-right sm:px-3">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={z.einzelpreis ?? ''}
                          onChange={(e) =>
                            updateZeile(i, {
                              einzelpreis: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          className="w-[4.5rem] rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-right text-xs text-slate-100 sm:w-24"
                        />
                      </td>
                      <td className="px-2 py-1 text-right sm:px-3">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={z.gesamtpreis ?? ''}
                          onChange={(e) =>
                            updateZeile(i, {
                              gesamtpreis: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          className="w-[4.5rem] rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-right text-xs text-slate-100 sm:w-24"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <details className="border-t border-slate-800 bg-slate-950/50 px-2 py-1.5 text-[10px] text-slate-500 sm:text-[11px]">
                <summary className="cursor-pointer font-semibold text-slate-400 hover:text-slate-300">Hinweise zum Buchen</summary>
                <p className="mt-1.5 leading-relaxed">
                  Namen werden auf Sammelbegriffe im Vorrat gemappt. Gewicht in kg, Getränke in l; Gesamtpreis = Zeilensumme. Ohne
                  Preis → 0 €. Schema-Fehler: Migrationen in Supabase + ggf. Schema-Cache warten.
                </p>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
