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
      className="relative flex h-12 w-12 items-center justify-center rounded-full border border-zinc-600/60 bg-zinc-950/50"
      title={`Wind aus ${windHimmelsrichtungAusGrad(grad)} (${Math.round(grad)}°)`}
    >
      <span className="absolute text-[8px] font-bold text-zinc-500" style={{ top: 2 }}>
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
    <div className="overflow-hidden rounded-2xl border border-zinc-700/35 bg-gradient-to-br from-zinc-950/70 via-zinc-950/55 to-zinc-950/90 shadow-xl shadow-black/25 ring-1 ring-white/[0.04] backdrop-blur-xl">
      <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8 sm:p-8">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-sky-300/95">Wetter · {ortName}</h2>
            <RegionWetterOrtwahlClient aktuell={ortId} />
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <span className="text-6xl font-black tabular-nums leading-none text-zinc-50 sm:text-7xl">{wetter.tempC}°</span>
            <div className="pb-1.5">
              <p className="text-lg font-semibold text-zinc-200">{wetter.zustandDe}</p>
              {wetter.feelsLikeC != null ? (
                <p className="text-sm text-zinc-400">Gefühlt wie {wetter.feelsLikeC}°C</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex justify-center sm:justify-end sm:pl-2">
          <WetterHimmelIcon kategorie={kat} pixel={140} className="drop-shadow-[0_0_24px_rgba(56,189,248,0.15)]" />
        </div>
      </div>

      <div className="grid gap-3 border-t border-zinc-800/70 bg-zinc-950/35 px-6 py-5 sm:grid-cols-2 sm:px-8">
        <div className="flex gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/45 p-4">
          <WindIkon />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Wind</p>
            {wetter.windKmh != null ? (
              <p className="mt-1 text-lg font-bold tabular-nums text-zinc-100">{wetter.windKmh} km/h</p>
            ) : (
              <p className="mt-1 text-zinc-500">—</p>
            )}
            {wetter.windBoeenKmh != null && wetter.windBoeenKmh > (wetter.windKmh ?? 0) ? (
              <p className="text-sm text-amber-200/80">Böen bis ca. {wetter.windBoeenKmh} km/h</p>
            ) : null}
            {grad != null ? (
              <p className="mt-1 text-sm text-zinc-300">
                {windHimmelsrichtungKurz(grad)} <span className="text-zinc-500">({Math.round(grad)}°)</span>
              </p>
            ) : null}
          </div>
          {grad != null ? <PfeilWindAusRichtung grad={grad} /> : null}
        </div>

        <div className="space-y-2 rounded-xl border border-zinc-800/60 bg-zinc-900/45 p-4 text-sm text-zinc-300">
          {wetter.luftfeuchte != null ? (
            <p>
              <span className="text-zinc-500">Luftfeuchtigkeit</span>{' '}
              <span className="font-semibold text-zinc-100">{wetter.luftfeuchte}%</span>
            </p>
          ) : null}
          {wetter.tMin != null && wetter.tMax != null ? (
            <p>
              <span className="text-zinc-500">Heute</span>{' '}
              <span className="font-semibold text-zinc-100">
                {wetter.tMin}° – {wetter.tMax}°
              </span>
            </p>
          ) : null}
          {wetter.morgenTMin != null && wetter.morgenTMax != null ? (
            <p>
              <span className="text-slate-500">Morgen</span>{' '}
              <span className="font-semibold text-slate-100">
                {wetter.morgenTMin}° – {wetter.morgenTMax}°
              </span>
            </p>
          ) : null}
          {sonneHeute ? (
            <>
              <p>
                <span className="text-zinc-500">Sonnenaufgang</span>{' '}
                <span className="font-semibold tabular-nums text-zinc-100">
                  {formatUhrzeitKurzDe(sonneHeute.sonnenaufgangIso)}
                </span>
              </p>
              <p>
                <span className="text-zinc-500">Sonnenuntergang</span>{' '}
                <span className="font-semibold tabular-nums text-zinc-100">
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
        <details className="app-disclosure group border-t border-zinc-800/70 bg-zinc-950/25" open>
          <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-3 px-4 py-4 text-left outline-offset-2 transition-colors hover:bg-zinc-800/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500/50 sm:px-8">
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
                    className="flex min-w-[3.5rem] snap-center flex-col items-center gap-1 rounded-xl border border-zinc-800/60 bg-zinc-900/45 px-2 py-2.5"
                    title={s.zustandDe}
                  >
                    <p className="text-[10px] font-mono font-bold tabular-nums text-zinc-500">{uhr}</p>
                    <WetterHimmelIcon kategorie={katS} pixel={40} className="opacity-95" />
                    <p className="text-sm font-black tabular-nums text-zinc-100">{s.tempC}°</p>
                    {s.windKmh != null ? (
                      <p className="text-[8px] tabular-nums text-zinc-500">{s.windKmh} km/h</p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </details>
      ) : null}

      <RegionWetter7TageTageszeitenClient ortId={ortId} prognose7Tage={wetter.prognose7Tage ?? []} />

      <p className="border-t border-zinc-800/60 px-6 py-2 text-[10px] text-zinc-600 sm:px-8">
        {aktualisiertAnzeige} ·{' '}
        <a className="underline decoration-zinc-700 hover:text-zinc-400" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>
        {' · '}
        <a
          className="underline decoration-zinc-700 hover:text-zinc-400"
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
