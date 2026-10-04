/** Etsy Unikat-Schalen: Taxonomy, Materials, Maße, Attribute (Room/…). */

import 'server-only'

import { etsyFetchJson } from '@/lib/etsy/etsy-server'
import { ETSY_API_BASE, etsyApiKeyHeader } from '@/lib/etsy/etsy-types'

/** Home & Living › Home Decor › Decorative Bowls */
export const ETSY_DEKORATIVE_SCHALE_TAXONOMY_ID = 1003
export const ETSY_DEKORATIVE_SCHALE_LABEL = 'Dekorative Schalen'

/** Centimeters scale for Width/Height/Depth properties */
const SCALE_CM = 7

const PROP = {
  width: 47626759898,
  height: 47626759834,
  depth: 54142602037,
  room: 145330288592,
  occasion: 46803063641,
  holiday: 46803063659,
  style: 145330288652,
  material: 148789511893,
  primaryColor: 200,
} as const

/** Raum: immer 5 passende für dekorative Holzschalen */
const ROOM_VALUES: Array<{ valueId: number; name: string }> = [
  { valueId: 2350, name: 'Kitchen & dining' },
  { valueId: 2351, name: 'Living room' },
  { valueId: 2353, name: 'Entryway' },
  { valueId: 2352, name: 'Office' },
  { valueId: 2355, name: 'Patio & outdoor' },
]

const OCCASION_HOUSEWARMING = { valueId: 27, name: 'Housewarming' }
const HOLIDAY_CHRISTMAS = { valueId: 35, name: 'Christmas' }
const STYLE_RUSTIC = { valueId: 2395, name: 'Rustic & primitive' }
const COLOR_BROWN = { valueId: 3, name: 'Brown' }
const MATERIAL_WOOD = { valueId: 286, name: 'Wood' }

/** DE-Holzart → Etsy Material-Property value_id (wenn bekannt). */
const HOLZ_MATERIAL_MAP: Array<{ match: RegExp; valueId: number; name: string }> = [
  { match: /esche|ash/i, valueId: 5256, name: 'Ash' },
  { match: /eiche|oak/i, valueId: 188, name: 'Oak' },
  { match: /ahorn|maple/i, valueId: 170, name: 'Maple' },
  { match: /kirsch|cherry/i, valueId: 88, name: 'Cherry' },
  { match: /walnuss|walnut/i, valueId: 283, name: 'Walnut' },
  { match: /buche|beech/i, valueId: 5206, name: 'Beech' },
  { match: /birke|birch/i, valueId: 1059, name: 'Birch' },
  { match: /ulme|elm/i, valueId: 5226, name: 'Elm' },
  { match: /erle|alder/i, valueId: 5221, name: 'Alder' },
  { match: /akazie|acacia/i, valueId: 5286, name: 'Acacia' },
  { match: /kiefer|pine/i, valueId: 203, name: 'Pine' },
  { match: /fichte|spruce/i, valueId: 5287, name: 'Spruce' },
  { match: /zeder|cedar/i, valueId: 81, name: 'Cedar' },
  { match: /oliv/i, valueId: 5309, name: 'Olive wood' },
  { match: /teak/i, valueId: 5241, name: 'Teak' },
  { match: /ebenholz|ebony/i, valueId: 5293, name: 'Ebony' },
  { match: /hainbuche|hornbeam/i, valueId: 5276, name: 'Hornbeam' },
]

export const ETSY_FINISH_MATERIAL = 'lebensmittelechtes Walnussöl'

/** „Apfel“ → „Apfelholz“; bereits „Apfelholz“ bleibt unverändert. */
export function normalisiereHolzMaterialName(holzart: string): string {
  const h = holzart.trim().replace(/\s+/g, ' ')
  if (!h) return 'Holz'
  if (/holz\b/i.test(h)) return h
  if (/esche$/i.test(h)) return `${h}nholz`
  if (/olive$/i.test(h)) return `${h}nholz`
  if (/kirsche$/i.test(h)) return 'Kirschholz'
  return `${h}holz`
}

/** Material-Tags: exakt die Holzart + lebensmittelechtes Walnussöl. */
export function baueUnikatMaterials(holzart: string): string[] {
  const holz = normalisiereHolzMaterialName(holzart)
  return [holz, ETSY_FINISH_MATERIAL]
}

/** Etsy Tag/Material: Buchstaben, Zahlen, Leerzeichen, - ' ™ © ® */
export function sanitisiereEtsyTag(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{Nd}\p{Zs}\-'\u2122\u00a9\u00ae]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20)
}

export function sanitisiereEtsyMaterial(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{Nd}\p{Zs}\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 45)
}

export type EtsyMasseParsed = {
  /** Durchmesser / Breite in cm */
  breiteCm: number
  /** Höhe in cm */
  hoeheCm: number
  /** Tiefe = Breite bei runden Schalen */
  tiefeCm: number
}

/**
 * Parst z. B. „22 × 8 cm“, „Ø 17 cm, H 5,5 cm“, „17x5.5“.
 * Breite und Tiefe = Durchmesser (rund).
 */
export function parseEtsyMasse(masse: string): EtsyMasseParsed | null {
  const s = masse.trim().toLowerCase().replace(/,/g, '.')
  if (!s) return null

  const nums = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(?:cm|mm)?/gi)].map((m) => Number(m[1]))
  const filtered = nums.filter((n) => Number.isFinite(n) && n > 0)
  if (filtered.length === 0) return null

  let d: number
  let h: number
  if (filtered.length === 1) {
    d = filtered[0]!
    h = Math.max(3, Math.round(d * 0.35 * 10) / 10)
  } else {
    d = Math.max(filtered[0]!, filtered[1]!)
    h = Math.min(filtered[0]!, filtered[1]!)
    // „Ø 17 H 5.5“ — erstes oft Durchmesser wenn Ø/D/Durchmesser im Text
    if (/[ø⌀]|durchmesser|\bd\b|\bø\b/i.test(s) || filtered[0]! >= filtered[1]!) {
      d = filtered[0]!
      h = filtered[1]!
    }
  }

  // mm → cm wenn Werte sehr groß
  if (d > 80 && h > 80) {
    d = d / 10
    h = h / 10
  }

  d = Math.round(d * 10) / 10
  h = Math.round(h * 10) / 10
  if (d < 1 || h < 0.5) return null
  return { breiteCm: d, hoeheCm: h, tiefeCm: d }
}

function holzMaterialProperty(holzart: string): { valueId: number; name: string } {
  const h = holzart.trim()
  for (const row of HOLZ_MATERIAL_MAP) {
    if (row.match.test(h)) return { valueId: row.valueId, name: row.name }
  }
  return MATERIAL_WOOD
}

async function putListingProperty(opts: {
  accessToken: string
  shopId: number
  listingId: number
  propertyId: number
  valueIds: Array<number | ''>
  values: string[]
  scaleId?: number
}): Promise<void> {
  const body = new URLSearchParams()
  /** Mehrfachwerte: komma-getrennt (Etsy nimmt sonst nur den letzten Wert). */
  const ids = opts.valueIds.map((id) => (id === '' ? '' : String(id)))
  body.set('value_ids', ids.join(','))
  body.set('values', opts.values.join(','))
  if (opts.scaleId != null) body.set('scale_id', String(opts.scaleId))

  const res = await fetch(
    `${ETSY_API_BASE}/application/shops/${opts.shopId}/listings/${opts.listingId}/properties/${opts.propertyId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'x-api-key': etsyApiKeyHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Listing-Property ${opts.propertyId} fehlgeschlagen (${res.status}): ${text.slice(0, 220)}`,
    )
  }
}

/** Nach Draft: Maße (Breite/Höhe/Tiefe), Raum×5, Anlass, Stil, Material, Farbe. */
export async function setzeEtsyUnikatAttribute(opts: {
  accessToken: string
  shopId: number
  listingId: number
  holzart: string
  masse: EtsyMasseParsed
}): Promise<void> {
  const base = {
    accessToken: opts.accessToken,
    shopId: opts.shopId,
    listingId: opts.listingId,
  }

  const dim = [
    { id: PROP.width, cm: opts.masse.breiteCm },
    { id: PROP.height, cm: opts.masse.hoeheCm },
    { id: PROP.depth, cm: opts.masse.tiefeCm },
  ]
  for (const d of dim) {
    await putListingProperty({
      ...base,
      propertyId: d.id,
      valueIds: [''],
      values: [String(d.cm)],
      scaleId: SCALE_CM,
    })
  }

  await putListingProperty({
    ...base,
    propertyId: PROP.room,
    valueIds: ROOM_VALUES.map((r) => r.valueId),
    values: ROOM_VALUES.map((r) => r.name),
  })

  await putListingProperty({
    ...base,
    propertyId: PROP.occasion,
    valueIds: [OCCASION_HOUSEWARMING.valueId],
    values: [OCCASION_HOUSEWARMING.name],
  })

  /** Feiertag: immer Weihnachten */
  await putListingProperty({
    ...base,
    propertyId: PROP.holiday,
    valueIds: [HOLIDAY_CHRISTMAS.valueId],
    values: [HOLIDAY_CHRISTMAS.name],
  })

  await putListingProperty({
    ...base,
    propertyId: PROP.style,
    valueIds: [STYLE_RUSTIC.valueId],
    values: [STYLE_RUSTIC.name],
  })

  await putListingProperty({
    ...base,
    propertyId: PROP.primaryColor,
    valueIds: [COLOR_BROWN.valueId],
    values: [COLOR_BROWN.name],
  })

  const mat = holzMaterialProperty(opts.holzart)
  await putListingProperty({
    ...base,
    propertyId: PROP.material,
    valueIds: [mat.valueId],
    values: [mat.name],
  })
}

/** Shop-Abteilung: gewählte Vorlage / „Schalen“ wenn vorhanden — was der Shop wirklich hat. */
export function resolveSchalenShopSectionId(
  sections: Array<{ shopSectionId: number; title: string }>,
  preferred?: number | null,
): number {
  if (preferred != null && preferred > 0) {
    const hit = sections.find((s) => s.shopSectionId === preferred)
    if (hit) return hit.shopSectionId
  }
  const schale = sections.find((s) => /schale/i.test(s.title))
  if (schale) return schale.shopSectionId
  if (sections.length === 1) return sections[0]!.shopSectionId
  throw new Error(
    'Shop-Abteilung wählen (z. B. „Schalen“). Bitte in der Vorlage die passende Sektion setzen.',
  )
}

/** Warenkorbzusammenfassung (DE Button-Lösung) — Text generieren; API kann das Feld nicht setzen. */
export function baueWarenkorbZusammenfassung(opts: {
  holzart: string
  masse: string
  produktForm?: string
  preisEur?: number
}): string {
  const holz = normalisiereHolzMaterialName(opts.holzart)
  const form = (opts.produktForm || 'Schale').trim() || 'Schale'
  const masse = opts.masse.trim() || 'Maße siehe Listing'
  const preis =
    opts.preisEur != null && opts.preisEur > 0 ? `${Math.round(opts.preisEur)} €` : null
  const teile = [
    `Handgedrechselte ${form} aus ${holz}`,
    masse,
    'Finish: lebensmittelechtes Walnussöl',
    'Unikat, hergestellt in Niederbayern',
    preis,
  ].filter(Boolean)
  return teile.join(' · ').slice(0, 200)
}

export async function leseListingTags(
  accessToken: string,
  listingId: number,
): Promise<string[]> {
  const data = await etsyFetchJson<{ tags?: string[] }>(
    accessToken,
    `/application/listings/${listingId}`,
  )
  return Array.isArray(data.tags) ? data.tags.map(String) : []
}
