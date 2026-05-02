'use client'

import { useState } from 'react'
import { CollapsibleAnimatedBody, CollapsiblePillButton, LABEL_ZUKLAPPEN } from '@/components/collapsible-ui'

const INVESTMENT_MANTRA = [
  {
    kategorie: 'Rentabilität',
    kennzahl: 'ROIC (LTM)',
    zielwert: '≥15%',
    funktion:
      'Kapitaleffizienz: Muss inkl. Goodwill gerechnet werden, um Akquisitionsdisziplin zu prüfen.',
  },
  {
    kategorie: 'Rentabilität',
    kennzahl: 'Value Spread',
    zielwert: '≥5%',
    funktion:
      'Wertschöpfung: Differenz zwischen ROIC und WACC. Ein schrumpfender Spread bei steigendem Umsatz ist ein Warnsignal.',
  },
  {
    kategorie: 'Rentabilität',
    kennzahl: 'Incremental ROIC',
    zielwert: '≥15%',
    funktion:
      'Zinseszins-Motor: Die Rendite auf jeden neu investierten Euro. Die wichtigste Kennzahl für zukünftige Compounder.',
  },
  {
    kategorie: 'Rentabilität',
    kennzahl: 'Gross Margin',
    zielwert: '≥40%',
    funktion: 'Preismacht: Muss über 5-10 Jahre stabil sein. Sinkende Margen deuten auf Commodity-Status hin.',
  },
  {
    kategorie: 'Rentabilität',
    kennzahl: 'SBC-adj. FCF Margin',
    zielwert: '≥10%',
    funktion: 'Wahre Cash-Generierung: FCF abzüglich Stock-Based Compensation (SBC). SBC ist eine echte Ausgabe!',
  },
  {
    kategorie: 'Wachstum',
    kennzahl: 'Organic Rev. CAGR',
    zielwert: '≥7%',
    funktion: 'Strukturelle Nachfrage: Bereinigt um Währungseffekte und Akquisitionen. Wahres Kundeninteresse.',
  },
  {
    kategorie: 'Wachstum',
    kennzahl: 'EPS CAGR (diluted)',
    zielwert: '≥10%',
    funktion: 'Skalierbarkeit: Muss schneller wachsen als der Umsatz (Operating Leverage).',
  },
  {
    kategorie: 'Cashflow',
    kennzahl: 'Cash Conversion Cycle',
    zielwert: 'Stabil / sinkend',
    funktion:
      'Operative Exzellenz: Wie lange ist Kapital in Vorräten gebunden? Steigende Tage sind oft ein Vorbote für Absatzprobleme.',
  },
  {
    kategorie: 'Cashflow',
    kennzahl: 'FCF Conversion',
    zielwert: '>90%',
    funktion:
      'Buchhaltungsqualität: Vergleich von Net Income zu FCF. Divergenzen deuten auf aggressive Buchhaltung hin.',
  },
  {
    kategorie: 'Effizienz',
    kennzahl: 'Capex / Sales',
    zielwert: '<5%',
    funktion: 'Asset Light: Unternehmen sollte ohne massive Reinvestitionen in Sachanlagen wachsen können.',
  },
  {
    kategorie: 'Effizienz',
    kennzahl: 'SBC / FCF',
    zielwert: '<15%',
    funktion:
      'Verwässerungs-Check: Wie viel des generierten Cashflows wird an Mitarbeiter (statt Aktionäre) verteilt?',
  },
  {
    kategorie: 'Sicherheit',
    kennzahl: 'Net Debt / EBITDA',
    zielwert: '<2,0×',
    funktion: 'Krisenfestigkeit: In einem Hochzinsumfeld ist eine saubere Bilanz die ultimative Versicherung.',
  },
  {
    kategorie: 'Sicherheit',
    kennzahl: 'Interest Coverage',
    zielwert: '>10×',
    funktion: 'Finanzielle Härte: Schutz gegen steigende Refinanzierungskosten.',
  },
  {
    kategorie: 'Kapitalpolitik',
    kennzahl: 'Buyback Yield',
    zielwert: 'Positiv',
    funktion:
      'Aktionärsfokus: Sinkende Aktienanzahl bei gleichzeitig hohem ROIC ist der "Double Whammy" für die Rendite.',
  },
] as const

export function InvestmentMantra({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(false)

  const shell = embedded ? 'space-y-3' : 'rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4'

  return (
    <section className={shell}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Mantra</p>
          <h2 className={`font-semibold tracking-tight text-white ${embedded ? 'text-base' : 'text-lg'}`}>
            Kennzahlen-Check
          </h2>
        </div>
        <CollapsiblePillButton
          open={open}
          onClick={() => setOpen((v) => !v)}
          labels={LABEL_ZUKLAPPEN}
          compact
          surface="glass"
          aria-expanded={open}
        />
      </div>

      <CollapsibleAnimatedBody open={open} className="mt-3">
        <div className="hidden overflow-x-auto pb-0.5 md:block">
          <table className="min-w-full divide-y divide-zinc-800/90 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-zinc-400">
                <th className="px-3 py-2 font-semibold">Kategorie</th>
                <th className="px-3 py-2 font-semibold">Kennzahl</th>
                <th className="px-3 py-2 font-semibold">Ziel</th>
                <th className="px-3 py-2 font-semibold">Erklärung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {INVESTMENT_MANTRA.map((item) => (
                <tr key={item.kennzahl} className="align-top">
                  <td className="px-3 py-2.5 text-xs font-medium text-zinc-400">{item.kategorie}</td>
                  <td className="px-3 py-2.5 font-medium text-white">{item.kennzahl}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-teal-400">{item.zielwert}</td>
                  <td className="max-w-xl px-3 py-2.5 leading-relaxed text-zinc-300">{item.funktion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 md:hidden">
          {INVESTMENT_MANTRA.map((item) => (
            <article key={item.kennzahl} className="rounded-xl border border-zinc-800/90 bg-zinc-950/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{item.kategorie}</p>
              <p className="mt-1 text-sm font-medium text-white">{item.kennzahl}</p>
              <p className="mt-1 text-sm font-semibold text-teal-400">{item.zielwert}</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{item.funktion}</p>
            </article>
          ))}
        </div>
      </CollapsibleAnimatedBody>
    </section>
  )
}
