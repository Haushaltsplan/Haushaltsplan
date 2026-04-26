/**
 * Artikel, wenn Titel **oder** RSS-Beschreibung mindestens eines
 * der folgenden Begriffe vorkommt.
 *
 * Umlaute/ß: normalisierung in `normFuerOrtssuche` (ß → ss, …)
 *
 * **Roßbach** ist *kein* reiner Substring-Test: „… Roßbach“ als Nachname
 * (Ostsee, Sport, …) sonst fälschlich gematcht. Nur offensichtlicher Orts-Bezug.
 */

const REGION_NEWS_SCHLAGWOERTER: readonly string[] = [
  'Haarbach',
  'Aidenbach',
  'Aldersbach',
  'Bad Birnbach',
  'Bad Griesbach im Rottal',
  /** Headlines nennen oft nur „Bad Griesbach“ ohne Zusatz */
  'Bad Griesbach',
  'Beutelsbach',
  'Egglham',
  'Fürstenzell',
  'Kößlarn',
  'Ortenburg',
  // 'Roßbach' — separat, siehe `istRossbachAlsOrtGemeint`
  'Ruhstorf an der Rott',
  /** Kurzform; viele Texte „in Ruhstorf“, nicht die volle Zeile */
  'Ruhstorf',
  'Tettenweis',
  'Bergham',
  'Grongörgen',
  'Oberuttlau',
  'Unteruttlau',
  'Rainding',
  'Wolfakirchen',
  'Sachsenham',
  'Winkl',
  'Eschlbach',
  'Sammarei',
  'Weng',
  'Anleng',
  'Binderöd',
  'Dobl',
  'Freudenberg',
  'Freudenheim',
  'Grub',
  'Halmöd',
  'Hötzenham',
  'Klobach',
  'Kronholz',
  'Kronöd',
  'Loh',
  'Machham',
  'Nussertsham',
  'Oberhörbach',
  'Unterhörbach',
  'Oberndorf',
  'Oberthambach',
  'Unterthambach',
  'Riedertsham',
  'Schmalzöd',
  'Wienertsham',
  'Tanz in den Mai',
]

/**
 * Nach Normalisierung heißt der Ort stets `rossbach` (ß → ss).
 * Kein reines /rossbach/ — das trifft auch „Familie Roßbach, Ostsee“.
 */
const ROSSBACH_NUR_ORT: readonly RegExp[] = [
  /\bin\s+rossbach\b/i,
  /\baus\s+rossbach\b/i,
  /\bbei\s+rossbach\b/i,
  /\bnach\s+rossbach\b/i,
  /\bzu\s+rossbach\b/i,
  /\bam\s+rossbach\b/i,
  // kein /von\s+rossbach/ — trifft oft „Statement von Roßbach“ (Person)
  /\bgemeinde\s+rossbach\b/i,
  /\bort(?:steil)?\s+rossbach\b/i,
  /\bmarkt(?:platz)?\s+rossbach\b/i,
  /\bin\s+der\s+gemeinde\s+rossbach\b/i,
]

function normFuerOrtssuche(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
}

function istRossbachAlsOrtGemeint(vollNorm: string): boolean {
  if (!vollNorm.includes('rossbach')) {
    return false
  }
  for (const re of ROSSBACH_NUR_ORT) {
    if (re.test(vollNorm)) {
      return true
    }
  }
  return false
}

/**
 * Liefert true, wenn im Volltext (Titel + Beschreibung) mindestens eins
 * der erlaubten Schlagwörter vorkommt bzw. Roßbach klar als Ort gemeint ist.
 */
export function passtNewsLautRegionSchlagwortliste(volltext: string): boolean {
  const voll = normFuerOrtssuche(volltext)
  for (const w of REGION_NEWS_SCHLAGWOERTER) {
    if (voll.includes(normFuerOrtssuche(w))) {
      return true
    }
  }
  if (istRossbachAlsOrtGemeint(voll)) {
    return true
  }
  return false
}
