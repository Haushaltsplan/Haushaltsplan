import type { RohGoogleNewsEintrag } from '@/lib/google-news-rss'

function rohText(roh: RohGoogleNewsEintrag): string {
  return `${roh.titel} ${roh.sucheFuerLokal}`.replace(/\s+/g, ' ').trim()
}

function normKlein(s: string): string {
  return s
    .toLowerCase()
    .replace(/['\u2018\u2019\u201A\u2032\u2035]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function enthaeltPhrase(hay: string, needle: string): boolean {
  if (needle.length < 4) return false
  return normKlein(hay).includes(normKlein(needle))
}

const UNTERHALT = /kreuzwort|horoskop|5 gründe/i

const BUNDES = /formel[ \-]*1|fu(ß|ss)ball|bundesliga|champions( )?-?( )?league|handball|basket(?!,)|\bf1\b(?!,)/i

const FIN = /\b(aktie|börse|dax(?!'|’)|krypto|bitcoin|fonds|anleihe)\b/i

const RADSPORT =
  /radsport|rennrad|stra(ß|s)enrads?|etappen?|procycling|world( )?tour|grand( )?tour|u\.?c\.?i\b|giro|vuelta|tour( of| de| d'| d )|france|roubaix|flandern|austrag(ung|t)|ausschreib(ung|en)|zeitfahr|poga(c|č)ar|klasse(ment)?/i

const WINTERSP = /biathlon|skisprung|skispring(?!$)|skifahr(?!$)|skilang(?!$)|langlauf(?!$)|gundersen|hahnenkamm|lauberhorn|vierschanz|tour( de|) ski|nordi(c|h)(?!$)|milan(oa|o)[ -]cortina|olymp(ia|ische)?( )?winter(?!$)|riesen(s)?lalom|slalom|super( )?-?g(?!$)|abfahrt(?!$)|doping(?!,).{0,30}(biat|ski|nord(?!$))|fis( )?[-]?(welt(?!$)|cups?)|winter(?!reifen|thur|garten|rad)(ort)?( )?s?port(?!$)/i

const RAD_ZUSATZ = /\betap|rennrad|stra(ß|s)enrad|u\.?c\.?i\b|giro|vuelta\b/i

const RAD_KONTEXT =
  /radsport|rennrad|etappen?|giro|vuelta|tour( de| of| d'| d )|u\.?c\.?i|fahr(?!$)|roubaix|fland(?!$)|zeitfahr|austrag(ung|t)|doping(?!,).*?rad|Cycling(?!$)|Renn(?!$)|Radsport(?!$)/i

const WINTER_ZUSATZ = /nord(?!$)|schanz(?!$)|eisschne|eis(schnell|kunst)|rodel(?!$)|bobs(?!$)|loipe(?!$)|\b(ski(?!$)|winterp(?!$)|biat(?!$)|hopp(?!$))\b/i

const WINTER_KONTEXT =
  /biathlon|skifah|skispr|skilang|winter(?!reifen|thur)(?!$)|nord(?!$)|schanz|eis(?!$)|\bfis\b|\bibu\b|hahnenkamm|cortina|loipe(?!$)/i

function finKlingtCycling(s: string): boolean {
  if (RADSPORT.test(s) || RAD_ZUSATZ.test(s)) return false
  return /cofidis|ineos/i.test(s) && /kredit(?!$)|börse|konto(?!$)|zins(?!,)|billion(?!$)/i.test(s)
}

function radsportKeywordMitKontext(k: string, s: string): boolean {
  if (RAD_KONTEXT.test(s)) return true
  const w = k.trim().split(/\s+/)
  if (w.length >= 2 && k.length >= 8) return RAD_KONTEXT.test(s)
  if (k.length >= 12) return RAD_KONTEXT.test(s)
  return false
}

function winterKeywordMitKontext(k: string, s: string): boolean {
  if (WINTER_KONTEXT.test(s)) return true
  const w = k.trim().split(/\s+/)
  if (w.length >= 2 && k.length >= 8) return WINTER_KONTEXT.test(s)
  if (k.length >= 10) return WINTER_KONTEXT.test(s)
  return false
}

export function passtRadsportEintrag(
  roh: RohGoogleNewsEintrag,
  schluessel: readonly string[],
): boolean {
  const s = rohText(roh)
  if (s.length < 12 || UNTERHALT.test(s) || finKlingtCycling(s)) return false
  if (RADSPORT.test(s) || RAD_ZUSATZ.test(s)) return true
  for (const k of schluessel) {
    if (k.length < 6) continue
    if (!enthaeltPhrase(s, k)) continue
    if (BUNDES.test(s) || FIN.test(s)) {
      if (RADSPORT.test(s) || RAD_ZUSATZ.test(s) || RAD_KONTEXT.test(s)) return true
      return false
    }
    if (radsportKeywordMitKontext(k, s)) return true
  }
  return false
}

export function passtWintersportEintrag(
  roh: RohGoogleNewsEintrag,
  schluessel: readonly string[],
): boolean {
  const s = rohText(roh)
  if (s.length < 12 || UNTERHALT.test(s)) return false
  if (WINTERSP.test(s) || WINTER_ZUSATZ.test(s)) return true
  for (const k of schluessel) {
    if (k.length < 6) continue
    if (!enthaeltPhrase(s, k)) continue
    if (BUNDES.test(s) || FIN.test(s)) {
      if (WINTERSP.test(s) || WINTER_ZUSATZ.test(s) || WINTER_KONTEXT.test(s)) return true
      return false
    }
    if (winterKeywordMitKontext(k, s)) return true
  }
  return false
}
