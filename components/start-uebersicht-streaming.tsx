import { PageSection, PageSectionPanel } from '@/components/page-shell'
import { DetailsDisclosureTriggerEnd } from '@/components/collapsible-ui'
import { RegionWetterAnzeige } from '@/components/region-wetter-anzeige'
import { ladeAktienPortfolioNews } from '@/lib/aktien-portfolio-news'
import {
  investmentsSperreFreischaltungKurzDE,
  investmentsSperreLetzterTagDisplayDE,
  istInvestmentsGesperrt,
} from '@/lib/investments-sperre'
import {
  ladeRegionNews,
  ladeWetterRegion,
  REGION_HAARBACH,
  REGION_LEOGANG,
  wetterBeiLadefehler,
  wetterOrtKoordinaten,
  type WetterOrtId,
} from '@/lib/region-haarbach'
import { ladeProfirennradsportNews, ladeProfiWintersportNews } from '@/lib/sport-profi-news'

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

function formatNewsDatum(iso: string | null) {
  if (!iso) return 'o. D.'
  try {
    return new Date(iso).toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'o. D.'
  }
}

function ortKopfzeile(ortId: WetterOrtId) {
  if (ortId === 'leogang') {
    return (
      <p className="mb-3 text-xs text-zinc-500">
        <span className="font-semibold text-zinc-300">{REGION_LEOGANG.name}</span>
        <span className="mx-1.5 text-zinc-600">·</span>
        {REGION_LEOGANG.bezirk}
      </p>
    )
  }
  return (
    <p className="mb-3 text-xs text-zinc-500">
      <span className="font-semibold text-zinc-300">{REGION_HAARBACH.name}</span>
      <span className="mx-1.5 text-zinc-600">·</span>
      {REGION_HAARBACH.kreis}
    </p>
  )
}

/** Lädt nur Wetter — für Suspense-Streaming unabhängig von News. */
export async function StartRegionBlock({ ortId }: { ortId: WetterOrtId }) {
  const ortWetter = wetterOrtKoordinaten(ortId)
  let wetter
  try {
    wetter = await ladeWetterRegion(ortId)
  } catch (e) {
    wetter = wetterBeiLadefehler(e instanceof Error ? e.message : 'Wetter nicht erreichbar')
  }

  return (
    <PageSection titleId="start-region-heading" title="Region & Wetter" density="compact">
      <PageSectionPanel density="compact">
        {ortKopfzeile(ortId)}
        <RegionWetterAnzeige
          wetter={wetter}
          aktualisiertAnzeige={formatUhr(wetter.aktualisiert)}
          ortId={ortId}
          ortName={ortWetter.name}
        />
      </PageSectionPanel>
    </PageSection>
  )
}

async function ladeNewsUmgebung() {
  try {
    return await ladeRegionNews()
  } catch (e) {
    return { artikel: [], fehler: e instanceof Error ? e.message : 'News nicht erreichbar' } as const
  }
}

export async function StartNewsUmgebungPanel() {
  const news = await ladeNewsUmgebung()
  return (
    <PageSectionPanel density="compact">
      <details className="app-disclosure group bg-zinc-950/20">
        <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left outline-offset-2 transition-colors hover:bg-zinc-800/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500/50 sm:px-4">
          <p className="min-w-0 pr-1 text-[11px] font-black uppercase tracking-widest text-amber-200/80">
            News aus der Umgebung
          </p>
          <DetailsDisclosureTriggerEnd tone="amber" />
        </summary>
        <div className="px-3 pb-3 pt-1 sm:px-4">
          {news.fehler ? <p className="mt-1 text-xs text-amber-200/60">{news.fehler}</p> : null}
          {news.artikel.length === 0 && !news.fehler ? <p className="mt-2 text-sm text-zinc-500">Keine Meldungen.</p> : null}
          <ul className="mt-3 space-y-2.5">
            {news.artikel.map((a, i) => (
              <li
                key={a.href + i}
                className="flex flex-col gap-0.5 border-b border-zinc-800/60 pb-2.5 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-3"
              >
                <time
                  className="shrink-0 text-xs font-mono tabular-nums text-zinc-500"
                  dateTime={a.veroeffentlichtAm ?? undefined}
                >
                  {formatNewsDatum(a.veroeffentlichtAm)}
                </time>
                <div className="min-w-0 flex-1">
                  <a
                    href={a.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[15px] font-semibold text-zinc-100 underline decoration-zinc-600 underline-offset-2 transition hover:text-cyan-200"
                  >
                    {a.titel}
                  </a>
                  <span className="ml-1.5 text-xs text-zinc-600">· {a.quelle}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </PageSectionPanel>
  )
}

async function ladeNewsPortfolio() {
  try {
    return await ladeAktienPortfolioNews()
  } catch (e) {
    return { artikel: [], fehler: e instanceof Error ? e.message : 'News nicht erreichbar' } as const
  }
}

export async function StartNewsPortfolioPanel() {
  if (istInvestmentsGesperrt()) {
    return (
      <PageSectionPanel density="compact">
        <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 px-3 py-3 sm:px-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-violet-200/75">Markt-News</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Während der Aktienpause (bis einschließlich {investmentsSperreLetzterTagDisplayDE()}) sind hier keine
            Schlagzeilen geladen — bewusst ruhig. Ab {investmentsSperreFreischaltungKurzDE()} erscheint die Liste wieder.
          </p>
        </div>
      </PageSectionPanel>
    )
  }

  const portfolioNews = await ladeNewsPortfolio()
  return (
    <PageSectionPanel density="compact">
      <details className="app-disclosure group bg-zinc-950/20">
        <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left outline-offset-2 transition-colors hover:bg-zinc-800/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500/50 sm:px-4">
          <p className="min-w-0 pr-1 text-[11px] font-black uppercase tracking-widest text-emerald-200/80">
            Markt-News
          </p>
          <DetailsDisclosureTriggerEnd tone="emerald" />
        </summary>
        <div className="px-3 pb-3 pt-1 sm:px-4">
          {portfolioNews.fehler ? <p className="mt-1 text-xs text-amber-200/60">{portfolioNews.fehler}</p> : null}
          {portfolioNews.artikel.length === 0 && !portfolioNews.fehler ? (
            <p className="mt-2 text-sm text-zinc-500">Keine Meldungen.</p>
          ) : null}
          <ul className="mt-3 space-y-2.5">
            {portfolioNews.artikel.map((a, i) => (
              <li
                key={a.href + i}
                className="flex flex-col gap-0.5 border-b border-zinc-800/60 pb-2.5 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-3"
              >
                <time
                  className="shrink-0 text-xs font-mono tabular-nums text-zinc-500"
                  dateTime={a.veroeffentlichtAm ?? undefined}
                >
                  {formatNewsDatum(a.veroeffentlichtAm)}
                </time>
                <div className="min-w-0 flex-1">
                  <a
                    href={a.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[15px] font-semibold text-zinc-100 underline decoration-zinc-600 underline-offset-2 transition hover:text-cyan-200"
                  >
                    {a.titel}
                  </a>
                  <span className="ml-1.5 text-xs text-zinc-600">· {a.quelle}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </PageSectionPanel>
  )
}

async function ladeNewsRennrad() {
  try {
    return await ladeProfirennradsportNews()
  } catch (e) {
    return { artikel: [], fehler: e instanceof Error ? e.message : 'News nicht erreichbar' } as const
  }
}

export async function StartNewsRennradPanel() {
  const rennradNews = await ladeNewsRennrad()
  return (
    <PageSectionPanel density="compact">
      <details className="app-disclosure group bg-zinc-950/20">
        <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left outline-offset-2 transition-colors hover:bg-zinc-800/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500/50 sm:px-4">
          <p className="min-w-0 pr-1 text-[11px] font-black uppercase tracking-widest text-orange-200/80">
            News zum Profirennradsport
          </p>
          <DetailsDisclosureTriggerEnd tone="orange" />
        </summary>
        <div className="px-3 pb-3 pt-1 sm:px-4">
          {rennradNews.fehler ? <p className="mt-1 text-xs text-amber-200/60">{rennradNews.fehler}</p> : null}
          {rennradNews.artikel.length === 0 && !rennradNews.fehler ? (
            <p className="mt-2 text-sm text-zinc-500">Keine Meldungen.</p>
          ) : null}
          <ul className="mt-3 space-y-2.5">
            {rennradNews.artikel.map((a, i) => (
              <li
                key={a.href + i}
                className="flex flex-col gap-0.5 border-b border-zinc-800/60 pb-2.5 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-3"
              >
                <time
                  className="shrink-0 text-xs font-mono tabular-nums text-zinc-500"
                  dateTime={a.veroeffentlichtAm ?? undefined}
                >
                  {formatNewsDatum(a.veroeffentlichtAm)}
                </time>
                <div className="min-w-0 flex-1">
                  <a
                    href={a.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[15px] font-semibold text-zinc-100 underline decoration-zinc-600 underline-offset-2 transition hover:text-cyan-200"
                  >
                    {a.titel}
                  </a>
                  <span className="ml-1.5 text-xs text-zinc-600">· {a.quelle}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </PageSectionPanel>
  )
}

async function ladeNewsWinter() {
  try {
    return await ladeProfiWintersportNews()
  } catch (e) {
    return { artikel: [], fehler: e instanceof Error ? e.message : 'News nicht erreichbar' } as const
  }
}

export async function StartNewsWinterPanel() {
  const winterNews = await ladeNewsWinter()
  return (
    <PageSectionPanel density="compact">
      <details className="app-disclosure group bg-zinc-950/20">
        <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left outline-offset-2 transition-colors hover:bg-zinc-800/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500/50 sm:px-4">
          <p className="min-w-0 pr-1 text-[11px] font-black uppercase tracking-widest text-sky-200/80">
            News zum Profi Wintersport
          </p>
          <DetailsDisclosureTriggerEnd tone="sky" />
        </summary>
        <div className="px-3 pb-3 pt-1 sm:px-4">
          {winterNews.fehler ? <p className="mt-1 text-xs text-amber-200/60">{winterNews.fehler}</p> : null}
          {winterNews.artikel.length === 0 && !winterNews.fehler ? (
            <p className="mt-2 text-sm text-zinc-500">Keine Meldungen.</p>
          ) : null}
          <ul className="mt-3 space-y-2.5">
            {winterNews.artikel.map((a, i) => (
              <li
                key={a.href + i}
                className="flex flex-col gap-0.5 border-b border-zinc-800/60 pb-2.5 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-3"
              >
                <time
                  className="shrink-0 text-xs font-mono tabular-nums text-zinc-500"
                  dateTime={a.veroeffentlichtAm ?? undefined}
                >
                  {formatNewsDatum(a.veroeffentlichtAm)}
                </time>
                <div className="min-w-0 flex-1">
                  <a
                    href={a.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[15px] font-semibold text-zinc-100 underline decoration-zinc-600 underline-offset-2 transition hover:text-cyan-200"
                  >
                    {a.titel}
                  </a>
                  <span className="ml-1.5 text-xs text-zinc-600">· {a.quelle}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </PageSectionPanel>
  )
}
