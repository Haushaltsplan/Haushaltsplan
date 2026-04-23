/**
 * Gleiche Artikel trotz Umlaut, Groß/Klein, Plural (Apfel/Äpfel, Ei/Eier, Tomate/Tomaten).
 */

export function produktNameNormalisieren(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '')
}

/** Typische deutsche Plural-Endungen am Wortende (längere zuerst). */
const PLURAL_SUFFIXE = ['chen', 'lein', 'sel', 'ern', 'eln', 'isch', 'en', 'er', 'es', 'e', 'n', 's'] as const

/** Rest nach gemeinsamem Präfix (Singular kürzer) — z. B. ei|eier → er, tomate|tomaten → n. */
const PLURAL_REST = /^(er|en|es|e|n|s|ern|eln|chen|lein|sel|in)$/

/**
 * Alle „Stamm“-Varianten durch sukzessives Entfernen gängiger Plural-Suffixe
 * (min. 2 Zeichen Restlänge).
 */
export function pluralSuffixVarianten(key: string): Set<string> {
  const out = new Set<string>()
  if (!key) return out
  out.add(key)
  let k = key
  for (let tiefe = 0; tiefe < 6; tiefe++) {
    let gekuerzt = false
    for (const suf of PLURAL_SUFFIXE) {
      if (k.length - suf.length >= 2 && k.endsWith(suf)) {
        k = k.slice(0, -suf.length)
        out.add(k)
        gekuerzt = true
        break
      }
    }
    if (!gekuerzt) break
  }
  return out
}

/** Kürzeres Wort ist Präfix des längeren + typische Plural-Endung (Ei/Eier, Tomate/Tomaten). */
export function istSingularPluralPaar(kurz: string, lang: string): boolean {
  if (kurz.length < 2 || lang.length <= kurz.length) return false
  if (!lang.startsWith(kurz)) return false
  const rest = lang.slice(kurz.length)
  if (rest.length === 0 || rest.length > 5) return false
  return PLURAL_REST.test(rest)
}

export function namenGleichFuerLager(a: string, b: string): boolean {
  const na = produktNameNormalisieren(a)
  const nb = produktNameNormalisieren(b)
  if (!na || !nb) return na === nb
  if (na === nb) return true

  const A = pluralSuffixVarianten(na)
  const B = pluralSuffixVarianten(nb)
  for (const x of A) {
    if (B.has(x)) return true
  }
  for (const x of A) {
    for (const y of B) {
      if (istSingularPluralPaar(x, y) || istSingularPluralPaar(y, x)) return true
    }
  }
  if (istSingularPluralPaar(na, nb) || istSingularPluralPaar(nb, na)) return true
  return false
}

/** Zuerst exakter Name (nur Groß/Klein/Leerzeichen), sonst gleiche/verwandte Form. */
export function findeProduktIdNachAnzeigeName(
  kandidaten: Array<{ id: string; name: string }>,
  gesuchterName: string,
): string | null {
  const g = gesuchterName.trim()
  if (!g) return null
  const gLower = g.toLocaleLowerCase('de')
  const exakt = kandidaten.find((p) => p.name.trim().toLocaleLowerCase('de') === gLower)
  if (exakt) return exakt.id

  const gKey = produktNameNormalisieren(g)
  if (!gKey) return null

  const gleicherNormKey = kandidaten.filter((p) => produktNameNormalisieren(p.name) === gKey)
  if (gleicherNormKey.length > 0) return waehleCanonicalId(gleicherNormKey)

  const treffer = kandidaten.filter((p) => namenGleichFuerLager(g, p.name))
  if (treffer.length === 0) return null
  return waehleCanonicalId(treffer)
}

/** Kürzester Anzeigename, bei Gleichstand kleinste UUID. */
export function waehleCanonicalId(gruppe: Array<{ id: string; name: string }>): string {
  const sorted = [...gruppe].sort((a, b) => {
    const la = a.name.trim().length
    const lb = b.name.trim().length
    if (la !== lb) return la - lb
    return a.id.localeCompare(b.id)
  })
  return sorted[0]!.id
}

class UnionFind {
  private parent = new Map<string, string>()
  find(x: string): string {
    let p = this.parent.get(x) ?? x
    if (p !== x) {
      p = this.find(p)
      this.parent.set(x, p)
    }
    return p
  }
  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
}

/** Gruppiert IDs, deren Namen zusammenpassen (Plural, Umlaut, …). */
export function gruppiereProduktIdsNachNormalform(rows: Array<{ id: string; name: string }>): Map<string, string[]> {
  const gueltig = rows.filter((r) => produktNameNormalisieren(r.name))
  const uf = new UnionFind()
  for (let i = 0; i < gueltig.length; i++) {
    for (let j = i + 1; j < gueltig.length; j++) {
      if (namenGleichFuerLager(gueltig[i]!.name, gueltig[j]!.name)) {
        uf.union(gueltig[i]!.id, gueltig[j]!.id)
      }
    }
  }
  const gruppen = new Map<string, string[]>()
  for (const r of gueltig) {
    const root = uf.find(r.id)
    const arr = gruppen.get(root) || []
    arr.push(r.id)
    gruppen.set(root, arr)
  }
  return gruppen
}

function capitalizeFirstLetterDeSegment(segment: string): string {
  const kl = segment.toLocaleLowerCase('de')
  const i = kl.search(/[a-zäöüß]/i)
  if (i < 0) return kl
  return kl.slice(0, i) + kl.charAt(i).toLocaleUpperCase('de') + kl.slice(i + 1)
}

/**
 * Kassenbons schreiben Namen oft in VERSALIEN. Für die Anzeige im Lager: normale Lesart
 * (nur wenn der Text überwiegend in Großbuchstaben steht).
 * Beispiel: CURRYWÜRSTE → Currywürste
 */
export function produktAnzeigeNameAusBon(name: string): string {
  const t = name.trim().replace(/\s+/g, ' ')
  if (!t) return t
  const buchstaben = [...t].filter((c) => /[A-Za-zÄÖÜäöüß]/.test(c))
  if (buchstaben.length === 0) return t
  const gross = buchstaben.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length
  if (gross / buchstaben.length < 0.65) return t

  return t
    .split(' ')
    .map((wort) =>
      wort
        .split('-')
        .map((teil) => capitalizeFirstLetterDeSegment(teil))
        .join('-'),
    )
    .join(' ')
}
