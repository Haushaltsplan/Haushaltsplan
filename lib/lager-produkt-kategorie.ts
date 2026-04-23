/**
 * Feste Warengruppen fürs Lager (KI + Fallback + Anzeige).
 */

export const LAGER_PRODUKT_KATEGORIEN = [
  'Gemüse',
  'Obst',
  'Fleisch & Wurst',
  'Fisch',
  'Milchprodukte',
  'Eier',
  'Backwaren',
  'Öle & Essig',
  'Getränke',
  'Süßigkeiten',
  'Snacks',
  'Tiefkühl',
  'Konserven',
  'Haushalt & Reinigung',
  'Sonstiges',
] as const

export type LagerProduktKategorie = (typeof LAGER_PRODUKT_KATEGORIEN)[number]

const KANON_SET = new Set<string>(LAGER_PRODUKT_KATEGORIEN.map((k) => k.toLowerCase()))

/** Aus KI oder Formular → kanonischer Wert. */
export function normalisiereLagerKategorie(raw: string | null | undefined): LagerProduktKategorie {
  const t = (raw || '').trim()
  if (!t) return 'Sonstiges'
  const lower = t.toLowerCase()
  for (const k of LAGER_PRODUKT_KATEGORIEN) {
    if (k.toLowerCase() === lower) return k
  }
  if (lower === 'gemuese' || lower === 'grünzeug') return 'Gemüse'
  if (lower === 'milch' || lower === 'molkerei') return 'Milchprodukte'
  if (lower === 'süssigkeiten' || lower === 'suessigkeiten' || lower === 'süßwaren') return 'Süßigkeiten'
  if (lower === 'getraenk' || lower === 'getränke') return 'Getränke'
  if (KANON_SET.has(lower)) {
    const hit = LAGER_PRODUKT_KATEGORIEN.find((k) => k.toLowerCase() === lower)
    if (hit) return hit
  }
  return 'Sonstiges'
}

/**
 * Grobe Zuordnung aus dem (bereits kanonischen) Artikelnamen, falls die KI keine Kategorie liefert
 * oder „Sonstiges“ zurückgibt.
 */
export function kategorieFallbackAusArtikel(artikel: string): LagerProduktKategorie {
  const a = artikel.toLowerCase()

  if (/burti|waschmittel|spülmittel|spuelmittel|toilettenpapier|küchenrolle|reiniger|tabs|spülmaschine|haushalt/i.test(a)) {
    return 'Haushalt & Reinigung'
  }
  if (/olivenöl|öl|essig|dressing|mayonnaise|mayo\b/i.test(a)) return 'Öle & Essig'
  if (
    /\b(gummi|toffifee|haribo|katjes|lakritz|bonbon|praline|schokolade|schoko|riegel|fruchtgummi|drops|nimm|nuss|nougat|kekse|keks\b|süß|sueß|zucker|zartbitter)\b/i.test(a)
  ) {
    return 'Süßigkeiten'
  }
  if (
    /\b(bier|pils|weizen|radler|urhell|hacklberger|ötti|stiegl|goesser|gauder|zipfer|cola|mate|wasser|saft|limo|limonade|sprudel|schorle|energy|nektar|brause|glühwein|gluhwein|glühmost|gluhmost)\b/i.test(a) ||
    /\b(fl\.|flasche|dose)\s*\d/i.test(a)
  ) {
    return 'Getränke'
  }
  if (/\b(hackfleisch|wurst|steak|filet|braten|schnitzel|geflügel|hähnchen|huhn|pute|rind|schwein|lamm|currywurst|leberwurst|salami|schinken|speck)\b/i.test(a)) {
    return 'Fleisch & Wurst'
  }
  if (/\b(fisch|lachs|thunfisch|forelle|hering|garnelen|shrimp|tintenfisch)\b/i.test(a)) return 'Fisch'
  if (
    /\b(joghurt|quark|milch|sahne|rahm|butter|frischkäse|schmand|sauerrahm|saure sahne|mozzarella|feta|parmesan|pecorino|crème|creme fraiche|buttermilch)\b/i.test(a)
  ) {
    return 'Milchprodukte'
  }
  if (/\b(ei\b|eier)\b/i.test(a)) return 'Eier'
  if (/\b(brot|brötchen|semmel|baguette|croissant|kuchen|torte)\b/i.test(a)) return 'Backwaren'
  if (/\b(tiefkühl|tk-|pommes|spinat tief|pizza tief)\b/i.test(a)) return 'Tiefkühl'
  if (/\b(dose|konserve|passierte|eingemacht)\b/i.test(a)) return 'Konserven'
  if (/\b(apfel|birne|banane|orange|zitrone|beere|traube|melone|kiwi|pfirsich|pflaume|kirsche|exot)\b/i.test(a)) return 'Obst'
  if (
    /\b(gurke|tomate|möhre|mohre|karotte|paprika|zwiebel|kartoffel|salat|kohl|brokkoli|blumenkohl|zucchini|aubergine|sellerie|lauch|knoblauch|ingwer|champignon|pilz|spinat|mangold|radicchio|endivie)\b/i.test(a)
  ) {
    return 'Gemüse'
  }
  if (/nüsse|chips|popcorn|studentenfutter|snack/i.test(a)) return 'Snacks'

  return 'Sonstiges'
}

/** Kategorie aus KI-Wert + Artikel absichern (Süßigkeit vor Milchprodukt). */
export function lagerKategorieFinal(ai: string | null | undefined, artikelKanonsch: string): LagerProduktKategorie {
  const aNorm = artikelKanonsch.trim().toLowerCase()
  if (aNorm === 'schmand' || /\bschmand\b/i.test(artikelKanonsch)) {
    return 'Milchprodukte'
  }
  const ausAi = normalisiereLagerKategorie(ai)
  const ausName = kategorieFallbackAusArtikel(artikelKanonsch)
  if (ausAi !== 'Sonstiges') {
    if (ausName === 'Süßigkeiten' && ausAi === 'Milchprodukte') return 'Süßigkeiten'
    if (ausName === 'Getränke' && ausAi === 'Fleisch & Wurst') return 'Getränke'
    return ausAi
  }
  return ausName
}
