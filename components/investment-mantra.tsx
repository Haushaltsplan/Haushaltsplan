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

export function InvestmentMantra() {
  const [open, setOpen] = useState(false)

  return (
    <section className="rounded-[2.5rem] border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/35 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400/90">Investmentmantra</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-100">Kennzahlen-Check</h2>
          <p className="mt-2 text-xs text-slate-500">
            Kategorie, Kennzahl, Zielwert/Benchmark und Forensic Check auf einen Blick.
          </p>
        </div>
        <CollapsiblePillButton
          open={open}
          onClick={() => setOpen((v) => !v)}
          labels={LABEL_ZUKLAPPEN}
          tone="emerald"
          aria-expanded={open}
        />
      </div>

      <CollapsibleAnimatedBody open={open} className="mt-5">
        <div className="hidden overflow-x-auto pb-0.5 md:block">
            <table className="min-w-full divide-y divide-slate-800 text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2 font-semibold">Kategorie</th>
                  <th className="px-3 py-2 font-semibold">Kennzahl</th>
                  <th className="px-3 py-2 font-semibold">Zielwert / Benchmark</th>
                  <th className="px-3 py-2 font-semibold">Funktion des Burggrabens &amp; Forensic Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {INVESTMENT_MANTRA.map((item) => (
                  <tr key={item.kennzahl} className="align-top">
                    <td className="px-3 py-3 text-xs font-semibold text-emerald-200/95">{item.kategorie}</td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-100">{item.kennzahl}</td>
                    <td className="px-3 py-3 text-sm font-bold text-emerald-200">{item.zielwert}</td>
                    <td className="px-3 py-3 text-xs leading-relaxed text-slate-300">{item.funktion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>

        <div className="mt-4 grid gap-3 md:hidden">
            {INVESTMENT_MANTRA.map((item) => (
              <article key={item.kennzahl} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-300/90">{item.kategorie}</p>
                <p className="mt-1 text-sm font-bold text-slate-100">{item.kennzahl}</p>
                <p className="mt-1 text-xs font-semibold text-emerald-200">Ziel: {item.zielwert}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{item.funktion}</p>
              </article>
            ))}
        </div>
      </CollapsibleAnimatedBody>
    </section>
  )
}
