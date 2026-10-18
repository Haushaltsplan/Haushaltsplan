/**
 * GEO-Intros dürfen die bestehende Etsy-Beschreibung nicht stapeln.
 * Entfernt nur ähnliche Doppel-Intros — behält Produkt-Einleitung + Handwerks-Absatz.
 */

/** Strukturierter Listing-Körper (Emoji-Sektionen, Maße, Pflege …) beginnt hier oft. */
const KOERPER_MARKER_RE =
  /^(?:[🪵📏🌿✨🎁🛠️🔧💧📦🇩🇪🇪🇺⭐💎🧼🚫🌻]|masse|maße|maß|pflege|verwendung|material|finish|versand|hinweis|pflegehinweise?|charakter|durchmesser|ø\s*\d|holzart)/iu

const PRODUKT_RE =
  /(schale|schüssel|schuessel|bowl|dose|behälter|behaelter|vase|teller|stab|skulptur|gefäß|gefaess)/i
const HOLZ_RE =
  /(eiche|esche|ahorn|walnuss|nussbaum|kirsch|birke|buche|linde|pflaume|zwetschg|apfel|birne|ulme|rüster|robinie|oliv|zirbe|lärche|kiefer|fichte|eibe|mooreiche|wurzelholz|holz)/i
const PROZESS_RE =
  /(entstehungsprozess|vorgedreht|lufttrocknung|drehbank|feingeschliffen|rohling|trocknung|formgebung)/i

function normBlock(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[„“"']/g, '')
    .trim()
}

function aehnlich(a: string, b: string): boolean {
  const na = normBlock(a)
  const nb = normBlock(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const kurz = na.length <= nb.length ? na : nb
  const lang = na.length <= nb.length ? nb : na
  if (kurz.length >= 80 && lang.startsWith(kurz.slice(0, Math.min(120, kurz.length)))) return true
  const wa = new Set(na.split(' ').filter((w) => w.length >= 4))
  const wb = new Set(nb.split(' ').filter((w) => w.length >= 4))
  if (wa.size < 6 || wb.size < 6) return false
  let hit = 0
  for (const w of wa) if (wb.has(w)) hit++
  return hit / Math.min(wa.size, wb.size) >= 0.55
}

function istKoerperBlock(block: string): boolean {
  const t = block.trim()
  if (!t) return false
  const ersteZeile = t.split(/\n/)[0]?.trim() || t
  return KOERPER_MARKER_RE.test(ersteZeile) || KOERPER_MARKER_RE.test(t.slice(0, 40))
}

function istProzessBlock(block: string): boolean {
  return PROZESS_RE.test(block) && !istProduktIntro(block)
}

/** Kurze/mittlere Produkt-Einleitung: WAS + Holzart (GEO-First-2). */
function istProduktIntro(block: string): boolean {
  const t = block.trim()
  if (t.length < 35 || t.length > 700) return false
  if (istKoerperBlock(t)) return false
  if (PROZESS_RE.test(t) && !PRODUKT_RE.test(t)) return false
  return PRODUKT_RE.test(t) && HOLZ_RE.test(t)
}

function istIntroBlock(block: string): boolean {
  const t = block.trim()
  if (t.length < 40 || t.length > 900) return false
  if (istKoerperBlock(t)) return false
  if (istProzessBlock(t)) return false
  const zeilen = t.split(/\n/).filter(Boolean)
  if (zeilen.length > 8) return false
  return /[.!?]/.test(t)
}

function produktIntroScore(block: string): number {
  let s = 0
  if (PRODUKT_RE.test(block)) s += 3
  if (HOLZ_RE.test(block)) s += 3
  if (/unikat|handgedrechselt|handgemacht|niederbayern/i.test(block)) s += 2
  if (/ø|durchmesser|\d+\s*cm/i.test(block)) s += 1
  if (PROZESS_RE.test(block)) s -= 4
  // Kurze prägnante Intros bevorzugen gegenüber Roman
  if (block.length >= 60 && block.length <= 320) s += 2
  if (block.length > 500) s -= 1
  return s
}

/** Blöcke per Leerzeile; behält innere Newlines im Block. */
export function beschreibungBloecke(description: string): string[] {
  return description
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
}

/**
 * Entfernt nur ähnliche gestapelte SEO-Intros.
 * Behält: beste Produkt-Einleitung + Handwerks-/Prozess-Absatz + Körper.
 * Holt eine am Ende hängende Produkt-Kurzfassung nach vorne, falls vorne keine Einleitung steht.
 */
export function entferneGestapelteBeschreibungsIntros(description: string): {
  cleaned: string
  entfernt: number
} {
  const raw = description.replace(/\r\n/g, '\n').trim()
  const blocks = beschreibungBloecke(raw)
  if (blocks.length <= 1) return { cleaned: raw, entfernt: 0 }

  const koerperIdx = blocks.findIndex((b) => istKoerperBlock(b))
  let entfernt = 0
  let vorspann: string[]
  let koerper: string[]

  if (koerperIdx < 0) {
    vorspann = [...blocks]
    koerper = []
  } else {
    vorspann = blocks.slice(0, koerperIdx)
    koerper = blocks.slice(koerperIdx)
  }

  // 1) Ähnliche Intro-Duplikate im Vorspann kollabieren → bestes Produkt-Intro behalten
  const neuVorspann: string[] = []
  for (const block of vorspann) {
    if (!istIntroBlock(block) && !istProduktIntro(block)) {
      neuVorspann.push(block)
      continue
    }
    const dupIdx = neuVorspann.findIndex(
      (b) => (istIntroBlock(b) || istProduktIntro(b)) && aehnlich(b, block),
    )
    if (dupIdx < 0) {
      neuVorspann.push(block)
      continue
    }
    entfernt++
    // Besseres (produktnäheres) Intro behalten
    if (produktIntroScore(block) > produktIntroScore(neuVorspann[dupIdx]!)) {
      neuVorspann[dupIdx] = block
    }
  }

  // 2) Mehrere Produkt-Intros → nur das beste behalten, Rest (Prozess etc.) lassen
  const produktIdxs = neuVorspann
    .map((b, i) => (istProduktIntro(b) ? i : -1))
    .filter((i) => i >= 0)
  if (produktIdxs.length > 1) {
    let best = produktIdxs[0]!
    for (const i of produktIdxs.slice(1)) {
      if (produktIntroScore(neuVorspann[i]!) > produktIntroScore(neuVorspann[best]!)) best = i
    }
    const filtered: string[] = []
    for (let i = 0; i < neuVorspann.length; i++) {
      if (produktIdxs.includes(i) && i !== best) {
        entfernt++
        continue
      }
      filtered.push(neuVorspann[i]!)
    }
    neuVorspann.length = 0
    neuVorspann.push(...filtered)
  }

  // 3) Produkt-Intro (falls im Vorspann) vor den Prozess-Absatz ziehen — Abrundung am Ende nie anfassen
  const prodI = neuVorspann.findIndex((b) => istProduktIntro(b))
  if (prodI > 0) {
    const [p] = neuVorspann.splice(prodI, 1)
    if (p) neuVorspann.unshift(p)
  }

  const cleaned = [...neuVorspann, ...koerper].join('\n\n').trim()
  return { cleaned, entfernt }
}

/** Kurze Schlusszeile, die fälschlich vorne steht (nach fehlerhafter Bereinigung). */
function istVermutlichAbrundungVorne(blocks: string[]): boolean {
  if (blocks.length < 2) return false
  const erst = blocks[0]!
  if (!istProduktIntro(erst) || erst.length > 320) return false
  // Danach Prozess oder Specs → das war keine echte GEO-Einleitung
  return istProzessBlock(blocks[1]!) || istKoerperBlock(blocks[1]!)
}

/**
 * Setzt die GEO-Einleitung vor Prozess + Specs — Abrundung bleibt am Ende.
 * - Prozess/Specs vorne → Intro davor
 * - Kurze Abrundung fälschlich vorne → Intro davor, Abrundung wieder ans Ende
 * - Echte (längere) Einleitung vorne → nur ersetzen
 */
export function setzeBeschreibungIntro(description: string, intro: string): string {
  const introTrim = intro.trim()
  const { cleaned: basis } = entferneGestapelteBeschreibungsIntros(description)
  if (!introTrim) return basis
  if (basis.startsWith(introTrim)) return basis

  const blocks = beschreibungBloecke(basis)
  if (blocks.length === 0) return introTrim

  if (istVermutlichAbrundungVorne(blocks)) {
    const abrundung = blocks[0]!
    const mitte = blocks.slice(1)
    const last = mitte[mitte.length - 1]
    const schonAmEnde = last != null && aehnlich(last, abrundung)
    const rest = mitte.join('\n\n').trim()
    if (!rest) return schonAmEnde ? introTrim : `${introTrim}\n\n${abrundung}`
    return schonAmEnde ? `${introTrim}\n\n${rest}` : `${introTrim}\n\n${rest}\n\n${abrundung}`
  }

  // Echte Einleitung vorne ersetzen — Prozess und Abrundung bleiben
  if (
    !istProzessBlock(blocks[0]!) &&
    !istKoerperBlock(blocks[0]!) &&
    (istProduktIntro(blocks[0]!) || istIntroBlock(blocks[0]!))
  ) {
    const rest = blocks.slice(1).join('\n\n').trim()
    return rest ? `${introTrim}\n\n${rest}` : introTrim
  }
  // Prozess oder Specs vorne → echte Einleitung davor setzen
  return `${introTrim}\n\n${basis}`.trim()
}

export function zaehleGestapelteIntros(description: string): number {
  return entferneGestapelteBeschreibungsIntros(description).entfernt
}

/** True wenn doppelte Intros entfernt werden sollten (nicht: Abrundung am Ende). */
export function brauchtBeschreibungBereinigung(description: string): boolean {
  return entferneGestapelteBeschreibungsIntros(description).entfernt > 0
}

/** True wenn vorne keine richtige GEO-Einleitung steht. */
export function fehltProduktEinleitungVorne(description: string): boolean {
  const blocks = beschreibungBloecke(description)
  if (blocks.length === 0) return true
  if (istVermutlichAbrundungVorne(blocks)) return true
  if (istProduktIntro(blocks[0]!)) return false
  return istProzessBlock(blocks[0]!) || istKoerperBlock(blocks[0]!)
}
