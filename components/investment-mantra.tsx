'use client'

import { useState } from 'react'
import { CollapsibleAnimatedBody, CollapsiblePillButton, LABEL_ZUKLAPPEN } from '@/components/collapsible-ui'

type MantraZeile = {
  kategorie: string
  kennzahl: string
  zielwert: string
  funktion: string
}

const INVESTMENT_MANTRA: readonly MantraZeile[] = [
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
]

const SEKTOR_MANTRAS: readonly {
  id: string
  title: string
  intro: string
  zeilen: readonly MantraZeile[]
}[] = [
  {
    id: 'software-saas',
    title: 'Software & SaaS (Asset Light / High Growth)',
    intro:
      'Hier liegt der Fokus auf der Unit Economics und der Vorhersehbarkeit der Cashflows.',
    zeilen: [
      {
        kategorie: 'Rentabilität',
        kennzahl: 'Rule of 40',
        zielwert: '≥40%',
        funktion:
          'Wachstums-Effizienz: Summe aus Umsatzwachstum und FCF-Marge. Zeigt, ob Wachstum gesund erkauft wird.',
      },
      {
        kategorie: 'Rentabilität',
        kennzahl: 'Gross Margin',
        zielwert: '≥70%',
        funktion:
          'Skalierbarkeit: Software hat Grenzkosten von nahezu Null. Niedrigere Margen deuten auf hohen Service-Anteil hin.',
      },
      {
        kategorie: 'Effizienz',
        kennzahl: 'Net Revenue Retention (NRR)',
        zielwert: '>110%',
        funktion:
          'Produkt-Sticky: Wie stark wachsen Bestandskunden? Ein Wert >100% bedeutet organisches Wachstum ohne Neukunden.',
      },
      {
        kategorie: 'Effizienz',
        kennzahl: 'Magic Number',
        zielwert: '>0,7',
        funktion:
          'S&M-Effizienz: Verhältnis von neuem ARR zu den Vertriebskosten. Misst die Effektivität des Sales-Teams.',
      },
      {
        kategorie: 'Wachstum',
        kennzahl: 'RPO Growth (Remaining Performance Obligation)',
        zielwert: '> Umsatzwachstum',
        funktion:
          'Zukunftsblick: Vertraglich zugesicherte, aber noch nicht abgerechnete Umsätze. Der beste Frühindikator.',
      },
      {
        kategorie: 'Cashflow',
        kennzahl: 'FCF Conversion (SBC-adj.)',
        zielwert: '>80%',
        funktion:
          'Qualität: Wie viel vom operativen Cashflow bleibt nach Abzug der aktienbasierten Vergütung wirklich übrig?',
      },
      {
        kategorie: 'Effizienz',
        kennzahl: 'CAC Payback Period',
        zielwert: '<18 Monate',
        funktion:
          'Amortisation: Wie lange dauert es, bis die Kosten für die Gewinnung eines Kunden durch dessen Deckungsbeitrag gedeckt sind?',
      },
      {
        kategorie: 'Sicherheit',
        kennzahl: 'Net Cash Position',
        zielwert: 'Positiv',
        funktion:
          'Unabhängigkeit: Quality-Softwarefirmen sollten Cash-positiv sein, um Akquisitionen ohne Verwässerung zu tätigen.',
      },
      {
        kategorie: 'Kapitalpolitik',
        kennzahl: 'SBC / FCF',
        zielwert: '<20%',
        funktion:
          'Verwässerungsschutz: Verhindert, dass das Management den Aktionärswert durch übermäßige Aktienoptionen auffrisst.',
      },
    ],
  },
  {
    id: 'industrials',
    title: 'Industrials & Engineering (Manufacturing / High Capex)',
    intro:
      'Hier zählen operative Exzellenz, Zyklus-Management und die Rendite auf investiertes Sachkapital.',
    zeilen: [
      {
        kategorie: 'Rentabilität',
        kennzahl: 'ROIC (WACC-adj.)',
        zielwert: 'Spread ≥5%',
        funktion:
          'Kapitaleffizienz: In kapitalintensiven Branchen ist der Spread zum WACC die einzige Wahrheit für Wertschöpfung.',
      },
      {
        kategorie: 'Rentabilität',
        kennzahl: 'Operating Margin',
        zielwert: 'Stabil über Zyklus',
        funktion:
          'Resilienz: Ein Einbruch in der Rezession ist normal, aber das Unternehmen muss profitabel bleiben.',
      },
      {
        kategorie: 'Wachstum',
        kennzahl: 'Book-to-Bill Ratio',
        zielwert: '>1,05',
        funktion:
          'Auftragsdynamik: Liegt der Auftragseingang über dem aktuellen Umsatz, ist die Pipeline für das Folgejahr gefüllt.',
      },
      {
        kategorie: 'Effizienz',
        kennzahl: 'Maintenance Capex / Sales',
        zielwert: '<3%',
        funktion:
          'Substanzerhalt: Wie viel muss investiert werden, nur um den Status Quo zu halten? Je weniger, desto besser.',
      },
      {
        kategorie: 'Effizienz',
        kennzahl: 'Asset Turnover',
        zielwert: '>1,2×',
        funktion:
          'Umschlagsgeschwindigkeit: Wie oft wird die Bilanzsumme pro Jahr durch den Umsatz „gedreht“?',
      },
      {
        kategorie: 'Cashflow',
        kennzahl: 'Cash Conversion Cycle',
        zielwert: 'Sinkend',
        funktion:
          'Working Capital: Effizientes Management von Vorräten und Forderungen setzt Cash frei.',
      },
      {
        kategorie: 'Wachstum',
        kennzahl: 'Incremental Margins',
        zielwert: '> Rohmarge',
        funktion:
          'Skaleneffekte: Jedes zusätzliche Stück sollte eine höhere Marge abwerfen als der Durchschnitt (Operating Leverage).',
      },
      {
        kategorie: 'Sicherheit',
        kennzahl: 'Interest Coverage',
        zielwert: '>8×',
        funktion:
          'Finanzielle Härte: Schutz vor steigenden Zinsen bei oft hohem Verschuldungsgrad für Fabriken.',
      },
      {
        kategorie: 'Kapitalpolitik',
        kennzahl: 'Dividend Payout',
        zielwert: '30% – 50%',
        funktion:
          'Disziplin: Eine moderate Ausschüttung lässt Raum für Reinvestitionen und sichert die Dividende im Abschwung.',
      },
    ],
  },
  {
    id: 'financial-services',
    title: 'Financial Services (Banks & Insurance)',
    intro:
      'Klassische Cashflow-Metriken versagen hier. Wir schauen auf Eigenkapitalrendite und Risikomanagement.',
    zeilen: [
      {
        kategorie: 'Rentabilität',
        kennzahl: 'ROE (Return on Equity)',
        zielwert: '≥15%',
        funktion:
          'Kernrendite: Da Banken hoch gehebelt sind, ist die Eigenkapitalrendite die entscheidende Vergleichsgröße.',
      },
      {
        kategorie: 'Rentabilität',
        kennzahl: 'Net Interest Margin (NIM)',
        zielwert: '>2%',
        funktion:
          'Zinsmarge: Die Differenz zwischen Aktiv- und Passivseite. Zeigt die Wettbewerbsposition im Kreditmarkt.',
      },
      {
        kategorie: 'Effizienz',
        kennzahl: 'Cost-to-Income Ratio',
        zielwert: '<55%',
        funktion:
          'Operative Schlankheit: Banken sind heute IT-Unternehmen. Hohe Quoten deuten auf veraltete Prozesse hin.',
      },
      {
        kategorie: 'Sicherheit',
        kennzahl: 'CET1 Ratio',
        zielwert: '>14%',
        funktion:
          'Puffer: Hartes Kernkapital zur Deckung von Verlusten. Höher als regulatorisch gefordert signalisiert „Quality“.',
      },
      {
        kategorie: 'Qualität',
        kennzahl: 'NPL Ratio (Non-Performing Loans)',
        zielwert: '<1,5%',
        funktion:
          'Risikodisziplin: Anteil der Kredite, die mehr als 90 Tage überfällig sind. Das „Giftdepot“ der Bilanz.',
      },
      {
        kategorie: 'Wachstum',
        kennzahl: 'Loan Growth (adj.)',
        zielwert: '4% – 8%',
        funktion:
          'Marktanteil: Muss organisch wachsen, ohne dass die Kreditstandards (Underwriting) aufgeweicht werden.',
      },
      {
        kategorie: 'Kapitalpolitik',
        kennzahl: 'Total Payout (Div + Buyback)',
        zielwert: '>60%',
        funktion:
          'Kapitalrückführung: Wenn die Bank vollkapitalisiert ist, muss der Überschuss an die Eigentümer zurückfließen.',
      },
      {
        kategorie: 'Bewertung',
        kennzahl: 'P/TBV (Price / Tang. Book Value)',
        zielwert: '<1,5×',
        funktion:
          'Sicherheitsmarge: Man möchte für die reine Substanz (ohne Goodwill) nicht zu viel bezahlen.',
      },
    ],
  },
  {
    id: 'healthcare',
    title: 'Healthcare & Pharma (R&D Driven)',
    intro:
      'Wachstum wird hier durch Patente und Forschungspipelines generiert, nicht nur durch Marketing.',
    zeilen: [
      {
        kategorie: 'Rentabilität',
        kennzahl: 'EBITDA Marge',
        zielwert: '>30%',
        funktion:
          'Cash-Power: Hohe Margen sind nötig, um die immensen R&D-Kosten für die nächste Generation zu finanzieren.',
      },
      {
        kategorie: 'Wachstum',
        kennzahl: 'R&D / Sales',
        zielwert: '15% – 25%',
        funktion:
          'Innovationsmotor: Wer zu wenig forscht, stirbt nach dem Patentablauf (Patent Cliff).',
      },
      {
        kategorie: 'Qualität',
        kennzahl: 'Pipeline Replacement Ratio',
        zielwert: '>1,0',
        funktion:
          'Zukunftssicherung: Ersetzt der Wert der neuen Phase-II/III-Projekte den Umsatz der auslaufenden Patente?',
      },
      {
        kategorie: 'Sicherheit',
        kennzahl: 'Net Debt / EBITDA',
        zielwert: '<1,5×',
        funktion:
          'Finanzkraft: Erlaubt „Bolt-on“-Akquisitionen von kleinen Biotech-Firmen zur Ergänzung des Portfolios.',
      },
      {
        kategorie: 'Effizienz',
        kennzahl: 'SG&A / Sales',
        zielwert: '<25%',
        funktion:
          'Fokus: Ein Qualitätsunternehmen sollte mehr in Forschung als in Verwaltung investieren.',
      },
      {
        kategorie: 'Cashflow',
        kennzahl: 'FCF Marge',
        zielwert: '>20%',
        funktion:
          'Echte Rendite: Hohe Cashflows sind typisch für etablierte Pharma-Werte mit starken Blockbustern.',
      },
      {
        kategorie: 'Wachstum',
        kennzahl: 'Organisches Umsatzwachstum',
        zielwert: '≥5%',
        funktion:
          'Nachfrage: Zeigt, ob das aktuelle Portfolio noch wächst oder nur noch durch Preiserhöhungen lebt.',
      },
    ],
  },
  {
    id: 'reits',
    title: 'REITs & Real Estate (Asset Heavy / Yield)',
    intro:
      'Hier ist der „Gewinn“ (Net Income) durch hohe Abschreibungen wertlos. Wir nutzen FFO (Funds From Operations).',
    zeilen: [
      {
        kategorie: 'Rentabilität',
        kennzahl: 'AFFO Yield',
        zielwert: '>5%',
        funktion:
          'Echte Rendite: Adjusted Funds From Operations (FFO abzüglich Instandhaltung). Die Basis für die Dividende.',
      },
      {
        kategorie: 'Wachstum',
        kennzahl: 'AFFO per Share CAGR',
        zielwert: '≥4%',
        funktion:
          'Wachstum: Zeigt, ob der REIT pro Aktie wächst oder nur durch Ausgabe neuer Aktien (Verwässerung) expandiert.',
      },
      {
        kategorie: 'Effizienz',
        kennzahl: 'Occupancy Rate',
        zielwert: '>95%',
        funktion:
          'Auslastung: Leerstand ist die teuerste Komponente im Immobilienbereich.',
      },
      {
        kategorie: 'Effizienz',
        kennzahl: 'Same-Store NOI Growth',
        zielwert: '>2%',
        funktion:
          'Mietmacht: Wachstum der Mieteinnahmen auf bestehender Fläche (Inflationsschutz).',
      },
      {
        kategorie: 'Sicherheit',
        kennzahl: 'Net Debt / EBITDAre',
        zielwert: '<6,0×',
        funktion:
          'Leverage: REITs sind immer verschuldet, aber die Last muss im Verhältnis zum operativen Cashflow tragbar sein.',
      },
      {
        kategorie: 'Sicherheit',
        kennzahl: 'Weighted Avg. Debt Maturity',
        zielwert: '>5 Jahre',
        funktion:
          'Refinanzierung: Lange Laufzeiten schützen vor plötzlichen Zinssprüngen am Kapitalmarkt.',
      },
      {
        kategorie: 'Kapitalpolitik',
        kennzahl: 'AFFO Payout Ratio',
        zielwert: '<90%',
        funktion:
          'Sicherheitspolster: Ein REIT sollte nicht seinen gesamten Cashflow ausschütten, um Reserven für Sanierungen zu haben.',
      },
    ],
  },
]

function MantraTabellenBlock({
  zeilen,
  rowKeyPrefix,
}: {
  zeilen: readonly MantraZeile[]
  rowKeyPrefix: string
}) {
  return (
    <>
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
            {zeilen.map((item, i) => (
              <tr key={`${rowKeyPrefix}-${i}-${item.kennzahl}`} className="align-top">
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
        {zeilen.map((item, i) => (
          <article
            key={`${rowKeyPrefix}-m-${i}-${item.kennzahl}`}
            className="rounded-xl border border-zinc-800/90 bg-zinc-950/40 px-4 py-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{item.kategorie}</p>
            <p className="mt-1 text-sm font-medium text-white">{item.kennzahl}</p>
            <p className="mt-1 text-sm font-semibold text-teal-400">{item.zielwert}</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{item.funktion}</p>
          </article>
        ))}
      </div>
    </>
  )
}

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
          aria-expanded={open}
        />
      </div>

      <CollapsibleAnimatedBody open={open} className="mt-3">
        <div className="space-y-10">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-white">Standard-Mantra (Quality Compounding)</h3>
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">
              Universelle Benchmarks für langfristige Qualitäts-Investments — unabhängig von der Branche.
            </p>
            <div className="mt-4">
              <MantraTabellenBlock zeilen={INVESTMENT_MANTRA} rowKeyPrefix="standard" />
            </div>
          </div>

          {SEKTOR_MANTRAS.map((block) => (
            <div key={block.id}>
              <h3 className="text-sm font-semibold tracking-tight text-white">{block.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">{block.intro}</p>
              <div className="mt-4">
                <MantraTabellenBlock zeilen={block.zeilen} rowKeyPrefix={block.id} />
              </div>
            </div>
          ))}
        </div>
      </CollapsibleAnimatedBody>
    </section>
  )
}
