/**
 * Warengruppen fürs Lager + automatische Erkennung aus Artikelnamen (Bon, Scan, manuell).
 *
 * Priorität: Marken/Stichwörter mit Punktesystem (ähnlich Finanz-Kategorisierung),
 * damit z. B. „Hacklberger Urhell“ → **Bier** und nicht Fleisch (Hack-False-Positive).
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
  'Bier',
  'Wein & Sekt',
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

/** Für robustes Matching (ä→ae, ß→ss). */
function deutschLower(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
}

type KatRegel = {
  kat: LagerProduktKategorie
  /** Höhere Zahl = wichtiger bei Gleichstand. */
  prio: number
  /** Ganze Wörter / Marken (bereits normalisiert ohne Umlaute). */
  keywords: string[]
  /** Zusätzliche Regex (auf Original-Text). */
  re?: RegExp[]
}

/**
 * Spezifische Warengruppen zuerst (Bier vor Getränke, Süßigkeiten vor Milch).
 * Keywords sind in deutschLower-Form.
 */
const ERKENNUNGS_REGELN: KatRegel[] = [
  {
    kat: 'Haushalt & Reinigung',
    prio: 90,
    keywords: [
      'waschmittel', 'spuelmittel', 'spuelmaschinentabs', 'tabs', 'toilettenpapier', 'kuechenrolle',
      'reiniger', 'putzmittel', 'wc', 'burti', 'persil', 'ariel', 'finish', 'domestos',
    ],
    re: [/waschmittel|spülmittel|spuelmittel|toilettenpapier|küchenrolle|reiniger|tabs/i],
  },
  {
    kat: 'Bier',
    prio: 95,
    keywords: [
      'bier', 'pils', 'pilsner', 'lager', 'hell', 'urhell', 'dunkel', 'weizen', 'hefeweizen',
      'radler', 'alkoholfreies bier', 'märzen', 'marzen', 'export', 'kölsch', 'koelsch', 'ipa', 'ale', 'stout',
      'porter', 'craft beer', 'craftbier',
      'hacklberger', 'stiegl', 'goesser', 'gauder', 'zipfer', 'puntigamer', 'murauer', 'egger', 'schwechater',
      'ottakringer', 'villacher', 'moenchshof', 'monchshof', 'krombacher', 'bitburger', 'warsteiner', 'becks',
      'augustiner', 'paulaner', 'erdinger', 'franziskaner', 'spaten', 'loewenbraeu', 'lowenbrau', 'holsten',
      'veltins', 'jever', 'flensburger', 'steinburg', 'einbecker', 'veltins', 'frei', 'freibier',
      'budweiser', 'corona', 'heineken', 'carlsberg', 'desperados',
    ],
    re: [
      /\b(bier|pils|urhell|weizen|radler|bräu|braeu|brew|lager)\b/i,
      /\b(hacklberger|stiegl|goesser|gauder|zipfer|puntigamer|murauer|egger|schwechat)\b/i,
      /\b(ötti|otti)\b/i,
    ],
  },
  {
    kat: 'Wein & Sekt',
    prio: 88,
    keywords: [
      'wein', 'rotwein', 'weisswein', 'rosewein', 'rose', 'riesling', 'grüner veltliner', 'gruener veltliner',
      'chardonnay', 'sekt', 'prosecco', 'champagner', 'cava', 'perlwein', 'gluehwein', 'gluhwein', 'gluehmost', 'gluhmost',
      'punsch', 'feuerzangenbowle', 'spritzer',
    ],
    re: [/\b(wein|sekt|prosecco|champagner|riesling|veltliner)\b/i, /gl[uü]hwein/i, /gl[uü]hmost/i],
  },
  {
    kat: 'Süßigkeiten',
    prio: 85,
    keywords: [
      'schokolade', 'schoko', 'praline', 'bonbon', 'gummibaerchen', 'fruchtgummi', 'haribo', 'katjes', 'lakritz',
      'toffifee', 'riegel', 'keks', 'kekse', 'nuss', 'nougat', 'zucker', 'suesss', 'suessigkeiten',
    ],
    re: [
      /\b(gummi|toffifee|haribo|katjes|lakritz|bonbon|praline|schokolade|schoko|riegel|fruchtgummi)\b/i,
    ],
  },
  {
    kat: 'Öle & Essig',
    prio: 80,
    keywords: ['olivenoel', 'olivenöl', 'sonnenblumenoel', 'rapsoel', 'essig', 'balsamico', 'dressing', 'mayonnaise', 'mayo'],
    re: [/olivenöl|olivenoel|essig|dressing|mayonnaise/i],
  },
  {
    kat: 'Getränke',
    prio: 70,
    keywords: [
      'cola', 'coca', 'pepsi', 'fanta', 'sprite', 'limo', 'limonade', 'mate', 'club mate', 'wasser', 'mineralwasser',
      'saft', 'orangensaft', 'apfelsaft', 'nektar', 'schorle', 'sprudel', 'brause', 'energy', 'red bull', 'redbull',
      'eistee', 'ice tea', 'kaffee', 'tee', 'kakao', 'sirup',
    ],
    re: [/\b(cola|mate|wasser|saft|limo|limonade|schorle|energy|nektar|brause)\b/i],
  },
  {
    kat: 'Fleisch & Wurst',
    prio: 75,
    keywords: [
      'hackfleisch', 'wurst', 'steak', 'filet', 'braten', 'schnitzel', 'geflügel', 'haehnchen', 'huhn', 'pute',
      'rind', 'schwein', 'lamm', 'currywurst', 'leberwurst', 'salami', 'schinken', 'speck', 'bratwurst',
    ],
    re: [
      /\b(hackfleisch|wurst|steak|schnitzel|salami|schinken|currywurst)\b/i,
      /\b(schweine|rind|pute|kalb|gemischtes)[\s-]+hack(fleisch)?\b/i,
      /\bhackfleisch\b/i,
    ],
  },
  {
    kat: 'Fisch',
    prio: 74,
    keywords: ['fisch', 'lachs', 'thunfisch', 'forelle', 'hering', 'garnelen', 'shrimp', 'tintenfisch'],
    re: [/\b(fisch|lachs|thunfisch|forelle|garnelen)\b/i],
  },
  {
    kat: 'Milchprodukte',
    prio: 72,
    keywords: [
      'joghurt', 'jogurt', 'quark', 'milch', 'sahne', 'rahm', 'butter', 'frischkaese', 'schmand', 'sauerrahm',
      'mozzarella', 'feta', 'parmesan', 'pecorino', 'creme', 'buttermilch', 'kefir',
    ],
    re: [/\b(joghurt|quark|milch|sahne|butter|schmand|mozzarella|feta)\b/i],
  },
  { kat: 'Eier', prio: 71, keywords: ['eier', 'ei'], re: [/\b(eier|ei)\b/i] },
  {
    kat: 'Backwaren',
    prio: 68,
    keywords: ['brot', 'broetchen', 'semmel', 'baguette', 'croissant', 'kuchen', 'torte', 'hefezopf'],
    re: [/\b(brot|brötchen|broetchen|semmel|baguette)\b/i],
  },
  {
    kat: 'Tiefkühl',
    prio: 65,
    keywords: ['tiefkuehl', 'tiefkühl', 'tk', 'pommes', 'pizza tief'],
    re: [/\b(tiefkühl|tiefkuehl|tk-)\b/i],
  },
  {
    kat: 'Konserven',
    prio: 64,
    keywords: ['konserve', 'dose', 'passierte', 'eingemacht'],
    re: [/\b(konserve|passierte)\b/i],
  },
  {
    kat: 'Obst',
    prio: 60,
    keywords: [
      'apfel', 'birne', 'banane', 'orange', 'zitrone', 'beere', 'traube', 'melone', 'kiwi', 'pfirsich', 'pflaume',
      'kirsche',
    ],
    re: [/\b(apfel|birne|banane|orange|zitrone|traube|melone)\b/i],
  },
  {
    kat: 'Gemüse',
    prio: 58,
    keywords: [
      'gurke', 'tomate', 'moehre', 'karotte', 'paprika', 'zwiebel', 'kartoffel', 'salat', 'kohl', 'brokkoli',
      'blumenkohl', 'zucchini', 'aubergine', 'sellerie', 'lauch', 'knoblauch', 'ingwer', 'champignon', 'pilz', 'spinat',
    ],
    re: [/\b(gurke|tomate|möhre|mohre|paprika|zwiebel|kartoffel|salat|brokkoli)\b/i],
  },
  {
    kat: 'Snacks',
    prio: 55,
    keywords: ['chips', 'popcorn', 'studentenfutter', 'snack', 'nuesse', 'erdnuss'],
    re: [/\b(chips|popcorn|snack|nüsse|nuesse)\b/i],
  },
]

function punktzahlFuerRegel(textNorm: string, textOrig: string, regel: KatRegel): number {
  let score = 0
  for (const kw of regel.keywords) {
    if (!kw) continue
    if (kw.includes(' ')) {
      if (textNorm.includes(kw)) score += regel.prio
    } else if (new RegExp(`(?:^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z0-9]|$)`).test(textNorm)) {
      score += regel.prio
    }
  }
  if (regel.re) {
    for (const re of regel.re) {
      if (re.test(textOrig)) score += Math.round(regel.prio * 0.85)
    }
  }
  return score
}

/** Verhindert „Hacklberger“ → Fleisch (Hack-Regel). */
function istOffensichtlichBier(textNorm: string, textOrig: string): boolean {
  if (punktzahlFuerRegel(textNorm, textOrig, ERKENNUNGS_REGELN[1]) > 0) return true
  return /\b(hacklberger|urhell|pils|weizen|radler|stiegl|goesser|zipfer)\b/i.test(textOrig)
}

/** Haupt-Erkennung: Artikelname → Warengruppe. */
export function lagerKategorieAusArtikel(artikel: string): LagerProduktKategorie {
  const orig = (artikel || '').trim()
  if (!orig) return 'Sonstiges'
  const norm = deutschLower(orig)

  if (/\bschmand\b/i.test(orig) || norm === 'schmand') return 'Milchprodukte'

  let best: { kat: LagerProduktKategorie; score: number } = { kat: 'Sonstiges', score: 0 }

  for (const regel of ERKENNUNGS_REGELN) {
    if (regel.kat === 'Fleisch & Wurst' && istOffensichtlichBier(norm, orig)) continue
    const s = punktzahlFuerRegel(norm, orig, regel)
    if (s > best.score) best = { kat: regel.kat, score: s }
  }

  return best.kat
}

/** Aus KI oder Formular → kanonischer Wert. */
export function normalisiereLagerKategorie(raw: string | null | undefined): LagerProduktKategorie {
  const t = (raw || '').trim()
  if (!t) return 'Sonstiges'
  const lower = t.toLowerCase()
  for (const k of LAGER_PRODUKT_KATEGORIEN) {
    if (k.toLowerCase() === lower) return k
  }
  if (lower === 'gemuese' || lower === 'grünzeug' || lower === 'gruenzeug') return 'Gemüse'
  if (lower === 'milch' || lower === 'molkerei') return 'Milchprodukte'
  if (lower === 'süssigkeiten' || lower === 'suessigkeiten' || lower === 'süßwaren' || lower === 'suesswaren') {
    return 'Süßigkeiten'
  }
  if (lower === 'getraenk' || lower === 'getränke' || lower === 'getraenke') return 'Getränke'
  if (lower === 'alkohol' || lower === 'alkoholische getraenke') return 'Bier'
  if (KANON_SET.has(lower)) {
    const hit = LAGER_PRODUKT_KATEGORIEN.find((k) => k.toLowerCase() === lower)
    if (hit) return hit
  }
  return 'Sonstiges'
}

/** Kategorie aus KI-Wert + Artikel absichern. */
export function lagerKategorieFinal(ai: string | null | undefined, artikelKanonsch: string): LagerProduktKategorie {
  const ausName = lagerKategorieAusArtikel(artikelKanonsch)
  const ausAi = normalisiereLagerKategorie(ai)

  if (ausAi === 'Sonstiges') return ausName

  // KI sagt oft noch „Getränke“ für Bier — Name gewinnt bei klarer Biermarke.
  if (ausAi === 'Getränke' && (ausName === 'Bier' || ausName === 'Wein & Sekt')) return ausName
  if (ausAi === 'Fleisch & Wurst' && (ausName === 'Bier' || ausName === 'Getränke')) return ausName
  if (ausName === 'Süßigkeiten' && ausAi === 'Milchprodukte') return 'Süßigkeiten'
  if (ausName === 'Milchprodukte' && /\bschmand\b/i.test(artikelKanonsch)) return 'Milchprodukte'

  return ausAi
}

/** Wenn Formular leer / Sonstiges: aus Name ableiten. */
export function lagerKategorieFuerErfassung(name: string, formularKategorie?: string | null): LagerProduktKategorie {
  const form = normalisiereLagerKategorie(formularKategorie)
  if (form !== 'Sonstiges') return form
  return lagerKategorieAusArtikel(name)
}

/** @deprecated Alias — nutze `lagerKategorieAusArtikel`. */
export function kategorieFallbackAusArtikel(artikel: string): LagerProduktKategorie {
  return lagerKategorieAusArtikel(artikel)
}
