/** Bekannte Investor-Zitate — ein Zitat pro Kalendertag (365). */

export type InvestorTageszitat = {
  text: string
  autor: string
}

export const INVESTOR_TAGESZITATE: readonly InvestorTageszitat[] = [
  {
    text: 'Sei ängstlich, wenn andere gierig sind, und gierig, wenn andere ängstlich sind.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Der Aktienmarkt ist ein Mechanismus, der Geld von den Ungeduldigen zu den Geduldigen umverteilt.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Preis ist, was du zahlst. Wert ist, was du bekommst.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Unsere Lieblingshaltefrist ist für immer.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Risiko entsteht, wenn man nicht weiß, was man tut.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Es ist besser, ungefähr richtig zu liegen als präzise falsch.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Die erste Regel des Investierens: Verliere kein Geld. Die zweite: Vergiss Regel eins nicht.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Zeit ist der Freund des wunderbaren Unternehmens und der Feind des Mittelmäßigen.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Weise Leute wetten auf Vorteile, nicht auf Würfel.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Zeige mir die Anreize, und ich sage dir das Ergebnis.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Die große Geldanlage kommt nicht aus dem Kaufen und Verkaufen, sondern aus dem Warten.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Invertieren, immer invertieren: Denke darüber nach, was schiefgehen kann — und vermeide es.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Eine Aktie zu besitzen heißt, ein Stück eines Unternehmens zu besitzen.',
    autor: 'Peter Lynch',
  },
  {
    text: 'Investiere in das, was du verstehst.',
    autor: 'Peter Lynch',
  },
  {
    text: 'Hinter jeder Aktie steht ein Unternehmen. Finde heraus, was es tut.',
    autor: 'Peter Lynch',
  },
  {
    text: 'Der Schlüssel zum Geldverdienen an der Börse ist, nicht erschrocken zu werden.',
    autor: 'Peter Lynch',
  },
  {
    text: 'In der kurzen Frist ist der Markt eine Wahlmaschine, in der langen Frist eine Waage.',
    autor: 'Benjamin Graham',
  },
  {
    text: 'Der intelligente Investor ist ein Realist, der an Optimisten verkauft und von Pessimisten kauft.',
    autor: 'Benjamin Graham',
  },
  {
    text: 'Der Margin of Safety ist das zentrale Konzept erfolgreichen Investierens.',
    autor: 'Benjamin Graham',
  },
  {
    text: 'Die größten Gewinne kommen oft aus dem Kauf, wenn niemand kaufen will.',
    autor: 'Sir John Templeton',
  },
  {
    text: 'Bullmärkte entstehen im Pessimismus, wachsen im Skeptizismus, reifen im Optimismus und sterben in Euphorie.',
    autor: 'Sir John Templeton',
  },
  {
    text: 'Die vier gefährlichsten Worte im Investing: Diesmal ist alles anders.',
    autor: 'Sir John Templeton',
  },
  {
    text: 'Diversifikation ist der einzige Free Lunch im Investing.',
    autor: 'Harry Markowitz',
  },
  {
    text: 'Zeit im Markt schlägt Timing des Marktes.',
    autor: 'John Bogle',
  },
  {
    text: 'Bleib dem Kurs treu. Impulsives Handeln ist der Feind des Anlegers.',
    autor: 'John Bogle',
  },
  {
    text: 'Der Anleger, der am wenigsten handelt, verdient oft am meisten.',
    autor: 'John Bogle',
  },
  {
    text: 'Nicht die höchste Rendite jagen — die zuverlässigste Strategie finden.',
    autor: 'John Bogle',
  },
  {
    text: 'Cash ist eine Position. Manchmal ist Nichtstun die beste Entscheidung.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Value Investing ist einfach zu verstehen, aber schwer durchzuhalten.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Der Markt kann länger irrational bleiben, als du zahlungsfähig bleiben kannst.',
    autor: 'John Maynard Keynes',
  },
  {
    text: 'Erfolg im Investing kommt vom Schutz vor dem permanenten Verlust von Kapital.',
    autor: 'Howard Marks',
  },
  {
    text: 'Du kannst nicht vorhersehen, aber du kannst dich vorbereiten.',
    autor: 'Howard Marks',
  },
  {
    text: 'Risiko ist das, was übrig bleibt, wenn man glaubt, alles bedacht zu haben.',
    autor: 'Howard Marks',
  },
  {
    text: 'Geduld ist die seltenste Ware an den Märkten — und die wertvollste.',
    autor: 'Howard Marks',
  },
  {
    text: 'Kaufe, wenn es Blut auf den Straßen gibt — auch wenn das Blut dein eigenes ist.',
    autor: 'Baron Rothschild',
  },
  {
    text: 'Der Zinseszins ist das achte Weltwunder — und Disziplin sein Motor.',
    autor: 'Albert Einstein (zugeschrieben)',
  },
  {
    text: 'Die Börse belohnt nicht Aktivität, sondern Einsicht und Ausdauer.',
    autor: 'Philip Fisher',
  },
  {
    text: 'Der beste Zeitpunkt zum Verkaufen einer großartigen Aktie ist — fast nie.',
    autor: 'Philip Fisher',
  },
  {
    text: 'Konzentriere dich auf wenige außergewöhnliche Unternehmen, nicht auf viele mittelmäßige.',
    autor: 'Philip Fisher',
  },
  {
    text: 'Eine gute Firma zu einem fairen Preis ist besser als eine faire Firma zu einem guten Preis.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Die meisten Menschen interessieren sich für Aktien, wenn alle anderen es tun. Die Zeit zum Kaufen ist, wenn niemand es will.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Wenn du nicht bereit bist, eine Aktie zehn Jahre zu halten, solltest du sie nicht einmal zehn Minuten besitzen.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Spekulation ist der Versuch, vom Markt zu profitieren. Investing ist der Versuch, vom Unternehmen zu profitieren.',
    autor: 'Benjamin Graham',
  },
  {
    text: 'Wisse, was du besitzt — und warum du es besitzt.',
    autor: 'Peter Lynch',
  },
  {
    text: 'Die größte Gefahr für dein Kapital ist nicht Volatilität — sondern emotionale Entscheidungen.',
    autor: 'Daniel Kahneman',
  },
  {
    text: 'Übermut ist der Feind des Anlegers; Demut ist sein Verbündeter.',
    autor: 'Daniel Kahneman',
  },
  {
    text: 'Plane für das Unerwartete. Die Geschichte wiederholt sich nicht, aber sie reimt sich.',
    autor: 'Mark Twain (zugeschrieben)',
  },
  {
    text: 'Ein Portfolio ist kein Wettkampf — es ist ein Werkzeug für deine Ziele.',
    autor: 'William Bernstein',
  },
  {
    text: 'Wenn du die Qualität eines Unternehmens kennst, brauchst du den nächsten Quartalsbericht weniger zu fürchten.',
    autor: 'Terry Smith',
  },
  {
    text: 'Kaufe Qualität. Halte Qualität. Verkaufe nur, wenn die Qualität bricht.',
    autor: 'Terry Smith',
  },
  {
    text: 'Die besten Investments fühlen sich oft unangenehm an, wenn man sie tätigt.',
    autor: 'Howard Marks',
  },
  {
    text: 'Zinsen sind der Preis der Ungeduld — und der Feind des langfristigen Anlegers.',
    autor: 'Jason Zweig',
  },
  {
    text: 'Ein Crash ist der Preis der Eintrittskarte für langfristige Aktienrenditen.',
    autor: 'William Bernstein',
  },
  {
    text: 'Nicht der klügste Anleger gewinnt — sondern der disziplinierteste.',
    autor: 'Benjamin Graham',
  },
  {
    text: 'Wenn du schläfst und dein Geld arbeitet, hast du den Zinseszins verstanden.',
    autor: 'Naval Ravikant',
  },
  {
    text: 'Spiele langfristige Spiele mit langfristigen Menschen — und langfristigen Unternehmen.',
    autor: 'Naval Ravikant',
  },
  {
    text: 'Die Börse ist voller Menschen, die den Kurs jeder Aktie kennen, aber den Wert von nichts.',
    autor: 'Philip Fisher',
  },
  {
    text: 'Eine Margin of Safety schützt dich vor dem Unbekannten — und vor dir selbst.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Erfolg misst sich nicht am nächsten Tick, sondern an Jahrzehnten.',
    autor: 'John Bogle',
  },
  {
    text: 'Der Unterschied zwischen erfolgreichen und erfolglosen Menschen: Erfolgreiche geben nicht auf.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Ich mag Leute, die Zahlen zu Geschichten machen — und Geschichten, die zu Zahlen passen.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Die Welt ist voller törichter Glücksspieler, die denken, sie seien Investoren.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Ein Moat ist kein Slogan — es ist ein nachhaltiger Wettbewerbsvorteil.',
    autor: 'Pat Dorsey',
  },
  {
    text: 'Bewerte das Business, nicht den Chart.',
    autor: 'Pat Dorsey',
  },
  {
    text: 'Wachstum ohne Moat ist oft nur vorübergehend.',
    autor: 'Pat Dorsey',
  },
  {
    text: 'Kapitalallokation ist die wichtigste Fähigkeit eines CEO.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Der schlechteste Zeitpunkt zum Verkaufen ist, wenn du Geld brauchst.',
    autor: 'Morgan Housel',
  },
  {
    text: 'Reich werden und reich bleiben sind zwei verschiedene Fähigkeiten.',
    autor: 'Morgan Housel',
  },
  {
    text: 'Sparsamkeit ist die Lücke zwischen Ego und Einkommen.',
    autor: 'Morgan Housel',
  },
  {
    text: 'Geschichte wiederholt sich nicht, aber Verhalten schon.',
    autor: 'Morgan Housel',
  },
  {
    text: 'Dein Verhalten mit Geld zählt mehr als deine Intelligenz.',
    autor: 'Morgan Housel',
  },
  {
    text: 'Pessimismus klingt klug. Optimismus zahlt die Rechnung.',
    autor: 'Morgan Housel',
  },
  {
    text: 'Die größte Anlagechance ist oft die, die sich am unangenehmsten anfühlt.',
    autor: 'Morgan Housel',
  },
  {
    text: 'Geld ist das, was du nicht ausgibst.',
    autor: 'Morgan Housel',
  },
  {
    text: 'Planen ist wichtig. Am Plan festhalten, wenn es wehtut, ist wichtiger.',
    autor: 'Morgan Housel',
  },
  {
    text: 'Risiko ist das, was du nicht siehst, wenn alles gut läuft.',
    autor: 'Howard Marks',
  },
  {
    text: 'Zweite-Ebene-Denken: Was denkt der Markt — und was denke ich anders?',
    autor: 'Howard Marks',
  },
  {
    text: 'Zyklusbewusstsein schlägt Prognosen.',
    autor: 'Howard Marks',
  },
  {
    text: 'Wenn du den Preis zahlst, den alle zahlen, bekommst du die Rendite, die alle bekommen.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Geduld ohne Analyse ist Trägheit. Analyse ohne Geduld ist Aktionismus.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Der Markt ist kein Lehrer, der dich belohnt — er ist ein Prüfer, der dich demütigt.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Kaufe Unternehmen, die du auch ohne Börse besitzen würdest.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Opportunitätskosten sind real: Jeder Euro kann nur einmal arbeiten.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Reputation braucht 20 Jahre — und fünf Minuten, sie zu zerstören.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Ich kaufe nie etwas, wenn ich nicht den Abwärtsschutz verstehe.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Der innere Wert ändert sich langsam. Der Kurs ändert sich schnell.',
    autor: 'Benjamin Graham',
  },
  {
    text: 'Mr. Market ist dein Diener, nicht dein Herr.',
    autor: 'Benjamin Graham',
  },
  {
    text: 'Investieren ohne Sicherheitsmarge ist Spekulation mit Etikett.',
    autor: 'Benjamin Graham',
  },
  {
    text: 'Analysiere Fakten, nicht Gefühle.',
    autor: 'Benjamin Graham',
  },
  {
    text: 'Ein gutes Unternehmen in Schwierigkeiten ist oft günstiger als ein schlechtes in Mode.',
    autor: 'Peter Lynch',
  },
  {
    text: 'Die Tenbagger wachsen oft dort, wo niemand hinsieht.',
    autor: 'Peter Lynch',
  },
  {
    text: 'Verkaufe nicht nur, weil eine Aktie gestiegen ist.',
    autor: 'Peter Lynch',
  },
  {
    text: 'Wenn du die Bilanz nicht lesen kannst, besitzt du ein Lotterielos.',
    autor: 'Peter Lynch',
  },
  {
    text: 'Kosten sind der Feind der Rendite.',
    autor: 'John Bogle',
  },
  {
    text: 'Kaufe den Heuhaufen, nicht die Nadel.',
    autor: 'John Bogle',
  },
  {
    text: 'Stay the course — besonders wenn es wehtut.',
    autor: 'John Bogle',
  },
  {
    text: 'Die Magie der Märkte liegt im Eigentum an produktiven Assets.',
    autor: 'John Bogle',
  },
  {
    text: 'Prognosen sagen mehr über den Prognostiker aus als über die Zukunft.',
    autor: 'John Bogle',
  },
  {
    text: 'Diversifikation schützt dich vor Unwissenheit.',
    autor: 'William Bernstein',
  },
  {
    text: 'Dein größter Feind sitzt zwischen deinen Ohren.',
    autor: 'William Bernstein',
  },
  {
    text: 'Asset Allocation bestimmt mehr als Stockpicking.',
    autor: 'William Bernstein',
  },
  {
    text: 'Rebalancing ist Disziplin in Aktion.',
    autor: 'William Bernstein',
  },
  {
    text: 'Langeweile ist oft ein Zeichen guter Anlagestrategie.',
    autor: 'William Bernstein',
  },
  {
    text: 'Die besten Geschäfte sind dort, wo die Erwartungen am niedrigsten sind.',
    autor: 'Sir John Templeton',
  },
  {
    text: 'Forsche dort, wo andere ängstlich sind.',
    autor: 'Sir John Templeton',
  },
  {
    text: 'Maximale Pessimismus ist oft maximale Chance.',
    autor: 'Sir John Templeton',
  },
  {
    text: 'Hilfe kommt selten von der Masse.',
    autor: 'Sir John Templeton',
  },
  {
    text: 'Qualität zum Discount schlägt Hype zum Premium.',
    autor: 'Terry Smith',
  },
  {
    text: 'Hohe Kapitalrendite und Reinvestment — das ist der Kern.',
    autor: 'Terry Smith',
  },
  {
    text: 'Ignoriere den Lärm der Quartals-Guidance.',
    autor: 'Terry Smith',
  },
  {
    text: 'Ein teures Qualitätsunternehmen kann billig sein, wenn der Moat hält.',
    autor: 'Terry Smith',
  },
  {
    text: 'Skalenvorteile mit Kunden zu teilen schafft Loyalität.',
    autor: 'Nick Sleep',
  },
  {
    text: 'Langfristig gewinnen Unternehmen, die Kunden und Kapital gerecht behandeln.',
    autor: 'Nick Sleep',
  },
  {
    text: 'Komplexe Strategien scheitern oft an einfachen Fehlern.',
    autor: 'Nick Sleep',
  },
  {
    text: 'Halte fest, was funktioniert — auch wenn es langweilig wirkt.',
    autor: 'Nick Sleep',
  },
  {
    text: 'Checklisten retten dich vor vermeidbaren Fehlern.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Lerne kontinuierlich — oder werde irrelevant.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Multidisziplinäres Denken schlägt enge Expertise.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Vermeide Idiotensteuer: Gebühren, Hebel, Hype.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Die beste Rache ist, lange zu leben und klug zu investieren.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Ein Portfolio ohne Prozess ist ein Stimmungsbarometer.',
    autor: 'Joel Greenblatt',
  },
  {
    text: 'Kaufe Gutes billig — und warte.',
    autor: 'Joel Greenblatt',
  },
  {
    text: 'Eine Magic Formula ohne Disziplin ist nur eine Liste.',
    autor: 'Joel Greenblatt',
  },
  {
    text: 'Sonderfälle und Spin-offs lohnen Recherche.',
    autor: 'Joel Greenblatt',
  },
  {
    text: 'Konzentration ist erlaubt, wenn du wirklich verstehst.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Zu viel Diversifikation ist oft Unsicherheit im Kostüm.',
    autor: 'Philip Fisher',
  },
  {
    text: 'Scuttlebutt: Rede mit Kunden, Lieferanten, Wettbewerbern.',
    autor: 'Philip Fisher',
  },
  {
    text: 'Management-Qualität ist Teil des Investments.',
    autor: 'Philip Fisher',
  },
  {
    text: 'Wachstum ohne Cashflow ist eine Geschichte, kein Business.',
    autor: 'Philip Fisher',
  },
  {
    text: 'Der Trend ist dein Freund — bis er endet.',
    autor: 'Jesse Livermore',
  },
  {
    text: 'Märkte werden nie falsch gepreist, weil sie sich anders fühlen als du.',
    autor: 'Jesse Livermore',
  },
  {
    text: 'Verluste begrenzen ist Überlebensstrategie.',
    autor: 'Jesse Livermore',
  },
  {
    text: 'Überhandel dich nicht in den Ruin.',
    autor: 'Jesse Livermore',
  },
  {
    text: 'Liquidität ist Sauerstoff — merkst du erst, wenn sie fehlt.',
    autor: 'Ray Dalio',
  },
  {
    text: 'Prinzipien schlagen Impulse.',
    autor: 'Ray Dalio',
  },
  {
    text: 'Diversifiziere über unverknüpfte Ertragsquellen.',
    autor: 'Ray Dalio',
  },
  {
    text: 'Schmerz plus Reflexion ergibt Fortschritt.',
    autor: 'Ray Dalio',
  },
  {
    text: 'Radikale Transparenz beginnt bei dir selbst.',
    autor: 'Ray Dalio',
  },
  {
    text: 'Wenn du die gleiche Meinung wie alle hast, bist du überflüssig.',
    autor: 'George Soros',
  },
  {
    text: 'Märkte sind reflexiv: Preise beeinflussen Realität.',
    autor: 'George Soros',
  },
  {
    text: 'Es ist egal, ob du recht hast — es zählt, wie viel du verdienst, wenn du recht hast.',
    autor: 'George Soros',
  },
  {
    text: 'Überlebe zuerst. Optimiere später.',
    autor: 'George Soros',
  },
  {
    text: 'Asymmetrische Payoffs: begrenztes Risiko, offenes Upside.',
    autor: 'Stanley Druckenmiller',
  },
  {
    text: 'Wenn du eine starke These hast, sei bereit, groß zu positionieren.',
    autor: 'Stanley Druckenmiller',
  },
  {
    text: 'Flexibilität schlägt Dogma.',
    autor: 'Stanley Druckenmiller',
  },
  {
    text: 'Kapital schützen in unsicheren Phasen ist Alpha.',
    autor: 'Stanley Druckenmiller',
  },
  {
    text: 'Makro und Mikro gehören zusammen.',
    autor: 'Paul Tudor Jones',
  },
  {
    text: 'Defensive Haltung ist kein Pessimismus — sie ist Professionalität.',
    autor: 'Paul Tudor Jones',
  },
  {
    text: 'Risikomanagement ist die ganze Aufgabe.',
    autor: 'Paul Tudor Jones',
  },
  {
    text: 'Die beste Trade-Idee stirbt ohne Positionsgröße.',
    autor: 'Paul Tudor Jones',
  },
  {
    text: 'Edge ohne Execution ist Theorie.',
    autor: 'Ed Thorp',
  },
  {
    text: 'Erwartungswert schlägt Bauchgefühl.',
    autor: 'Ed Thorp',
  },
  {
    text: 'Hebel ist ein Werkzeug — und eine Waffe.',
    autor: 'Ed Thorp',
  },
  {
    text: 'Mathematik ist ein Moat, wenn andere sie meiden.',
    autor: 'Ed Thorp',
  },
  {
    text: 'Daten ohne Hypothese sind nur Rauschen.',
    autor: 'Jim Simons',
  },
  {
    text: 'Muster existieren — aber selten dort, wo alle suchen.',
    autor: 'Jim Simons',
  },
  {
    text: 'Forschung schlägt Charisma.',
    autor: 'Jim Simons',
  },
  {
    text: 'Systematisch denken, emotional handeln vermeiden.',
    autor: 'Jim Simons',
  },
  {
    text: 'Buy-and-hold funktioniert nur, wenn du holden kannst.',
    autor: 'Jeremy Siegel',
  },
  {
    text: 'Aktien schlagen langfristig Anleihen — wenn du durchhältst.',
    autor: 'Jeremy Siegel',
  },
  {
    text: 'Dividenden sind der stille Renditetreiber.',
    autor: 'Jeremy Siegel',
  },
  {
    text: 'Geduld ist die billigste Form von Alpha.',
    autor: 'Jeremy Siegel',
  },
  {
    text: 'Ein Random Walk heißt nicht, dass Denken nutzlos ist.',
    autor: 'Burton Malkiel',
  },
  {
    text: 'Kosten und Steuern fressen mehr Alpha als die meisten denken.',
    autor: 'Burton Malkiel',
  },
  {
    text: 'Indexieren ist Demut vor dem Markt.',
    autor: 'Burton Malkiel',
  },
  {
    text: 'Timing-Versuche sind teure Unterhaltung.',
    autor: 'Burton Malkiel',
  },
  {
    text: 'Effiziente Märkte sind eine Annäherung — nicht ein Dogma.',
    autor: 'Eugene Fama',
  },
  {
    text: 'Risikoprämien existieren, weil Risiko wehtut.',
    autor: 'Eugene Fama',
  },
  {
    text: 'Faktor-Exposures erklären viel — aber nicht alles.',
    autor: 'Eugene Fama',
  },
  {
    text: 'Irrationalität der Anleger ist messbar.',
    autor: 'Robert Shiller',
  },
  {
    text: 'Narrative bewegen Märkte stärker als Tabellen.',
    autor: 'Robert Shiller',
  },
  {
    text: 'Blasen fühlen sich im Moment wie neue Paradigmen an.',
    autor: 'Robert Shiller',
  },
  {
    text: 'CAPE ist ein Kompass, keine Stoppuhr.',
    autor: 'Robert Shiller',
  },
  {
    text: 'Unterbewertung ohne Katalysator kann lange dauern.',
    autor: 'Bruce Greenwald',
  },
  {
    text: 'Franchise-Wert und Asset-Wert unterscheiden.',
    autor: 'Bruce Greenwald',
  },
  {
    text: 'Wettbewerb frisst Margen — außer bei echten Moats.',
    autor: 'Bruce Greenwald',
  },
  {
    text: 'Earnings Power Value ist oft ehrlicher als Hype-Multiples.',
    autor: 'Bruce Greenwald',
  },
  {
    text: 'Einfache Kennzahlen, konsequent angewandt, schlagen Komplexität.',
    autor: 'Joseph Piotroski',
  },
  {
    text: 'Fundamentale Verbesserung schlägt Storytelling.',
    autor: 'Joseph Piotroski',
  },
  {
    text: 'Bilanzen lügen seltener als Pressemitteilungen.',
    autor: 'Joseph Piotroski',
  },
  {
    text: 'Qualität der Erträge zählt mehr als das Headline-Ergebnis.',
    autor: 'Joseph Piotroski',
  },
  {
    text: 'Ein Prozess schützt dich vor deinem schlechtesten Tag.',
    autor: 'Michael Mauboussin',
  },
  {
    text: 'Basisraten schlagen Anekdoten.',
    autor: 'Michael Mauboussin',
  },
  {
    text: 'Skill und Glück trennen — sonst lernst du falsch.',
    autor: 'Michael Mauboussin',
  },
  {
    text: 'Erwartungswert denken, nicht Ergebnis denken.',
    autor: 'Michael Mauboussin',
  },
  {
    text: 'Die Dauer des Wettbewerbsvorteils ist die geheime Variable.',
    autor: 'Michael Mauboussin',
  },
  {
    text: 'Kopiere kluge Prozesse, nicht blinde Trades.',
    autor: 'Guy Spier',
  },
  {
    text: 'Checklisten und ruhige Umgebung verbessern Entscheidungen.',
    autor: 'Guy Spier',
  },
  {
    text: 'Lerne von den Besten — und bleib demütig.',
    autor: 'Guy Spier',
  },
  {
    text: 'Compounding braucht Jahre ungestörten Wachstums.',
    autor: 'Guy Spier',
  },
  {
    text: 'Clone klug: Verstehe warum, bevor du kopierst.',
    autor: 'Mohnish Pabrai',
  },
  {
    text: 'Kopf: ich gewinne. Zahl: ich verliere wenig.',
    autor: 'Mohnish Pabrai',
  },
  {
    text: 'Dhandho: wenig Risiko, viel Upside.',
    autor: 'Mohnish Pabrai',
  },
  {
    text: 'Warte auf fette Pitches — und schwing dann fest.',
    autor: 'Mohnish Pabrai',
  },
  {
    text: 'Hundertbagger brauchen Zeit, Wachstum und oft auch Mut.',
    autor: 'Christopher Mayer',
  },
  {
    text: 'Halte die Gewinner, schneide die Hoffnungslosigkeit.',
    autor: 'Christopher Mayer',
  },
  {
    text: 'Eigentümer-Mentalität schlägt Trader-Mentalität.',
    autor: 'Christopher Mayer',
  },
  {
    text: 'Kleine Positionen können groß werden — wenn du sie lässt.',
    autor: 'Christopher Mayer',
  },
  {
    text: 'Hundert zu eins kommt von außergewöhnlichen Unternehmen über Jahrzehnte.',
    autor: 'Thomas Phelps',
  },
  {
    text: 'Verkaufe nicht deine Zukunft für heutige Ruhe.',
    autor: 'Thomas Phelps',
  },
  {
    text: 'Geduld ist eine Anlagestrategie.',
    autor: 'Thomas Phelps',
  },
  {
    text: 'Die größte Gefahr ist, zu früh auszusteigen.',
    autor: 'Thomas Phelps',
  },
  {
    text: 'Sparrate schlägt Stockpicking in den frühen Jahren.',
    autor: 'JL Collins',
  },
  {
    text: 'Der einfache Pfad zum Reichtum ist langweilig — und wirksam.',
    autor: 'JL Collins',
  },
  {
    text: 'Finanzielle Freiheit ist Optionen, nicht Status.',
    autor: 'JL Collins',
  },
  {
    text: 'Marktcrashs sind Ausverkäufe für den Langfristigen.',
    autor: 'JL Collins',
  },
  {
    text: 'Leben unter den eigenen Möglichkeiten ist eine Superpower.',
    autor: 'Vicki Robin',
  },
  {
    text: 'Geld ist ein Anspruch auf die Lebenszeit anderer Menschen.',
    autor: 'Vicki Robin',
  },
  {
    text: 'Genug ist eine Entscheidung, kein Kontostand.',
    autor: 'Vicki Robin',
  },
  {
    text: 'Bewusste Ausgaben schaffen bewusste Freiheit.',
    autor: 'Vicki Robin',
  },
  {
    text: 'Automatisiere gute Entscheidungen.',
    autor: 'Ramit Sethi',
  },
  {
    text: 'Spende bewusst, spare aggressiv, investiere einfach.',
    autor: 'Ramit Sethi',
  },
  {
    text: 'Kleine Optimierungen an großen Ausgaben zählen.',
    autor: 'Ramit Sethi',
  },
  {
    text: 'Scham über Geld blockiert Lernen.',
    autor: 'Ramit Sethi',
  },
  {
    text: 'Ein Plan schlägt Motivation.',
    autor: 'Ramit Sethi',
  },
  {
    text: 'Durchschnittskosteneffekt ist Disziplin für Unsichere.',
    autor: 'Andrew Hallam',
  },
  {
    text: 'Globale Diversifikation ist Demut vor der Zukunft.',
    autor: 'Andrew Hallam',
  },
  {
    text: 'Vergleiche dich nicht mit Nachbarn — vergleiche dich mit deinen Zielen.',
    autor: 'Andrew Hallam',
  },
  {
    text: 'Niedrige Kosten sind der sicherste Alpha.',
    autor: 'Andrew Hallam',
  },
  {
    text: 'Wachstum und Value ergänzen sich über Zyklen.',
    autor: 'David Swensen',
  },
  {
    text: 'Alternative Assets brauchen Kompetenz — sonst sind sie teuer und nutzlos.',
    autor: 'David Swensen',
  },
  {
    text: 'Rebalancing erzwingt günstig kaufen und teuer verkaufen.',
    autor: 'David Swensen',
  },
  {
    text: 'Liquidität hat einen Preis — und einen Nutzen.',
    autor: 'David Swensen',
  },
  {
    text: 'Aktienübergewicht langfristig, aber nicht blind.',
    autor: 'David Swensen',
  },
  {
    text: 'Leseroutine ist der beste Investment-Edge.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Vermeide Situationen, in denen du klug sein musst.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Neid ist giftig für Anleger und Menschen.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Zuverlässigkeit ist unterschätzt.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Der Zinseszins braucht ungestörte Zeit.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Nicht verlieren ist der halbe Sieg.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Konzentration auf den eigenen Kompetenzkreis.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Integrität des Managements ist nicht verhandelbar.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Cashflow ist Realität. Gewinn ist Meinung.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Ein teurer Kauf kann billig enden — und umgekehrt.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Der Markt zahlt langfristig für Eigentum an Produktivität.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Druck von außen kann dich zu schlechten Trades drängen — ignoriere ihn.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Schreibe auf, warum du kaufst — bevor du kaufst.',
    autor: 'Jason Zweig',
  },
  {
    text: 'Dein Gehirn ist auf Überleben gebaut, nicht auf Aktienmärkte.',
    autor: 'Jason Zweig',
  },
  {
    text: 'Nachrichten sind Unterhaltung mit Ticker.',
    autor: 'Jason Zweig',
  },
  {
    text: 'Überprüfe deine Annahmen, nicht nur deine Positionen.',
    autor: 'Jason Zweig',
  },
  {
    text: 'Ruhe ist ein Wettbewerbsvorteil.',
    autor: 'Jason Zweig',
  },
  {
    text: 'Volatilität ist kein Risiko — permanenter Kapitalverlust ist es.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Illiquidität kann Chance sein, wenn du Zeit hast.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Komplexität versteckt oft Risiko.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Sondersituationen belohnen Vorbereitung.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Konträr sein nur, wenn die Fakten mitgehen.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Ein gutes Investment erklärt sich in einfachen Sätzen.',
    autor: 'Peter Lynch',
  },
  {
    text: 'Wenn die Story zu gut klingt, prüfe doppelt.',
    autor: 'Peter Lynch',
  },
  {
    text: 'Zykliker brauchen Timing-Demut.',
    autor: 'Peter Lynch',
  },
  {
    text: 'Turnarounds gelingen selten so schnell wie erhofft.',
    autor: 'Peter Lynch',
  },
  {
    text: 'Wachstumstitel sterben oft an zu hohen Erwartungen.',
    autor: 'Peter Lynch',
  },
  {
    text: 'Dividenden lügen nicht so leicht wie Guidance.',
    autor: 'John Bogle',
  },
  {
    text: 'Eigentum an dem gesamten Markt ist radikal einfach.',
    autor: 'John Bogle',
  },
  {
    text: 'Trading ist nach Kosten oft ein negatives Summenspiel.',
    autor: 'John Bogle',
  },
  {
    text: 'Dein Berater sollte in deinem Interesse handeln — sonst bist du das Produkt.',
    autor: 'John Bogle',
  },
  {
    text: 'Langfristig gewinnen Sparsamkeit und Zeit.',
    autor: 'John Bogle',
  },
  {
    text: 'Ein Crash testet deine Asset Allocation, nicht deine Prognosekraft.',
    autor: 'William Bernstein',
  },
  {
    text: 'Notfallreserve hält dich investiert.',
    autor: 'William Bernstein',
  },
  {
    text: 'Humankapital ist dein größtes Asset — früh im Leben.',
    autor: 'William Bernstein',
  },
  {
    text: 'Anleihen sind Stoßdämpfer, keine Renditemaschinen.',
    autor: 'William Bernstein',
  },
  {
    text: 'Bildungsrendite schlägt Spekulationsrendite.',
    autor: 'William Bernstein',
  },
  {
    text: 'Angst und Gier sind die zwei großen Markttreiber.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Opportunismus ohne Vorbereitung ist Glücksspiel.',
    autor: 'Howard Marks',
  },
  {
    text: 'Wenn alle bullisch sind, prüfe die Abseite.',
    autor: 'Howard Marks',
  },
  {
    text: 'Risikokontrolle ist Alpha in Verkleidung.',
    autor: 'Howard Marks',
  },
  {
    text: 'Gute Jahre verleiten zu schlechten Entscheidungen.',
    autor: 'Howard Marks',
  },
  {
    text: 'Schlechte Jahre lehren die wertvollsten Lektionen.',
    autor: 'Howard Marks',
  },
  {
    text: 'Ein Portfolio ist ein System — optimiere das System.',
    autor: 'Ray Dalio',
  },
  {
    text: 'Korrelationen steigen in Krisen — plane dafür.',
    autor: 'Ray Dalio',
  },
  {
    text: 'Balance schlägt Vorhersage.',
    autor: 'Ray Dalio',
  },
  {
    text: 'Fehlerprotokolle machen dich besser.',
    autor: 'Ray Dalio',
  },
  {
    text: 'Wahrheit vor Ego.',
    autor: 'Ray Dalio',
  },
  {
    text: 'Kaufe Unternehmen mit Preismacht.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Inflation ist der Feind des Bargeldsammlers.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Gute Manager allokieren Kapital wie Eigentümer.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Schlechte Manager allokieren Kapital wie Angestellte mit Bonus.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Ein Moat ohne Reinvestitionsmöglichkeit wird zur Cash-Kuh — das kann okay sein.',
    autor: 'Pat Dorsey',
  },
  {
    text: 'Wechselkosten, Netzwerkeffekte, Intangibles, Kostenvorteil — kenne deinen Moat-Typ.',
    autor: 'Pat Dorsey',
  },
  {
    text: 'Moats erodieren — überwache sie.',
    autor: 'Pat Dorsey',
  },
  {
    text: 'Stückkostenökonomie erzählt die Wahrheit hinter dem Wachstum.',
    autor: 'Pat Dorsey',
  },
  {
    text: 'Kundenbindung ist oft der beste Indikator.',
    autor: 'Pat Dorsey',
  },
  {
    text: 'Wenn du den Abwärtsschutz nicht siehst, ist das Aufwärtspotenzial egal.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Zwangsverkäufe schaffen Gelegenheiten.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Katalysatoren sind nice-to-have, nicht must-have — wenn der Preis stimmt.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Notleidende Assets belohnen Geduld und Expertise.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Absolut denken, nicht relativ zum Index hetzen.',
    autor: 'Seth Klarman',
  },
  {
    text: 'Ein Indexfonds ist Demut in Produktform.',
    autor: 'John Bogle',
  },
  {
    text: 'Je mehr du tradest, desto mehr zahlst du der Industrie.',
    autor: 'John Bogle',
  },
  {
    text: 'Die Finanzindustrie ist oft ein Kostenzentrum für den Kunden.',
    autor: 'John Bogle',
  },
  {
    text: 'Einfachheit skaliert. Komplexität bricht.',
    autor: 'John Bogle',
  },
  {
    text: 'Dein Verhalten bestimmt, ob du die Marktrendite bekommst.',
    autor: 'John Bogle',
  },
  {
    text: 'Lesen ist der billigste Hebel im Investing.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Vermeide extreme Ideologien — auch im Portfolio.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Selbstkritik ist eine Anlagestrategie.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Lerne aus den Fehlern anderer — es ist billiger.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Geduld und Aggressivität gehören zusammen: warten, dann zuschlagen.',
    autor: 'Charlie Munger',
  },
  {
    text: 'Ein Investment-Tagebuch reduziert Wiederholungsfehler.',
    autor: 'Michael Mauboussin',
  },
  {
    text: 'Prozessqualität misst du vor dem Ergebnis.',
    autor: 'Michael Mauboussin',
  },
  {
    text: 'Überconfidence ist der teuerste Bias.',
    autor: 'Michael Mauboussin',
  },
  {
    text: 'Feedback-Schleifen verbessern Entscheidungen.',
    autor: 'Michael Mauboussin',
  },
  {
    text: 'Probabilistisch denken: Bereiche, nicht Punkte.',
    autor: 'Michael Mauboussin',
  },
  {
    text: 'Die Börse ist ein Transfer von Ungeduld zu Geduld — jeden Tag.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Ein günstiger Preis ohne Qualität ist oft eine Value Trap.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Ein teurer Preis mit Qualität kann trotzdem falsch sein — warte auf bessere Einstiege.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Cash ist Optionswert in Krisen.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Reputation und Vertrauen sind Vermögenswerte.',
    autor: 'Warren Buffett',
  },
  {
    text: 'Nicht jede Gelegenheit muss genutzt werden.',
    autor: 'Howard Marks',
  },
  {
    text: 'Selektivität ist Stärke.',
    autor: 'Howard Marks',
  },
  {
    text: 'Wenn die Risikoprämie schrumpft, schrumpfe dein Risiko.',
    autor: 'Howard Marks',
  },
  {
    text: 'Wenn die Risikoprämie wächst, werde mutiger — mit System.',
    autor: 'Howard Marks',
  },
  {
    text: 'Marktregime ändern sich — Strategien müssen mitdenken.',
    autor: 'Howard Marks',
  },
  {
    text: 'Einen Plan für Crashs schreibt man bei Sonne.',
    autor: 'William Bernstein',
  },
  {
    text: 'Liquiditätsbedarf und Anlagehorizont müssen passen.',
    autor: 'William Bernstein',
  },
  {
    text: 'Steuern sind Teil der Netto-Rendite.',
    autor: 'William Bernstein',
  },
  {
    text: 'Kostenquote ist der sicherste Prognosefaktor.',
    autor: 'William Bernstein',
  },
  {
    text: 'Schlaf gut — sonst hältst du die Strategie nicht durch.',
    autor: 'William Bernstein',
  },
  {
    text: 'Quality Investing heißt: weniger Fehler, mehr Compounding.',
    autor: 'Terry Smith',
  },
  {
    text: 'Vermeide Unternehmen, die ständig Kapital vernichten.',
    autor: 'Terry Smith',
  },
  {
    text: 'Free-Cashflow-Conversion sagt mehr als EBITDA-Märchen.',
    autor: 'Terry Smith',
  },
  {
    text: 'Kultur und Kapitaldisziplin gehören zusammen.',
    autor: 'Terry Smith',
  },
  {
    text: 'Langfristig zählt der intrinsische Wertpfad.',
    autor: 'Terry Smith',
  },
  {
    text: 'Ein gutes Leben braucht genug — nicht maximal.',
    autor: 'Morgan Housel',
  },
  {
    text: 'Freiheit ist die höchste Dividende.',
    autor: 'Morgan Housel',
  },
  {
    text: 'Vergleiche dich abwärts, um dankbar zu bleiben — und aufwärts, um zu lernen.',
    autor: 'Morgan Housel',
  },
  {
    text: 'Raum für Fehler ist die wahre Sicherheitsmarge im Leben.',
    autor: 'Morgan Housel',
  },
  {
    text: 'Zuerst überleben. Dann compounden.',
    autor: 'Morgan Housel',
  },
  {
    text: 'Heute sparen ist morgen wählen können.',
    autor: 'Vicki Robin',
  },
  {
    text: 'Konsum ist oft ein Ersatz für Klarheit.',
    autor: 'Vicki Robin',
  },
  {
    text: 'Tracke Ausgaben, um Werte zu tracken.',
    autor: 'Vicki Robin',
  },
  {
    text: 'Finanzielle Unabhängigkeit ist ein Spektrum.',
    autor: 'Vicki Robin',
  },
  {
    text: 'Zeit ist die knappste Ressource — allokiere sie wie Kapital.',
    autor: 'Naval Ravikant',
  },
  {
    text: 'Spezifisches Wissen und Ownership schlagen Lohnarbeit langfristig.',
    autor: 'Naval Ravikant',
  },
  {
    text: 'Hebel verstehen: Kapital, Code, Medien, Menschen.',
    autor: 'Naval Ravikant',
  },
  {
    text: 'Spiele Spiele mit positivem Gesamtnutzen.',
    autor: 'Naval Ravikant',
  },
  {
    text: 'Ruhe und Klarheit sind Produktivitäts-Assets.',
    autor: 'Naval Ravikant',
  },
  {
    text: 'Ein Investment ohne Exit-These braucht eine Hold-These.',
    autor: 'Philip Fisher',
  },
  {
    text: 'Forschung vor dem Kauf ist billiger als Reue danach.',
    autor: 'Philip Fisher',
  },
  {
    text: 'Wachstum und Profitabilität müssen zusammenpassen.',
    autor: 'Philip Fisher',
  },
  {
    text: 'Vermeide Tipps von Leuten ohne eigenes Risiko.',
    autor: 'Philip Fisher',
  },
  {
    text: 'Langfristige Freundschaft mit einem Unternehmen schlägt Short-Term-Dating.',
    autor: 'Philip Fisher',
  },
  {
    text: 'Der Markt ist kurzfristig demokratisch und langfristig meritokratisch.',
    autor: 'Benjamin Graham',
  },
  {
    text: 'Sicherheitsmarge ist Demut in Zahlen.',
    autor: 'Benjamin Graham',
  },
  {
    text: 'Analyse vor Aktion — immer.',
    autor: 'Benjamin Graham',
  },
  {
    text: 'Emotionen sind Teil der Gleichung — deshalb brauchst du Regeln.',
    autor: 'Benjamin Graham',
  },
  {
    text: 'Ein Investor verdient Geld durch Denken, ein Spekulant durch Hoffen.',
    autor: 'Benjamin Graham',
  },
  {
    text: 'Wenn alle dasselbe Asset wollen, ist der Preis oft schon die Warnung.',
    autor: 'Sir John Templeton',
  },
  {
    text: 'Suche weltweit — Chancen sind nicht lokal begrenzt.',
    autor: 'Sir John Templeton',
  },
  {
    text: 'Eigene Überzeugungen testen gegen Daten.',
    autor: 'Sir John Templeton',
  },
  {
    text: 'Demut vor der Ungewissheit der Zukunft.',
    autor: 'Sir John Templeton',
  },
  {
    text: 'Bargeld in der Krise ist Mut in Reserve.',
    autor: 'Sir John Templeton',
  },
  {
    text: 'Ein Index ist die Durchschnittsmeinung — schlagen ist schwer nach Kosten.',
    autor: 'Burton Malkiel',
  },
  {
    text: 'Diversifikation über Länder und Sektoren reduziert Idiosynkrasie.',
    autor: 'Burton Malkiel',
  },
  {
    text: 'Rebalancing-Disziplin schlägt Market-Timing.',
    autor: 'Burton Malkiel',
  },
  {
    text: 'Bildung über Produkte schützt vor Verkaufsdruck.',
    autor: 'Burton Malkiel',
  },
  {
    text: 'Langfristige Aktienquote braucht langfristige Nerven.',
    autor: 'Burton Malkiel',
  },
  {
    text: 'Dividendenwachstum ist oft nachhaltiger als hohe aktuelle Yields.',
    autor: 'Jeremy Siegel',
  },
  {
    text: 'Sektor-Rotation klingt klug und endet oft teuer.',
    autor: 'Jeremy Siegel',
  },
  {
    text: 'Historische Renditen sind ein Kompass, keine Garantie.',
    autor: 'Jeremy Siegel',
  },
  {
    text: 'Inflationsschutz kommt von produktiven Assets.',
    autor: 'Jeremy Siegel',
  },
  {
    text: 'Zeit diversifiziert besser als viele Trades.',
    autor: 'Jeremy Siegel',
  },
  {
    text: 'Narrative Awareness: Merke, welche Geschichte der Markt gerade glaubt.',
    autor: 'Robert Shiller',
  },
  {
    text: 'Überschwang ist ansteckend — Impfung ist Skepsis.',
    autor: 'Robert Shiller',
  },
  {
    text: 'Immobilien und Aktien haben eigene Psychologie-Zyklen.',
    autor: 'Robert Shiller',
  },
  {
    text: 'Messbare Übertreibung heißt nicht sofortige Korrektur.',
    autor: 'Robert Shiller',
  },
  {
    text: 'Langfristige Erwartungen managen ist Risikomanagement.',
    autor: 'Robert Shiller',
  },
] as const

/** Tag-des-Jahres 1..366 → Index 0..364 (Schalttag 366 wrappt). */
export function tageszitatIndexFuerDatum(datumIso: string): number {
  const [y, m, d] = datumIso.split('-').map(Number)
  const start = Date.UTC(y!, 0, 0)
  const current = Date.UTC(y!, m! - 1, d!)
  const dayOfYear = Math.floor((current - start) / 86_400_000)
  return (dayOfYear - 1) % INVESTOR_TAGESZITATE.length
}

export function tageszitatFuerDatum(datumIso: string): InvestorTageszitat {
  return INVESTOR_TAGESZITATE[tageszitatIndexFuerDatum(datumIso)]!
}
