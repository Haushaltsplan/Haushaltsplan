/**
 * Abgeleitete Kapitalgrößen aus der Kapitalbasis-Serie: Steuersatz, NOPAT, IC, ROIC.
 *
 * Zwei Definitionsentscheidungen, die hier bewusst festgelegt sind:
 *
 * **IC ohne Cash-Abzug.** Investiertes Kapital = Eigenkapital inkl. Minderheiten +
 * Gesamtschulden. Der Abzug von Bargeld (Damodaran-Konvention) lässt die Kapitalbasis
 * bei rückkaufstarken Titeln kollabieren und erzeugt absurde Renditen: SPGI 2021 hätte
 * netto ein IC von 3.142 Mio. → ROIC 105 %, brutto 9.650 Mio. → 34 %. Die Referenzwerte
 * (SPGI 2025: IC ~49.700, ROIC ~10,1 %) folgen der Brutto-Definition; die Netto-Variante
 * wird als `icNettoMio` weiterhin mitgeführt.
 *
 * **Steuersatz normalisiert.** Der rohe effektive Satz enthält Einmaleffekte, die NOPAT
 * um Größenordnungen verzerren: Microsofts TCJA-Jahr kommt auf über 50 % und drückt den
 * ROIC von ~22 % auf 11 %. Ausreißer außerhalb eines Plausibilitätsbands werden daher
 * durch den Median der übrigen Jahre ersetzt und als ersetzt markiert.
 */

import type {
  KapitalbasisAbleitung,
  KapitalbasisJahr,
} from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-typen'

const STEUER_UNTERGRENZE = 0.05
const STEUER_OBERGRENZE = 0.4
const STEUER_DEFAULT = 0.21

function median(werte: number[]): number | null {
  if (werte.length === 0) return null
  const s = [...werte].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!
}

/**
 * Vorsteuerergebnis. Rekonstruktion aus Nettogewinn + Steuer ist der verlässlichere Weg,
 * wenn der getaggte Wert unplausibel ist: ein Vorsteuerergebnis unterhalb des
 * Nettogewinns kann bei positiver Steuerlast nicht stimmen und deutet darauf hin, dass
 * eine Teilmenge aus der Steuerfußnote getaggt wurde.
 */
function pretaxMio(j: KapitalbasisJahr): number | null {
  const rekonstruiert =
    j.nettogewinnMio != null && j.steuerMio != null ? j.nettogewinnMio + j.steuerMio : null

  if (j.pretaxMio != null) {
    const unplausibel =
      j.nettogewinnMio != null && j.steuerMio != null && j.steuerMio > 0
        ? j.pretaxMio < j.nettogewinnMio
        : false
    if (!unplausibel) return j.pretaxMio
  }
  return rekonstruiert ?? j.pretaxMio
}

function roherSteuersatz(j: KapitalbasisJahr): number | null {
  const pretax = pretaxMio(j)
  if (pretax == null || pretax <= 0 || j.steuerMio == null) return null
  const satz = j.steuerMio / pretax
  return Number.isFinite(satz) ? satz : null
}

export function eigenkapitalBasisMio(j: KapitalbasisJahr): number | null {
  const kern =
    j.eigenkapitalInklMinderheitenMio ??
    (j.eigenkapitalParentMio != null
      ? j.eigenkapitalParentMio + (j.minderheitenMio ?? 0)
      : null)
  if (kern == null) return null
  return kern + (j.rueckkaufbareMinderheitenMio ?? 0)
}

export function gesamtschuldenMio(j: KapitalbasisJahr): number | null {
  const lang = j.langfristigeSchuldenMio
  const kurz = j.kurzfristigeSchuldenMio
  if (lang == null && kurz == null) return null
  return (lang ?? 0) + (kurz ?? 0)
}

function rundeOderNull(v: number | null, stellen = 1): number | null {
  if (v == null || !Number.isFinite(v)) return null
  const f = 10 ** stellen
  return Math.round(v * f) / f
}

/**
 * Steuersätze normalisieren: plausible Sätze bleiben, Ausreißer und Lücken werden
 * ersetzt.
 *
 * Der Ersatzwert stammt aus dem zeitlichen Umfeld des betroffenen Jahres, nicht aus der
 * Gesamthistorie. Ein globaler Median schleppt sonst das Vor-TCJA-Niveau in die
 * Gegenwart: McDonald's taggt in neueren Abschlüssen kein Pretax-Ergebnis, der Median
 * über die volle Historie liegt bei 34 % (US-Satz vor 2018) und drückt den heutigen
 * NOPAT um rund ein Sechstel.
 */
const STEUER_FENSTER_JAHRE = 4

function normalisierteSteuersaetze(
  jahre: KapitalbasisJahr[],
): Map<number, { satz: number; ersetzt: boolean }> {
  const roh = new Map<number, number | null>()
  for (const j of jahre) roh.set(j.jahr, roherSteuersatz(j))

  const istPlausibel = (s: number | null | undefined): s is number =>
    s != null && s >= STEUER_UNTERGRENZE && s <= STEUER_OBERGRENZE

  const plausibleJahre = [...roh.entries()].filter(([, s]) => istPlausibel(s)) as Array<
    [number, number]
  >
  const globalerMedian = median(plausibleJahre.map(([, s]) => s)) ?? STEUER_DEFAULT

  const out = new Map<number, { satz: number; ersetzt: boolean }>()
  for (const [jahr, satz] of roh) {
    if (istPlausibel(satz)) {
      out.set(jahr, { satz, ersetzt: false })
      continue
    }
    const nah = plausibleJahre
      .filter(([j]) => Math.abs(j - jahr) <= STEUER_FENSTER_JAHRE)
      .map(([, s]) => s)
    out.set(jahr, { satz: median(nah) ?? globalerMedian, ersetzt: true })
  }
  return out
}

export function baueAbleitungen(jahre: KapitalbasisJahr[]): KapitalbasisAbleitung[] {
  const steuern = normalisierteSteuersaetze(jahre)

  return jahre.map((j) => {
    const steuerInfo = steuern.get(j.jahr) ?? { satz: STEUER_DEFAULT, ersetzt: true }
    const nopat = j.ebitMio != null ? j.ebitMio * (1 - steuerInfo.satz) : null

    const eq = eigenkapitalBasisMio(j)
    const debt = gesamtschuldenMio(j)
    const ic = eq != null ? eq + (debt ?? 0) : null

    const liquiditaet = (j.bargeldMio ?? 0) + (j.kurzfristigeAnlagenMio ?? 0)
    const icNetto = ic != null ? ic - liquiditaet : null

    const immateriell = (j.goodwillMio ?? 0) + (j.intangiblesMio ?? 0)
    const icTangible = ic != null ? ic - immateriell : null

    const wc =
      j.umlaufvermoegenMio != null && j.kurzfristigeVerbindlichkeitenMio != null
        ? j.umlaufvermoegenMio - j.kurzfristigeVerbindlichkeitenMio
        : null

    const bruttoReinvest =
      j.capexMio != null || j.softwareCapexMio != null
        ? Math.abs(j.capexMio ?? 0) + Math.abs(j.softwareCapexMio ?? 0)
        : null

    return {
      jahr: j.jahr,
      steuersatz: Math.round(steuerInfo.satz * 1000) / 1000,
      steuersatzErsetzt: steuerInfo.ersetzt,
      nopatMio: rundeOderNull(nopat),
      icMio: rundeOderNull(ic),
      icNettoMio: rundeOderNull(icNetto),
      icTangibleMio: rundeOderNull(icTangible),
      workingCapitalMio: rundeOderNull(wc),
      bruttoReinvestMio: rundeOderNull(bruttoReinvest),
      roicPct: nopat != null && ic != null && ic > 0 ? rundeOderNull((nopat / ic) * 100) : null,
      roicTangiblePct:
        nopat != null && icTangible != null && icTangible > 0
          ? rundeOderNull((nopat / icTangible) * 100)
          : null,
    }
  })
}
