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
 *  2. **Zwei Varianten.** `buch` misst, ob sich auch das per Akquisition zugekaufte
 *     Kapital verzinst. `organisch` rechnet Goodwill und Intangibles heraus und misst die
 *     Reinvestitionsrendite des laufenden Geschäfts. Bei S&P Global ist der Kontrast
 *     zwischen ROIC (~10 %) und organischem ROIIC die eigentliche Aussage.
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
/** Fenster in Präferenzreihenfolge (längere Fenster glätten Einmaleffekte). */
const FENSTER_PRAEFERENZ = [5, 4, 3, 2]

export type RoiicRegime =
  /** ΔIC deutlich positiv — klassisches ΔNOPAT/ΔIC. */
  | 'normal'
  /** Kapitalbasis stagniert oder schrumpft bei steigendem NOPAT. */
  | 'kapitalleicht'
  /** NOPAT rückläufig. */
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
  icTangibleMio: number | null
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
        icTangibleMio: a?.icTangibleMio ?? null,
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

  const icFeld = art === 'organisch' ? 'icTangibleMio' : 'icMio'
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
      const { pct, gedeckelt } = begrenze(rohPct, DECKEL_NORMAL)
      return {
        ...gemeinsam,
        pct,
        pctRoh: Math.round(rohPct * 10) / 10,
        regime: 'schrumpfend',
        nennerMio: Math.round(deltaIc * 10) / 10,
        gedeckelt,
        begruendung: 'NOPAT rückläufig trotz Kapitalaufbau — negative Grenzrendite.',
      }
    }
    return {
      ...gemeinsam,
      pct: null,
      pctRoh: null,
      regime: 'schrumpfend',
      nennerMio: null,
      gedeckelt: false,
      begruendung: 'NOPAT und Kapitalbasis schrumpfen zugleich — Quotient ohne Aussage.',
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
  const reinvest = summeReinvest(zeilen, icVon.jahr, icBis.jahr, maJahre)
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
 * Fenster, die eine Großakquisition überspannen, sind für die organische Variante
 * unbrauchbar: der zugekaufte Gewinn steckt im Zähler, das zugekaufte Kapital ist aus dem
 * Nenner herausgerechnet. Bei S&P Global ergäbe das eine Reinvestitionsrendite, die nur
 * den IHS-Markit-Zukauf spiegelt.
 *
 * Zulässig ist ein Fenster, dessen Kapital-Startjahr auf oder nach dem Dealjahr liegt —
 * die Eröffnungsbilanz enthält die Akquisition dann bereits.
 */
function fensterErlaubt(variante: RoiicVariante, art: RoiicArt): boolean {
  return art !== 'organisch' || !variante.fensterUeberspanntMa
}

/**
 * Bestes Fenster je Variante: längstes Fenster mit belastbarem Ergebnis, dealfreie Fenster
 * zuerst.
 *
 * Der Rückfall auf ein Fenster mit Deal ist nötig, weil sonst genau die Titel mit dem
 * frischesten Zukauf keinen Wert bekämen — bei Home Depot (Deal 2025) oder ServiceNow
 * (2025) liegt zwischen Abschluss und letztem Berichtsjahr kein volles Jahr. Ein
 * gekennzeichneter Wert ist dort aussagekräftiger als `null`.
 */
function waehleVariante(zeilen: Zeile[], art: RoiicArt, maJahre: number[]): RoiicVariante | null {
  const kandidaten: RoiicVariante[] = []
  for (const spanne of FENSTER_PRAEFERENZ) {
    const v = berechneVariante(zeilen, art, spanne, maJahre)
    if (v) kandidaten.push(v)
  }
  const brauchbar = kandidaten.filter((v) => v.pct != null && v.regime !== 'unzureichend')
  const dealfrei = brauchbar.filter((v) => fensterErlaubt(v, art))
  if (dealfrei.length > 0) return dealfrei[0]!
  const ersatz = brauchbar[0] ?? kandidaten[0] ?? null
  if (ersatz == null || !ersatz.fensterUeberspanntMa || art !== 'organisch') return ersatz
  return {
    ...ersatz,
    begruendung: `${ersatz.begruendung} Kein dealfreies Fenster verfügbar — Akquisition im Zeitraum, Wert nach oben verzerrt.`,
  }
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
    for (const spanne of FENSTER_PRAEFERENZ) {
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
