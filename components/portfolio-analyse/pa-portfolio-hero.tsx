'use client'

import Link from 'next/link'
import { useMemo, type ReactNode } from 'react'
import { DonutChart } from '@/components/finanzen/donut-chart'
import { PaBadge, PaCard } from '@/components/portfolio-analyse/pa-ui'
import { formatDatumDe, formatEur, formatProzent } from '@/lib/portfolio-analyse/berechnung'
import { eintraegeZuDonut, gewichtungNachAsset } from '@/lib/portfolio-analyse/gewichtung'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { PortfolioScopeMetrics } from '@/lib/portfolio-analyse/parqet-core/types'
import { ASSET_KLASSE_LABEL, type AssetKlasse } from '@/lib/portfolio-analyse/types'
import type { WertentwicklungPunkt } from '@/lib/portfolio-analyse/wertentwicklung'

function formatEurKompakt(n: number): string {
  return `${Math.round(n).toLocaleString('de-DE')}€`
}

function portfolioTitel(positionen: LivePosition[]): string {
  const klassen = [...new Set(positionen.map((p) => p.assetKlasse))]
  if (klassen.length === 1) {
    const k = klassen[0] as AssetKlasse
    if (k === 'aktie') return 'Aktien Portfolio'
    return `${ASSET_KLASSE_LABEL[k]} Portfolio`
  }
  return 'Portfolio'
}

function MetricSecondary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/[0.04] py-2.5 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm font-medium tabular-nums text-zinc-300">{value}</span>
    </div>
  )
}

function MetricPrimary({
  label,
  value,
  valueClass = 'text-zinc-50',
  badge,
}: {
  label: string
  value: string
  valueClass?: string
  badge?: ReactNode
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-500">{label}</span>
        {badge}
      </div>
      <p className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight sm:text-[1.65rem] ${valueClass}`}>
        {value}
      </p>
    </div>
  )
}

export function PaPortfolioHero({
  positionen,
  kennzahlen,
  metrics,
  irr,
  wertentwicklung,
  startDatumIso,
}: {
  positionen: LivePosition[]
  kennzahlen: {
    depotwertEur: number
    investiertEur: number
    gewinnVerlustProzent: number | null
  }
  metrics: PortfolioScopeMetrics | null | undefined
  irr: number | null | undefined
  wertentwicklung: WertentwicklungPunkt[]
  startDatumIso: string | null
}) {
  const donut = useMemo(() => {
    const eintraege = gewichtungNachAsset(positionen)
    return eintraegeZuDonut(eintraege, 24)
  }, [positionen])

  const assetklassen = useMemo(() => new Set(positionen.map((p) => p.assetKlasse)).size, [positionen])
  const holdings = positionen.filter((p) => p.wertLiveEur > 0).length

  const depotwert = kennzahlen.depotwertEur
  const investiert = metrics?.costBasisEUR ?? kennzahlen.investiertEur
  const perfPct = metrics?.unrealizedGainPercent ?? kennzahlen.gewinnVerlustProzent
  const kursgewinn = metrics?.unrealizedGainEUR ?? positionen.reduce((s, p) => s + p.gewinnVerlustEur, 0)
  const dividenden = metrics?.totalDividendsGrossEUR ?? 0
  const realisiert = metrics?.realizedGainsEUR ?? 0

  const wertAmStart =
    wertentwicklung.length > 0 ? wertentwicklung[0].portfoliowertEur : 0
  const startLabel = startDatumIso ? `Wert am ${formatDatumDe(startDatumIso)}` : 'Wert am Start'

  const perfBadge =
    perfPct != null ? (
      <PaBadge variant={perfPct >= 0 ? 'positive' : 'negative'}>
        {perfPct >= 0 ? '↑' : '↓'}{' '}
        {Math.abs(perfPct).toLocaleString('de-DE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
        %
      </PaBadge>
    ) : null

  return (
    <PaCard variant="elevated" className="overflow-hidden">
      <div className="flex flex-col gap-8 p-5 sm:p-6 lg:flex-row lg:items-stretch lg:gap-10">
        <div className="flex shrink-0 justify-center lg:justify-start lg:pt-2">
          <DonutChart
            segmente={donut}
            groesse={200}
            dicke={26}
            mitte={{ wert: formatEurKompakt(depotwert) }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
                {portfolioTitel(positionen)}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {assetklassen} {assetklassen === 1 ? 'Assetklasse' : 'Assetklassen'} · {holdings}{' '}
                {holdings === 1 ? 'Holding' : 'Holdings'} · EUR
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/portfolioanalyse/import"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-teal-400 transition-colors hover:bg-teal-500/10 hover:text-teal-300"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                Verwalten
              </Link>
              <span className="hidden h-4 w-px bg-zinc-700 sm:block" aria-hidden />
              <button
                type="button"
                disabled
                title="Demnächst"
                className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
                  />
                </svg>
                Teilen
              </button>
              <span className="hidden h-4 w-px bg-zinc-700 sm:block" aria-hidden />
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-zinc-950/60 px-3 py-1.5 text-xs font-medium text-zinc-400">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"
                  />
                </svg>
                Alle Assetklassen
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-zinc-950/60 px-3 py-1.5 text-xs font-medium text-zinc-400">
                Seit Kauf
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </span>
            </div>
          </div>

          <hr className="mt-5 border-white/[0.06]" />

          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div>
              <MetricPrimary
                label="Portfoliowert"
                value={formatEur(depotwert)}
                badge={perfBadge}
              />
              <div className="mt-4">
                <MetricSecondary label={startLabel} value={formatEur(wertAmStart)} />
                <MetricSecondary label="Investiert" value={formatEur(investiert)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-6">
              <MetricPrimary
                label="Kursgewinn"
                value={formatEur(kursgewinn)}
                valueClass={kursgewinn >= 0 ? 'text-emerald-400' : 'text-rose-400'}
              />
              <MetricPrimary
                label="IZF"
                value={irr != null ? formatProzent(irr) : '—'}
                valueClass={
                  irr != null && irr >= 0 ? 'text-emerald-400' : irr != null ? 'text-rose-400' : 'text-zinc-50'
                }
              />
              <div>
                <p className="text-sm text-zinc-500">Dividenden</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-400/95">
                  {formatEur(dividenden)}
                </p>
              </div>
              <div>
                <p className="text-sm text-zinc-500">Realisiert</p>
                <p
                  className={`mt-1 text-lg font-semibold tabular-nums ${
                    realisiert >= 0 ? 'text-emerald-400/95' : 'text-rose-400'
                  }`}
                >
                  {formatEur(realisiert)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PaCard>
  )
}
