'use client'

import { PaFundamentalMetrikChart } from '@/components/portfolio-analyse/pa-fundamental-metrik-chart'
import { chartAnalyseSchluessel } from '@/lib/portfolio-analyse/chart-analyse-store'
import { bewerteChartInfoFuerAktie } from '@/lib/portfolio-analyse/fundamental-chart-info-check'
import { lesePersonlichenStorage, schreibePersonlichenStorage } from '@/lib/zugriff-client'
import type {
  FundamentalMetrikZeile,
  FundamentalPeriode,
} from '@/lib/portfolio-analyse/fundamentaldaten-types'
import type { PaInfoHintInhalt } from '@/components/portfolio-analyse/pa-info-hint'

export const QUALITAET_PANELS = [
  {
    id: 'gewinn',
    kurz: 'Gewinne',
    titel: 'Gewinne, Cashflows und Dividenden',
    ids: ['ocf', 'fcf', 'nettogewinn', 'dividenden_gezahlt', 'eps'],
    variant: 'standard' as const,
  },
  {
    id: 'umsatz',
    kurz: 'Umsatz',
    titel: 'Umsatz und Margen',
    ids: ['umsatz', 'bruttomarge', 'ebitda_marge', 'ebit_marge', 'nettomarge'],
    variant: 'standard' as const,
  },
  {
    id: 'guv',
    kurz: 'GuV',
    titel: 'GuV: Umsatz bis Nettogewinn',
    ids: ['umsatz', 'bruttogewinn', 'ebitda', 'ebit', 'nettogewinn'],
    variant: 'standard' as const,
  },
  {
    id: 'kosten',
    kurz: 'Kosten',
    titel: 'Kosten und Reinvestition',
    ids: ['sga', 'rd', 'sbc', 'capex', 'da'],
    variant: 'standard' as const,
  },
  {
    id: 'rendite',
    kurz: 'Renditen',
    titel: 'Renditen (ROE / ROIC)',
    ids: ['roe', 'roi', 'roi_ex_goodwill'],
    variant: 'standard' as const,
  },
  {
    id: 'multiples',
    kurz: 'Bewertung',
    titel: 'Bewertung (Multiples)',
    ids: ['kgv', 'ps', 'pfcf', 'fcf_rendite', 'ev_ebitda', 'pb'],
    variant: 'bewertung' as const,
  },
  {
    id: 'verschuldung',
    kurz: 'Schulden',
    titel: 'Verschuldung und Kapital',
    ids: ['gesamtverschuldung', 'nettoverschuldung', 'bargeld', 'eigenkapital', 'net_debt_ebitda'],
    variant: 'standard' as const,
  },
  {
    id: 'working_capital',
    kurz: 'WC',
    titel: 'Working Capital (Tage)',
    ids: ['dso', 'dio', 'dpo'],
    variant: 'standard' as const,
  },
  {
    id: 'buyback',
    kurz: 'Buybacks',
    titel: 'Aktienrückkäufe und Aktienzahl',
    ids: ['aktienrueckkauf', 'aktien'],
    variant: 'standard' as const,
  },
] as const

export const CHART_WAHL_EIGEN = 'eigen' as const
export type QualitaetPanelId = (typeof QUALITAET_PANELS)[number]['id']
export type FundamentalChartWahlId = QualitaetPanelId | typeof CHART_WAHL_EIGEN

export const QUALITAET_CHART_INFO: Record<FundamentalChartWahlId, PaInfoHintInhalt> = {
  gewinn: {
    schauen:
      'Ob der ausgewiesene Gewinn auch als Cash ankommt: operativer Cashflow, Free Cashflow, Nettogewinn, EPS und Dividenden über die Jahre.',
    gut: 'FCF steigt mit dem Gewinn oder liegt nah dran (hohe Conversion). EPS wächst, ohne dass die Aktienzahl explodiert. Die Dividende wird vom FCF getragen.',
    schlecht:
      'Gewinn läuft, FCF bleibt zurück oder fällt — oft Accruals, Working-Capital-Aufbau oder eine CapEx-Falle. Dividende größer als FCF. EPS nur kosmetisch durch Rückkäufe.',
  },
  umsatz: {
    schauen:
      'Umsatzqualität: wächst das Geschäft, und bleiben Brutto-, EBITDA-, EBIT- und Nettomarge dabei stabil?',
    gut: 'Umsatz wächst bei stabilen oder steigenden Margen — Pricing Power, Mix, Skaleneffekte.',
    schlecht:
      'Umsatz nur mit fallenden Margen (Preisdruck, Rabatte, Mixverschlechterung). Eine dauerhaft bröckelnde Bruttomarge ist das Moat-Warnsignal.',
  },
  guv: {
    schauen:
      'Die GuV-Schichten von oben nach unten: Umsatz → Bruttogewinn → EBITDA → EBIT → Nettogewinn.',
    gut: 'Die unteren Schichten wachsen mindestens so schnell wie der Umsatz (operativer Hebel). Die Abstände zwischen den Linien bleiben nachvollziehbar.',
    schlecht:
      'Umsatz steigt, unten kommt nichts an — Kosten fressen den Hebel. EBIT oder Nettogewinn entkoppeln sich stark vom EBITDA (Zins, Abschreibungen, Einmaleffekte).',
  },
  kosten: {
    schauen:
      'Was das Wachstum kostet: Vertrieb/Verwaltung (SG&A), Forschung, aktienbasierte Vergütung (SBC), CapEx und Abschreibungen.',
    gut: 'Kosten wachsen langsamer als der Umsatz. F&E und CapEx finanzieren Wachstum, ohne den FCF zu zerstören. SBC bleibt im Verhältnis zum FCF klein.',
    schlecht:
      'SG&A oder SBC laufen dem Umsatz davon. CapEx steigt, FCF nicht — Reinvestitionsfalle. Hohe SBC plus Buyback ist oft ein Nullsummenspiel bei der Aktienzahl.',
  },
  rendite: {
    schauen:
      'Kapitalverzinsung: ROE, ROIC und ROIC ohne Goodwill — verdient das Geschäft auf dem eingesetzten Kapital?',
    gut: 'Hoher, stabiler ROIC klar über den Kapitalkosten. ROIC ohne Goodwill bleibt stark: der Moat steckt nicht nur in teuren Übernahmen.',
    schlecht:
      'ROIC fällt über Jahre. ROE ist nur über Schulden hoch. Große Lücke zwischen ROIC und ROIC ohne Goodwill — teure Deals ohne Rendite.',
  },
  multiples: {
    schauen:
      'Was der Markt zahlt: KGV, KUV, Kurs/FCF, FCF-Rendite, EV/EBITDA, KBV — Niveau und die eigene Historie, nicht „billig vs. teuer“ absolut.',
    gut: 'Multiple unter der eigenen Historie oder hohe FCF-Rendite bei gleichbleibender Qualität — Discount, kein kaputtes Geschäft.',
    schlecht:
      'Bewertung am oberen Rand der eigenen Spanne, ohne dass Wachstum oder Margen mitziehen. Sehr niedrige FCF-Rendite bei teurem Multiple.',
  },
  verschuldung: {
    schauen: 'Bilanzpuffer: Gesamt- und Nettoverschuldung, Cash, Eigenkapital, Nettoverschuldung/EBITDA.',
    gut: 'Netto-Cash oder ein niedriges, stabiles Verschuldungsmultiple. Schulden sinken oder wachsen langsamer als EBITDA und FCF.',
    schlecht:
      'Nettoverschuldung steigt schneller als EBITDA. Cash schmilzt. Eigenkapital schrumpft durch Verluste oder Buybacks auf Pump.',
  },
  working_capital: {
    schauen: 'Cash im operativen Kreislauf: DSO (Kunden zahlen), DIO (Lager liegt), DPO (wir zahlen Lieferanten).',
    gut: 'DSO und DIO stabil oder fallend — das Unternehmen zieht Cash. DPO nicht künstlich nach oben getrieben.',
    schlecht:
      'DSO oder DIO steigen (späteres Inkasso, Lagerberg, Channel Stuffing). DPO springt hoch — oft Liquiditätsstress auf Kosten der Lieferanten.',
  },
  buyback: {
    schauen: 'Kapitalrückgabe gegen Verwässerung: Rückkaufvolumen und die ausstehende Aktienzahl.',
    gut: 'Aktienzahl fällt nachhaltig — echte Verknappung. Rückkäufe, wenn das Multiple nicht extrem teuer ist.',
    schlecht:
      'Große Rückkäufe, Aktienzahl trotzdem flach oder steigend (SBC frisst den Buyback). Schrumpfendes Eigenkapital bei steigender Aktienzahl.',
  },
  eigen: {
    schauen:
      'Deine Auswahl aus der Tabelle. Am nützlichsten sind Reihen, die zusammen eine Geschichte erzählen — etwa Umsatz vs. Marge oder FCF vs. Gewinn.',
    gut: 'Die gewählten Reihen bewegen sich so, wie es zum Geschäftsmodell passt: FCF mit dem Gewinn, Marge mit dem Umsatz, Schulden nicht schneller als EBITDA.',
    schlecht:
      'Widersprüche: eine Qualitätsreihe fällt, während eine andere nur kosmetisch steigt. Linke und rechte Achse haben oft unterschiedliche Einheiten — nicht 1:1 vergleichen.',
  },
}

export const CHART_WAHL_OPTIONEN: { id: FundamentalChartWahlId; kurz: string; titel: string }[] = [
  ...QUALITAET_PANELS.map((p) => ({ id: p.id as FundamentalChartWahlId, kurz: p.kurz, titel: p.titel })),
  { id: CHART_WAHL_EIGEN, kurz: 'Eigene', titel: 'Eigene Auswahl' },
]

const CHART_WAHL_STORAGE = 'pa-fundamental-sichtbare-charts-v1'

export function alleChartWahlIds(): FundamentalChartWahlId[] {
  return CHART_WAHL_OPTIONEN.map((o) => o.id)
}

export function leseSichtbareCharts(): Set<FundamentalChartWahlId> {
  const alle = alleChartWahlIds()
  const raw = lesePersonlichenStorage(CHART_WAHL_STORAGE)
  if (!raw) return new Set(alle)
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set(alle)
    const erlaubt = new Set<string>(alle)
    const ids = parsed.filter((id): id is FundamentalChartWahlId => typeof id === 'string' && erlaubt.has(id))
    return new Set(ids)
  } catch {
    return new Set(alle)
  }
}

export function schreibeSichtbareCharts(ids: Set<FundamentalChartWahlId>): void {
  schreibePersonlichenStorage(CHART_WAHL_STORAGE, JSON.stringify([...ids]))
}

export function qualitaetPanelIdFuerZeile(zeileId: string): string {
  for (const p of QUALITAET_PANELS) {
    if ((p.ids as readonly string[]).includes(zeileId)) return `qualitaet-chart-${p.id}`
  }
  return 'fundamental-metrik-tabelle'
}

export function qualitaetPanelWahlIdFuerZeile(zeileId: string): QualitaetPanelId | null {
  for (const p of QUALITAET_PANELS) {
    if ((p.ids as readonly string[]).includes(zeileId)) return p.id
  }
  return null
}

function hatWerte(z: FundamentalMetrikZeile): boolean {
  return Object.values(z.werte).some((v) => v != null && Number.isFinite(v))
}

export function PaFundamentalChartWahl({
  sichtbar,
  onToggle,
  onAlle,
}: {
  sichtbar: Set<string>
  onToggle: (id: FundamentalChartWahlId) => void
  onAlle: () => void
}) {
  const alleAn = CHART_WAHL_OPTIONEN.every((o) => sichtbar.has(o.id))
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--app-text-muted)]">Charts</span>
      <div className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-[var(--app-border-strong)] bg-[var(--app-bg)] p-0.5">
        {CHART_WAHL_OPTIONEN.map((o) => {
          const an = sichtbar.has(o.id)
          return (
            <button
              key={o.id}
              type="button"
              title={an ? `${o.titel} ausblenden` : `${o.titel} einblenden`}
              aria-pressed={an}
              onClick={() => onToggle(o.id)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                an
                  ? 'bg-sky-600/90 text-white'
                  : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              {o.kurz}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={onAlle}
        className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
          alleAn ? 'text-[var(--app-text-muted)]' : 'text-sky-300/90 hover:text-sky-200'
        }`}
        disabled={alleAn}
        title="Alle Charts einblenden"
      >
        Alle
      </button>
    </div>
  )
}

export function PaFundamentalQualitaetsCharts({
  perioden,
  bewertungPerioden,
  zeilen,
  bewertungZeilen,
  ticker,
  sichtbarIds,
}: {
  perioden: FundamentalPeriode[]
  bewertungPerioden: FundamentalPeriode[]
  zeilen: FundamentalMetrikZeile[]
  bewertungZeilen: FundamentalMetrikZeile[]
  ticker?: string
  sichtbarIds?: Set<string>
}) {
  const panels = QUALITAET_PANELS.filter((p) => !sichtbarIds || sichtbarIds.has(p.id))
  if (panels.length === 0) return null
  return (
    <div className="divide-y divide-[var(--app-border)]">
      {panels.map((panel) => {
        const quelle = panel.variant === 'bewertung' ? bewertungZeilen : zeilen
        const periodenPanel = panel.variant === 'bewertung' ? bewertungPerioden : perioden
        const ids = panel.ids.filter((id) => quelle.some((z) => z.id === id && hatWerte(z)))
        if (ids.length === 0) return null
        const basis = QUALITAET_CHART_INFO[panel.id]
        const info: PaInfoHintInhalt = {
          ...basis,
          urteil: bewerteChartInfoFuerAktie(panel.id, quelle, periodenPanel),
        }
        return (
          <PaFundamentalMetrikChart
            key={panel.id}
            chartId={`qualitaet-chart-${panel.id}`}
            titel={panel.titel}
            kompakt
            eingebettet
            variant={panel.variant}
            perioden={periodenPanel}
            zeilen={quelle}
            aktivIds={new Set(ids)}
            labelsAnzeigen={false}
            onClear={() => undefined}
            onToggleSerie={() => undefined}
            onToggleLabels={() => undefined}
            analyseSchluessel={ticker ? chartAnalyseSchluessel(ticker, `qualitaet-${panel.id}`) : undefined}
            analyseTitel={ticker ? `${ticker} · ${panel.titel}` : panel.titel}
            info={info}
          />
        )
      })}
    </div>
  )
}
