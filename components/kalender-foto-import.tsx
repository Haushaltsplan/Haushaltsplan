'use client'

import { kalenderKategorieMeta } from '@/lib/haushalt-kalender'
import type { KalenderFotoImportZeile } from '@/lib/kalender-foto-vision'
import { KiBrandChip } from '@/components/ki-brand'
import { KI_PANEL_OUTER } from '@/lib/ki-ui'
import { useCallback, useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'

type Props = {
  onImport: (zeilen: KalenderFotoImportZeile[]) => void
}

export function KalenderFotoImport({ onImport }: Props) {
  const inputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [vorschau, setVorschau] = useState<KalenderFotoImportZeile[] | null>(null)
  const [auswahl, setAuswahl] = useState<Record<number, boolean>>({})

  const verarbeiteDatei = useCallback(
    async (file: File | null) => {
      if (!file || !file.size) return
      setFehler(null)
      setVorschau(null)
      setLaden(true)
      try {
        const fd = new FormData()
        fd.set('file', file)
        const res = await fetch('/api/kalender/foto-import', { method: 'POST', body: fd })
        const data = (await res.json()) as { error?: string; events?: KalenderFotoImportZeile[] }
        if (!res.ok) {
          setFehler(data.error || 'Auswertung fehlgeschlagen.')
          return
        }
        const ev = Array.isArray(data.events) ? data.events : []
        if (ev.length === 0) {
          toast('Keine Termine oder Daten im Foto erkannt.', { duration: 4500 })
          return
        }
        setVorschau(ev)
        const init: Record<number, boolean> = {}
        ev.forEach((_, i) => {
          init[i] = true
        })
        setAuswahl(init)
      } catch {
        setFehler('Netzwerkfehler oder Antwort ungültig.')
      } finally {
        setLaden(false)
        if (fileRef.current) fileRef.current.value = ''
      }
    },
    [],
  )

  const abwaehlenToggle = (index: number) => {
    setAuswahl((a) => ({ ...a, [index]: !a[index] }))
  }

  const uebernehmen = () => {
    if (!vorschau) return
    const gewaehlt = vorschau.filter((_, i) => auswahl[i] !== false)
    if (gewaehlt.length === 0) {
      toast.error('Bitte mindestens einen Eintrag auswählen.')
      return
    }
    onImport(gewaehlt)
    setVorschau(null)
    setAuswahl({})
    toast.success(`${gewaehlt.length} im Kalender gespeichert.`)
  }

  return (
    <div className={`overflow-hidden rounded-2xl ${KI_PANEL_OUTER}`}>
      <div className="border-b border-violet-800/40 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <KiBrandChip iconSize={14} />
          <h2 className="text-sm font-black text-violet-100 sm:text-base">Foto importieren</h2>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--app-text-muted)] sm:text-xs">
          Foto hochladen (Einladung, Ticket, Arztbrief, Screenshot). Die KI liest <strong className="text-[var(--app-text-muted)]">Datum</strong> und{' '}
          <strong className="text-[var(--app-text-muted)]">Titel</strong> und schlägt eine <strong className="text-[var(--app-text-muted)]">Kategorie</strong> vor — bitte vor dem
          Speichern prüfen. Benötigt dieselbe KI-Konfiguration wie der Finanz-Coach (<code className="font-mono text-[10px] text-sky-300/90">GEMINI_API_KEY</code> oder{' '}
          <code className="font-mono text-[10px] text-sky-300/90">OPENAI_API_KEY</code> in <code className="font-mono text-[10px]">.env.local</code>).
        </p>
      </div>
      <div className="space-y-3 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="sr-only"
            disabled={laden}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              void verarbeiteDatei(f)
            }}
          />
          <label
            htmlFor={inputId}
            className={`inline-flex cursor-pointer rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-sky-950/30 transition hover:bg-sky-500 ${
              laden ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            {laden ? 'Wird ausgewertet…' : 'Foto auswählen'}
          </label>
          {vorschau && vorschau.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setVorschau(null)
                setAuswahl({})
                setFehler(null)
              }}
              className="rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-surface-hover)] px-3 py-2 text-xs font-bold text-[var(--app-text)]"
            >
              Vorschau schließen
            </button>
          ) : null}
        </div>

        {fehler ? (
          <p className="rounded-lg border border-rose-800/60 bg-rose-950/35 px-3 py-2 text-xs text-rose-100">{fehler}</p>
        ) : null}

        {vorschau && vorschau.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Vorschau — Häkchen entfernen zum Auslassen</p>
            <ul className="max-h-[min(50vh,22rem)] space-y-2 overflow-y-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-2">
              {vorschau.map((z, i) => {
                const km = kalenderKategorieMeta(z.kategorie)
                const iso = z.datum
                const de = (() => {
                  try {
                    return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  } catch {
                    return iso
                  }
                })()
                return (
                  <li
                    key={`${i}-${iso}-${z.titel}`}
                    className={`flex gap-2 rounded-lg border px-2 py-2 text-left text-sm ${km.listBorder} ${km.listBg}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] text-sky-600"
                      checked={auswahl[i] !== false}
                      onChange={() => abwaehlenToggle(i)}
                      aria-label={`${z.titel} übernehmen`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${km.badge}`}>{km.label}</span>
                        <span className="text-xs text-[var(--app-text)]">{de}</span>
                        {z.uhrzeit ? (
                          <span className="font-mono text-xs text-[var(--app-text)]">{z.uhrzeit}</span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 font-semibold text-[var(--app-text)]">{z.titel}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              onClick={uebernehmen}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-black text-white shadow-md shadow-emerald-950/30 transition hover:bg-emerald-500"
            >
              Ausgewählte in den Kalender übernehmen
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
