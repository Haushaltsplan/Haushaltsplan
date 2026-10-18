/**
 * GEO-Intros dürfen die bestehende Etsy-Beschreibung nicht stapeln.
 * Frühere Pushes haben „Intro\\n\\n+alter Text“ wiederholt — hier bereinigen/ersetzen.
 */

/** Strukturierter Listing-Körper (Emoji-Sektionen, Maße, Pflege …) beginnt hier oft. */
const KOERPER_MARKER_RE =
  /^(?:[🪵📏🌿✨🎁🛠️🔧💧📦🇩🇪🇪🇺⭐]|masse|maße|maß|pflege|verwendung|material|finish|versand|hinweis|pflegehinweis|durchmesser|ø\s*\d)/iu

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

function istIntroBlock(block: string): boolean {
  const t = block.trim()
  if (t.length < 40 || t.length > 900) return false
  if (istKoerperBlock(t)) return false
  const zeilen = t.split(/\n/).filter(Boolean)
  if (zeilen.length > 8) return false
  return /[.!?]/.test(t)
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
 * Entfernt gestapelte GEO-/SEO-Einleitungen am Anfang.
 * Behält den Listing-Körper und höchstens die unterste Intro-Passage
 * (meist die älteste / originalnahe) direkt vor dem Körper.
 */
export function entferneGestapelteBeschreibungsIntros(description: string): {
  cleaned: string
  entfernt: number
} {
  const blocks = beschreibungBloecke(description)
  if (blocks.length <= 1) return { cleaned: description.trim(), entfernt: 0 }

  const koerperIdx = blocks.findIndex((b) => istKoerperBlock(b))

  if (koerperIdx < 0) {
    // Kein Emoji-Körper: Kette ähnlicher Intro-Blöcke am Anfang kürzen
    let drop = 0
    while (
      drop + 1 < blocks.length &&
      istIntroBlock(blocks[drop]!) &&
      istIntroBlock(blocks[drop + 1]!) &&
      aehnlich(blocks[drop]!, blocks[drop + 1]!)
    ) {
      drop++
    }
    if (drop === 0) return { cleaned: description.trim(), entfernt: 0 }
    return { cleaned: blocks.slice(drop).join('\n\n').trim(), entfernt: drop }
  }

  if (koerperIdx <= 1) return { cleaned: description.trim(), entfernt: 0 }

  const vorspann = blocks.slice(0, koerperIdx)
  const koerper = blocks.slice(koerperIdx)
  // Mehrere Vorspann-Blöcke → nur den letzten behalten (näher am Original-Körper)
  const neuVorspann = [vorspann[vorspann.length - 1]!]
  const entfernt = vorspann.length - 1
  const cleaned = [...neuVorspann, ...koerper].join('\n\n').trim()
  return { cleaned, entfernt }
}

/**
 * Setzt genau ein Intro vor den bereinigten Körper — ohne erneutes Stapeln.
 */
export function setzeBeschreibungIntro(description: string, intro: string): string {
  const introTrim = intro.trim()
  const { cleaned: basis } = entferneGestapelteBeschreibungsIntros(description)
  if (!introTrim) return basis
  if (basis.startsWith(introTrim)) return basis
  const blocks = beschreibungBloecke(basis)
  if (blocks.length === 0) return introTrim
  if (istIntroBlock(blocks[0]!) && !istKoerperBlock(blocks[0]!)) {
    const rest = blocks.slice(1).join('\n\n').trim()
    return rest ? `${introTrim}\n\n${rest}` : introTrim
  }
  return `${introTrim}\n\n${basis}`.trim()
}

export function zaehleGestapelteIntros(description: string): number {
  return entferneGestapelteBeschreibungsIntros(description).entfernt
}
