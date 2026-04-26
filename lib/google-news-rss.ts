/**
 * Google News RSS (und kompatible Feeds) — XML → strukturierte Einträge
 */

export function decodeXmlText(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<[^>]+>/g, '')
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
  quelle: string
  veroeffentlichtAm: string | null
  /** titel + beschreibung für clientseitigen Filter o. ä. */
  sucheFuerLokal: string
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
      out.push({ titel, href, quelle, veroeffentlichtAm, sucheFuerLokal })
    }
  }
  return out
}
