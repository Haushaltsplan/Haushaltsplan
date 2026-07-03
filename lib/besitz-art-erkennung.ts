import { normalisiereBesitzKategorie, type BesitzKategorie } from '@/lib/besitz-kategorien'
import {
  BESITZ_KLEIDUNGSART_GRUPPEN,
  BESITZ_SCHUHART_GRUPPEN,
  normalisiereBesitzKleidungsart,
} from '@/lib/besitz-kleidungsarten'

export type BesitzArtErkennungInput = {
  kategorie: string
  name: string
  hersteller?: string | null
  notiz?: string | null
  haendler?: string | null
}

export type BesitzArtErkennungErgebnis = {
  kleidungsart: string | null
  groesse: string | null
  farbe: string | null
  artikelnummer: string | null
  quelle: 'regel' | null
}

type ArtRegel = { re: RegExp; art: string; nur: 'Kleidung' | 'Schuhe' }

const ART_REGELN: ArtRegel[] = [
  { re: /\b(poloshirt|polo[\s-]?shirt|polo\b)/i, art: 'Poloshirt', nur: 'Kleidung' },
  { re: /\b(t[\s-]?shirt|tee\b|tshirt)\b/i, art: 'T-Shirt', nur: 'Kleidung' },
  { re: /\b(tank[\s-]?top|top\b|unterhemd)\b/i, art: 'Top', nur: 'Kleidung' },
  { re: /\b(hem(d|den)|oxford|business[\s-]?hemd)\b/i, art: 'Hemd', nur: 'Kleidung' },
  { re: /\b(bluse)\b/i, art: 'Bluse', nur: 'Kleidung' },
  { re: /\b(hoodie|kapuzen[\s-]?pullover|kapuzenpulli)\b/i, art: 'Hoodie', nur: 'Kleidung' },
  { re: /\b(pulli|pullover|sweater|strickpullover)\b/i, art: 'Pullover', nur: 'Kleidung' },
  { re: /\b(strickjacke|cardigan)\b/i, art: 'Strickjacke', nur: 'Kleidung' },
  { re: /\b(weste|gilet)\b/i, art: 'Weste', nur: 'Kleidung' },
  { re: /\b(jacke|jacket|softshell|windbreaker|bomber)\b/i, art: 'Jacke', nur: 'Kleidung' },
  { re: /\b(mantel|coat|trench|parka|daunenmantel)\b/i, art: 'Mantel', nur: 'Kleidung' },
  { re: /\b(parka)\b/i, art: 'Parka', nur: 'Kleidung' },
  { re: /\b(blazer|sakko)\b/i, art: 'Blazer', nur: 'Kleidung' },
  { re: /\b(jeans|denim|501|511|502|slim[\s-]?fit[\s-]?jeans)\b/i, art: 'Jeans', nur: 'Kleidung' },
  { re: /\b(chino|chinohose)\b/i, art: 'Chino', nur: 'Kleidung' },
  { re: /\b(stoffhose|bundfalten|an(?:zug)?hose)\b/i, art: 'Stoffhose', nur: 'Kleidung' },
  { re: /\b(shorts|kurzhose|bermuda)\b/i, art: 'Shorts', nur: 'Kleidung' },
  { re: /\b(jogging(hose|pants)|trainingshose|sweatpants)\b/i, art: 'Jogginghose', nur: 'Kleidung' },
  { re: /\b(leggings|tights)\b/i, art: 'Leggings', nur: 'Kleidung' },
  { re: /\b(rock\b|minirock|midirock)\b/i, art: 'Rock', nur: 'Kleidung' },
  { re: /\b(kleid\b|abendkleid|sommerkleid)\b/i, art: 'Kleid', nur: 'Kleidung' },
  { re: /\b(unterw[aä]sche|boxershorts|slip\b|bh\b|unterhose)\b/i, art: 'Unterwäsche', nur: 'Kleidung' },
  { re: /\b(socken|sneaker[\s-]?socken|wollsocken)\b/i, art: 'Socken', nur: 'Kleidung' },
  { re: /\b(strumpfhose|tights\b)\b/i, art: 'Strumpfhose', nur: 'Kleidung' },
  { re: /\b(badehose|badeshorts|swim[\s-]?shorts)\b/i, art: 'Badehose', nur: 'Kleidung' },
  { re: /\b(bikini)\b/i, art: 'Bikini', nur: 'Kleidung' },
  { re: /\b(badeanzug|swimsuit)\b/i, art: 'Badeanzug', nur: 'Kleidung' },
  { re: /\b(sneaker|trainer|turnschuh|laufschuh|running[\s-]?shoe)\b/i, art: 'Sneaker', nur: 'Schuhe' },
  { re: /\b(laufschuh|running)\b/i, art: 'Laufschuh', nur: 'Schuhe' },
  { re: /\b(trainingsschuh|hallenschuh|fitnessschuh)\b/i, art: 'Trainingsschuh', nur: 'Schuhe' },
  { re: /\b(wanderschuhe?|trekking[\s-]?schuh|hiking)\b/i, art: 'Wanderschuhe', nur: 'Schuhe' },
  { re: /\b(stiefel|boots|chelsea[\s-]?boot)\b/i, art: 'Stiefel', nur: 'Schuhe' },
  { re: /\b(stiefelette|ankle[\s-]?boot)\b/i, art: 'Stiefelette', nur: 'Schuhe' },
  { re: /\b(sandale|flip[\s-]?flops?|zehentrenner)\b/i, art: 'Sandale', nur: 'Schuhe' },
  { re: /\b(pantoletten|clogs)\b/i, art: 'Pantoletten', nur: 'Schuhe' },
  { re: /\b(halbschuh|brogue|derby|oxford[\s-]?schuh)\b/i, art: 'Halbschuh', nur: 'Schuhe' },
  { re: /\b(schnürer|schnürschuh|dress[\s-]?shoe)\b/i, art: 'Schnürer', nur: 'Schuhe' },
  { re: /\b(loafer|slipper[\s-]?schuh)\b/i, art: 'Loafer', nur: 'Schuhe' },
]

const GROESSEN_RE = [
  /\bgr(?:öße|osse)?\.?\s*[:.]?\s*(xxs|xs|s|m|l|xl|xxl|xxxl|3xl|4xl)\b/i,
  /\bgr(?:öße|osse)?\.?\s*[:.]?\s*(\d{2,3}\/\d{2,3})\b/i,
  /\bgr(?:öße|osse)?\.?\s*[:.]?\s*(\d{2,3})\b/i,
  /\bsize\s*[:.]?\s*(xxs|xs|s|m|l|xl|xxl|xxxl|\d{2,3}(?:\/\d{2,3})?)\b/i,
  /\b(\d{2,3}\/\d{2,3})\b/,
]

const FARBEN = [
  'schwarz',
  'black',
  'weiß',
  'weiss',
  'white',
  'navy',
  'blau',
  'blue',
  'rot',
  'red',
  'grün',
  'gruen',
  'green',
  'grau',
  'grey',
  'gray',
  'beige',
  'braun',
  'brown',
  'gelb',
  'yellow',
  'orange',
  'lila',
  'violett',
  'purple',
  'pink',
  'rosa',
  'anthrazit',
  'oliv',
  'khaki',
  'creme',
  'bordeaux',
  'petrol',
  'türkis',
  'turkis',
]

const ARTNR_RE = [
  /(?:art\.?[\s-]?nr\.?|artikel[\s-]?nr\.?|sku|style[\s-]?code|modell[\s-]?nr\.?)\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9._\-\/]{2,40})/i,
  /\b([A-Z]{2,4}\d{3,}[A-Z0-9\-]*)\b/,
]

function textBlob(input: BesitzArtErkennungInput): string {
  return [input.name, input.hersteller, input.notiz, input.haendler].filter(Boolean).join(' ')
}

export function extrahiereArtikelnummer(text: string): string | null {
  for (const re of ARTNR_RE) {
    const m = text.match(re)
    if (m?.[1]) return m[1].trim().slice(0, 60)
  }
  return null
}

export function extrahiereGroesse(text: string): string | null {
  for (const re of GROESSEN_RE) {
    const m = text.match(re)
    if (m?.[1]) {
      const g = m[1].trim()
      if (/^\d{2,3}$/.test(g) && Number(g) > 60) continue
      return g.toUpperCase() === g && g.length <= 4 ? g : g
    }
  }
  return null
}

export function extrahiereFarbe(text: string): string | null {
  const lower = text.toLowerCase()
  for (const f of FARBEN) {
    const re = new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (re.test(lower)) {
      const map: Record<string, string> = {
        black: 'Schwarz',
        white: 'Weiß',
        weiss: 'Weiß',
        blue: 'Blau',
        red: 'Rot',
        green: 'Grün',
        gruen: 'Grün',
        grey: 'Grau',
        gray: 'Grau',
        brown: 'Braun',
        yellow: 'Gelb',
        purple: 'Lila',
        pink: 'Pink',
        rosa: 'Rosa',
        turkis: 'Türkis',
      }
      return map[f] ?? f.charAt(0).toUpperCase() + f.slice(1)
    }
  }
  const m = text.match(/\bfarbe\s*[:.]?\s*([a-zäöüß\-]{3,20})\b/i)
  return m?.[1] ? m[1].trim() : null
}

export function errateBesitzArtRegeln(input: BesitzArtErkennungInput): BesitzArtErkennungErgebnis {
  const kat = normalisiereBesitzKategorie(input.kategorie)
  const blob = textBlob(input)
  let kleidungsart: string | null = null

  if (kat === 'Kleidung' || kat === 'Schuhe') {
    for (const regel of ART_REGELN) {
      if (regel.nur !== kat) continue
      if (regel.re.test(blob)) {
        kleidungsart = normalisiereBesitzKleidungsart(regel.art, kat)
        break
      }
    }
  }

  return {
    kleidungsart,
    groesse: extrahiereGroesse(blob),
    farbe: extrahiereFarbe(blob),
    artikelnummer: extrahiereArtikelnummer(blob),
    quelle: kleidungsart ? 'regel' : null,
  }
}

export function alleBesitzArtenListe(kategorie: BesitzKategorie): string[] {
  const gruppen = kategorie === 'Schuhe' ? BESITZ_SCHUHART_GRUPPEN : BESITZ_KLEIDUNGSART_GRUPPEN
  return gruppen.flatMap((g) => [...g.arten])
}

export function brauchtBesitzAnreicherung(row: {
  kategorie: string
  kleidungsart?: string | null
  groesse?: string | null
  farbe?: string | null
  hersteller?: string | null
  bild_pfad?: string | null
}): boolean {
  if (!row.bild_pfad?.trim()) return false
  const kat = normalisiereBesitzKategorie(row.kategorie)
  if (kat === 'Kleidung' || kat === 'Schuhe') {
    return !row.kleidungsart?.trim() || !row.groesse?.trim() || !row.farbe?.trim()
  }
  return !row.farbe?.trim() || !row.hersteller?.trim()
}
