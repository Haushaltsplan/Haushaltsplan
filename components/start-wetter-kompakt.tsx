import { DetailsDisclosureTriggerEnd } from '@/components/collapsible-ui'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
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

function ortKopfzeile(ortId: WetterOrtId) {
  if (ortId === 'leogang') {
    return (
      <span className="font-semibold text-zinc-300">
        {REGION_LEOGANG.name} · {REGION_LEOGANG.bezirk}
      </span>
    )
  }
  return (
    <span className="font-semibold text-zinc-300">
      {REGION_HAARBACH.name} · {REGION_HAARBACH.kreis}
    </span>
  )
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
    <PageSection titleId="start-wetter-heading" title="Wetter" density="compact">
      <PageSectionPanel density="compact">
        {wetter.fehler ? (
          <p className="text-sm text-amber-200/90">{wetter.fehler}</p>
        ) : (
          <details className="app-disclosure group">
            <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-3 rounded-xl border border-zinc-800/70 bg-zinc-950/50 px-4 py-3 outline-offset-2 transition-colors hover:bg-zinc-800/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500/50">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <WetterHimmelIcon kategorie={kat} pixel={48} className="shrink-0" />
                <div className="min-w-0">
                  <p className="text-3xl font-black tabular-nums leading-none text-zinc-50">
                    {wetter.tempC}°
                  </p>
                  <p className="mt-1 truncate text-sm text-zinc-300">
                    {wetter.zustandDe} · {ortWetter.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">{ortKopfzeile(ortId)}</p>
                </div>
              </div>
              <DetailsDisclosureTriggerEnd tone="sky" />
            </summary>
            <div className="mt-3">
              <RegionWetterAnzeige
                wetter={wetter}
                aktualisiertAnzeige={formatUhr(wetter.aktualisiert)}
                ortId={ortId}
                ortName={ortWetter.name}
              />
            </div>
          </details>
        )}
      </PageSectionPanel>
    </PageSection>
  )
}
