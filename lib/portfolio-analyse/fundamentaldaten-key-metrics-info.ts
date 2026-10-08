import type { PaInfoHintInhalt } from '@/components/portfolio-analyse/pa-info-hint'

/** Erklärungen für Key-Metrics in der Übersicht (PaInfoHint „i“). */
export const KEY_METRIC_INFO = {
  '52w_hoch': {
    schauen: 'Höchster Schlusskurs der letzten 52 Wochen — Orientierung, wie weit der Kurs vom Hoch entfernt ist.',
    gut: 'Kurs nah am Hoch bei intakter Fundamentalqualität — oft Momentum und Vertrauen.',
    schlecht: 'Großer Abstand zum Hoch ohne erkennbare Erholung der Ertragskraft — Drawdown ohne Qualitätsstütze.',
  },
  '52w_tief': {
    schauen: 'Tiefster Schlusskurs der letzten 52 Wochen — Untergrenze der jüngsten Handelsspanne.',
    gut: 'Kurs klar über dem Tief bei stabilem Geschäft — Abverkauf war eher Sentiment.',
    schlecht: 'Kurs nahe am Tief und Margen/ROIC fallen mit — Abverkauf kann fundamental sein.',
  },
  kurs_aktuell: {
    schauen: 'Aktueller Börsenkurs (Listing-Währung) — Basis für Multiples und Distanz zu Hoch/Tief.',
    gut: 'Kursentwicklung passt zu Cashflow- und Gewinntrend.',
    schlecht: 'Kurs läuft stark voraus oder zurück, ohne dass FCF/Marge das stützt.',
  },
  vol_3m: {
    schauen: 'Durchschnittliches Tagesvolumen der letzten ~3 Monate — Liquidität der Aktie.',
    gut: 'Ausreichend Volumen für sinnvolle Positionsgrößen ohne große Spreads.',
    schlecht: 'Sehr dünnes Volumen — Einstieg/Ausstieg teuer, Kurse sprunghaft.',
  },
  beta: {
    schauen:
      '5-Jahres-Beta vs. S&P 500 — OLS aus monatlichen Total-Return-Renditen (adj. closes). Fehlt Yahoo-Beta, rechnen wir es selbst (ggf. FX→USD). Fließt in CAPM-Eigenkapitalkosten / WACC.',
    gut: 'Moderates Beta bei Quality Compoundern; kein Selbstzweck.',
    schlecht: 'Sehr hohes Beta ohne entsprechend höheres langfristiges Wachstum — mehr Volatilität ohne Ertrag.',
  },
  float: {
    schauen: 'Free Float: handelbarer Anteil der ausstehenden Aktien (ohne Insider-/Sperranteile).',
    gut: 'Ausreichender Float für faire Preisfindung.',
    schlecht: 'Sehr geringer Float — Kurse können extrem schwanken, Index-Effekte überzeichnet.',
  },
  market_cap: {
    schauen: 'Marktkapitalisierung = Kurs × ausstehende Aktien — Größe des Eigenkapital-Anspruchs.',
    gut: 'Größe passt zur Liquidität und zur gewünschten Depotgewichtung.',
    schlecht: 'Sehr kleine Caps mit dünnem Float und schwacher Bilanz — Klumpen- und Ausfallrisiko.',
  },
  enterprise_value: {
    schauen: 'Enterprise Value ≈ Marktkap + Nettofinanzverbindlichkeiten — Wert des operativen Unternehmens.',
    gut: 'EV und Marktkap liegen nah beieinander (wenig Nettoverschuldung) oder EV erklärt sich durch Cash.',
    schlecht: 'EV deutlich über Marktkap bei hoher Nettoverschuldung — Hebelrisiko in Multiples.',
  },
  shares_out: {
    schauen: 'Anzahl ausstehender Aktien — Nenner für EPS, FCF/Aktie und Verwässerung.',
    gut: 'Aktienzahl stabil oder fallend (echte Buybacks).',
    schlecht: 'Anhaltend steigende Aktienzahl — SBC/Emissionen verwässern die Eigentümer.',
  },
  net_debt: {
    schauen: 'Nettoverschuldung = verzinsliche Schulden − Cash/kurzfristige Anlagen (LTM/aktuell).',
    gut: 'Netto-Cash oder moderate Nettoverschuldung relativ zu FCF und EBITDA.',
    schlecht: 'Steigende Nettoverschuldung ohne Wachstum der Ertragskraft — Refi- und Zinsrisiko.',
  },
  net_debt_ebitda: {
    schauen: 'Net Debt / EBITDA — Verschuldung relativ zur operativen Ertragskraft.',
    gut: 'Niedrig und stabil (je nach Branche oft unter ~2–3×); bei Quality oft Netto-Cash.',
    schlecht: 'Steigendes Multiple oder Niveau deutlich über Branchennorm — Bilanz wird enger.',
  },
  net_debt_fcf: {
    schauen: 'Net Debt / FCF — wie viele Jahre Free Cashflow die Nettoverschuldung „tilgen“ würden.',
    gut: 'Niedrig: Schulden sind schnell aus Cashflow bedienbar.',
    schlecht: 'Hoch oder steigend: Verschuldung frisst den Eigentümer-Cashflow.',
  },
  interest_coverage: {
    schauen: 'Zinsdeckung (EBIT oder ähnliches / Zinsaufwand) — Puffer vor Zinslast.',
    gut: 'Hohe, stabile Deckung — Zinsen belasten den Gewinn kaum.',
    schlecht: 'Fallende oder knappe Deckung — steigende Zinsen oder schwächeres EBIT treffen hart.',
  },
  aktien_verwaesserung: {
    schauen: 'Jährliche Veränderung der Aktienzahl — Verwässerung (+) vs. Verknappung (−).',
    gut: 'Negativ oder nahe null: Buybacks übersteigen SBC/Emissionen.',
    schlecht: 'Deutlich positiv: Eigentümeranteil schrumpft jedes Jahr.',
  },
  debt_due_24m: {
    schauen: 'Schulden, die in den nächsten 24 Monaten fällig werden (Refinanzierungsberg).',
    gut: 'Geringer Anteil am Gesamtbestand — kein großer Refi-Druck.',
    schlecht: 'Großer Fälligkeitsberg bei teuren Zinsen oder schwachem FCF — Liquiditätsrisiko.',
  },
  debt_due_12m: {
    schauen: 'Schulden fällig innerhalb von 12 Monaten — kurzfristiger Refi-/Liquiditätsbedarf.',
    gut: 'Überschaubar und durch Cash/Linien gedeckt.',
    schlecht: 'Hoch relativ zu Cash und FCF — kurzfristiger Stress möglich.',
  },
  ltm_brutto: {
    schauen: 'LTM-Bruttomarge — Preissetzungsmacht und Kosten des verkauften Produkts/Service.',
    gut: 'Hoch und stabil/steigend — Pricing Power, Mix, Skaleneffekte.',
    schlecht: 'Fallende Bruttomarge über Jahre — Moat oder Mix erodiert.',
  },
  brutto_std_10y: {
    schauen: 'Standardabweichung der Bruttomarge über bis zu 10 Jahre — Stabilität der Pricing Power.',
    gut: 'Niedrige Streuung: Marge ist vorhersehbar (Quality-Signal).',
    schlecht: 'Hohe Streuung: zyklisches oder fragiles Preismacht-Profil.',
  },
  ltm_ebit: {
    schauen: 'LTM-EBIT-Marge — operative Profitabilität nach Abschreibungen, vor Zinsen/Steuern.',
    gut: 'Stabil oder steigend bei Umsatzwachstum — operativer Hebel greift.',
    schlecht: 'Marge fällt trotz Wachstum — Kosten fressen den Hebel.',
  },
  ltm_roa: {
    schauen: 'LTM Return on Assets — Gewinn relativ zur Bilanzsumme.',
    gut: 'Solide und stabil; bei asset-light Modellen oft höher.',
    schlecht: 'Niedrig/fallend: Kapital wird ineffizient gebunden.',
  },
  ltm_roe: {
    schauen: 'LTM Return on Equity — Gewinn relativ zum Eigenkapital (kann durch Hebel aufgeblasen sein).',
    gut: 'Hoch bei gleichzeitig solidem ROIC und moderater Verschuldung.',
    schlecht: 'Nur über Schulden hoch — ROE ohne ROIC-Qualität ist trügerisch.',
  },
  ltm_roic: {
    schauen: 'LTM ROIC — Rendite auf dem investierten Kapital (Kernkennzahl für Quality Compounder).',
    gut: 'Klar über WACC, stabil oder steigend — Value Creation.',
    schlecht: 'Unter oder nahe WACC, oder dauerhaft fallend — Kapitalvernichtung bzw. Moat-Erosion.',
  },
  ltm_roic_ex_gw: {
    schauen: 'ROIC ohne Goodwill — Kapitaleffizienz des operativen Geschäfts ohne teure Übernahmen.',
    gut: 'Ebenfalls hoch: Moat steckt im Geschäft, nicht nur in Deal-Accounting.',
    schlecht: 'Große Lücke zu ROIC inkl. Goodwill — teure Deals ohne operative Rendite.',
  },
  ltm_value_spread: {
    schauen: 'Value Spread = ROIC − WACC — wirtschaftlicher Mehrwert je Kapitaleinheit.',
    gut: 'Deutlich positiv und stabil — Compounding mit echtem Economic Profit.',
    schlecht: 'Negativ oder schrumpfend — investiertes Kapital verdient die Kapitalkosten nicht.',
  },
  reinvest_quote: {
    schauen: 'Reinvestitionsquote (CapEx + M&A − D&A) / FCF — wie viel Cash zurück ins Wachstum fließt.',
    gut: 'Sinnvoll positiv bei hohem Incremental ROIC; nicht dauerhaft FCF-zerstörend.',
    schlecht: 'Sehr hoch bei schwachem Incremental ROIC — teures Wachstum ohne Rendite.',
  },
  incremental_roic: {
    schauen: 'Incremental ROIC (ΔNOPAT / ΔInvested Capital, mehrjähriges Fenster) — Rendite auf neuem Kapital.',
    gut: 'Hoch und nah am oder über dem laufenden ROIC — Wachstum schafft Wert.',
    schlecht: 'Deutlich unter ROIC/WACC — Wachstum verwässert die Qualität.',
  },
  roic_5y_avg: {
    schauen: 'Durchschnittlicher ROIC über ~5 Jahre — nachhaltiges Kapitaleffizienz-Niveau.',
    gut: 'Hoch und nah am aktuellen ROIC — keine Einjahres-Eintagsfliege.',
    schlecht: 'Schnitt klar über aktuellem ROIC — Qualität bröckelt.',
  },
  incremental_value_spread: {
    schauen: 'Incremental Value Spread = Incremental ROIC − WACC — Wertbeitrag neuen Kapitals.',
    gut: 'Positiv: jedes neue Kapital schafft Economic Profit.',
    schlecht: 'Negativ: Wachstum zerstört Wert.',
  },
  sloan_ratio: {
    schauen: 'Sloan-Ratio (Accruals) — Anteil nicht-cashbasierten Gewinns; Qualität der Earnings.',
    gut: 'Niedrig/moderat: Gewinn und Cashflow laufen weitgehend zusammen.',
    schlecht: 'Hoch: Gewinn hängt stark an Accruals — Earnings-Qualität fraglich.',
  },
  beneish_m: {
    schauen: 'Beneish M-Score — statistisches Signal für mögliche Gewinnmanipulation (niedriger = weniger auffällig).',
    gut: 'Im „niedrig“-Bereich — kein erhöhtes Manipulations-Warnflag.',
    schlecht: 'Erhöhtes Risiko-Flag — tiefer in Accruals, Working Capital und Fußnoten schauen.',
  },
  fcf_conversion: {
    schauen: 'FCF / Nettogewinn — wie viel vom ausgewiesenen Gewinn als Free Cashflow ankommt.',
    gut: 'Nahe oder über 100 % über Zeit — Cash-Qualität stimmt.',
    schlecht: 'Dauerhaft deutlich unter 100 % — Accruals, CapEx oder WC fressen den Gewinn.',
  },
  sbc_fcf_ratio: {
    schauen: 'Aktienbasierte Vergütung relativ zum Free Cashflow — echte Kosten der Mitarbeitervergütung.',
    gut: 'Niedrig und stabil: SBC frisst den Eigentümer-Cashflow nicht auf.',
    schlecht: 'Hoch: „Gewinn“ ohne Cash — Verwässerung und Opportunitätskosten.',
  },
  sbc_ocf_ratio: {
    schauen: 'SBC relativ zum operativen Cashflow — Belastung vor CapEx.',
    gut: 'Einstellig und kontrolliert.',
    schlecht: 'Zweistellig und steigend — Cashflow-Qualität leidet.',
  },
  rd_aktivierung: {
    schauen: 'Anteil aktivierter F&E an den Forschungsausgaben — Accounting-Wahl bei Software/Entwicklung.',
    gut: 'Transparent und branchenüblich; Cashflow-Sicht bleibt klar.',
    schlecht: 'Sehr hohe Aktivierung kann Margen/ROIC kosmetisch aufblasen.',
  },
  kunden_top1: {
    schauen: 'Umsatzanteil des größten Kunden — Konzentrationsrisiko.',
    gut: 'Moderat: kein einzelner Kunde dominiert existenziell.',
    schlecht: 'Sehr hoch: Verlust/ Neuverhandlung eines Kunden trifft hart.',
  },
  kunden_top3: {
    schauen: 'Umsatzanteil der Top-3-Kunden — Kundenkonzentration.',
    gut: 'Breit gestreut — Pricing und Volumen nicht an wenigen Abnehmern hängen.',
    schlecht: 'Hohe Konzentration — Verhandlungsmacht liegt beim Kunden.',
  },
  fwd_rev_cagr_2y: {
    schauen: 'Erwartetes Umsatzwachstum über ~2 Jahre (Analysten-/Konsens-Schätzung).',
    gut: 'Positiv und glaubwürdig relativ zur Historie und zur Kapazität.',
    schlecht: 'Sehr aggressiv ohne Margin-/FCF-Unterlegung — Erwartung zu hoch.',
  },
  fwd_ebitda_cagr_2y: {
    schauen: 'Erwartetes EBITDA-Wachstum über ~2 Jahre — operativer Konsens.',
    gut: 'Wächst mit oder schneller als Umsatz (Hebel).',
    schlecht: 'Deutlich langsamer als Umsatz — Margendruck erwartet.',
  },
  fwd_eps_cagr_2y: {
    schauen: 'Erwartetes EPS-Wachstum über ~2 Jahre — oft Treiber für Forward-KGV/PEG.',
    gut: 'Nachhaltig und nahe am FCF-Wachstum.',
    schlecht: 'Nur durch Buybacks/Steuern kosmetisch — ohne Cash-Unterlegung.',
  },
  rev_cagr_3y: {
    schauen: 'Historisches Umsatz-CAGR über 3 Jahre.',
    gut: 'Solides Wachstum bei stabilen Margen.',
    schlecht: 'Wachstum nur mit fallender Marge oder ohne FCF.',
  },
  rev_cagr_5y: {
    schauen: 'Historisches Umsatz-CAGR über 5 Jahre — längerfristiger Wachstumspfad.',
    gut: 'Stetig positiv, passend zum Moat.',
    schlecht: 'Abflachend oder negativ bei teurer Bewertung.',
  },
  ebitda_cagr_3y: {
    schauen: 'Historisches EBITDA-CAGR über 3 Jahre.',
    gut: 'Mindestens so stark wie Umsatz — operativer Hebel.',
    schlecht: 'Hinter dem Umsatz zurück — Kosteninflation oder Mix.',
  },
  eps_cagr_3y: {
    schauen: 'Historisches EPS-CAGR über 3 Jahre.',
    gut: 'Wächst mit dem operativen Ergebnis, nicht nur durch Aktienzahl.',
    schlecht: 'EPS-Wachstum ohne FCF/NOPAT — Qualität prüfen.',
  },
  eps_cagr_5y: {
    schauen: 'Historisches EPS-CAGR über 5 Jahre.',
    gut: 'Langfristig robust und cash-unterstützt.',
    schlecht: 'Stark, aber Aktienzahl explodiert oder FCF fehlt.',
  },
  fcf_je_aktie_cagr_5y: {
    schauen: 'CAGR des Free Cashflows je Aktie über 5 Jahre — Eigentümer-Cash-Wachstum.',
    gut: 'Stark positiv: echtes Compounding je Anteil.',
    schlecht: 'Schwach trotz EPS-Wachstum — Cash kommt nicht beim Aktionär an.',
  },
  rule_of_40: {
    schauen:
      'Rule of 40 = Umsatz-CAGR 3J + beste Marge (FCF / EBIT / EBITDA). Balance Wachstum vs. Profitabilität (v. a. Software/Netzwerke).',
    gut: 'Um oder über 40: gesundes Wachstum-Profit-Profil.',
    schlecht: 'Klar darunter bei teurer Bewertung — zu wenig Wachstum oder zu wenig Marge.',
  },
  nrr: {
    schauen: 'Net Revenue Retention — Bestandskunden halten und expandieren Umsatz (SaaS/Abo).',
    gut: 'Deutlich über 100 %: Expansion übertrifft Churn.',
    schlecht: 'Unter 100 % oder fallend: Churn/Preisdruck bei Bestandskunden.',
  },
  target_price: {
    schauen: 'Durchschnittliches Analysten-Kursziel (Konsens) — Markterwartung, kein Fair Value.',
    gut: 'Als Sentiment-Kontext; Abstand zum Kurs mit eigenen Multiples abgleichen.',
    schlecht: 'Starkes Upside im Konsens bei gleichzeitig teuren Multiples — oft zu optimistisch.',
  },
  ntm_ev_rev: {
    schauen: 'FY EV / Umsatz — Bewertung des Unternehmenswerts auf erwartetem Jahresumsatz.',
    gut: 'Angemessen zur Wachstums- und Margenqualität (nicht absolut „billig“).',
    schlecht: 'Sehr hoch ohne Rule-of-40-/FCF-Unterstützung.',
  },
  ntm_ev_ebitda: {
    schauen: 'FY EV / EBITDA — operatives Bewertungsmultiple auf Forward-EBITDA.',
    gut: 'Im Rahmen der eigenen Historie und der Ertragskraft.',
    schlecht: 'Am oberen Historienrand ohne Margen-/Wachstumsverbesserung.',
  },
  ntm_pe: {
    schauen: 'FY-KGV (P/E) — Kurs relativ zum erwarteten Jahresgewinn je Aktie.',
    gut: 'Passt zu nachhaltigem EPS-/FCF-Wachstum (PEG-Kontext).',
    schlecht: 'Hoch bei stagnierendem Wachstum oder schlechter FCF-Conversion.',
  },
  peg_ratio: {
    schauen: 'PEG ≈ KGV / erwartetes EPS-Wachstum — grobe Relativierung der Bewertung.',
    gut: 'Moderat bei glaubwürdigem Wachstum (Faustformel oft nahe ~1–1,5).',
    schlecht: 'Hoch: teuer relativ zum erwarteten Wachstum — oder Wachstum überschätzt.',
  },
  ntm_mc_fcf: {
    schauen: 'FY Marktkap / FCF — wie viele Jahre Forward-FCF die Marktkapitalisierung „kostet“.',
    gut: 'Niedriger bei stabiler FCF-Qualität — attraktive Cash-Yield-Perspektive.',
    schlecht: 'Sehr hoch: Markt zahlt viel für (noch) wenig Eigentümer-Cash.',
  },
  ntm_fcf_rendite: {
    schauen: 'FY-FCF-Rendite ≈ Forward-FCF / Marktkap — Cash-Yield-Erwartung.',
    gut: 'Solide und steigend bei stabiler Qualität.',
    schlecht: 'Sehr niedrig bei gleichzeitig teuren Earnings-Multiples.',
  },
  ltm_ev_rev: {
    schauen: 'LTM EV / Umsatz — aktuelles Umsatz-Multiple auf den letzten zwölf Monaten.',
    gut: 'Im historischen Kontext der Firma und zur Marge passend.',
    schlecht: 'Teuer bei schwacher oder fallender Marge.',
  },
  ltm_pe: {
    schauen: 'LTM-KGV — Kurs / Trailing-EPS.',
    gut: 'Nicht extrem über der eigenen Historie ohne Qualitätsplus.',
    schlecht: 'Hoch bei Einmalgewinnen im Nenner oder ohne FCF.',
  },
  ltm_pb: {
    schauen: 'LTM Kurs / Buchwert — relevant v. a. bei kapitalintensiven oder Finanzmodellen.',
    gut: 'Interpretierbar im Branchenkontext; bei asset-light oft strukturell hoch.',
    schlecht: 'Steigend bei schrumpfendem Eigenkapital (Verluste/Buybacks auf Pump).',
  },
  ltm_ps: {
    schauen: 'LTM Kurs / Umsatz (P/S) — einfache Sales-Bewertung auf Eigenkapitalbasis.',
    gut: 'Sinnvoll nur mit Margenkontext; besser oft EV/Sales.',
    schlecht: 'Hoch ohne Profitabilitätspfad.',
  },
  ltm_pfcf: {
    schauen: 'LTM Kurs / FCF (P/FCF) — Bewertung auf Trailing-Free-Cashflow.',
    gut: 'Moderat bei hoher Conversion und stabilem FCF.',
    schlecht: 'Hoch: teuer relativ zum tatsächlich verfügbaren Cash.',
  },
  ltm_fcf_rendite: {
    schauen: 'LTM-FCF-Rendite = FCF / Marktkap — aktueller Cash-Yield.',
    gut: 'Attraktiv und nachhaltig (nicht nur ein CapEx-Tief).',
    schlecht: 'Sehr niedrig oder nur durch unterlassene Reinvestition hoch.',
  },
  div_yield: {
    schauen: 'Dividendenrendite — Ausschüttung relativ zum Kurs.',
    gut: 'Gedeckt vom FCF, nachhaltig, nicht auf Kosten der Reinvestition.',
    schlecht: 'Hoch nur weil Kurs eingebrochen ist oder Ausschüttung > FCF.',
  },
  payout: {
    schauen: 'Ausschüttungsquote — Dividende relativ zum Gewinn (manchmal auch FCF-Logik prüfen).',
    gut: 'Konservativ und vom FCF getragen.',
    schlecht: 'Sehr hoch oder steigend bei schwachem FCF — Dividende gefährdet.',
  },
  wacc: {
    schauen: 'WACC (CAPM-Schätzung) — gewichtete Kapitalkosten aus Beta, Marktkap und Fremdkapitalzins.',
    gut: 'ROIC und Incremental ROIC klar darüber — Economic Profit.',
    schlecht: 'ROIC nahe oder unter WACC — investiertes Kapital verdient die Hurdle Rate nicht.',
  },
  pers_div_yield: {
    schauen: 'Persönliche Div-Rendite (Yield on Cost) — Jahresausschüttung relativ zu deinem Einstandskurs.',
    gut: 'Deutlich über der Marktrendite bei Kursgewinn — du „verdienst“ mehr als neue Käufer.',
    schlecht: 'Unter der Marktrendite trotz Plus: oft falscher Vergleich (TTM-Cash vs. Yahoo) oder teurer Nachkauf.',
  },
  fcf_marge: {
    schauen: 'FCF-Marge = Free Cashflow / Umsatz — wie viel vom Umsatz als Eigentümer-Cash bleibt.',
    gut: 'Hoch und stabil: skalierbares, cashgenerierendes Modell.',
    schlecht: 'Niedrig oder fallend: CapEx, WC oder schwache Conversion fressen den Umsatz.',
  },
  ltm_ev_ebitda: {
    schauen: 'EV / EBITDA — Enterprise Value relativ zum operativen Ergebnis (hier oft FY/LTM-Mix).',
    gut: 'Im Rahmen der eigenen Historie und zur Ertragskraft passend.',
    schlecht: 'Am oberen Historienrand ohne Margen-/Wachstumsverbesserung.',
  },
  hist_median_pe_5y: {
    schauen: 'Median des eigenen KGV über ~5 Geschäftsjahre — Bewertungsanker der Firma.',
    gut: 'Aktuelles KGV klar darunter bei intakter Qualität — relativ günstig zur eigenen Historie.',
    schlecht: 'Aktuelles KGV deutlich darüber ohne Qualitätsplus — teurer als „normal“ für diese Aktie.',
  },
  hist_pe_pctl_5y: {
    schauen: 'Aktuelles KGV als Perzentil der 5J-Historie (0 = günstig, 100 = teuer).',
    gut: 'Niedriges Perzentil bei stabiler Ertragskraft — Einstiegszone relativ zur eigenen Historie.',
    schlecht: 'Hohes Perzentil — Kurs bewertet die Aktie am oberen Ende ihrer Historie.',
  },
  hist_pe_pctl_10y: {
    schauen: 'Aktuelles KGV als Perzentil der 10J-Historie — längerer Bewertungskontext.',
    gut: 'Niedrig bei intaktem Moat — selten günstige Phase.',
    schlecht: 'Hoch: teurer als in den meisten der letzten zehn Jahre.',
  },
  hist_median_fcf_yield_5y: {
    schauen: 'Median der FCF-Rendite über ~5 Jahre — typischer Cash-Yield der Aktie.',
    gut: 'Aktuelle FCF-Rendite darüber — mehr Cash-Yield als historisch üblich.',
    schlecht: 'Aktuell darunter — Markt zahlt mehr für denselben Cashflow.',
  },
  hist_median_ev_ebitda_5y: {
    schauen: 'Median EV/EBITDA über ~5 Jahre — operativer Bewertungsanker.',
    gut: 'Aktuelles Multiple darunter bei stabiler Marge.',
    schlecht: 'Aktuell deutlich teurer als der eigene 5J-Median.',
  },
  hist_ev_ebitda_pctl_5y: {
    schauen: 'Aktuelles EV/EBITDA als Perzentil der 5J-Historie.',
    gut: 'Niedrig = günstig relativ zur eigenen Historie.',
    schlecht: 'Hoch = teuer im eigenen Bewertungsband.',
  },
  hist_ev_ebitda_pctl_10y: {
    schauen: 'Aktuelles EV/EBITDA als Perzentil der 10J-Historie.',
    gut: 'Niedrig bei intakter Qualität — längerer Kontext spricht für Discount.',
    schlecht: 'Hoch — teurer als in den meisten der letzten zehn Jahre.',
  },
  hist_median_ev_rev_5y: {
    schauen: 'Median EV/Umsatz über ~5 Jahre — Sales-Bewertungsanker.',
    gut: 'Aktuell darunter bei stabiler/steigender Marge.',
    schlecht: 'Aktuell deutlich teurer ohne Margenfortschritt.',
  },
  hist_ev_rev_pctl_5y: {
    schauen: 'Aktuelles EV/Umsatz als Perzentil der 5J-Historie.',
    gut: 'Niedriges Perzentil — relativ günstig zum eigenen Band.',
    schlecht: 'Hohes Perzentil — teuer im eigenen Historienkontext.',
  },
} as const satisfies Record<string, PaInfoHintInhalt>

export function keyMetricInfo(id: string): PaInfoHintInhalt | null {
  return KEY_METRIC_INFO[id as keyof typeof KEY_METRIC_INFO] ?? null
}
