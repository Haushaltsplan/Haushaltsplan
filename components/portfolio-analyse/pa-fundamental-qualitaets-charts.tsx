'use client'

import { PaFundamentalMetrikChart } from '@/components/portfolio-analyse/pa-fundamental-metrik-chart'
import type {
  FundamentalMetrikZeile,
  FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'

export const QUALITAET_PANELS = [
  {
    id: 'gewinn',
    titel: 'Gewinne, Cashflows und Dividenden',
    ids: ['ocf', 'fcf', 'nettogewinn', 'dividenden_gezahlt', 'eps'],
    variant: 'standard' as const,
  },
  {
    id: 'umsatz',
    titel: 'Umsatz und Margen',
    ids: ['umsatz', 'bruttomarge', 'ebitda_marge', 'ebit_marge', 'nettomarge'],
    variant: 'standard' as const,
  },
  {
    id: 'guv',
    titel: 'GuV: Umsatz bis Nettogewinn',
    ids: ['umsatz', 'bruttogewinn', 'ebitda', 'ebit', 'nettogewinn'],
    variant: 'standard' as const,
  },
  {
    id: 'kosten',
    titel: 'Kosten und Reinvestition',
    ids: ['sga', 'rd', 'sbc', 'capex', 'da'],
    variant: 'standard' as const,
  },
  {
    id: 'rendite',
    titel: 'Renditen (ROE / ROIC)',
    ids: ['roe', 'roi', 'roi_ex_goodwill'],
    variant: 'standard' as const,
  },
  {
    id: 'multiples',
    titel: 'Bewertung (Multiples)',
    ids: ['kgv', 'ps', 'pfcf', 'ev_ebitda', 'pb'],
    variant: 'bewertung' as const,
  },
  {
    id: 'verschuldung',
    titel: 'Verschuldung und Kapital',
    ids: ['gesamtverschuldung', 'nettoverschuldung', 'bargeld', 'eigenkapital', 'net_debt_ebitda'],
    variant: 'standard' as const,
  },
  {
    id: 'working_capital',
    titel: 'Working Capital (Tage)',
    ids: ['dso', 'dio', 'dpo'],
    variant: 'standard' as const,
  },
  {
    id: 'buyback',
    titel: 'Aktienrückkäufe und Aktienzahl',
    ids: ['aktienrueckkauf', 'aktien'],
    variant: 'standard' as const,
  },
] as const

export function qualitaetPanelIdFuerZeile(zeileId: string): string {
  for (const p of QUALITAET_PANELS) {
    if ((p.ids as readonly string[]).includes(zeileId)) return `qualitaet-chart-${p.id}`
  }
  return 'fundamental-metrik-tabelle'
}

function hatWerte(z: FundamentalMetrikZeile): boolean {
  return Object.values(z.werte).some((v) => v != null && Number.isFinite(v))
}

export function PaFundamentalQualitaetsCharts({
  perioden,
  bewertungPerioden,
  zeilen,
  bewertungZeilen,
}: {
  perioden: FundamentalPeriode[]
  bewertungPerioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  bewertungZeilen: FundamentalMetrikZeile[]
}) {
  return (
    <div className="divide-y divide-[var(--app-border)]">
      {QUALITAET_PANELS.map((panel) => {
        const quelle = panel.variant === 'bewertung' ? bewertungZeilen : zeilen
        const ids = panel.ids.filter((id) => quelle.some((z) => z.id === id && hatWerte(z)))
        if (ids.length === 0) return null
        return (
          <PaFundamentalMetrikChart
            key={panel.id}
            chartId={`qualitaet-chart-${panel.id}`}
            titel={panel.titel}
            kompakt
            eingebettet
            variant={panel.variant}
            perioden={panel.variant === 'bewertung' ? bewertungPerioden : perioden}
            zeilen={quelle}
            aktivIds={new Set(ids)}
            labelsAnzeigen={false}
            onClear={() => undefined}
            onToggleSerie={() => undefined}
            onToggleLabels={() => undefined}
          />
        )
      })}
    </div>
  )
}
