import type { PaInfoHintInhalt } from '@/components/portfolio-analyse/pa-info-hint'

/** Erklärungen für DCF-Rechner (PaInfoHint „i“ — wie bei den Qualitäts-Charts). */
export const DCF_INFO = {
  fairValue: {
    schauen:
      'Der modellierte Wert einer Aktie heute: abgezinster Free Cashflow der High-Growth-Phase plus abgezinster Terminal Value, minus Net Debt und Minorities, geteilt durch die Aktienzahl am Horizont.',
    gut: 'Fair Value klar über dem Kurs bei konservativen Annahmen (niedrigeres g, höherer WACC, spürbare MoS) — Margin of Safety, kein Optimismus-Modell.',
    schlecht:
      'Fair Value nur mit aggressivem Wachstum oder sehr niedrigem WACC über dem Kurs. Sehr hoher TV-Anteil (>80 %) heißt: fast alles hängt am ewig wachsenden Endwert.',
  },
  kurs: {
    schauen: 'Aktueller Börsenkurs (Yahoo) — Vergleichsmaßstab für Upside/Downside und Reverse-DCF.',
    gut: 'Kurs deutlich unter Fair Value und Buy-Price (nach MoS) — der Markt preist weniger Wachstum ein als dein Base Case.',
    schlecht: 'Kurs nahe oder über Fair Value: wenig Polster. Reverse-DCF zeigt dann oft ein hohes implizites Wachstum.',
  },
  fcfBasis: {
    schauen:
      'Reported Free Cashflow als Ausgangspunkt (OCF − CapEx), bevorzugt TTM, sonst letztes Geschäftsjahr. Das ist der Cashflow, den das Modell Jahr für Jahr wachsen lässt.',
    gut: 'Stabiler, positiver FCF, der zum Gewinn passt (hohe Conversion). Basis nicht durch Einmaleffekte aufgeblasen.',
    schlecht:
      'Negativer oder extrem schwankender FCF. Einmalige Working-Capital-Effekte oder CapEx-Löcher verzerren die Basis — dann manuell überschreiben.',
  },
  netDebt: {
    schauen:
      'Nettoverschuldung = verzinsliche Schulden − Cash. Wird vom Enterprise Value abgezogen (bzw. Netto-Cash addiert), um zum Equity Value zu kommen.',
    gut: 'Netto-Cash oder moderate Net Debt — der Eigenkapitalwert liegt nah am EV.',
    schlecht:
      'Sehr hohe Net Debt frisst den Equity Value. Minorities/Leases fehlen oft in der Auto-Zahl — bei Bedarf überschreiben.',
  },
  wacc: {
    schauen:
      'Gewichtete Kapitalkosten: Diskontierungssatz für alle künftigen FCFs. CAPM-Default aus Beta, risikofreiem Zins (~4,5 %) und Equity Risk Premium (~5,5 %), plus Debt-Anteil nach Steuern.',
    gut: 'WACC plausibel zur Geschäftsqualität (Quality Compounder oft 7–9 %). Leicht höherer WACC = konservativer Fair Value.',
    schlecht:
      'Zu niedriger WACC (z. B. <6 %) bläht den Wert auf. WACC ≤ Terminal-g macht Gordon Growth mathematisch ungültig.',
  },
  shares: {
    schauen:
      'Ausstehende Aktien heute. Zusammen mit Share-Count-CAGR ergibt sich die Nenner-Aktienzahl am Ende der Prognose.',
    gut: 'Stabile oder sinkende Aktienzahl (Buybacks) — mehr Wert je Aktie.',
    schlecht: 'Starke Verwässerung (SBC, Emissionen) ohne entsprechenden FCF-Anstieg — Fair Value je Aktie sinkt.',
  },
  szenario: {
    schauen:
      'Voreinstellungen relativ zum Base Case aus den Paket-Defaults: Bear dämpft Wachstum und erhöht den WACC, Bull umgekehrt.',
    gut: 'Base Case mit Consensus-nahen Annahmen; Bear/Bull nur als Spannweite, nicht als Wunschdenken.',
    schlecht: 'Nur Bull anschauen und kaufen — Ignorieren des Bear Case ist der häufigste Selbstbetrug beim DCF.',
  },
  prognosejahre: {
    schauen:
      'Länge der expliziten High-Growth-Phase (Jahre 1…n), in der FCF diskret prognostiziert und einzeln abgezinst wird.',
    gut: '5–10 Jahre passend zum Sichtbarkeitshorizont. Qualität mit vorhersehbarem Cash oft 7–10J.',
    schlecht:
      'Sehr lange High-Growth-Phase mit hohem konstantem g ohne Fade — überschätzt den Endwert systematisch.',
  },
  gStart: {
    schauen:
      'Start-Wachstumsrate des FCF in der High-Growth-Phase. Default aus Forward-Consensus (FCF-Forecast, sonst Umsatz-/EPS-Wachstum) — nicht aus historischem 5J-CAGR.',
    gut: 'g nahe am Consensus und unter dem, was Reverse-DCF impliziert — du forderst weniger als der Markt einpreist.',
    schlecht:
      'g weit über Consensus ohne These. Oder g aus Restjahr FY0≈TTM (~1–2 %) — das ist kein sinnvolles Mehrjahres-Wachstum.',
  },
  fade: {
    schauen:
      'Linearer Übergang: g₁ = Start-Wachstum, gₙ = Terminalwachstum. Ohne Fade bleibt g über alle Prognosejahre konstant auf dem Startwert.',
    gut: 'Fade an bei hohen Start-g — verhindert ewiges Hyperwachstum bis Jahr 10.',
    schlecht: 'Fade aus + hohes g über 10 Jahre + Gordon mit niedrigem WACC = klassische Überbewertungsfalle.',
  },
  gTerminal: {
    schauen:
      'Langfristiges Wachstumsrate nach der expliziten Phase (und Fade-Ziel). Bei Gordon: TV = FCFₙ×(1+g)/(WACC−g). Muss unter dem WACC liegen.',
    gut: 'gTerminal nahe nominalem BIP/Inflation (ca. 2–3 %). Konservativ eher 2–2,5 %.',
    schlecht: 'gTerminal ≥ 4–5 % oder nahe am WACC — Terminal Value explodiert, Modell wird unbrauchbar.',
  },
  terminalMethode: {
    schauen:
      'Wie der Restwert nach Jahr n berechnet wird: Gordon (ewiges Wachstum) oder Exit Multiple (FCFₙ × Multiple, z. B. historisches Kurs/FCF).',
    gut: 'Gordon mit bescheidenem gTerminal — oder Exit Multiple nahe der eigenen Historie / Peer-Median.',
    schlecht:
      'Exit Multiple weit über der Historie „weil Qualität“. Oder Gordon mit g zu nah am WACC.',
  },
  exitMultiple: {
    schauen: 'TV = FCF im letzten Prognosejahr × Exit-Multiple. Typisch orientiert an historischem MC/FCF oder Peer-Gruppe.',
    gut: 'Multiple am unteren Rand der eigenen 5–10J-Spanne oder leicht unter Peer-Median.',
    schlecht: 'Multiple am Peak der Historie als „Exit“ — du verkaufst im Modell zum Höchstpreis.',
  },
  mos: {
    schauen:
      'Margin of Safety: Buy-Price = Fair Value × (1 − MoS). Puffer gegen falsche Annahmen, nicht gegen Kursvolatilität allein.',
    gut: '15–30 % MoS bei Quality; mehr bei unsicherem Wachstum oder hohem TV-Anteil.',
    schlecht: 'MoS 0 % und trotzdem kaufen — jedes Modell-Irrtum landet voll im Verlust.',
  },
  shareCagr: {
    schauen:
      'Jährliche Änderung der Aktienzahl über den Horizont. Wirkt nur auf den Nenner (FV/Aktie), nicht auf den Aggregat-FCF.',
    gut: 'Negativer CAGR (Buybacks) erhöht FV/Aktie. Leicht positiv bei SBC ist oft realistisch.',
    schlecht: 'Starke positive Verwässerung ignorieren — sonst ist FV/Aktie zu hoch.',
  },
  minorities: {
    schauen:
      'Minderheitenanteile / Non-controlling Interest: Anspruch Dritter am Enterprise Value, wird vom Equity Value abgezogen. Default 0 (oft nicht im Paket).',
    gut: 'Bekannte NCI aus dem Geschäftsbericht eintragen — sonst überschätzt du den Anteil der Stammaktionäre.',
    schlecht: 'Große Minderheiten (JVs, Tochtergesellschaften) bei 0 lassen — Equity Value zu hoch.',
  },
  fcfOverride: {
    schauen: 'Manuelle FCF-Basis, falls TTM/GJ durch Einmaleffekte verzerrt ist (z. B. normalisierter Owner-Earnings-Näherungswert).',
    gut: 'Nur anpassen, wenn du die Verzerrung belegen kannst (Einmal-CapEx, Litigation, WC-Spike).',
    schlecht: 'Basis hochsetzen „weil nächstes Jahr besser wird“ — das gehört ins Wachstum g, nicht in die Basis.',
  },
  zwischenschritte: {
    schauen:
      'Jahr-für-Jahr: FCF, Abzinsungsfaktor, PV. Summe der PVs + PV(Terminal) = Enterprise Value. TV-Anteil zeigt, wie stark der Endwert dominiert.',
    gut: 'Nachvollziehbare FCF-Kurve; TV-Anteil nicht absurd hoch; Equity Bridge (Net Debt, Shares) klar.',
    schlecht: 'TV-Anteil >85 % bei kurzem Horizont — du bewertest fast nur eine ewige Rente, nicht das sichtbare Geschäft.',
  },
  sensitivitaet: {
    schauen:
      '2D-Matrix: Fair Value je Aktie über WACC (Spalten) und Terminal-g bzw. Exit-Multiple (Zeilen). Farbe vs. aktuellem Kurs (grün = Unterbewertung).',
    gut: 'Base-Zelle (amber) und Nachbarzellen bleiben unter dem Kurs bzw. mit MoS kaufbar — robust, nicht nur ein Punkt.',
    schlecht: 'Nur die eine günstigste Zelle ist grün — das Modell kippt bei kleinen Annahmenänderungen ins Rote.',
  },
  reverseDcf: {
    schauen:
      'Welches FCF-Startwachstum der Markt implizit einpreist, damit Fair Value = aktueller Kurs (bei sonst gleichen Annahmen inkl. Fade/Terminal).',
    gut: 'Implizites g deutlich über deinem Base-g — der Markt ist optimistischer als du; oder umgekehrt: Kurs verlangt wenig Wachstum.',
    schlecht:
      'Implizites g unrealistisch hoch (z. B. >20 % über 10J) und du kaufst trotzdem ohne Moat-/Wachstumsthese.',
  },
} as const satisfies Record<string, PaInfoHintInhalt>
