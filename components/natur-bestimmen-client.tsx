'use client'

import { useCallback, useId, useState } from 'react'
import toast from 'react-hot-toast'
import { PageChrome, PageHero, pageSectionPanelClass, pageSectionShellClass } from '@/components/page-shell'
import {
  type NaturBestimmungErgebnis,
  type NaturKategorieId,
  NATUR_MAX_FOTOS,
  type NaturVertrauenId,
} from '@/lib/natur-bestimmen-vision'

const KATEGORIE_LABEL: Record<NaturKategorieId, { label: string; emoji: string }> = {
  tier: { label: 'Tier', emoji: '🦌' },
  pflanze: { label: 'Pflanze', emoji: '🌿' },
  pilz: { label: 'Pilz', emoji: '🍄' },
  kein_lebewesen: { label: 'Nicht (klar) ein Lebewesen', emoji: '❔' },
  unklar: { label: 'Unklar', emoji: '❓' },
}

const VERTRAUEN_BADGE: Record<
  NaturVertrauenId,
  { className: string; label: string }
> = {
  hoch: { className: 'bg-emerald-900/50 text-emerald-200 border-emerald-600/50', label: 'Eher sicher' },
  mittel: { className: 'bg-amber-900/40 text-amber-100 border-amber-600/50', label: 'Mittlere Sicherheit' },
  niedrig: { className: 'bg-rose-900/40 text-rose-100 border-rose-500/50', label: 'Unsicher' },
}

type BlickEintrag = { file: File; url: string; key: string }

let blickId = 0
function naechsteKey() {
  blickId += 1
  return `blick-${blickId}`
}

export function NaturBestimmenClient() {
  const idGalerie = useId()
  const idKamera = useId()
  const [blick, setBlick] = useState<BlickEintrag[]>([])
  const [loading, setLoading] = useState(false)
  const [ergebnis, setErgebnis] = useState<NaturBestimmungErgebnis | null>(null)

  const anhaengenBilder = (list: FileList | null) => {
    if (!list?.length) return
    setErgebnis(null)
    setBlick((prev) => {
      const naechste: BlickEintrag[] = [...prev]
      for (let i = 0; i < list.length; i++) {
        const f = list.item(i)
        if (!f) continue
        if (!f.type.startsWith('image/')) {
          toast.error('Nur JPEG, PNG, WebP.')
          continue
        }
        if (naechste.length >= NATUR_MAX_FOTOS) {
          toast.error(`Höchstens ${NATUR_MAX_FOTOS} Bilder.`)
          break
        }
        naechste.push({ file: f, url: URL.createObjectURL(f), key: naechsteKey() })
      }
      return naechste
    })
  }

  const onGalerie: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    anhaengenBilder(e.target.files)
    e.target.value = ''
  }

  const onKamera: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    anhaengenBilder(e.target.files)
    e.target.value = ''
  }

  const entferneIndex = (idx: number) => {
    setBlick((prev) => {
      const t = prev[idx]
      if (t) URL.revokeObjectURL(t.url)
      return prev.filter((_, j) => j !== idx)
    })
    setErgebnis(null)
  }

  const clearAll = useCallback(() => {
    setBlick((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.url)
      return []
    })
    setErgebnis(null)
  }, [])

  const absenden = async () => {
    if (blick.length < 1) {
      toast.error('Zuerst mindestens ein Foto auswählen.')
      return
    }
    setLoading(true)
    setErgebnis(null)
    try {
      const fd = new FormData()
      for (const s of blick) {
        fd.append('file', s.file)
      }
      const res = await fetch('/api/natur-bestimmen', { method: 'POST', body: fd })
      const data = (await res.json().catch(() => ({}))) as { error?: string; ergebnis?: NaturBestimmungErgebnis }
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Analyse fehlgeschlagen.')
        return
      }
      if (data.ergebnis) {
        setErgebnis(data.ergebnis)
        toast.success('Analyse fertig.')
      } else {
        toast.error('Keine Auswertung erhalten.')
      }
    } catch {
      toast.error('Netzwerkfehler.')
    } finally {
      setLoading(false)
    }
  }

  const kInfo = ergebnis ? KATEGORIE_LABEL[ergebnis.kategorie] : null
  const vInfo = ergebnis ? VERTRAUEN_BADGE[ergebnis.vertrauen] : null
  const prozentBalkenFarbe = ergebnis
    ? ergebnis.sicherheit_prozent >= 70
      ? 'bg-emerald-500'
      : ergebnis.sicherheit_prozent >= 40
        ? 'bg-amber-500'
        : 'bg-rose-500'
    : 'bg-slate-500'

  return (
    <PageChrome>
      <PageHero
        eyebrow="Natur"
        title="Bestimmen"
        description="Tiere, Pflanzen und Pilze per KI einordnen — keine Fach- oder Essbarkeitsgarantie."
      />

      <section className={pageSectionShellClass}>
        <div className={pageSectionPanelClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-6">
          <div className="flex min-h-[200px] min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-950/50 p-3">
            {blick.length > 0 ? (
              <div
                className="grid w-full max-w-2xl grid-cols-2 gap-2 sm:grid-cols-2"
                style={{ gridTemplateRows: blick.length === 1 ? '1fr' : undefined }}
              >
                {blick.map((b, i) => (
                  <div
                    key={b.key}
                    className="relative aspect-video overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900"
                  >
                    <img
                      src={b.url}
                      alt={`Bild ${i + 1}`}
                      className="h-full w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => entferneIndex(i)}
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md border border-slate-600 bg-slate-950/90 text-sm text-slate-200"
                      title="Bild entfernen"
                    >
                      ×
                    </button>
                    <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 text-[10px] text-slate-300">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-slate-500">Noch keine Bilder</p>
            )}
          </div>

          <div className="flex w-full flex-col justify-center gap-3 sm:max-w-xs">
            <input
              id={idGalerie}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={onGalerie}
            />
            <input
              id={idKamera}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="sr-only"
              onChange={onKamera}
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2">
              <label
                htmlFor={idKamera}
                className="flex cursor-pointer items-center justify-center rounded-xl border border-sky-500/50 bg-sky-950/30 px-4 py-3 text-center text-sm font-bold text-sky-100 transition hover:bg-sky-900/30"
              >
                Foto aufnehmen
              </label>
              <label
                htmlFor={idGalerie}
                className="flex cursor-pointer items-center justify-center rounded-xl border border-lime-600/50 bg-lime-950/30 px-4 py-3 text-center text-sm font-bold text-lime-200 transition hover:bg-lime-900/30"
              >
                {blick.length > 0 ? 'Aus Galerie' : 'Fotos wählen'}
              </label>
            </div>
            <p className="text-center text-xs text-slate-500">
              {blick.length} / {NATUR_MAX_FOTOS} {blick.length === 1 ? 'Bild' : 'Bilder'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={absenden}
                disabled={blick.length < 1 || loading}
                className="flex-1 rounded-xl border border-cyan-600/50 bg-cyan-950/40 py-3 text-sm font-bold text-cyan-100 transition enabled:hover:bg-cyan-900/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? 'Analysiere…' : 'Bestimmen'}
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={(blick.length < 1 && !ergebnis) || loading}
                className="rounded-xl border border-slate-600 px-3 py-3 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                Leeren
              </button>
            </div>
          </div>
        </div>
        </div>
      </section>

      {ergebnis && (
        <section className="space-y-4" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            {kInfo && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-1.5 text-sm font-semibold text-slate-200">
                <span aria-hidden>{kInfo.emoji}</span> {kInfo.label}
              </span>
            )}
            {vInfo && (
              <span
                className={`inline-flex rounded-lg border px-3 py-1.5 text-xs font-bold ${vInfo.className}`}
                title="Stufe (zusammen mit Prozentwert)"
              >
                {vInfo.label}
              </span>
            )}
            <span
              className="text-sm font-bold tabular-nums text-slate-200"
              title="Geschätzt anhand der geladenen Bilder"
            >
              {ergebnis.sicherheit_prozent}&nbsp;% sicher
            </span>
          </div>

          <div className="max-w-md" aria-label={`Einschätzung: ${ergebnis.sicherheit_prozent} Prozent`}>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-[width] ${prozentBalkenFarbe}`}
                style={{ width: `${ergebnis.sicherheit_prozent}%` }}
              />
            </div>
          </div>

          <h2 className="text-lg font-bold text-slate-100">
            {ergebnis.deutsche_bezeichnung}
            {ergebnis.wissenschaftlicher_name && (
              <span className="ml-2 font-mono text-sm font-normal text-slate-500 italic">
                {ergebnis.wissenschaftlicher_name}
              </span>
            )}
          </h2>

          <div className="rounded-xl border border-cyan-900/50 bg-cyan-950/15 p-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-cyan-200/80">Form &amp; Sichtbares (zuerst)</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-cyan-50/90">{ergebnis.anatomie_zuerst}</p>
          </div>

          <div className="prose prose-invert max-w-none prose-p:text-slate-300 prose-p:leading-relaxed">
            <p className="whitespace-pre-wrap text-slate-200">{ergebnis.kurztext}</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Sichtbar im Bild</h3>
            <p className="whitespace-pre-wrap text-sm text-slate-300">{ergebnis.merkmale_im_bild}</p>
          </div>

          {ergebnis.verwechslungsgefahr && (
            <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-4">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-200/80">Verwechslung / Hinweis</h3>
              <p className="whitespace-pre-wrap text-sm text-amber-50/90">{ergebnis.verwechslungsgefahr}</p>
            </div>
          )}

          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">
            <strong className="text-slate-300">Hinweis: </strong>
            {ergebnis.sicherheitshinweis}
          </div>
        </section>
      )}
    </PageChrome>
  )
}
