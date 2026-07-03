'use client'

import { brauchtBesitzAnreicherung } from '@/lib/besitz-art-erkennung'
import { KiBrandChip } from '@/components/ki-brand'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'

type Zeile = {
  id: string
  name: string
  kategorie: string
  kleidungsart?: string | null
  groesse?: string | null
  farbe?: string | null
  bild_pfad?: string | null
}

type Props = {
  zeilen: Zeile[]
  laden: boolean
  autoStart?: boolean
  onFertig: () => void | Promise<void>
}

type Fortschritt = {
  gesamt: number
  erledigt: number
  fehler: number
}

export function BesitzAnreichernRunner({ zeilen, laden, autoStart = true, onFertig }: Props) {
  const [laeuft, setLaeuft] = useState(false)
  const [fortschritt, setFortschritt] = useState<Fortschritt | null>(null)
  const gestartet = useRef(false)
  const abbruch = useRef(false)

  const offene = useMemo(
    () => zeilen.filter((z) => brauchtBesitzAnreicherung(z)),
    [zeilen],
  )

  const start = useCallback(async () => {
    if (laeuft || !offene.length) return
    abbruch.current = false
    setLaeuft(true)
    setFortschritt({ gesamt: offene.length, erledigt: 0, fehler: 0 })

    let erledigt = 0
    let fehler = 0
    let fertig = false

    try {
      while (!fertig && !abbruch.current) {
        const res = await fetch('/api/besitz/anreichern', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 3 }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          fertig?: boolean
          verarbeitet?: number
          ergebnisse?: Array<{ foto?: boolean; fehler?: string }>
        }
        if (!res.ok || typeof data.error === 'string') {
          toast.error(data.error || 'Anreichern fehlgeschlagen.')
          break
        }
        const batch = Array.isArray(data.ergebnisse) ? data.ergebnisse : []
        erledigt += batch.length
        fehler += batch.filter((e) => e.fehler).length
        setFortschritt({ gesamt: offene.length, erledigt, fehler })
        fertig = Boolean(data.fertig) || batch.length === 0
        if (!fertig) await new Promise((r) => setTimeout(r, 800))
      }

      if (!abbruch.current) {
        if (erledigt > 0) {
          toast.success(erledigt === 1 ? '1 Gegenstand angereichert.' : `${erledigt} Gegenstände angereichert.`)
        }
        await onFertig()
      }
    } finally {
      setLaeuft(false)
    }
  }, [laeuft, offene.length, onFertig])

  useEffect(() => {
    if (!autoStart || laden || gestartet.current || !offene.length) return
    gestartet.current = true
    void start()
  }, [autoStart, laden, offene.length, start])

  if (!offene.length && !laeuft) return null

  return (
    <div className="mb-6 rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <KiBrandChip iconSize={14} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-100">
              {laeuft ? 'Gegenstände werden per KI ergänzt …' : `${offene.length} mit Foto — Metadaten unvollständig`}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-200/70">
              Art, Größe, Farbe und Marke aus dem eigenen Foto (keine Websuche, kein Stock-Bild).
            </p>
            {fortschritt ? (
              <p className="mt-1 text-[11px] tabular-nums text-[var(--app-text-muted)]">
                {fortschritt.erledigt} / {fortschritt.gesamt}
                {fortschritt.fehler ? ` · ${fortschritt.fehler} Hinweise` : ''}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {laeuft ? (
            <button
              type="button"
              onClick={() => {
                abbruch.current = true
              }}
              className="rounded-lg border border-[var(--app-border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]"
            >
              Abbrechen
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void start()}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500"
            >
              {offene.length ? 'Jetzt anreichern' : 'Erneut prüfen'}
            </button>
          )}
        </div>
      </div>
      {laeuft ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--app-surface-muted)]">
          <div
            className="h-full rounded-full bg-amber-500 transition-all duration-500"
            style={{
              width: fortschritt
                ? `${Math.min(100, Math.round((fortschritt.erledigt / Math.max(fortschritt.gesamt, 1)) * 100))}%`
                : '12%',
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
