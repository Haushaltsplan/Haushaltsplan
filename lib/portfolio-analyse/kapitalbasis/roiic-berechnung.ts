/**
 * ROIIC — Rendite auf das *zusätzlich* investierte Kapital.
 *
 * Warum die alte Berechnung bei Qualitätstiteln systematisch versagte: sie setzte
 * ΔNOPAT und ΔIC über dasselbe Fenster und verwarf das Ergebnis, sobald ΔIC klein oder
 * negativ war. Genau das ist bei den interessantesten Titeln der Normalfall — S&P Global
 * baut nach der IHS-Markit-Integration Kapital ab (Rückkäufe, Amortisation), während
 * NOPAT wächst: ΔIC 2022→2024 = −1.794 Mio., ΔIC tangible = −416 Mio. Jede Buchformel
 * liefert dort entweder ein negatives Artefakt (−103 %) oder `null`.
 *
 * Drei Festlegungen:
 *
 *  1. **Ein Jahr Lag.** Kapital, das in t investiert wird, verdient erst in t+1. ΔNOPAT
 *     läuft über (T−n → T), ΔIC über (T−n−1 → T−1).
 *  2. **Zwei Varianten, beide ohne Liquidität.** `buch` misst, ob sich auch das per
 *     Akquisition zugekaufte Kapital verzinst. `organisch` rechnet zusätzlich Goodwill und
 *     Intangibles heraus und misst die Reinvestitionsrendite des laufenden Geschäfts. Bei
 *     S&P Global ist der Kontrast zwischen ROIC (~10 %) und organischem ROIIC die
 *     eigentliche Aussage. Anders als beim ROIC-Niveau wird der Cash-Bestand abgezogen:
 *     einbehaltener Gewinn, der in der Bilanz liegt, ist keine Reinvestition.
 *  3. **Regime statt `null`.** Schrumpft die Kapitalbasis bei steigendem NOPAT, ist der
 *     ökonomisch richtige Nenner nicht ΔIC, sondern die tatsächlich getätigte
 *     Reinvestition: CapEx + kapitalisierte Software + Aufbau von Working Capital, M&A
 *     ausgeschlossen. Das Ergebnis wird gedeckelt und als `kapitalleicht` gekennzeichnet.
 *     D&A wird dabei *nicht* abgezogen — bei amortisationslastigen Titeln (SPGI: D&A
 *     1.179 Mio. gegen CapEx 195 Mio.) würde der Nenner sonst negativ.
 */

import type {
  KapitalbasisAbleitung,
  KapitalbasisJahr,
} from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-typen'

/** Obergrenze im kapitalleichten Regime — jenseits davon ist der Nenner zu klein für Präzision. */
const DECKEL_KAPITALLEICHT = 60
/**
 * Obergrenze bei echtem Kapitalaufbau. Höhere Werte kommen hier nicht an: sie werden
 * vorher ins kapitalleichte Regime umgeleitet, weil ein Buchnenner, der über 100 % ergibt,
 * die tatsächliche Investition nicht abbildet.
 */
const DECKEL_NORMAL = 100
const BODEN = -100
/**
 * Fenster: **drei Geschäftsjahre**, fest für alle Titel.
 *
 * `spanne` ist der Abstand zwischen erstem und letztem Jahr, drei Geschäftsjahre
 * entsprechen also `spanne = 2` — genau das Fenster der Referenzrechnung für S&P Global
 * (ΔNOPAT 2023→2025, ΔIC 2022→2024).
 *
 * Längere Fenster verwässern: sie ziehen Jahre herein, in denen ein anderes Geschäft
 * gemessen wird. Bei Thermo Fisher reichte ein Vier-Jahres-Fenster bis 2022 zurück und
 * damit ins Corona-Testgeschäft, das es heute nicht mehr gibt — der Titel wies dadurch
 * Stagnation aus, obwohl NOPAT seit 2023 um 942 Mio. gestiegen ist.
 *
 * Der Rückfall auf zwei Geschäftsjahre greift nur, wenn die Historie für drei nicht reicht.
 */
const SPANNE_STANDARD = 2
const FENSTER_PRAEFERENZ = [SPANNE_STANDARD, 1]
/** Nur für den Audit-Pfad: zeigt, wie das Ergebnis über andere Fenster aussähe. */
const FENSTER_AUDIT = [5, 4, 3, 2, 1]

export type RoiicRegime =
  /** ΔIC deutlich positiv — klassisches ΔNOPAT/ΔIC. */
  | 'normal'
  /** Kapitalbasis stagniert oder schrumpft bei steigendem NOPAT. */
  | 'kapitalleicht'
  /**
   * NOPAT liegt unter dem Ausgangsniveau. Der ausgewiesene Wert ist dann 0 und nicht
   * negativ — siehe Begründung in `berechneVariante`.
   */
  | 'schrumpfend'
  /** Datenlage reicht nicht. */
  | 'unzureichend'

export type RoiicArt = 'buch' | 'organisch'

export type RoiicVariante = {
  art: RoiicArt
  pct: number | null
  /**
   * Wert vor Deckelung. Im kapitalleichten Regime laufen sonst viele Titel auf denselben
   * Deckelwert und wären nicht mehr unterscheidbar.
   */
  pctRoh: number | null
  regime: RoiicRegime
  fensterJahre: number
  nopatVonJahr: number
  nopatBisJahr: number
  icVonJahr: number
  icBisJahr: number
  deltaNopatMio: number
  deltaIcMio: number | null
  /** Tatsächlich verwendeter Nenner (ΔIC oder Brutto-Reinvestition). */
  nennerMio: number | null
  gedeckelt: boolean
  /**
   * Fenster überspannt eine Großakquisition. Dann steckt zugekaufter Gewinn im Zähler,
   * während die organische Variante das zugekaufte Kapital aus dem Nenner nimmt — der Wert
   * ist nach oben verzerrt und nur eingeschränkt vergleichbar.
   */
  fensterUeberspanntMa: boolean
  begruendung: string
}

export type RoiicPaket = {
  /** Leitwert für Score und Anzeige: organisch, sonst buch. */
  roiicPct: number | null
  leitArt: RoiicArt | null
  organisch: RoiicVariante | null
  buch: RoiicVariante | null
  /** Jahre mit sprunghaftem Goodwill-Aufbau (Großakquisition). */
  maJahre: number[]
  /** Alle geprüften Fenster — für Audit und Nachvollziehbarkeit. */
  alleVarianten: RoiicVariante[]
}

export function leeresRoiicPaket(): RoiicPaket {
  return {
    roiicPct: null,
    leitArt: null,
    organisch: null,
    buch: null,
    maJahre: [],
    alleVarianten: [],
  }
}

type Zeile = {
  jahr: number
  nopatMio: number | null
  icMio: number | null
  icNettoMio: number | null
  icTangibleNettoMio: number | null
  bruttoReinvestMio: number | null
  workingCapitalMio: number | null
  goodwillMio: number | null
  intangiblesMio: number | null
  akquisitionenMio: number | null
}

function baueZeilen(jahre: KapitalbasisJahr[], ableitungen: KapitalbasisAbleitung[]): Zeile[] {
  const abl = new Map(ableitungen.map((a) => [a.jahr, a]))
  return jahre
    .map((j) => {
      const a = abl.get(j.jahr)
      return {
        jahr: j.jahr,
        nopatMio: a?.nopatMio ?? null,
        icMio: a?.icMio ?? null,
        icNettoMio: a?.icNettoMio ?? null,
        icTangibleNettoMio: a?.icTangibleNettoMio ?? null,
        bruttoReinvestMio: a?.bruttoReinvestMio ?? null,
        workingCapitalMio: a?.workingCapitalMio ?? null,
        goodwillMio: j.goodwillMio,
        intangiblesMio: j.intangiblesMio,
        akquisitionenMio: j.akquisitionenMio,
      }
    })
    .sort((a, b) => a.jahr - b.jahr)
}

/**
 * Großakquisitionen erkennen: Sprung in Goodwill + Intangibles, gemessen relativ zur
 * Kapitalbasis des Vorjahres. Relativ statt absolut, damit die Schwelle unabhängig von
 * Unternehmensgröße und Berichtswährung greift.
 */
function findeMaJahre(zeilen: Zeile[]): number[] {
  const out: number[] = []
  for (let i = 1; i < zeilen.length; i++) {
    const vor = zeilen[i - 1]!
    const jetzt = zeilen[i]!
    const vorher = (vor.goodwillMio ?? 0) + (vor.intangiblesMio ?? 0)
    const nachher = (jetzt.goodwillMio ?? 0) + (jetzt.intangiblesMio ?? 0)
    const sprung = nachher - vorher
    const basis = Math.abs(vor.icMio ?? 0)
    if (basis <= 0) continue
    if (sprung / basis >= 0.2 && sprung > 0) out.push(jetzt.jahr)
  }
  return out
}

/**
 * Tatsächlich eingesetztes Wachstumskapital im Fenster: CapEx + kapitalisierte Software
 * + Aufbau von Working Capital + **Bolt-on-Zukäufe**.
 *
 * Summiert wird über die Jahre des NOPAT-Fensters, nicht über das um ein Jahr versetzte
 * Kapitalfenster: gefragt ist, wie viel Kapital das Unternehmen in den drei gemessenen
 * Geschäftsjahren eingesetzt hat, während der Gewinn um den gemessenen Betrag stieg.
 *
 * Kleine Zukäufe gehören in den Nenner — bei Seriell-Akquirierern wie Halma, Balchem oder
 * Wolters Kluwer ist Zukauf das Wachstumsmodell, und ein Nenner aus reinem CapEx würde sie
 * fälschlich als kapitalleicht ausweisen. Ausgenommen bleiben nur die als Großdeal
 * erkannten Jahre, deren Kapital die organische Variante ohnehin herausrechnet.
 */
function summeReinvest(
  zeilen: Zeile[],
  vonJahr: number,
  bisJahr: number,
  maJahre: number[],
): number | null {
  let summe = 0
  let treffer = 0
  for (const z of zeilen) {
    if (z.jahr <= vonJahr || z.jahr > bisJahr) continue
    if (z.bruttoReinvestMio == null) continue
    summe += z.bruttoReinvestMio
    if (!maJahre.includes(z.jahr) && z.akquisitionenMio != null) {
      summe += Math.abs(z.akquisitionenMio)
    }
    treffer++
  }
  if (treffer === 0) return null
  const wcVon = zeilen.find((z) => z.jahr === vonJahr)?.workingCapitalMio
  const wcBis = zeilen.find((z) => z.jahr === bisJahr)?.workingCapitalMio
  if (wcVon != null && wcBis != null) summe += Math.max(0, wcBis - wcVon)
  return summe
}

function begrenze(pct: number, deckel: number): { pct: number; gedeckelt: boolean } {
  if (pct > deckel) return { pct: deckel, gedeckelt: true }
  if (pct < BODEN) return { pct: BODEN, gedeckelt: true }
  return { pct: Math.round(pct * 10) / 10, gedeckelt: false }
}

function berechneVariante(
  zeilen: Zeile[],
  art: RoiicArt,
  spanne: number,
  maJahre: number[],
): RoiicVariante | null {
  const letzte = zeilen[zeilen.length - 1]
  if (!letzte) return null

  const nopatBis = letzte
  const nopatVon = zeilen.find((z) => z.jahr === letzte.jahr - spanne)
  const icBis = zeilen.find((z) => z.jahr === letzte.jahr - 1)
  const icVon = zeilen.find((z) => z.jahr === letzte.jahr - spanne - 1)
  if (!nopatVon || !icBis || !icVon) return null
  if (nopatBis.nopatMio == null || nopatVon.nopatMio == null) return null

  // Beide Varianten rechnen Liquidität heraus. ROIIC misst die Rendite auf *neu
  // eingesetztes* Kapital; ein wachsender Cash-Bestand ist kein Einsatz, sondern
  // Zurückhaltung, und blähte den Nenner bei liquiditätsstarken Titeln auf.
  const icFeld = art === 'organisch' ? 'icTangibleNettoMio' : 'icNettoMio'
  const icBisWert = icBis[icFeld]
  const icVonWert = icVon[icFeld]
  // Signifikanzmaßstab ist immer das Buch-IC, also die tatsächliche Unternehmensgröße.
  // Am tangiblen Kapital gemessen wäre die Schwelle bei goodwill-lastigen Titeln winzig:
  // bei Waste Management genügten dann rund 300 Mio. Kapitalzuwachs auf eine Basis von
  // 30 Mrd., um als echter Kapitalaufbau zu gelten — Ergebnis war ein organischer ROIIC
  // von 146 % gegen 12,8 % auf Buchbasis.
  const groessenMassstab = Math.abs(icBis.icMio ?? icBisWert ?? 0)

  const deltaNopat = nopatBis.nopatMio - nopatVon.nopatMio
  const deltaIc = icBisWert != null && icVonWert != null ? icBisWert - icVonWert : null

  const gemeinsam = {
    art,
    fensterUeberspanntMa: maJahre.some((m) => m > icVon.jahr),
    fensterJahre: spanne,
    nopatVonJahr: nopatVon.jahr,
    nopatBisJahr: nopatBis.jahr,
    icVonJahr: icVon.jahr,
    icBisJahr: icBis.jahr,
    deltaNopatMio: Math.round(deltaNopat * 10) / 10,
    deltaIcMio: deltaIc != null ? Math.round(deltaIc * 10) / 10 : null,
  }

  if (deltaIc == null) {
    return {
      ...gemeinsam,
      pct: null,
      pctRoh: null,
      regime: 'unzureichend',
      nennerMio: null,
      gedeckelt: false,
      begruendung: 'Kapitalbasis für das Fenster nicht vollständig.',
    }
  }

  // Wann gilt ΔIC als „nicht vorhanden"? Relativ zur Kapitalbasis, damit die Schwelle
  // bei Microsoft (IC ~480 Mrd.) und Balchem (IC ~1 Mrd.) gleich streng ist.
  const schwelle = Math.max(1, groessenMassstab * 0.02)
  // Zweite Bedingung: liefert der Buchnenner über ein Mehrjahresfenster mehr als einen
  // Euro Zusatzgewinn je Euro Zusatzkapital, misst die Bilanzveränderung die tatsächliche
  // Investition nicht mehr — dann ist die Brutto-Reinvestition der ehrlichere Nenner.
  const kapitalWaechst = deltaIc > schwelle && deltaNopat / deltaIc <= 1

  if (deltaNopat <= 0) {
    if (kapitalWaechst) {
      const rohPct = (deltaNopat / deltaIc) * 100
      return {
        ...gemeinsam,
        // Null, nicht negativ. Der Quotient aus Gewinnrückgang und Kapitalzuwachs ist keine
        // Rendite: der Rückgang stammt aus dem Altgeschäft, nicht aus dem neuen Kapital.
        // Thermo Fisher wies so −10,2 % aus, obwohl das heißen würde, das investierte
        // Kapital vernichte jährlich ein Zehntel seines Werts. Richtig ist: die
        // Reinvestition hat bisher keine messbare Zusatzrendite gebracht. Die Größe des
        // Rückgangs bleibt in `pctRoh` erhalten.
        pct: 0,
        pctRoh: Math.round(rohPct * 10) / 10,
        regime: 'schrumpfend',
        nennerMio: Math.round(deltaIc * 10) / 10,
        gedeckelt: false,
        begruendung: `NOPAT liegt ${Math.abs(Math.round(deltaNopat))} Mio. unter dem Ausgangsniveau, obwohl ${Math.round(deltaIc)} Mio. Kapital zugeflossen sind — die Reinvestition hat noch keine Zusatzrendite erbracht.`,
      }
    }
    // Auch hier 0 statt `null`: Gewinn und Kapitalbasis gehen zugleich zurück, es gibt also
    // kein zusätzlich eingesetztes Kapital, dem eine Rendite zuzuordnen wäre. Vorher fielen
    // Home Depot und Datadog dadurch komplett aus der Kennzahl.
    return {
      ...gemeinsam,
      pct: 0,
      pctRoh: null,
      regime: 'schrumpfend',
      nennerMio: null,
      gedeckelt: false,
      begruendung: `NOPAT liegt ${Math.abs(Math.round(deltaNopat))} Mio. unter dem Ausgangsniveau, die Kapitalbasis schrumpft ebenfalls — keine Reinvestitionsrendite messbar.`,
    }
  }

  if (kapitalWaechst) {
    const rohPct = (deltaNopat / deltaIc) * 100
    const { pct, gedeckelt } = begrenze(rohPct, DECKEL_NORMAL)
    return {
      ...gemeinsam,
      pct,
      pctRoh: Math.round(rohPct * 10) / 10,
      regime: 'normal',
      nennerMio: Math.round(deltaIc * 10) / 10,
      gedeckelt,
      begruendung: `ΔNOPAT ${gemeinsam.deltaNopatMio} Mio. auf ΔIC ${gemeinsam.deltaIcMio} Mio.`,
    }
  }

  // Kapitalleicht: Nenner ist die tatsächliche Reinvestition, nicht die Bilanzveränderung.
  const reinvest = summeReinvest(zeilen, nopatVon.jahr - 1, nopatBis.jahr, maJahre)
  if (reinvest == null || reinvest <= 0) {
    return {
      ...gemeinsam,
      pct: DECKEL_KAPITALLEICHT,
      pctRoh: null,
      regime: 'kapitalleicht',
      nennerMio: null,
      gedeckelt: true,
      begruendung:
        'NOPAT wächst ohne messbaren Kapitaleinsatz — Reinvestitionsdaten fehlen, Wert gedeckelt.',
    }
  }
  const rohPct = (deltaNopat / reinvest) * 100
  const { pct, gedeckelt } = begrenze(rohPct, DECKEL_KAPITALLEICHT)
  return {
    ...gemeinsam,
    pct,
    pctRoh: Math.round(rohPct * 10) / 10,
    regime: 'kapitalleicht',
    nennerMio: Math.round(reinvest * 10) / 10,
    gedeckelt,
    begruendung: `Kapitalbasis stagniert (ΔIC ${gemeinsam.deltaIcMio} Mio.) — Nenner ist die Brutto-Reinvestition von ${Math.round(reinvest)} Mio.`,
  }
}

/**
 * Festes Drei-Jahres-Fenster für beide Varianten. Organisch darf nicht heimlich auf
 * zwei Jahre verkürzen, nur weil ein Deal im Fenster liegt — sonst vergleicht man
 * bei Rollins 11 % (2J, dealfrei) mit 88 % Buch (3J inkl. Deal). Der Deal wird
 * gekennzeichnet, nicht umgangen. Kürzer nur, wenn die Historie für drei Jahre fehlt.
 */
function waehleVariante(zeilen: Zeile[], art: RoiicArt, maJahre: number[]): RoiicVariante | null {
  for (const spanne of FENSTER_PRAEFERENZ) {
    const v = berechneVariante(zeilen, art, spanne, maJahre)
    if (!v || v.pct == null || v.regime === 'unzureichend') continue
    if (art === 'organisch' && v.fensterUeberspanntMa) {
      return {
        ...v,
        begruendung: `${v.begruendung} Akquisition im Zeitraum — organischer Wert nach oben verzerrt.`,
      }
    }
    return v
  }
  return berechneVariante(zeilen, art, FENSTER_PRAEFERENZ[0]!, maJahre)
}

export function berechneRoiic(
  jahre: KapitalbasisJahr[],
  ableitungen: KapitalbasisAbleitung[],
): RoiicPaket {
  const zeilen = baueZeilen(jahre, ableitungen)
  if (zeilen.length < 3) return leeresRoiicPaket()

  const maJahre = findeMaJahre(zeilen)
  const organisch = waehleVariante(zeilen, 'organisch', maJahre)
  const buch = waehleVariante(zeilen, 'buch', maJahre)

  const alleVarianten: RoiicVariante[] = []
  for (const art of ['organisch', 'buch'] as RoiicArt[]) {
    for (const spanne of FENSTER_AUDIT) {
      const v = berechneVariante(zeilen, art, spanne, maJahre)
      if (v) alleVarianten.push(v)
    }
  }

  const leit = organisch?.pct != null ? organisch : buch?.pct != null ? buch : null

  return {
    roiicPct: leit?.pct ?? null,
    leitArt: leit?.art ?? null,
    organisch,
    buch,
    maJahre,
    alleVarianten,
  }
}
