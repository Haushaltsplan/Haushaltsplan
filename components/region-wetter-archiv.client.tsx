'use client'

import { DetailsDisclosureTriggerEnd } from '@/components/collapsible-ui'
import { WetterHimmelIcon, iconKategorie } from '@/components/wetter-zeichen'
import type { WetterHistorieTag, WetterOrtId } from '@/lib/region-haarbach'
import {
  heuteIsoEuropeBerlin,
  isoDatumPlusKalendertage,
  isoZuDatumAnzeigeDe,
  WETTER_ARCHIV_DATUM_MIN,
  windHimmelsrichtungKurz,
} from '@/lib/region-haarbach'
import { useCallback, useEffect, useState } from 'react'

type Props = {
  ortId: WetterOrtId
  startDatumIso: string
  initialHistorie: WetterHistorieTag | null
}

export function RegionWetterArchivClient({ ortId, startDatumIso, initialHistorie }: Props) {
  const maxIso = heuteIsoEuropeBerlin()
  const [datumIso, setDatumIso] = useState(startDatumIso)
  const [tag, setTag] = useState<WetterHistorieTag | null>(initialHistorie)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const fetchArchiv = useCallback(
    async (iso: string) => {
      setLaden(true)
      setFehler(null)
      try {
        const q = new URLSearchParams({ datum: iso, ort: ortId })
        const res = await fetch(`/api/region-wetter/archiv?${q}`)
        const j = (await res.json()) as { tag?: WetterHistorieTag | null; fehler?: string }
        if (!res.ok) {
          setTag(null)
          setFehler(j.fehler ?? `Fehler ${res.status}`)
          return
        }
        setTag(j.tag ?? null)
        if (j.tag == null) setFehler('Keine Archivdaten für diesen Tag.')
      } catch (e) {
        setTag(null)
        setFehler(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
      } finally {
        setLaden(false)
      }
    },
    [ortId],
  )

  useEffect(() => {
    if (datumIso === startDatumIso && initialHistorie != null) {
      setTag(initialHistorie)
      setFehler(null)
      return
    }
    void fetchArchiv(datumIso)
  }, [datumIso, startDatumIso, initialHistorie, fetchArchiv])

  const kannZurueck = datumIso > WETTER_ARCHIV_DATUM_MIN
  const kannVor = datumIso < maxIso

  const geheTag = (delta: number) => {
    const neu = isoDatumPlusKalendertage(datumIso, delta)
    if (delta < 0) {
      setDatumIso(neu < WETTER_ARCHIV_DATUM_MIN ? WETTER_ARCHIV_DATUM_MIN : neu)
      return
    }
    setDatumIso(neu > maxIso ? maxIso : neu)
  }

  const istReferenz = datumIso === startDatumIso
  const titelDatum = tag?.datumAnzeigeDe ?? isoZuDatumAnzeigeDe(datumIso)
  const btnCls =
    'rounded-lg border border-amber-700/35 bg-[var(--app-surface-muted)] px-2.5 py-1.5 text-xs font-semibold text-amber-100/95 transition hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-35'

  return (
    <details className="app-disclosure group border-t border-[var(--app-border)] bg-[var(--app-surface-muted)]/25">
      <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-3 px-4 py-4 text-left outline-offset-2 transition-colors hover:bg-[var(--app-surface-hover)]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500/50 sm:px-8">
        <p className="min-w-0 pr-1 text-[11px] font-black uppercase tracking-widest text-amber-200/85">
          Wetterarchiv
          <span className="mt-0.5 block font-mono font-bold normal-case tracking-normal text-amber-100/75">
            {titelDatum}
            {istReferenz ? <span className="text-amber-400/80"> · gleicher Kalendertag vor 1 Jahr</span> : null}
          </span>
        </p>
        <DetailsDisclosureTriggerEnd tone="sky" />
      </summary>
      <div className="space-y-4 px-4 pb-5 sm:px-8">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--app-border)] pb-4">
          <button type="button" disabled={!kannZurueck || laden} className={btnCls} onClick={() => geheTag(-1)}>
            ← Tag
          </button>
          <button type="button" disabled={!kannVor || laden} className={btnCls} onClick={() => geheTag(1)}>
            Tag →
          </button>
          {!istReferenz ? (
            <button type="button" disabled={laden} className={btnCls} onClick={() => setDatumIso(startDatumIso)}>
              Zu „vor 1 Jahr“
            </button>
          ) : null}
          {laden ? <span className="text-xs text-[var(--app-text-muted)]">Lade …</span> : null}
        </div>

        {fehler ? <p className="text-sm text-amber-200/90">{fehler}</p> : null}

        {!laden && tag ? (
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <div className="flex flex-wrap items-end gap-3">
                <span className="text-4xl font-black tabular-nums leading-none text-[var(--app-text)] sm:text-5xl">
                  {tag.tMin}° – {tag.tMax}°
                </span>
                <div className="pb-1">
                  <p className="text-base font-semibold text-[var(--app-text)]">{tag.zustandDe}</p>
                  <p className="text-xs text-[var(--app-text-muted)]">Tagesmin / ‑max (Archiv)</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-[var(--app-text)] sm:grid-cols-2">
                {tag.windMaxKmh != null ? (
                  <p>
                    <span className="text-[var(--app-text-muted)]">Wind (max.)</span>{' '}
                    <span className="font-semibold text-[var(--app-text)]">{tag.windMaxKmh} km/h</span>
                    {tag.windRichtungGrad != null ? (
                      <span className="text-[var(--app-text-muted)]">
                        {' '}
                        · {windHimmelsrichtungKurz(tag.windRichtungGrad)} ({Math.round(tag.windRichtungGrad)}°)
                      </span>
                    ) : null}
                  </p>
                ) : null}
                {tag.windBoeenMaxKmh != null ? (
                  <p>
                    <span className="text-[var(--app-text-muted)]">Böen (max.)</span>{' '}
                    <span className="font-semibold text-amber-200/90">{tag.windBoeenMaxKmh} km/h</span>
                  </p>
                ) : null}
                {tag.niederschlagMm != null ? (
                  <p>
                    <span className="text-[var(--app-text-muted)]">Niederschlag</span>{' '}
                    <span className="font-semibold text-[var(--app-text)]">{tag.niederschlagMm} mm</span>
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex justify-center sm:justify-end">
              <WetterHimmelIcon
                kategorie={iconKategorie(tag.wmoCode)}
                pixel={100}
                className="opacity-95 drop-shadow-[0_0_18px_rgba(251,191,36,0.12)]"
              />
            </div>
          </div>
        ) : null}
      </div>
    </details>
  )
}
