/**
 * Prüfung ohne KI: Jede Zahl im Skript muss aus dem Faktenblatt kommen.
 * Dazu Floskel-Sperrliste und Wiederholungscheck gegen frühere Videos.
 */
import { zahlenImText } from '@/lib/youtube/longform/longform-format'
import type { LongformFakt, LongformFaktenblatt, LongformPruefHinweis, LongformSatz, LongformSkript } from '@/lib/youtube/longform/longform-types'

/** Zahlen, die in Eigennamen stecken und keine Behauptung sind. */
const EIGENNAMEN_ZAHLEN = [/S&P\s*500/gi, /Nasdaq[-\s]*100/gi, /Dow\s*30/gi, /Fortune\s*500/gi, /\b(?:19|20)\d{2}\b/g]

export const FLOSKELN: RegExp[] = [
  /\blet'?s dive (?:in|into)\b/i,
  /\bdive deep\b/i,
  /\bin today'?s video\b/i,
  /\bwithout further ado\b/i,
  /\bgame[-\s]?changer\b/i,
  /\bbuckle up\b/i,
  /\bat the end of the day\b/i,
  /\bit'?s worth noting\b/i,
  /\bin conclusion\b/i,
  /\bnavigat(?:e|ing) the (?:landscape|complexities)\b/i,
  /\bunlock(?:ing)? (?:the )?(?:potential|value)\b/i,
  /\bdelve\b/i,
  /\btestament to\b/i,
  /\bsmash (?:that|the) like\b/i,
  /\bwelcome back to (?:the|my) channel\b/i,
  /\bhey guys\b/i,
  /\bstay tuned\b/i,
  /\bto the moon\b/i,
  /\bno[- ]brainer\b/i,
]

function istNahe(a: number, b: number): boolean {
  const x = Math.abs(a)
  const y = Math.abs(b)
  if (x === y) return true
  if (y === 0) return x < 0.05
  const rel = Math.abs(x - y) / y
  // Gerundete Sprechweise: „about 58 thousand“ für 58,240, „45%“ für 45.3%.
  return rel <= 0.02 || Math.abs(x - y) <= 0.6
}

function erlaubteWerte(f: LongformFakt): number[] {
  const out: number[] = []
  if (f.wert != null) out.push(f.wert)
  for (const z of zahlenImText(f.text)) out.push(z.wert)
  return out
}

function textOhneEigennamen(text: string): string {
  let t = text
  for (const re of EIGENNAMEN_ZAHLEN) t = t.replace(re, ' ')
  return t
}

function ngramme(text: string, n: number): Set<string> {
  const w = text.toLowerCase().replace(/[^a-z0-9$% ]+/g, ' ').split(/\s+/).filter(Boolean)
  const out = new Set<string>()
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '))
  return out
}

export type PruefKontext = {
  faktenblatt: LongformFaktenblatt
  /** Sätze und Kernphrasen der letzten Videos. */
  frueher: string[]
}

/** Prüft einen Satz, ergänzt fehlende Fakt-Verweise, die eindeutig passen. */
export function pruefeSatz(satz: LongformSatz, ctx: PruefKontext): LongformSatz {
  const byId = new Map(ctx.faktenblatt.fakten.map((f) => [f.id, f]))
  const hinweise: LongformPruefHinweis[] = []
  const faktIds = satz.faktIds.filter((id) => {
    if (byId.has(id)) return true
    hinweise.push({ art: 'fakt_unbekannt', text: `Unbekannte Fakt-Kennung „${id}“ entfernt.` })
    return false
  })

  for (const z of zahlenImText(textOhneEigennamen(satz.text))) {
    const referenziert = faktIds.map((id) => byId.get(id)!).some((f) => erlaubteWerte(f).some((v) => istNahe(z.wert, v)))
    if (referenziert) continue
    const passend = ctx.faktenblatt.fakten.find((f) => erlaubteWerte(f).some((v) => istNahe(z.wert, v)))
    if (passend) {
      faktIds.push(passend.id)
      continue
    }
    hinweise.push({ art: 'zahl_ohne_fakt', text: `„${z.roh}“ steht in keinem Fakt. Satz umschreiben oder Zahl streichen.` })
  }

  for (const re of FLOSKELN) {
    const m = satz.text.match(re)
    if (m) hinweise.push({ art: 'floskel', text: `Floskel „${m[0]}“ — klingt nach Fließband.` })
  }

  const eigene = ngramme(satz.text, 5)
  if (eigene.size) {
    for (const alt of ctx.frueher) {
      const treffer = [...ngramme(alt, 5)].find((g) => eigene.has(g))
      if (treffer) {
        hinweise.push({ art: 'wiederholung', text: `„${treffer}“ kam schon in einem früheren Video vor.` })
        break
      }
    }
  }

  return { ...satz, faktIds: [...new Set(faktIds)], hinweise: [...hinweise, ...(satz.hinweise ?? []).filter((h) => h.art === 'behauptung')] }
}

export function pruefeSkript(skript: LongformSkript, ctx: PruefKontext): LongformSkript {
  return {
    ...skript,
    abschnitte: skript.abschnitte.map((a) => ({ ...a, saetze: a.saetze.map((s) => pruefeSatz(s, ctx)) })),
  }
}

export function anzahlKritisch(skript: LongformSkript): number {
  return skript.abschnitte.reduce(
    (n, a) => n + a.saetze.reduce((m, s) => m + (s.hinweise?.filter((h) => h.art === 'zahl_ohne_fakt' || h.art === 'behauptung').length ?? 0), 0),
    0,
  )
}
