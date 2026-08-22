import type { FundamentaldatenErweitert } from '@/lib/portfolio-analyse/fundamentaldaten-erweitert-types'
import type { FundamentalKeyMetric } from '@/lib/portfolio-analyse/fundamentaldaten-types'

function pctRaw(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '–'
  return `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
}

function mioUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '–'
  return `$${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })} Mio.`
}

/** Ergänzt Key Metrics um SEC-Schuldenfälligkeit, F&E-Aktivierung, Kundenkonzentration. */
export function ergaenzeKeyMetricsAusErweitert(
  metrics: FundamentalKeyMetric[],
  erweitert: FundamentaldatenErweitert | null | undefined,
): FundamentalKeyMetric[] {
  if (!erweitert) return metrics
  const out = [...metrics]
  const debt = erweitert.debtMaturity
  const rd = erweitert.rdKapitalisierung

  if (debt && (debt.due24mMio != null || debt.refiAnteil24mPct != null)) {
    out.push({
      id: 'debt_due_24m',
      label: 'Schulden fällig ≤24M',
      wert:
        debt.due24mMio != null
          ? `${mioUsd(debt.due24mMio)}${debt.refiAnteil24mPct != null ? ` (${debt.refiAnteil24mPct} %)` : ''}`
          : pctRaw(debt.refiAnteil24mPct),
      gruppe: 'kapitalstruktur',
    })
    if (debt.due12mMio != null) {
      out.push({
        id: 'debt_due_12m',
        label: 'Schulden fällig ≤12M',
        wert: mioUsd(debt.due12mMio),
        gruppe: 'kapitalstruktur',
      })
    }
  }

  if (rd && (rd.aktivierungsquotePct != null || rd.kapitalisiertMio != null)) {
    out.push({
      id: 'rd_aktivierung',
      label: 'F&E-Aktivierungsquote',
      wert:
        rd.aktivierungsquotePct != null
          ? pctRaw(rd.aktivierungsquotePct)
          : rd.kapitalisiertMio != null
            ? `aktiviert ${mioUsd(rd.kapitalisiertMio)}`
            : '–',
      gruppe: 'effizienz',
    })
  }

  const kunden = erweitert.secSegmentHistorie?.zusatz?.hauptkunden ?? []
  if (kunden.length > 0) {
    const top3 = kunden.slice(0, 3)
    const sum = Math.round(top3.reduce((s, k) => s + k.anteilPct, 0) * 10) / 10
    out.push({
      id: 'kunden_top3',
      label: 'Umsatzanteil Top-3-Kunden',
      wert: `${sum.toFixed(0)} % (${top3.map((k) => k.name).join(', ')})`,
      gruppe: 'effizienz',
    })
    if (kunden[0]) {
      out.push({
        id: 'kunden_top1',
        label: 'Umsatzanteil Top-Kunde',
        wert: `${kunden[0].anteilPct} % (${kunden[0].name})`,
        gruppe: 'effizienz',
      })
    }
  }

  return out
}
