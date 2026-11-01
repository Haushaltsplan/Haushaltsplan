import { absUrl } from '@/lib/radwerkstatt/radwerkstatt-url'

export type ProduktSeitenHinweis = {
  name: string
  beschreibung: string
  bildUrl: string
  preisEur: number | null
  preisText: string
  waehrung: string
  text: string
}

export function decodeHtml(s: string): string {
  let out = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&nbsp;/gi, ' ')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;|&#0*39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => zeichen(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, n: string) => zeichen(Number(n)))
  }
  return out
}

function zeichen(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return ''
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}

function metaTags(html: string): Array<Record<string, string>> {
  const tags: Array<Record<string, string>> = []
  const re = /<meta\b([^>]*)\/?>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const attrs: Record<string, string> = {}
    const ar = /([:\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g
    let a: RegExpExecArray | null
    while ((a = ar.exec(m[1] ?? ''))) {
      attrs[(a[1] ?? '').toLowerCase()] = decodeHtml(a[3] ?? a[4] ?? '')
    }
    tags.push(attrs)
  }
  return tags
}

function metaWert(tags: Array<Record<string, string>>, schluessel: string): string {
  const k = schluessel.toLowerCase()
  for (const t of tags) {
    const id = (t.property || t.name || t.itemprop || '').toLowerCase()
    if (id === k && t.content) return t.content.trim()
  }
  return ''
}

function titelTag(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m?.[1] ? decodeHtml(m[1]).replace(/\s+/g, ' ').trim() : ''
}

export function sichtbarerText(html: string): string {
  const ohne = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  return decodeHtml(ohne).replace(/\s+/g, ' ').trim().slice(0, 4000)
}

function jsonLdBloecke(html: string): unknown[] {
  const out: unknown[] = []
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const roh = (m[1] ?? '').trim()
    if (!roh) continue
    try {
      out.push(JSON.parse(roh))
    } catch {
      /* Shop-JSON manchmal ungültig */
    }
  }
  return out
}

function typPasst(o: Record<string, unknown>, name: string): boolean {
  const t = o['@type']
  const liste = Array.isArray(t) ? t : [t]
  return liste.some((x) => String(x ?? '').toLowerCase().split('/').pop() === name.toLowerCase())
}

function gehJson(node: unknown, besuch: (o: Record<string, unknown>) => void, tiefe = 0) {
  if (!node || typeof node !== 'object' || tiefe > 8) return
  if (Array.isArray(node)) {
    for (const x of node) gehJson(x, besuch, tiefe + 1)
    return
  }
  const o = node as Record<string, unknown>
  besuch(o)
  for (const key of ['@graph', 'hasVariant', 'isVariantOf', 'mainEntity']) {
    if (o[key]) gehJson(o[key], besuch, tiefe + 1)
  }
}

function istProduktObjekt(o: Record<string, unknown>): boolean {
  return (
    typPasst(o, 'Product') ||
    typPasst(o, 'ProductGroup') ||
    typPasst(o, 'IndividualProduct') ||
    typPasst(o, 'SomeProducts')
  )
}

function angebotUrl(offers: unknown): string {
  const liste = Array.isArray(offers) ? offers : offers && typeof offers === 'object' ? [offers] : []
  for (const eintrag of liste) {
    if (eintrag && typeof eintrag === 'object' && typeof (eintrag as { url?: unknown }).url === 'string') {
      return (eintrag as { url: string }).url
    }
  }
  return ''
}

function pfadVon(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, '').toLowerCase()
  } catch {
    return ''
  }
}

function nameOhneSite(name: string, siteName: string, seitenUrl: string): string {
  const marker = new Set<string>()
  const site = siteName.replace(/\s+/g, ' ').trim()
  if (site && site.length <= 40) marker.add(site)
  try {
    const host = new URL(seitenUrl).hostname.replace(/^www\./, '')
    const marke = host.split('.')[0] ?? ''
    if (marke.length > 2) marker.add(marke)
  } catch {
    /* ohne Host bleibt der Name */
  }
  let out = name
  for (const teil of marker) {
    const esc = teil.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`\\s*[|·•]\\s*${esc}\\s*$`, 'i'), '')
    out = out.replace(new RegExp(`\\s+[–—-]\\s*${esc}\\s*$`, 'i'), '')
  }
  return out.replace(/\s+/g, ' ').trim()
}

export function seiteWirktGesperrt(html: string): boolean {
  const title = titelTag(html).toLowerCase().replace(/\u00a0/g, ' ').trim()
  if (/access denied|just a moment|attention required|captcha|forbidden|robot check|verify you are human/.test(title)) {
    return true
  }
  if (
    html.length < 12000 &&
    /access denied|edgesuite|cf-browser-verification|challenge-platform|bm-verify|akamai-loading/i.test(html)
  ) {
    return true
  }
  return false
}

function markenName(o: Record<string, unknown>): string {
  const b = o.brand
  if (typeof b === 'string') return decodeHtml(b).replace(/\s+/g, ' ').trim()
  if (b && typeof b === 'object' && !Array.isArray(b)) {
    const n = (b as Record<string, unknown>).name
    if (typeof n === 'string') return decodeHtml(n).replace(/\s+/g, ' ').trim()
  }
  return ''
}

/** Nur Länge, Gebinde oder Farbe — dann bleibt der Gruppenname der Produktname. */
function istNurAusfuehrung(rest: string): boolean {
  const t = rest.trim().toLowerCase()
  if (!t || t.length > 40) return false
  if (/^(?:silber|schwarz|rot|blau|weiß|weiss|pink|lila|grün|gruen|gold|silver|black|red|blue|white|grey|gray|uni|universal)$/i.test(t)) {
    return true
  }
  return /^\d+(?:[.,]\d+)?(?:\s*(?:links?|glieder|ml|cl|l|g|kg|mm|cm|zoll|inch))?(?:\s+(?:silber|schwarz|rot|blau|weiß|weiss|pink|lila|grün|gruen|gold|silver|black|red|blue|white))?$/i.test(t)
}

/** Variantenname enthält den Gruppennamen und ist mehr als eine Ausführung. */
function nameIstAusfuehrlich(variante: string, gruppe: string): boolean {
  const v = variante.trim().toLowerCase()
  const g = gruppe.trim().toLowerCase()
  if (!v || !g || !v.includes(g)) return false
  const rest = v.slice(v.indexOf(g) + g.length).replace(/^[\s|·•\-–—:,/]+/, '').trim()
  if (!rest) return true
  return !istNurAusfuehrung(rest)
}

function markeSchonImNamen(name: string, marke: string): boolean {
  const n = name.toLowerCase()
  const m = marke.toLowerCase()
  if (!m) return true
  if (n.includes(m)) return true
  const wort = m.split(/\s+/).find((teil) => teil.length > 2 && !/^(gmbh|ag|inc|ltd|kg|ug|sarl|sas|co)$/.test(teil)) ?? ''
  return Boolean(wort) && n.includes(wort)
}

function nameBereinigen(name: string): string {
  return name
    .replace(/\s+um\s+\d[\d.,]*\s*€\s*statt\s+\d[\d.,]*\s*€.*$/i, '')
    .replace(/\s*[|]\s*\d{5,}\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function zahlAusPreis(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return Math.round(raw * 100) / 100
  if (typeof raw !== 'string') return null
  const t = raw.trim().replace(/\s/g, '')
  if (!t) return null
  const norm = t.includes(',') && !t.includes('.') ? t.replace(',', '.') : t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(norm.replace(/[^\d.]/g, ''))
  if (!Number.isFinite(n) || n < 0 || n > 100000) return null
  return Math.round(n * 100) / 100
}

function liesPreisFeld(raw: unknown, waehrungFallback: string): { betrag: number | null; waehrung: string } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    const betrag = zahlAusPreis(o.amount ?? o.value ?? o.price)
    const waehrung = String(o.currencyCode || o.priceCurrency || o.currency || waehrungFallback || '')
      .trim()
      .toUpperCase()
    return { betrag, waehrung }
  }
  return { betrag: zahlAusPreis(raw), waehrung: waehrungFallback }
}

function preisAusAngebot(offers: unknown): { betrag: number | null; waehrung: string } {
  if (typeof offers === 'number' || typeof offers === 'string') return liesPreisFeld(offers, '')
  if (offers && typeof offers === 'object' && !Array.isArray(offers)) {
    const direkt = offers as Record<string, unknown>
    if ('amount' in direkt || 'currencyCode' in direkt) return liesPreisFeld(direkt, '')
  }
  const liste = Array.isArray(offers) ? offers : offers ? [offers] : []
  for (const eintrag of liste) {
    if (!eintrag || typeof eintrag !== 'object') continue
    const o = eintrag as Record<string, unknown>
    const spec = o.priceSpecification
    const specPreis =
      spec && typeof spec === 'object' ? (spec as Record<string, unknown>).price : undefined
    const waehrung = String(
      o.priceCurrency || (spec && typeof spec === 'object' ? (spec as Record<string, unknown>).priceCurrency : '') || '',
    )
      .trim()
      .toUpperCase()
    const gelesen = liesPreisFeld(o.price ?? o.lowPrice ?? specPreis, waehrung)
    if (gelesen.betrag != null) return gelesen
  }
  return { betrag: null, waehrung: '' }
}

/** Shopify legt den Preis oft neben das JSON-LD, als amount + currencyCode. */
function preisAusShopify(html: string): { betrag: number | null; waehrung: string } {
  const m = html.match(
    /"price"\s*:\s*\{\s*"amount"\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*,\s*"currencyCode"\s*:\s*"([A-Z]{3})"/,
  )
  if (!m) return { betrag: null, waehrung: '' }
  return { betrag: zahlAusPreis(m[1]), waehrung: m[2] ?? '' }
}

function bildIstLogo(url: string): boolean {
  return /logo|icon|sprite|favicon|pixel|1x1|badge|flag|payment|trustpilot|placeholder/i.test(url)
}

function ersteBildUrl(image: unknown, basis: string): string {
  if (typeof image === 'string') {
    const u = absUrl(image, basis)
    return u && !bildIstLogo(u) ? u : ''
  }
  if (Array.isArray(image)) {
    for (const x of image) {
      const u = ersteBildUrl(x, basis)
      if (u) return u
    }
    return ''
  }
  if (image && typeof image === 'object') {
    const o = image as Record<string, unknown>
    const url = o.url ?? o.contentUrl ?? o.thumbnailUrl
    if (typeof url === 'string') return ersteBildUrl(url, basis)
  }
  return ''
}

function tagAttribut(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'))
  return decodeHtml(m?.[2] ?? m?.[3] ?? '').trim()
}

function bildAusMarkup(html: string, basis: string): string {
  const tags = html.match(/<(?:link|img|meta)\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    const rel = tagAttribut(tag, 'rel').toLowerCase()
    const prop = tagAttribut(tag, 'itemprop').toLowerCase()
    if (rel !== 'image_src' && prop !== 'image') continue
    const roh = tagAttribut(tag, 'href') || tagAttribut(tag, 'src') || tagAttribut(tag, 'content')
    const u = ersteBildUrl(roh, basis)
    if (u) return u
  }
  const re = /"(?:image|hiRes|imageUrl|contentUrl)"\s*:\s*"(https?:[^"\\]+)"/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const roh = (m[1] ?? '').replace(/\\u0026/g, '&').replace(/\\\//g, '/')
    const u = ersteBildUrl(roh, basis)
    if (u && /\.(?:jpe?g|png|webp)(?:$|\?)/i.test(u)) return u
  }
  return ''
}

function preisAusMicrodata(html: string): { betrag: number | null; waehrung: string } {
  const tags = html.match(/<[^>]+itemprop\s*=\s*["'](?:price|priceCurrency)["'][^>]*>/gi) ?? []
  let betrag: number | null = null
  let waehrung = ''
  for (const tag of tags) {
    const prop = tagAttribut(tag, 'itemprop').toLowerCase()
    const content = tagAttribut(tag, 'content')
    if (prop === 'price' && betrag == null) betrag = zahlAusPreis(content)
    if (prop === 'pricecurrency' && content) waehrung = content.toUpperCase()
  }
  if (betrag == null) {
    const inline = html.match(/itemprop=["']price["'][^>]*>\s*([^<]{1,24})/i)
    if (inline) betrag = zahlAusPreis(inline[1] ?? '')
  }
  return { betrag, waehrung }
}

/** Verkaufspreis. UVP, „statt“, Versand und Grundpreis zählen nicht. Zwei unerklärte Beträge bleiben leer. */
function verkaufsPreisEur(text: string): number | null {
  const statt = text.match(/(\d{1,5}(?:[.,]\d{2})?)\s*€\s*statt\b/i)
  if (statt) {
    const n = zahlAusPreis(statt[1])
    if (n != null && n > 0 && n < 20000) return n
  }
  const zahlen = new Set<number>()
  for (const m of text.matchAll(/(?:€\s*(\d{1,5}(?:[.,]\d{2})?)|(\d{1,5}[.,]\d{2})\s*€)/g)) {
    const start = m.index ?? 0
    const davor = text.slice(Math.max(0, start - 18), start).toLowerCase()
    const danach = text.slice(start + m[0].length, start + m[0].length + 14).toLowerCase()
    if (/versand|shipping|uvp|rrp|msrp|grundpreis|statt/.test(davor)) continue
    if (/^\s*(?:pro\b|\/\s*(?:l|kg|m)\b)/.test(danach)) continue
    const n = zahlAusPreis(m[1] || m[2] || '')
    if (n != null && n > 0 && n < 20000) zahlen.add(n)
  }
  if (zahlen.size !== 1) return null
  return [...zahlen][0] ?? null
}

function preisTextAus(betrag: number | null, waehrung: string): string {
  if (betrag == null) return ''
  if (!waehrung || waehrung === 'EUR') {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(betrag)
  }
  return `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(betrag)} ${waehrung}`
}

export function extrahiereProduktHinweise(html: string, seitenUrl: string): ProduktSeitenHinweis {
  const tags = metaTags(html)
  const ld = jsonLdBloecke(html)
  let name = ''
  let beschreibung = ''
  let bildUrl = ''
  let preisEur: number | null = null
  let anzeigeBetrag: number | null = null
  let waehrung = ''
  let varianteGetroffen = false
  let gruppenName = ''
  let gruppenBild = ''
  let marke = ''
  const treffer: Array<{ name: string; beschreibung: string; bild: string; betrag: number | null; waehrung: string }> = []
  const seitenPfad = pfadVon(seitenUrl)

  const merkePreis = (betrag: number | null, cur: string, erzwingen = false, nurWennKleiner = false) => {
    if (betrag == null) return
    if (nurWennKleiner && anzeigeBetrag != null && betrag >= anzeigeBetrag) return
    if (anzeigeBetrag != null && !erzwingen && !nurWennKleiner) return
    const c = cur.trim().toUpperCase()
    anzeigeBetrag = betrag
    waehrung = c
    preisEur = !c || c === 'EUR' ? betrag : null
  }

  for (const block of ld) {
    gehJson(block, (o) => {
      if (!istProduktObjekt(o)) return
      const produktName = typeof o.name === 'string' ? decodeHtml(o.name).replace(/\s+/g, ' ').trim() : ''
      const adresse = angebotUrl(o.offers) || (typeof o.url === 'string' ? o.url : '')
      const passtZurSeite = Boolean(seitenPfad) && pfadVon(adresse) === seitenPfad
      const hatVarianten = o.hasVariant != null
      const istGruppe = typPasst(o, 'ProductGroup') || hatVarianten
      if (istGruppe && produktName) gruppenName = produktName
      const gefundeneMarke = markenName(o)
      if (gefundeneMarke) marke = gefundeneMarke
      const vollerName = !istGruppe && (!gruppenName || nameIstAusfuehrlich(produktName, gruppenName))
      const nameUebernehmen =
        vollerName &&
        (!name ||
          passtZurSeite ||
          (!varianteGetroffen && produktName.startsWith(name) && produktName.length > name.length))
      if (passtZurSeite) varianteGetroffen = true
      if (produktName && (istGruppe || nameUebernehmen)) name = produktName
      if (
        (istGruppe || vollerName) &&
        (!beschreibung || (vollerName && passtZurSeite)) &&
        typeof o.description === 'string' &&
        o.description.trim()
      ) {
        beschreibung = decodeHtml(o.description).replace(/\s+/g, ' ').trim()
      }
      const bild = ersteBildUrl(o.image ?? o.thumbnailUrl, seitenUrl)
      if (istGruppe && bild) gruppenBild = bild
      if (bild && (!bildUrl || (passtZurSeite && vollerName))) bildUrl = bild
      const p = preisAusAngebot(o.offers ?? o.price)
      merkePreis(p.betrag, p.waehrung, passtZurSeite && vollerName, passtZurSeite && !vollerName && !istGruppe)
      if (!istGruppe && passtZurSeite) {
        treffer.push({
          name: produktName,
          beschreibung: typeof o.description === 'string' ? decodeHtml(o.description).replace(/\s+/g, ' ').trim() : '',
          bild,
          betrag: p.betrag,
          waehrung: p.waehrung,
        })
      }
    })
  }

  if (treffer.length === 1) {
    const t = treffer[0]
    if (t && t.name) name = t.name
    if (t?.beschreibung) beschreibung = t.beschreibung
    if (t?.bild) bildUrl = t.bild
    if (t && t.betrag != null) merkePreis(t.betrag, t.waehrung || 'EUR', true)
  } else if (treffer.length > 1 && gruppenName) {
    name = gruppenName
    if (gruppenBild) bildUrl = gruppenBild
    const gueltig = treffer.filter((t) => t.betrag != null)
    const min = gueltig.reduce<(typeof treffer)[number] | null>((best, t) => {
      if (!best || (t.betrag != null && best.betrag != null && t.betrag < best.betrag)) return t
      return best
    }, null)
    if (min?.betrag != null) merkePreis(min.betrag, min.waehrung || 'EUR', true)
  }

  if (marke && name && !markeSchonImNamen(name, marke)) {
    name = `${marke} ${name}`
  }

  if (!name) name = metaWert(tags, 'og:title') || metaWert(tags, 'twitter:title') || titelTag(html)
  if (!beschreibung) beschreibung = metaWert(tags, 'og:description') || metaWert(tags, 'description')
  if (!bildUrl) {
    const og = absUrl(
      metaWert(tags, 'og:image:secure_url') ||
        metaWert(tags, 'og:image:url') ||
        metaWert(tags, 'og:image') ||
        metaWert(tags, 'twitter:image') ||
        metaWert(tags, 'twitter:image:src'),
      seitenUrl,
    )
    bildUrl = og && !bildIstLogo(og) ? og : bildAusMarkup(html, seitenUrl)
  }

  if (anzeigeBetrag == null) {
    const amount = metaWert(tags, 'product:price:amount') || metaWert(tags, 'og:price:amount') || metaWert(tags, 'price')
    const cur = (metaWert(tags, 'product:price:currency') || metaWert(tags, 'og:price:currency') || 'EUR').toUpperCase()
    merkePreis(zahlAusPreis(amount), cur)
  }
  if (anzeigeBetrag == null) {
    const micro = preisAusMicrodata(html)
    merkePreis(micro.betrag, micro.waehrung || 'EUR')
  }
  if (anzeigeBetrag == null) {
    const shop = preisAusShopify(html)
    merkePreis(shop.betrag, shop.waehrung)
  }
  const text = sichtbarerText(html)
  if (anzeigeBetrag == null) merkePreis(verkaufsPreisEur(text), 'EUR')

  name = nameBereinigen(nameOhneSite(name, metaWert(tags, 'og:site_name'), seitenUrl)).slice(0, 180)
  beschreibung = beschreibung.replace(/\s+/g, ' ').trim().slice(0, 800)

  return {
    name,
    beschreibung,
    bildUrl,
    preisEur,
    preisText: preisTextAus(anzeigeBetrag, waehrung || 'EUR'),
    waehrung: waehrung || (preisEur != null ? 'EUR' : ''),
    text,
  }
}

/** Name plus Bild oder Preis — erst dann ist die Seite brauchbar, sonst die nächste Quelle. */
export function hinweisReicht(h: ProduktSeitenHinweis): boolean {
  if (h.name.length < 2) return false
  if (/access denied|just a moment|captcha|robot check|forbidden|zugriff verweigert/i.test(h.name)) return false
  return Boolean(h.bildUrl) || h.preisEur != null || h.preisText.length > 0
}
