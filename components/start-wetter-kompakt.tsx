import { DetailsDisclosureTriggerEnd } from '@/components/collapsible-ui'
import { StartSektion } from '@/components/start-home-ui'
import { RegionWetterAnzeige } from '@/components/region-wetter-anzeige'
import { WetterHimmelIcon, iconKategorieAnzeige } from '@/components/wetter-zeichen'
import {
  REGION_HAARBACH,
  REGION_LEOGANG,
  heuteIsoEuropeBerlin,
  ladeWetterRegion,
  wetterBeiLadefehler,
  wetterOrtKoordinaten,
  zeitpunktIstNachtNachSonne,
  type WetterOrtId,
} from '@/lib/region-haarbach'

function formatUhr(iso: string) {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function ortLabel(ortId: WetterOrtId) {
  if (ortId === 'leogang') return `${REGION_LEOGANG.name} · ${REGION_LEOGANG.bezirk}`
  return `${REGION_HAARBACH.name} · ${REGION_HAARBACH.kreis}`
}

export async function StartWetterKompakt({ ortId }: { ortId: WetterOrtId }) {
  const ortWetter = wetterOrtKoordinaten(ortId)
  let wetter
  try {
    wetter = await ladeWetterRegion(ortId)
  } catch (e) {
    wetter = wetterBeiLadefehler(e instanceof Error ? e.message : 'Wetter nicht erreichbar')
  }

  const heuteIso = heuteIsoEuropeBerlin()
  const sonneHeute = wetter.sonnenzeitenTage.find((s) => s.datumIso === heuteIso)
  const nachtJetzt =
    sonneHeute != null
      ? zeitpunktIstNachtNachSonne(wetter.aktualisiert, sonneHeute.sonnenaufgangIso, sonneHeute.sonnenuntergangIso)
      : zeitpunktIstNachtNachSonne(wetter.aktualisiert, null, null)
  const kat = iconKategorieAnzeige(wetter.wmoCode, nachtJetzt)

  return (
    <StartSektion titel="Wetter" icon="☀" href={`/?ort=${ortId}`} akzent="sky">
      {wetter.fehler ? (
        <p className="text-sm text-amber-200/90">{wetter.fehler}</p>
      ) : (
        <details className="app-disclosure group -mx-1">
          <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-3 rounded-xl border border-sky-500/10 bg-sky-950/20 px-3 py-3 outline-offset-2 transition-colors hover:bg-sky-950/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500/50">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <WetterHimmelIcon
                kategorie={kat}
                pixel={56}
                className="shrink-0 drop-shadow-[0_0_20px_rgba(56,189,248,0.2)]"
              />
              <div className="min-w-0">
                <p className="text-4xl font-black tabular-nums leading-none tracking-tight text-zinc-50">
                  {wetter.tempC}°
                </p>
                <p className="mt-1.5 text-sm font-medium text-zinc-200">{wetter.zustandDe}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {ortWetter.name} · {ortLabel(ortId)}
                </p>
                {wetter.feelsLikeC != null ? (
                  <p className="mt-1 text-[11px] text-sky-200/70">Gefühlt {wetter.feelsLikeC}°</p>
                ) : null}
              </div>
            </div>
            <DetailsDisclosureTriggerEnd tone="sky" />
          </summary>
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800/60">
            <RegionWetterAnzeige
              wetter={wetter}
              aktualisiertAnzeige={formatUhr(wetter.aktualisiert)}
              ortId={ortId}
              ortName={ortWetter.name}
            />
          </div>
        </details>
      )}
    </StartSektion>
  )
}
