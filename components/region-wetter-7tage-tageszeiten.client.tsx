'use client'

import { WindIkon, WetterHimmelIcon, PrognoseTagKachel, iconKategorie, prognoseKopfzeile } from '@/components/wetter-zeichen'
import type { WetterTagPrognose } from '@/lib/region-haarbach'
import { windHimmelsrichtungKurz } from '@/lib/region-haarbach'
import type { TageszeitenPrognoseAntwort, WetterTageszeitSlot } from '@/lib/region-wetter-tageszeiten'
import { useCallback, useState } from 'react'

type Props = { prognose7Tage?: WetterTagPrognose[] | null }

function formatDatumKopf(datumIso: string): string {
  try {
    return new Date(`${datumIso}T12:00:00`).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  } catch {
    return datumIso
  }
}

function TageszeitZeile({ z }: { z: WetterTageszeitSlot }) {
  const kat = iconKategorie(z.wmoCode)
  const grad = z.windRichtungGrad
  return (
    <div className="flex flex-col gap-3 border-b border-slate-800/50 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="shrink-0 sm:w-36">
        <p className="text-xs font-bold leading-snug text-cyan-200/90">{z.label}</p>
      </div>
      <WetterHimmelIcon kategorie={kat} pixel={40} className="shrink-0 opacity-95" />
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <p className="font-medium text-slate-200">{z.zustandDe}</p>
        <p className="text-xs text-slate-400">
          <span className="font-semibold tabular-nums text-slate-100">
            {z.tempMin}° – {z.tempMax}°
          </span>
          {z.luftfeuchte != null ? <span className="ml-2 text-slate-500">· LF {z.luftfeuchte} %</span> : null}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
          {z.windKmh != null ? (
            <span className="inline-flex items-center gap-0.5">
              <WindIkon className="h-3.5 w-3.5 shrink-0 text-sky-400/80" />
              <span>
                {z.windKmh} km/h{grad != null ? ` · ${windHimmelsrichtungKurz(grad)}` : ''}
              </span>
            </span>
          ) : null}
          {z.windBoeenKmh != null && z.windBoeenKmh > (z.windKmh ?? 0) ? (
            <span className="text-amber-200/80">Böen {z.windBoeenKmh} km/h</span>
          ) : null}
          {z.niederschlagPMax != null && z.niederschlagPMax > 0 ? (
            <span>Regen max. {z.niederschlagPMax} %</span>
          ) : null}
        </p>
      </div>
    </div>
  )
}

export function RegionWetter7TageTageszeitenClient({ prognose7Tage }: Props) {
  const tage = prognose7Tage ?? []
  const [aktiv, setAktiv] = useState<string | null>(null)
  const [laden, setLaden] = useState(false)
  const [detail, setDetail] = useState<TageszeitenPrognoseAntwort | null>(null)
  const [apiFehler, setApiFehler] = useState<string | null>(null)

  const waehleTag = useCallback(
    async (datumIso: string) => {
      if (aktiv === datumIso) {
        setAktiv(null)
        setDetail(null)
        setApiFehler(null)
        return
      }
      setAktiv(datumIso)
      setApiFehler(null)
      setLaden(true)
      setDetail(null)
      try {
        const q = new URLSearchParams({ datum: datumIso })
        const res = await fetch(`/api/region-wetter/tageszeiten?${q}`, { method: 'GET' })
        const j = (await res.json()) as TageszeitenPrognoseAntwort
        if (!res.ok) {
          setApiFehler(j.fehler ?? `Fehler ${res.status}`)
          return
        }
        setDetail(j)
        if (j.fehler) {
          setApiFehler(j.fehler)
        }
      } catch (e) {
        setApiFehler(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
      } finally {
        setLaden(false)
      }
    },
    [aktiv],
  )

  if (tage.length === 0) return null

  return (
    <details className="app-disclosure group border-t border-slate-800/80 bg-slate-950/30" open>
      <summary className="flex cursor-pointer list-none select-none items-start justify-between gap-3 px-4 py-4 text-left outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500/50 sm:px-8">
        <p className="min-w-0 pr-1 text-[11px] font-black uppercase tracking-widest text-cyan-200/70">7-Tage-Ausblick</p>
        <span className="mt-1 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <div className="px-4 pb-4 sm:px-8">
        <div className="mt-0 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-7 sm:gap-2 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {tage.map((tag, index) => (
            <PrognoseTagKachel
              key={`${tag.datumIso}-${index}`}
              tag={tag}
              index={index}
              onClick={() => waehleTag(tag.datumIso)}
              selected={aktiv === tag.datumIso}
            />
          ))}
        </div>

        {aktiv != null ? (
          <div className="mt-4 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-cyan-100/95">
                {formatDatumKopf(aktiv)}
              </h3>
              {(() => {
                const i = tage.findIndex((t) => t.datumIso === aktiv)
                return i >= 0 ? <p className="text-xs text-slate-500">— {prognoseKopfzeile(i, aktiv)}</p> : null
              })()}
            </div>
            {laden ? (
              <p className="mt-3 text-sm text-slate-400">Lade Tageszeiten…</p>
            ) : apiFehler ? (
              <p className="mt-3 text-sm text-amber-200/90">{apiFehler}</p>
            ) : detail?.tageszeiten.length ? (
              <div className="mt-3">
                {detail.tageszeiten.map((z) => (
                  <TageszeitZeile key={z.id} z={z} />
                ))}
              </div>
            ) : !laden && aktiv ? (
              <p className="mt-3 text-sm text-slate-500">Keine stündlichen Daten.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  )
}
