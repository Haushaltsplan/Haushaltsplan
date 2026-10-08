/**
 * Brücke von der kanonischen Kapitalbasis zum bestehenden `IncrementalRoicPaket`.
 *
 * Bewusst als Adapter statt als Umbau aller Verbraucher: Key Metrics, Nachkauf-Score,
 * Struktur-Signale, Berater-Kontext und die UI lesen alle dasselbe Paket. Der Adapter
 * tauscht damit die Datenquelle aus, ohne die Verbraucher anzufassen.
 */

import 'server-only'

import type { IncrementalRoicPaket } from '@/lib/portfolio-analyse/incremental-roic'
import { ladeKapitalbasis } from '@/lib/portfolio-analyse/kapitalbasis/kapitalbasis-server'
import { berechneRoiic } from '@/lib/portfolio-analyse/kapitalbasis/roiic-berechnung'

export async function ladeIncrementalRoicAusKapitalbasis(opts: {
  symbolYahoo: string
  isin?: string | null
  ticker?: string | null
  firmenname?: string | null
  cik?: string | number | null
}): Promise<IncrementalRoicPaket | null> {
  const serie = await ladeKapitalbasis(opts)
  if (!serie || serie.jahre.length < 3) return null

  const paket = berechneRoiic(serie.jahre, serie.ableitungen)
  // Wie berechneRoiic: produktive Variante vor „schrumpfend“/0 % — sonst gewinnt
  // organisch=0 gegen einen echten Buch-ROIIC.
  const organisch = paket.organisch
  const buch = paket.buch
  const produktiv = (v: typeof organisch) =>
    v != null && v.pct != null && v.regime !== 'unzureichend' && v.regime !== 'schrumpfend'
  const messbar = (v: typeof organisch) =>
    v != null && v.pct != null && v.regime !== 'unzureichend'
  const leit = produktiv(organisch)
    ? organisch
    : produktiv(buch)
      ? buch
      : messbar(organisch)
        ? organisch
        : messbar(buch)
          ? buch
          : null
  if (!leit || leit.pct == null) return null

  // Ein-Jahres-Fenster separat, damit die Verbraucher wie bisher zwischen kurz- und
  // langfristiger Grenzrendite unterscheiden können.
  const einJahr = paket.alleVarianten.find(
    (v) => v.art === leit.art && v.fensterJahre === 1 && v.pct != null,
  )
  const fuenfJahr = paket.alleVarianten.find(
    (v) => v.art === leit.art && v.fensterJahre === 5 && v.pct != null,
  )

  return {
    incrementalRoicPct: leit.pct,
    incrementalRoic1yPct: einJahr?.pct ?? null,
    incrementalRoic5yPct: fuenfJahr?.pct ?? null,
    fensterJahre: leit.fensterJahre,
    quelle: 'kapitalbasis',
    methode: leit.art === 'organisch' ? 'tangible_ic' : 'book_ic',
    regime: leit.regime,
    buchPct: paket.buch?.pct ?? null,
    rohPct: leit.pctRoh,
    maImFenster: leit.fensterUeberspanntMa,
    begruendung: leit.begruendung,
  }
}
