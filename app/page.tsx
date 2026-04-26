import type { Metadata } from 'next'
import { RegionWetterAnzeige } from '@/components/region-wetter-anzeige'
import {
  ladeRegionNews,
  ladeWetterHaarbach,
  REGION_HAARBACH,
  wetterBeiLadefehler,
} from '@/lib/region-haarbach'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Start',
  description: `Region & Übersicht — ${REGION_HAARBACH.name}, ${REGION_HAARBACH.kreis}`,
}

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

export default async function StartUebersichtPage() {
  let wetter: Awaited<ReturnType<typeof ladeWetterHaarbach>>
  let news: Awaited<ReturnType<typeof ladeRegionNews>>
  try {
    ;[wetter, news] = await Promise.all([ladeWetterHaarbach(), ladeRegionNews()])
  } catch (e) {
    wetter = wetterBeiLadefehler(
      e instanceof Error ? e.message : 'Laden der Startseite fehlgeschlagen',
    )
    news = { artikel: [], fehler: e instanceof Error ? e.message : 'News nicht erreichbar' }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in duration-500">
      <div className="px-0.5">
        <h1 className="text-2xl font-black tracking-tight text-slate-100 sm:text-3xl">
          {REGION_HAARBACH.name}
          <span className="ml-2 text-base font-semibold text-slate-500 sm:text-lg">
            {REGION_HAARBACH.kreis}
          </span>
        </h1>
      </div>

      <RegionWetterAnzeige
        wetter={wetter}
        aktualisiertAnzeige={formatUhr(wetter.aktualisiert)}
        ortName={REGION_HAARBACH.name}
      />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-black/20">
        <details className="app-disclosure group" open>
          <summary className="flex cursor-pointer list-none select-none items-start justify-between gap-3 text-left outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500/50">
            <h2 className="text-xs font-black uppercase tracking-widest text-amber-200/80">News</h2>
            <span className="mt-0.5 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </summary>
          <div className="pt-1">
            {news.fehler ? <p className="mt-1 text-xs text-amber-200/60">{news.fehler}</p> : null}
            {news.artikel.length === 0 && !news.fehler ? <p className="mt-2 text-sm text-slate-500">Keine Meldungen.</p> : null}
            <ul className="mt-3 space-y-2.5">
              {news.artikel.map((a, i) => (
                <li
                  key={a.href + i}
                  className="flex flex-col gap-0.5 border-b border-slate-800/60 pb-2.5 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-3"
                >
                  <time
                    className="shrink-0 text-xs font-mono tabular-nums text-slate-500"
                    dateTime={a.veroeffentlichtAm ?? undefined}
                  >
                    {formatNewsDatum(a.veroeffentlichtAm)}
                  </time>
                  <div className="min-w-0 flex-1">
                    <a
                      href={a.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[15px] font-semibold text-slate-100 underline decoration-slate-600 underline-offset-2 transition hover:text-cyan-200"
                    >
                      {a.titel}
                    </a>
                    <span className="ml-1.5 text-xs text-slate-600">· {a.quelle}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </section>
    </div>
  )
}
