import { DetailsDisclosureTriggerEnd } from '@/components/collapsible-ui'
import { RegionWetterArchivClient } from '@/components/region-wetter-archiv.client'
import { RegionWetterOrtwahlClient } from '@/components/region-wetter-ortwahl.client'
import { RegionWetter7TageTageszeitenClient } from '@/components/region-wetter-7tage-tageszeiten.client'
import { WindIkon, WetterHimmelIcon, iconKategorieAnzeige } from '@/components/wetter-zeichen'
import type { WetterOverview, WetterOrtId } from '@/lib/region-haarbach'
import {
  formatUhrzeitKurzDe,
  heuteIsoEuropeBerlin,
  kalenderdatumVorJahrEuropeBerlin,
  windHimmelsrichtungAusGrad,
  windHimmelsrichtungKurz,
  zeitpunktIstNachtFuerKalendertag,
  zeitpunktIstNachtNachSonne,
} from '@/lib/region-haarbach'

type Props = {
  wetter: WetterOverview
  aktualisiertAnzeige: string
  ortId: WetterOrtId
  ortName: string
}

function PfeilWindAusRichtung({ grad }: { grad: number }) {
  return (
    <div
      className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[var(--app-border-strong)] bg-[var(--app-surface-muted)]"
      title={`Wind aus ${windHimmelsrichtungAusGrad(grad)} (${Math.round(grad)}°)`}
    >
      <span className="absolute text-[8px] font-bold text-[var(--app-text-muted)]" style={{ top: 2 }}>
        N
      </span>
      <svg
        className="h-6 w-6 text-amber-300/90"
        viewBox="0 0 24 24"
        style={{ transform: `rotate(${grad}deg)` }}
        aria-hidden
      >
        <path d="M12 3 L20 20 L12 16 L4 20 Z" fill="currentColor" />
      </svg>
    </div>
  )
}

export function RegionWetterAnzeige({ wetter, aktualisiertAnzeige, ortId, ortName }: Props) {
  if (wetter.fehler) {
    return <p className="text-sm text-amber-200/90">{wetter.fehler}</p>
  }

  const heuteIso = heuteIsoEuropeBerlin()
  const sonneHeute = wetter.sonnenzeitenTage.find((s) => s.datumIso === heuteIso)
  const nachtJetzt =
    sonneHeute != null
      ? zeitpunktIstNachtNachSonne(wetter.aktualisiert, sonneHeute.sonnenaufgangIso, sonneHeute.sonnenuntergangIso)
      : zeitpunktIstNachtNachSonne(wetter.aktualisiert, null, null)

  const kat = iconKategorieAnzeige(wetter.wmoCode, nachtJetzt)
  const grad = wetter.windRichtungGrad
  const vorJahrDatum = kalenderdatumVorJahrEuropeBerlin()

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--app-border-strong)]/35 bg-gradient-to-br from-[var(--app-surface-muted)]/70 via-[var(--app-surface)] to-[var(--app-surface-muted)] shadow-xl shadow-[var(--app-shadow)] ring-1 ring-[var(--app-ring)] backdrop-blur-xl">
      <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8 sm:p-8">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-sky-300/95">Wetter · {ortName}</h2>
            <RegionWetterOrtwahlClient aktuell={ortId} />
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <span className="text-6xl font-black tabular-nums leading-none text-[var(--app-text)] sm:text-7xl">{wetter.tempC}°</span>
            <div className="pb-1.5">
              <p className="text-lg font-semibold text-[var(--app-text)]">{wetter.zustandDe}</p>
              {wetter.feelsLikeC != null ? (
                <p className="text-sm text-[var(--app-text-muted)]">Gefühlt wie {wetter.feelsLikeC}°C</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex justify-center sm:justify-end sm:pl-2">
          <WetterHimmelIcon kategorie={kat} pixel={140} className="drop-shadow-[0_0_24px_rgba(56,189,248,0.15)]" />
        </div>
      </div>

      <div className="grid gap-3 border-t border-[var(--app-border)]/70 bg-[var(--app-surface-muted)]/35 px-6 py-5 sm:grid-cols-2 sm:px-8">
        <div className="flex gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/45 p-4">
          <WindIkon />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-text-muted)]">Wind</p>
            {wetter.windKmh != null ? (
              <p className="mt-1 text-lg font-bold tabular-nums text-[var(--app-text)]">{wetter.windKmh} km/h</p>
            ) : (
              <p className="mt-1 text-[var(--app-text-muted)]">—</p>
            )}
            {wetter.windBoeenKmh != null && wetter.windBoeenKmh > (wetter.windKmh ?? 0) ? (
              <p className="text-sm text-amber-200/80">Böen bis ca. {wetter.windBoeenKmh} km/h</p>
            ) : null}
            {grad != null ? (
              <p className="mt-1 text-sm text-[var(--app-text)]">
                {windHimmelsrichtungKurz(grad)} <span className="text-[var(--app-text-muted)]">({Math.round(grad)}°)</span>
              </p>
            ) : null}
          </div>
          {grad != null ? <PfeilWindAusRichtung grad={grad} /> : null}
        </div>

        <div className="space-y-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/45 p-4 text-sm text-[var(--app-text)]">
          {wetter.luftfeuchte != null ? (
            <p>
              <span className="text-[var(--app-text-muted)]">Luftfeuchtigkeit</span>{' '}
              <span className="font-semibold text-[var(--app-text)]">{wetter.luftfeuchte}%</span>
            </p>
          ) : null}
          {wetter.tMin != null && wetter.tMax != null ? (
            <p>
              <span className="text-[var(--app-text-muted)]">Heute</span>{' '}
              <span className="font-semibold text-[var(--app-text)]">
                {wetter.tMin}° – {wetter.tMax}°
              </span>
            </p>
          ) : null}
          {wetter.morgenTMin != null && wetter.morgenTMax != null ? (
            <p>
              <span className="text-[var(--app-text-muted)]">Morgen</span>{' '}
              <span className="font-semibold text-[var(--app-text)]">
                {wetter.morgenTMin}° – {wetter.morgenTMax}°
              </span>
            </p>
          ) : null}
          {sonneHeute ? (
            <>
              <p>
                <span className="text-[var(--app-text-muted)]">Sonnenaufgang</span>{' '}
                <span className="font-semibold tabular-nums text-[var(--app-text)]">
                  {formatUhrzeitKurzDe(sonneHeute.sonnenaufgangIso)}
                </span>
              </p>
              <p>
                <span className="text-[var(--app-text-muted)]">Sonnenuntergang</span>{' '}
                <span className="font-semibold tabular-nums text-[var(--app-text)]">
                  {formatUhrzeitKurzDe(sonneHeute.sonnenuntergangIso)}
                </span>
              </p>
            </>
          ) : null}
        </div>
      </div>

      <RegionWetterArchivClient
        key={`${ortId}-${vorJahrDatum.iso}`}
        ortId={ortId}
        startDatumIso={vorJahrDatum.iso}
        initialHistorie={
          wetter.historieVorJahr?.datumIso === vorJahrDatum.iso ? wetter.historieVorJahr : null
        }
      />

      {(wetter.stundenPrognose ?? []).length > 0 ? (
        <details className="app-disclosure group border-t border-[var(--app-border)]/70 bg-[var(--app-surface-muted)]/25">
          <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-3 px-4 py-4 text-left outline-offset-2 transition-colors hover:bg-[var(--app-surface-hover)]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500/50 sm:px-8">
            <p className="min-w-0 pr-1 text-[11px] font-black uppercase tracking-widest text-sky-200/80">Nächste Stunden</p>
            <DetailsDisclosureTriggerEnd tone="sky" />
          </summary>
          <div className="px-4 pb-4 sm:px-8">
            <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(wetter.stundenPrognose ?? []).map((s) => {
                const nachtSlot = zeitpunktIstNachtFuerKalendertag(s.zeitIso, wetter.sonnenzeitenTage)
                const katS = iconKategorieAnzeige(s.wmoCode, nachtSlot)
                let uhr = '—'
                try {
                  const t = new Date(s.zeitIso)
                  uhr = Number.isFinite(t.getTime())
                    ? t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                    : s.zeitIso
                } catch {
                  uhr = s.zeitIso
                }
                return (
                  <div
                    key={s.zeitIso}
                    className="flex min-w-[3.5rem] snap-center flex-col items-center gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]/45 px-2 py-2.5"
                    title={s.zustandDe}
                  >
                    <p className="text-[10px] font-mono font-bold tabular-nums text-[var(--app-text-muted)]">{uhr}</p>
                    <WetterHimmelIcon kategorie={katS} pixel={40} className="opacity-95" />
                    <p className="text-sm font-black tabular-nums text-[var(--app-text)]">{s.tempC}°</p>
                    {s.windKmh != null ? (
                      <p className="text-[8px] tabular-nums text-[var(--app-text-muted)]">{s.windKmh} km/h</p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </details>
      ) : null}

      <RegionWetter7TageTageszeitenClient ortId={ortId} prognose7Tage={wetter.prognose7Tage ?? []} />

      <p className="border-t border-[var(--app-border)] px-6 py-2 text-[10px] text-[var(--app-text-muted)] sm:px-8">
        {aktualisiertAnzeige} ·{' '}
        <a className="underline decoration-[var(--app-border-strong)] hover:text-[var(--app-text-muted)]" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>
        {' · '}
        <a
          className="underline decoration-[var(--app-border-strong)] hover:text-[var(--app-text-muted)]"
          href="https://open-meteo.com/en/docs/historical-weather-api"
          target="_blank"
          rel="noreferrer"
        >
          Archiv
        </a>
      </p>
    </div>
  )
}
