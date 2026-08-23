/**
 * Feldweiser Merge mehrerer Quellen zu einer Kapitalbasis-Serie.
 *
 * Der bisherige Ansatz war „eine Quelle gewinnt komplett": fehlte dort ein Feld, fehlte
 * die Kennzahl. Hier liefert die höchstrangige Quelle das Grundgerüst, und jede weitere
 * Quelle füllt nur noch offene Felder.
 *
 * Vor dem Auffüllen läuft eine Konsistenzprüfung über die überlappenden Jahre. Ohne sie
 * würden Serien in unterschiedlicher Berichtswährung oder Skalierung stillschweigend
 * vermischt — ASML berichtet in EUR, Yahoo liefert für dasselbe Symbol je nach Listing
 * teils umgerechnete Werte. Weichen die gemeinsamen Jahre zu stark ab, wird die Quelle
 * verworfen statt vermischt.
 */

import {
  KAPITALBASIS_QUELLEN_RANG,
  KAPITALBASIS_ROHFELDER,
  leeresKapitalbasisJahr,
  type KapitalbasisJahr,
  type KapitalbasisQuelle,
  type KapitalbasisRohfeld,
} from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-typen'

export type QuellenBeitrag = {
  quelle: KapitalbasisQuelle
  jahre: KapitalbasisJahr[]
}

/** Felder, an denen die Skalen-/Währungsgleichheit zweier Serien geprüft wird. */
const PRUEFFELDER: KapitalbasisRohfeld[] = [
  'ebitMio',
  'umsatzMio',
  'eigenkapitalParentMio',
  'gesamtvermoegenMio',
]

/**
 * Zwei Quellen, die denselben Abschluss in derselben Währung abbilden, weichen um wenige
 * Promille ab. Die Toleranz muss deshalb deutlich unter dem EUR/USD-Kurs liegen: Macrotrends
 * führt für EU-Titel nur ADR-Seiten mit in USD umgerechneten Zahlen, und bei einer Schwelle
 * von 20 % rutschten so 15 Jahre USD-Historie in die EUR-Serie von Wolters Kluwer.
 */
const ABWEICHUNG_TOLERANZ = 0.05
/** Ein einzelnes Feldpaar kann zufällig passen — erst mehrere Punkte sind ein Beleg. */
const MIN_VERGLEICHSPUNKTE = 2

function median(werte: number[]): number | null {
  if (werte.length === 0) return null
  const s = [...werte].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!
}

/**
 * Passen die beiden Serien in Skala und Währung zusammen? Verglichen wird das Verhältnis
 * gemeinsamer Jahre; ohne Überlappung gilt die Quelle als kompatibel, weil sie dann
 * ausschließlich Jahre ergänzt, die das Grundgerüst nicht kennt.
 */
export function serienKompatibel(basis: KapitalbasisJahr[], zusatz: KapitalbasisJahr[]): boolean {
  const nachJahr = new Map(zusatz.map((j) => [j.jahr, j]))
  const verhaeltnisse: number[] = []

  for (const b of basis) {
    const z = nachJahr.get(b.jahr)
    if (!z) continue
    for (const feld of PRUEFFELDER) {
      const bv = b[feld]
      const zv = z[feld]
      if (bv == null || zv == null) continue
      if (Math.abs(bv) < 1 || Math.abs(zv) < 1) continue
      verhaeltnisse.push(Math.abs(zv) / Math.abs(bv))
    }
  }

  if (verhaeltnisse.length === 0) return true
  if (verhaeltnisse.length < MIN_VERGLEICHSPUNKTE) return true
  const m = median(verhaeltnisse)
  if (m == null) return false
  return Math.abs(m - 1) <= ABWEICHUNG_TOLERANZ
}

function rang(quelle: KapitalbasisQuelle): number {
  const i = KAPITALBASIS_QUELLEN_RANG.indexOf(quelle)
  return i < 0 ? KAPITALBASIS_QUELLEN_RANG.length : i
}

export type MergeErgebnis = {
  jahre: KapitalbasisJahr[]
  beitragendeQuellen: KapitalbasisQuelle[]
  /** Quellen, die wegen abweichender Skala/Währung nicht gemergt wurden. */
  verworfeneQuellen: KapitalbasisQuelle[]
}

export function mergeKapitalbasis(beitraege: QuellenBeitrag[]): MergeErgebnis {
  const brauchbar = beitraege
    .filter((b) => b.jahre.length >= 2)
    .sort((a, b) => rang(a.quelle) - rang(b.quelle))

  if (brauchbar.length === 0) {
    return { jahre: [], beitragendeQuellen: [], verworfeneQuellen: [] }
  }

  const [grundgeruest, ...weitere] = brauchbar
  const jahre = new Map<number, KapitalbasisJahr>()
  for (const j of grundgeruest!.jahre) {
    jahre.set(j.jahr, { ...j, quellen: { ...j.quellen } })
  }

  const beitragend: KapitalbasisQuelle[] = [grundgeruest!.quelle]
  const verworfen: KapitalbasisQuelle[] = []

  for (const zusatz of weitere) {
    if (!serienKompatibel([...jahre.values()], zusatz.jahre)) {
      verworfen.push(zusatz.quelle)
      continue
    }

    let hatBeigetragen = false
    for (const z of zusatz.jahre) {
      let ziel = jahre.get(z.jahr)
      if (!ziel) {
        ziel = leeresKapitalbasisJahr(z.jahr, z.periodenEnde)
        jahre.set(z.jahr, ziel)
      }
      ziel.periodenEnde ??= z.periodenEnde
      for (const feld of KAPITALBASIS_ROHFELDER) {
        if (ziel[feld] != null) continue
        const wert = z[feld]
        if (wert == null) continue
        ziel[feld] = wert
        ziel.quellen[feld] = zusatz.quelle
        hatBeigetragen = true
      }
    }
    if (hatBeigetragen) beitragend.push(zusatz.quelle)
  }

  return {
    jahre: [...jahre.values()].sort((a, b) => a.jahr - b.jahr),
    beitragendeQuellen: beitragend,
    verworfeneQuellen: verworfen,
  }
}
