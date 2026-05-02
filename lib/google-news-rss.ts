/**
 * Google News RSS (und kompatible Feeds) — XML → strukturierte Einträge
 */

export function decodeXmlText(s: string): string {
  let t = String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<[^>]+>/g, '')
  t = t
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#0*160;/gi, ' ')
    .replace(/&#x0*a0;/gi, ' ')
    .replace(/&#(\d{1,7});/gi, (_, code) => {
      const n = Number(code)
      if (!Number.isFinite(n) || n < 9 || n > 0x10ffff) return ''
      try {
        return String.fromCodePoint(n)
      } catch {
        return ''
      }
    })
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, hex) => {
      const n = parseInt(hex, 16)
      if (!Number.isFinite(n) || n < 9 || n > 0x10ffff) return ''
      try {
        return String.fromCodePoint(n)
      } catch {
        return ''
      }
    })
  return t
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseIsoAusPubDateRaw(raw: string | undefined): string | null {
  if (!raw) return null
  const s = decodeXmlText(String(raw).trim())
  if (!s) return null
  const t = Date.parse(s)
  if (!Number.isFinite(t)) return null
  return new Date(t).toISOString()
}

export type RohGoogleNewsEintrag = {
  titel: string
  href: string
  /** Kurzbeschreibung / Lesetext aus dem RSS-Item (nach decodeXmlText). */
  beschreibung: string
  quelle: string
  veroeffentlichtAm: string | null
  /** titel + beschreibung für clientseitigen Filter o. ä. */
  sucheFuerLokal: string
}

/** Nur Einträge mit gültigem Pub-Datum innerhalb des Zeitfensters (ältere Meldungen rauswerfen). */
export function googleNewsItemsNachDatumFiltern<T extends { veroeffentlichtAm: string | null }>(
  items: T[],
  maxAlterMs: number,
): T[] {
  const cutoff = Date.now() - maxAlterMs
  return items.filter((x) => {
    if (!x.veroeffentlichtAm) return false
    const t = Date.parse(x.veroeffentlichtAm)
    return Number.isFinite(t) && t >= cutoff
  })
}

/** Neuestes Datum zuerst; Einträge ohne Datum nach hinten (für Movers lieber ignorieren). */
export function googleNewsItemsNachDatumSortieren<T extends { veroeffentlichtAm: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ta = a.veroeffentlichtAm ? Date.parse(a.veroeffentlichtAm) : Number.NEGATIVE_INFINITY
    const tb = b.veroeffentlichtAm ? Date.parse(b.veroeffentlichtAm) : Number.NEGATIVE_INFINITY
    return tb - ta
  })
}

export function parseGoogleNewsRssItems(
  xml: string,
  quelle: string,
  max: number,
): RohGoogleNewsEintrag[] {
  const out: RohGoogleNewsEintrag[] = []
  const re = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) && out.length < max) {
    const block = m[1]
    const tRaw = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''
    const lRaw = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? ''
    const pRaw =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ??
      block.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i)?.[1] ??
      block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1] ??
      ''
    const dRaw = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? ''
    const titel = decodeXmlText(tRaw)
    const href = decodeXmlText(lRaw)
    const beschreibung = decodeXmlText(dRaw)
    const veroeffentlichtAm = parseIsoAusPubDateRaw(pRaw) || null
    const sucheFuerLokal = `${titel} ${beschreibung}`.replace(/\s+/g, ' ').trim()
    if (titel && href) {
      out.push({ titel, href, beschreibung, quelle, veroeffentlichtAm, sucheFuerLokal })
    }
  }
  return out
}
