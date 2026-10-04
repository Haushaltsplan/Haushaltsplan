/**
 * Smart-Copy für CRM / Versand / Gravur — Platzhalter → Zwischenablage.
 * Client-sicher (kein server-only).
 */

export type EtsySmartCopyKontext = {
  kaeufer_name?: string
  holzart?: string
  bestellung_id?: string | number
  receipt_id?: string | number
  listing_title?: string
  tracking_link?: string
  gravur_text?: string
  aufschlag_eur?: string | number
  shop_name?: string
}

export const ETSY_SMART_COPY_VORLAGEN = {
  pflege_30d: `Hallo {{käufer_name}},

kurz der Pflege-Tipp zu deiner Schale{{holzart}}: gelegentlich mit lebensmittelechtem Walnussöl nachölen, trocken abwischen, nicht in die Spülmaschine.

Viele Grüße`,

  geschenk_11m: `Hallo {{käufer_name}},

falls du wieder ein Unikat suchst (z. B. Weihnachten/Jubiläum) — schau gerne in meinem Shop vorbei. Deine letzte Schale war{{holzart}}.

Viele Grüße`,

  review: `Hallo {{käufer_name}},

ist deine Schale gut angekommen? Wenn alles passt, freue ich mich sehr über eine kurze Bewertung auf Etsy — das hilft anderen Käufern enorm.

Viele Grüße`,

  unterwegs: `Hallo {{käufer_name}},

deine Bestellung #{{bestellung_id}} ist unterwegs{{tracking_link}}.

Sobald sie ankommt, freue ich mich über eine kurze Rückmeldung.

Viele Grüße`,

  gravur_bestaetigung: `Hallo {{käufer_name}},

ich habe deine Gravur-Anfrage notiert: „{{gravur_text}}“.
Aufschlag: {{aufschlag_eur}} €. Bitte kurz bestätigen, dann setze ich um.

Viele Grüße`,
} as const

export type EtsySmartCopyArt = keyof typeof ETSY_SMART_COPY_VORLAGEN

function wert(kontext: EtsySmartCopyKontext, key: string): string {
  const map: Record<string, string | number | undefined> = {
    kaeufer_name: kontext.kaeufer_name,
    holzart: kontext.holzart ? ` (${kontext.holzart})` : '',
    bestellung_id: kontext.bestellung_id ?? kontext.receipt_id,
    receipt_id: kontext.receipt_id ?? kontext.bestellung_id,
    listing_title: kontext.listing_title,
    tracking_link: kontext.tracking_link ? ` — ${kontext.tracking_link}` : '',
    gravur_text: kontext.gravur_text,
    aufschlag_eur: kontext.aufschlag_eur ?? 15,
    shop_name: kontext.shop_name,
  }
  const v = map[key]
  if (v == null || v === '') {
    if (key === 'holzart' || key === 'tracking_link') return ''
    return '…'
  }
  return String(v)
}

export function fuelleEtsySmartCopy(vorlage: string, kontext: EtsySmartCopyKontext): string {
  return vorlage
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => wert(kontext, key.toLowerCase()))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function etsySmartCopyText(art: EtsySmartCopyArt, kontext: EtsySmartCopyKontext): string {
  return fuelleEtsySmartCopy(ETSY_SMART_COPY_VORLAGEN[art], kontext)
}

export async function kopiereEtsySmartCopy(art: EtsySmartCopyArt, kontext: EtsySmartCopyKontext): Promise<string> {
  const text = etsySmartCopyText(art, kontext)
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
  }
  return text
}
