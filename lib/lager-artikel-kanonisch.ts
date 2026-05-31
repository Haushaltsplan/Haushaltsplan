import {
  findeProduktIdNachAnzeigeName,
  produktAnzeigeNameAusBon,
  produktNameNormalisieren,
  waehleCanonicalId,
} from '@/lib/produkt-name-normalize'

/**
 * Reine Pfand-/Leergut-Zeilen — nicht als Lagerware buchen.
 */
export function istLagerIrrelevantPfandOderLeergut(artikel: string): boolean {
  const t = artikel.trim().toLowerCase()
  if (!t) return true
  if (/^(mehrweg|flaschen|einweg)?\s*pfand\b/.test(t)) return true
  if (/^pfand\b/.test(t) && t.length < 36) return true
  if (/^leergut\b/.test(t)) return true
  if (/^dpg\b/.test(t)) return true
  return false
}

type Regel = { re: RegExp; sammelname: string }

/** Kasten/Tray: z. B. `Hack.Urhell20x0,5l`, `20 x 0,5 l` am Zeilenende — Anzahl Flaschen + Volumen pro Flasche. */
export function parseMultipackFlaschenNxLiter(text: string): { anzahl: number; volL: number; matched: string } | null {
  const s = String(text || '').trim()
  if (!s) return null
  const re = /(\d+)\s*[x×]\s*([\d,.]+)\s*l\b/gi
  const hits = [...s.matchAll(re)]
  if (!hits.length) return null
  const m = hits[hits.length - 1]
  const anzahl = Number(String(m[1]).replace(',', '.'))
  const volL = Number(String(m[2]).replace(',', '.'))
  if (!Number.isFinite(anzahl) || !Number.isFinite(volL)) return null
  if (anzahl < 2 || anzahl > 99) return null
  if (volL < 0.1 || volL > 2.5) return null
  return { anzahl, volL, matched: m[0] }
}

/** Entfernt ein erkanntes `Nx0,5l`-Suffix vom Bon-Text (für Artikelnamen). */
export function bonTextOhneMultipackFlaschenSuffix(text: string, matched: string): string {
  const i = text.lastIndexOf(matched)
  if (i < 0) return text.trim()
  return (text.slice(0, i) + text.slice(i + matched.length)).replace(/[.\s]+$/g, '').trim()
}

/**
 * Wenn im Bon-Text ein Kasten wie `20x0,5l` / `20 x 0,5 l` steht: **Anzahl Flaschen** + Einheit **Stück**,
 * Gebinde-Zahl aus dem Namen entfernen (für Lager-Anzeige).
 */
export function applyMultipackGetraenkKorrektur(roh: string): { roh: string; menge: number; einheit: string } | null {
  const pack = parseMultipackFlaschenNxLiter(roh)
  if (!pack) return null
  const cleaned = bonTextOhneMultipackFlaschenSuffix(roh, pack.matched)
  return { roh: cleaned || roh, menge: pack.anzahl, einheit: 'Stück' }
}

/** Reihenfolge: spezifischere Muster zuerst. */
const SAMMEL_REGELN: Regel[] = [
  { re: /passierte\s+tomaten/i, sammelname: 'Passierte Tomaten' },
  /** EDEKA o. Ä.: „B.L.Frisch.Sc“ / „Frisch.Sc“ = Schmand, nicht Frischkäse. */
  { re: /\b(?:b\.?\s*l\.?\s*)?frisch\.?\s*\.?\s*sc(?:hmand)?\b/i, sammelname: 'Schmand' },
  { re: /\bschmand\b/i, sammelname: 'Schmand' },
  /** Glühmost zuerst — nicht mit Glühwein zusammenlegen. */
  { re: /(?<![a-zäöüß])gl[uüh]hmost\b/i, sammelname: 'Glühmost' },
  /** Alle markierten Glühwein-Varianten (Christkindl, Kunzmann, …) → eine Lagerposition. */
  { re: /(?<![a-zäöüß])gl[uüh]hwein\b/i, sammelname: 'Glühwein' },
  { re: /(rispen|cocktail|cherry|strauch)[-\s]?tomaten/i, sammelname: 'Tomaten' },
  { re: /rispentomaten/i, sammelname: 'Tomaten' },
  { re: /rispen[-\s]?gurken/i, sammelname: 'Gurken' },
  { re: /^(bio\s+)?tomaten$/i, sammelname: 'Tomaten' },
  { re: /(ehl|tk)\s+.*(m[oö]hren|m[oö]hre|moren)\b/i, sammelname: 'Möhren' },
  { re: /\b(m[oö]hren|m[oö]hre|moren)\b/i, sammelname: 'Möhren' },
  { re: /\bkarotten?\b/i, sammelname: 'Karotten' },
  { re: /\b(salat)?gurken?\b/i, sammelname: 'Gurken' },
  { re: /(spitz|block|peperoni)?paprika/i, sammelname: 'Paprika' },
  /** Nur echtes Hack: Wort „hack“ muss Wortgrenze haben (nicht „Hacklberger“ o. Ä.). */
  { re: /\b(schweine|rind|pute|kalb|gemischtes|gemischt|reines|reine)([\s-]+)hack(fleisch)?\b/i, sammelname: 'Hackfleisch' },
  { re: /\bhackfleisch\b/i, sammelname: 'Hackfleisch' },
  { re: /waschmittel/i, sammelname: 'Waschmittel' },
  { re: /oliven[oö]l/i, sammelname: 'Olivenöl' },
  { re: /club[-\s]?mate/i, sammelname: 'Club Mate' },
  /** Biermarken/-sorten → eine Lagerposition „Bier“ (nicht „Hacklberger Urhell“ einzeln). */
  {
    re: /\b(hacklberger|urhell|pils|weizen|radler|stiegl|goesser|gauder|zipfer|puntigamer|murauer|egger|schwechat|ottakringer|villacher|krombacher|bitburger|warsteiner|becks|augustiner|paulaner|erdinger|spaten|holsten|veltins|jever|einbecker|desperados|corona|heineken)\b/i,
    sammelname: 'Bier',
  },
  { re: /\b(bier|bräu|braeu|brew|lager)\b/i, sammelname: 'Bier' },
  { re: /pecorino/i, sammelname: 'Pecorino' },
  { re: /curryw[uü]rst/i, sammelname: 'Currywürste' },
  { re: /zucchini/i, sammelname: 'Zucchini' },
  { re: /aubergine/i, sammelname: 'Auberginen' },
  { re: /brokkoli/i, sammelname: 'Brokkoli' },
  { re: /blumenkohl/i, sammelname: 'Blumenkohl' },
  { re: /(jung|weiß|rot|gelb|zucker)?zwiebeln?\b/i, sammelname: 'Zwiebeln' },
  { re: /\b(kartoffeln?|pellkartoffeln?)\b/i, sammelname: 'Kartoffeln' },
  { re: /\bbutter\b/i, sammelname: 'Butter' },
  { re: /(schlagsahne|sahne)\b/i, sammelname: 'Sahne' },
  /** Joghurt-Gums / Fruchtgummi — nicht Frischjoghurt. */
  {
    re: /joghurt.*(gum|gummi|gums)|(gum|gummi|gums).*joghurt|katjes|haribo.*joghurt|joghurt.*haribo/i,
    sammelname: 'Fruchtgummi',
  },
  { re: /\b(joghurt|jogurt)\b(?!.*(gum|gummi|gums|katjes|haribo))/i, sammelname: 'Joghurt' },
]

/** Entfernt typische Gebinde-Angaben am Ende (z. B. „0,5 l“, „500 ml“). */
function ohneGebindeAngabeAmEnde(name: string): string {
  return name
    .replace(/\s*[,]?\s*\d+[,.]?\d*\s*(l|ml|liter|cl)\s*$/i, '')
    .replace(/\s*[,]?\s*\d+\s*(x|×)\s*\d+[,.]?\d*\s*(l|ml)?\s*$/i, '')
    .trim()
}

/**
 * Mappt Bon-Text auf einen kurzen Lager-Sammelnamen (keine Marken-Präfixe, keine VERSALIEN).
 */
export function lagerArtikelSammelname(roh: string): string {
  const vorBon = roh.trim().replace(/\bherz\.?\s*/i, '')
  const basis = produktAnzeigeNameAusBon(vorBon)
  if (!basis) return basis

  const mitGebinde = ohneGebindeAngabeAmEnde(basis)
  const test = mitGebinde.toLocaleLowerCase('de')

  for (const { re, sammelname } of SAMMEL_REGELN) {
    if (re.test(test)) return sammelname
  }

  // Kein Treffer: Marken-/Kürzel am Anfang entfernen, erneut prüfen
  const ohneHaendler = mitGebinde
    .replace(/^(ehl|tk|bio|aldi|lidl|rewe|edeka|netto|penny|kaufland|hofer)\s+/i, '')
    .trim()
  if (ohneHaendler !== mitGebinde) {
    const t2 = ohneHaendler.toLocaleLowerCase('de')
    for (const { re, sammelname } of SAMMEL_REGELN) {
      if (re.test(t2)) return sammelname
    }
    return produktAnzeigeNameAusBon(ohneHaendler)
  }

  return mitGebinde
}

/** Für Duplikat-Erkennung: gleicher Sammelname trotz unterschiedlicher Bon-Schreibweise. */
export function lagerArtikelSammelSchluessel(artikel: string): string {
  return produktNameNormalisieren(lagerArtikelSammelname(artikel))
}

/**
 * Wie `findeProduktIdNachAnzeigeName`, zusätzlich Treffer über denselben **Lager-Sammelnamen**
 * (z. B. „Christkindl Glühwein“ ↔ „Kunzmann Glühwein“ ↔ „Glühwein“).
 */
export function findeProduktIdNachLagerZuordnung(
  kandidaten: Array<{ id: string; name: string }>,
  gesuchterName: string,
): string | null {
  const direkt = findeProduktIdNachAnzeigeName(kandidaten, gesuchterName)
  if (direkt) return direkt
  const g = lagerArtikelSammelSchluessel(gesuchterName)
  if (!g) return null
  const gruppe = kandidaten.filter((p) => lagerArtikelSammelSchluessel(p.name) === g)
  if (!gruppe.length) return null
  return waehleCanonicalId(gruppe)
}
