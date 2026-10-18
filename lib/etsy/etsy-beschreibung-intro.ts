/**
 * GEO-Intros dürfen die bestehende Etsy-Beschreibung nicht stapeln.
 * Entfernt nur ähnliche Doppel-Intros — behält echte Einleitung + Handwerk + Abrundung.
 */

/** Strukturierter Listing-Körper (Emoji-Sektionen, Maße, Pflege …) beginnt hier oft. */
const KOERPER_MARKER_RE =
  /^(?:[🪵📏🌿✨🎁🛠️🔧💧📦🇩🇪🇪🇺⭐💎🧼🚫🌻]|masse|maße|maß|pflege|verwendung|material|finish|versand|hinweis|pflegehinweise?|charakter|durchmesser|ø\s*\d|holzart)/iu

const PRODUKT_RE =
  /(schale|schüssel|schuessel|bowl|dose|behälter|behaelter|vase|teller|stab|skulptur|gefäß|gefaess)/i

/** Echte Holzart — nicht „Holzhochzeit“ / „Holzgeschenk“. */
const HOLZART_RE =
  /(eichenholz|\bescheholz\b|ahorn|walnussholz|nussbaum|kirschholz|birke|buchenholz|\bbuche\b|\beiche\b|\besche\b|linde|pflaume|zwetschg|apfel|birne|ulme|rüster|robinie|olivenholz|zirbe|lärche|kiefer|fichte|eibe|mooreiche|wurzelholz|(?:aus|von)\s+holz\b)/i

const PROZESS_RE =
  /(entstehungsprozess|vorgedreht|lufttrocknung|drehbank|feingeschliffen|rohling|trocknung|formgebung)/i

/** Reiner Anlass-/Geschenk-Zusatz — zählt NICHT als GEO-Einleitung. */
const NUR_ANLASS_RE =
  /^(auch\s+)?als\s+geschenk\b|holzhochzeit|einzug|geburtstag|anlass|valentins|weihnachtsgeschenk|muttertag/i

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
  return PROZESS_RE.test(block) && !istVolleGeoEinleitung(block)
}

function istNurAnlassSatz(block: string): boolean {
  const t = block.trim()
  if (t.length < 20) return false
  if (t.length > 180 && PRODUKT_RE.test(t) && HOLZART_RE.test(t)) return false
  return NUR_ANLASS_RE.test(t) && !HOLZART_RE.test(t.replace(/holzhochzeit|holzgeschenk/gi, ''))
}

const NUTZEN_RE =
  /\b(für|als|eignet|obst|deko|esstisch|sideboard|küche|kueche|sammler|anrichte|wohnzimmer|nutzen|servier)/i

/**
 * Echte GEO-/HOOK-Einleitung wie beim Neu-Listing:
 * Produkt + Holzart + Nutzen, ausreichend lang — nicht Anlass-Satz, nicht Abrundung.
 */
export function istVolleGeoEinleitung(block: string): boolean {
  const t = block.trim()
  if (t.length < 120 || t.length > 900) return false
  if (istKoerperBlock(t)) return false
  if (istNurAnlassSatz(t)) return false
  if (PROZESS_RE.test(t) && t.length < 220) return false
  if (!PRODUKT_RE.test(t) || !HOLZART_RE.test(t)) return false
  // Kompakte Abrundung/Warenkorb (Maße+Finish, wenig Nutzen) ≠ HOOK
  const kompaktAbrundung =
    t.length <= 300 &&
    /ø|durchmesser|\d+\s*[x×]\s*\d+/i.test(t) &&
    /öl|oel|wachs|finish|versiegelt/i.test(t) &&
    !NUTZEN_RE.test(t)
  if (kompaktAbrundung) return false
  if (!NUTZEN_RE.test(t) && t.length < 220) return false
  const saetze = t.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 15)
  return saetze.length >= 2
}

/** @deprecated Alias — nutze istVolleGeoEinleitung */
function istProduktIntro(block: string): boolean {
  return istVolleGeoEinleitung(block)
}

function istIntroBlock(block: string): boolean {
  const t = block.trim()
  if (t.length < 40 || t.length > 900) return false
  if (istKoerperBlock(t)) return false
  if (istProzessBlock(t)) return false
  if (istNurAnlassSatz(t)) return false
  const zeilen = t.split(/\n/).filter(Boolean)
  if (zeilen.length > 8) return false
  return /[.!?]/.test(t)
}

function produktIntroScore(block: string): number {
  let s = 0
  if (PRODUKT_RE.test(block)) s += 3
  if (HOLZART_RE.test(block)) s += 3
  if (/unikat|handgedrechselt|handgemacht|niederbayern/i.test(block)) s += 2
  if (/ø|durchmesser|\d+\s*cm/i.test(block)) s += 1
  if (PROZESS_RE.test(block)) s -= 4
  if (istNurAnlassSatz(block)) s -= 6
  if (block.length >= 100 && block.length <= 450) s += 2
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
 * Behält: beste echte GEO-Einleitung + Handwerk + Körper + Abrundung.
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

  const neuVorspann: string[] = []
  for (const block of vorspann) {
    if (!istIntroBlock(block) && !istVolleGeoEinleitung(block)) {
      neuVorspann.push(block)
      continue
    }
    const dupIdx = neuVorspann.findIndex(
      (b) => (istIntroBlock(b) || istVolleGeoEinleitung(b)) && aehnlich(b, block),
    )
    if (dupIdx < 0) {
      neuVorspann.push(block)
      continue
    }
    entfernt++
    if (produktIntroScore(block) > produktIntroScore(neuVorspann[dupIdx]!)) {
      neuVorspann[dupIdx] = block
    }
  }

  const produktIdxs = neuVorspann
    .map((b, i) => (istVolleGeoEinleitung(b) ? i : -1))
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

  const prodI = neuVorspann.findIndex((b) => istVolleGeoEinleitung(b))
  if (prodI > 0) {
    const [p] = neuVorspann.splice(prodI, 1)
    if (p) neuVorspann.unshift(p)
  }

  const cleaned = [...neuVorspann, ...koerper].join('\n\n').trim()
  return { cleaned, entfernt }
}

/** Kurze Schlusszeile / Anlass-Satz fälschlich vorne. */
function istSchwacherVorspannVorne(blocks: string[]): boolean {
  if (blocks.length < 1) return false
  const erst = blocks[0]!
  if (istVolleGeoEinleitung(erst)) return false
  if (istNurAnlassSatz(erst)) return true
  if (istProduktIntro(erst) && erst.length <= 320 && blocks.length >= 2) {
    return istProzessBlock(blocks[1]!) || istKoerperBlock(blocks[1]!)
  }
  return false
}

/**
 * Setzt die GEO-HOOK-Einleitung vor Prozess + Specs — Abrundung/Anlass am Ende bzw. behalten.
 */
export function setzeBeschreibungIntro(description: string, intro: string): string {
  const introTrim = intro.trim()
  const { cleaned: basis } = entferneGestapelteBeschreibungsIntros(description)
  if (!introTrim) return basis
  if (basis.startsWith(introTrim)) return basis

  const blocks = beschreibungBloecke(basis)
  if (blocks.length === 0) return introTrim

  // Schwacher Vorspann (Anlass-Satz / kurze Abrundung): behalten, Intro davor
  if (istSchwacherVorspannVorne(blocks) || istNurAnlassSatz(blocks[0]!)) {
    const erst = blocks[0]!
    const restBlocks = blocks.slice(1)
    // Anlass-Satz eher hinter die neue Einleitung, vor Prozess — oder ans Ende wenn Abrundung-artig
    if (istNurAnlassSatz(erst) || (erst.length <= 200 && PRODUKT_RE.test(erst))) {
      const rest = restBlocks.join('\n\n').trim()
      const last = restBlocks[restBlocks.length - 1]
      const schonAmEnde = last != null && aehnlich(last, erst)
      if (schonAmEnde) return rest ? `${introTrim}\n\n${rest}` : introTrim
      // Kurze Abrundung mit Produkt+Maßen → ans Ende; reiner Anlass → nach Intro vor Prozess
      if (/ø|durchmesser|\d+\s*cm|unikat|niederbayern/i.test(erst)) {
        return rest ? `${introTrim}\n\n${rest}\n\n${erst}` : `${introTrim}\n\n${erst}`
      }
      return rest ? `${introTrim}\n\n${erst}\n\n${rest}` : `${introTrim}\n\n${erst}`
    }
  }

  // Echte volle Einleitung vorne ersetzen
  if (istVolleGeoEinleitung(blocks[0]!)) {
    const rest = blocks.slice(1).join('\n\n').trim()
    return rest ? `${introTrim}\n\n${rest}` : introTrim
  }

  return `${introTrim}\n\n${basis}`.trim()
}

export function zaehleGestapelteIntros(description: string): number {
  return entferneGestapelteBeschreibungsIntros(description).entfernt
}

export function brauchtBeschreibungBereinigung(description: string): boolean {
  return entferneGestapelteBeschreibungsIntros(description).entfernt > 0
}

/** True wenn vorne keine richtige HOOK-/GEO-Einleitung steht. */
export function fehltProduktEinleitungVorne(description: string): boolean {
  const blocks = beschreibungBloecke(description)
  if (blocks.length === 0) return true
  return !istVolleGeoEinleitung(blocks[0]!)
}
