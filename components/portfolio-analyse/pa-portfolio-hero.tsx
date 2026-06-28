'use client'

import Link from 'next/link'
import { useMemo, type ReactNode } from 'react'
import { DonutChart } from '@/components/finanzen/donut-chart'
import { PaBadge, PaCard } from '@/components/portfolio-analyse/pa-ui'
import { formatDatumDe, formatEur, formatProzent } from '@/lib/portfolio-analyse/berechnung'
import { eintraegeZuDonut, gewichtungNachAsset } from '@/lib/portfolio-analyse/gewichtung'
import type { LivePosition } from '@/lib/portfolio-analyse/live-bewertung'
import type { ParqetPeriodKennzahlen } from '@/lib/portfolio-analyse/parqet-period-kennzahlen'
import type { PortfolioScopeMetrics } from '@/lib/portfolio-analyse/parqet-core/types'
import type { PeriodPerformance } from '@/lib/portfolio-analyse/parqet-core/types'
import { ASSET_KLASSE_LABEL, type AssetKlasse } from '@/lib/portfolio-analyse/types'

function formatEurKompakt(n: number): string {
  return `${Math.round(n).toLocaleString('de-DE')}€`
}

function labelFuerPeriodKey(key: PeriodPerformance['periodKey']): string {
  switch (key) {
    case '1T':
      return 'Heute'
    case '1W':
      return '7 Tage'
    case '1M':
      return '30 Tage'
    case '3M':
      return '3 Monate'
    case '6M':
      return '6 Monate'
    case 'MTD':
      return 'MTD'
    case 'YTD':
      return 'YTD'
    case '1J':
      return '1 Jahr'
    case '3J':
      return '3 Jahre'
    case '5J':
      return '5 Jahre'
    case 'MAX':
      return 'Seit Kauf'
    default:
      return 'Heute'
  }
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
      <span className="text-sm text-[var(--app-text-muted)]">{label}</span>
      <span className="text-sm font-medium tabular-nums text-[var(--app-text)]">{value}</span>
    </div>
  )
}

function MetricPrimary({
  label,
  value,
  valueClass = 'text-[var(--app-text)]',
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
        <span className="text-sm text-[var(--app-text-muted)]">{label}</span>
        {badge}
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums tracking-tight sm:text-[1.65rem] ${valueClass}`}>
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
  periodKennzahlen,
  onPeriodKeyChange,
}: {
  positionen: LivePosition[]
  kennzahlen: {
    depotwertEur: number
    investiertEur: number
    gewinnVerlustProzent: number | null
  }
  metrics: PortfolioScopeMetrics | null | undefined
  irr: number | null | undefined
  periodKennzahlen: ParqetPeriodKennzahlen
  onPeriodKeyChange: (key: PeriodPerformance['periodKey']) => void
}) {
  const donut = useMemo(() => {
    const eintraege = gewichtungNachAsset(positionen)
    return eintraegeZuDonut(eintraege, 24)
  }, [positionen])

  const assetklassen = useMemo(() => new Set(positionen.map((p) => p.assetKlasse)).size, [positionen])
  const holdings = positionen.filter((p) => p.wertLiveEur > 0).length

  const depotwert = kennzahlen.depotwertEur
  const wertAmLabel = `Wert am ${formatDatumDe(periodKennzahlen.periodStartDatumIso)}`
  const wertAmPeriodenstart = periodKennzahlen.wertAmPeriodenstart
  const investiertImZeitraum = periodKennzahlen.investiertImZeitraum
  const kursgewinn = periodKennzahlen.kursgewinn
  const perfPct = periodKennzahlen.performanceProzent
  const dividenden = periodKennzahlen.dividendenImZeitraum
  const realisiert = periodKennzahlen.realisiertImZeitraum

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
      <div className="flex flex-col gap-5 p-4 sm:gap-8 sm:p-6 lg:flex-row lg:items-stretch lg:gap-10">
        <div className="flex shrink-0 justify-center lg:w-[min(42%,280px)] lg:justify-start lg:pt-1">
          <div className="sm:hidden">
            <DonutChart
              segmente={donut}
              groesse={200}
              dicke={26}
              mitte={{ wert: formatEurKompakt(depotwert) }}
            />
          </div>
          <div className="hidden sm:block lg:hidden">
            <DonutChart
              segmente={donut}
              groesse={240}
              dicke={28}
              mitte={{ wert: formatEurKompakt(depotwert) }}
            />
          </div>
          <div className="hidden lg:block">
            <DonutChart
              segmente={donut}
              groesse={280}
              dicke={32}
              mitte={{ wert: formatEurKompakt(depotwert) }}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-[var(--app-text)] sm:text-2xl">
                {portfolioTitel(positionen)}
              </h1>
              <p className="mt-1 text-sm text-[var(--app-text-muted)]">
                {assetklassen} {assetklassen === 1 ? 'Assetklasse' : 'Assetklassen'} · {holdings}{' '}
                {holdings === 1 ? 'Holding' : 'Holdings'} · EUR
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <select
                value={periodKennzahlen.periodKey}
                onChange={(e) => onPeriodKeyChange(e.target.value as PeriodPerformance['periodKey'])}
                className="rounded-lg border border-white/[0.06] bg-[var(--app-surface-muted)]/30 px-3 py-1.5 text-sm text-[var(--app-text)] outline-none transition hover:border-white/[0.12] focus:ring-2 focus:ring-cyan-500/40"
                aria-label="Zeitraum wählen"
              >
                {(
                  ['1T', '1W', '1M', '3M', '6M', '1J', '3J', '5J', 'MTD', 'YTD', 'MAX'] as const
                ).map((k) => (
                  <option key={k} value={k}>
                    {labelFuerPeriodKey(k)}
                  </option>
                ))}
              </select>
              <Link
                href="/portfolioanalyse/import"
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-teal-400 transition-colors hover:bg-teal-500/10 hover:text-teal-300"
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
            </div>
          </div>

          <hr className="mt-4 border-white/[0.06] sm:mt-5" />

          <div className="mt-4 grid gap-6 sm:mt-6 sm:gap-8 md:grid-cols-2">
            <div>
              <MetricPrimary label="Portfoliowert" value={formatEur(depotwert)} badge={perfBadge} />
              <div className="mt-4">
                <MetricSecondary label={wertAmLabel} value={formatEur(wertAmPeriodenstart)} />
                <MetricSecondary label="Investiert" value={formatEur(investiertImZeitraum)} />
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
                  irr != null && irr >= 0 ? 'text-emerald-400' : irr != null ? 'text-rose-400' : 'text-[var(--app-text)]'
                }
              />
              <div>
                <p className="text-sm text-[var(--app-text-muted)]">Dividenden</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-400/95">
                  {formatEur(dividenden)}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--app-text-muted)]">Realisiert</p>
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
