/** Eine angezeigte Kennzahl. Brutto, operativ und Umsatzanteil bleiben getrennte Größen. */
export type MoatHeroMetric = {
  value: string
  label: string
  context_note: string
  spoken_reference: string
}

const FAMILIEN: { id: string; muster: RegExp }[] = [
  { id: 'gross', muster: /\bgross margin\b|\bbruttomarge\b/i },
  { id: 'operating', muster: /\boperating margin\b|\bebit margin\b|\boperative marge\b/i },
  { id: 'revenue', muster: /\bshare of revenue\b|\bof revenue\b|\brevenue share\b|\bumsatzanteil\b/i },
  { id: 'roic', muster: /\breturn on capital\b|\broic\b/i },
  { id: 'fcf', muster: /\bfcf conversion\b|\bfree cash flow\b/i },
  { id: 'nrr', muster: /\bnet revenue retention\b|\bnrr\b/i },
]

function familie(text: string): string | null {
  return FAMILIEN.find((f) => f.muster.test(text))?.id ?? null
}

function familien(text: string): string[] {
  return FAMILIEN.filter((f) => f.muster.test(text)).map((f) => f.id)
}

/** Tauscht einen fremden Kennzahlnamen, solange der Satz das angezeigte Label noch nicht nennt. */
export function korrigiereHeroSatz(satz: string, value: string, label: string): string {
  const eigene = familie(label)
  let text = satz.replace(/\s+/g, ' ').trim()
  const nenntLabel = label.trim().length > 0 && text.toLowerCase().includes(label.toLowerCase())
  if (eigene && !nenntLabel) {
    for (const f of FAMILIEN) {
      if (f.id === eigene) continue
      text = text.replace(f.muster, label.toLowerCase())
    }
  }
  if (value && !text.includes(value)) return satz.replace(/\s+/g, ' ').trim()
  return text
}

export function heroMetricAus(value: string, label: string, spoken: string, contextNote = ''): MoatHeroMetric {
  const satz = korrigiereHeroSatz(spoken, value, label)
  return {
    value,
    label,
    context_note: contextNote.replace(/\s+/g, ' ').trim(),
    spoken_reference: satz,
  }
}

/** Wahr, wenn Satz und Bild dieselbe Zahl und dieselbe Kennzahlart nennen. */
export function heroMetricPasst(hero: MoatHeroMetric, satz: string): boolean {
  const text = satz.replace(/\s+/g, ' ').trim()
  if (!hero.value || !text.includes(hero.value)) return false
  if (hero.spoken_reference && !hero.spoken_reference.includes(hero.value)) return false
  const bild = familie(hero.label)
  const stimme = familien(text)
  return !bild || stimme.length === 0 || stimme.includes(bild)
}
