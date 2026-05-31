import { lagerArtikelSammelname } from '@/lib/lager-artikel-kanonisch'
import { lagerKategorieAusArtikel } from '@/lib/lager-produkt-kategorie'

export type OffProduktTreffer = {
  barcode: string
  rohName: string
  anzeigeName: string
  kategorie: string
  marke?: string
}

/** Open Food Facts — kostenloser Barcode-Lookup (kein API-Key). */
export async function lookupOpenFoodFacts(barcode: string): Promise<OffProduktTreffer | null> {
  const code = String(barcode || '').trim().replace(/\D/g, '')
  if (code.length < 8) return null

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MeinHaushalt/1.0 (Speisekammer Lager)' },
    next: { revalidate: 0 },
  })
  if (!res.ok) return null

  const data = (await res.json()) as {
    status?: number
    product?: {
      product_name?: string
      product_name_de?: string
      brands?: string
      categories_tags?: string[]
    }
  }
  if (data.status !== 1 || !data.product) return null

  const p = data.product
  const roh =
    (p.product_name_de || '').trim() ||
    (p.product_name || '').trim() ||
    (p.brands || '').trim()
  if (!roh) return null

  const marke = (p.brands || '').trim() || undefined
  const anzeigeName = lagerArtikelSammelname(marke ? `${marke} ${roh}` : roh)
  const kategorie = lagerKategorieAusArtikel(anzeigeName || roh)

  return {
    barcode: code,
    rohName: roh,
    anzeigeName: anzeigeName || roh,
    kategorie,
    marke,
  }
}
