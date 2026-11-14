/** Untertitel: Prozent als Ziffern, die Loop-Brücke endet visuell mit einem Doppelpunkt. */

const EINER: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
}

const ZEHNER: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
}

function kern(wort: string): string {
  return wort.toLowerCase().replace(/[^a-z0-9.]/g, '')
}

function istZahlwort(k: string): boolean {
  return EINER[k] != null || ZEHNER[k] != null || k === 'point' || k === 'dot' || k === 'hundred' || /^\d+(?:\.\d+)?$/.test(k)
}

type Tok = { index: number; text: string }

function tokenisiere(woerter: string[]): Tok[] {
  const out: Tok[] = []
  woerter.forEach((wort, index) => {
    const parts = wort.split(/(?<=[A-Za-z])-(?=[A-Za-z])/)
    const zahlig = parts.length > 1 && parts.every((p) => istZahlwort(kern(p)))
    if (zahlig) for (const p of parts) out.push({ index, text: p })
    else out.push({ index, text: wort })
  })
  return out
}

function formatiereProzent(n: number): string {
  if (!Number.isFinite(n)) return ''
  const gerundet = Math.round(n * 100) / 100
  return `${Number.isInteger(gerundet) ? String(gerundet) : String(gerundet)}%`
}

function liesZahl(teile: string[], start: number): { n: number; bis: number } | null {
  let n = 0
  let gesehen = false
  let dezimal = false
  let stelle = 0.1
  let j = start
  let letzter: 'zehner' | 'einer' | 'ziffer' | 'hundert' | null = null
  while (j < teile.length) {
    const k = kern(teile[j] ?? '')
    if (!k) break
    if ((k === 'point' || k === 'dot') && gesehen && !dezimal) {
      dezimal = true
      j += 1
      continue
    }
    if (k === 'hundred' && gesehen && !dezimal && n > 0 && n < 1000) {
      n *= 100
      letzter = 'hundert'
      j += 1
      continue
    }
    if (/^\d+(?:\.\d+)?$/.test(k) && !gesehen && !dezimal) {
      n = Number(k)
      gesehen = true
      letzter = 'ziffer'
      j += 1
      continue
    }
    const zehner = ZEHNER[k]
    if (zehner != null && !dezimal && !gesehen) {
      n = zehner
      gesehen = true
      letzter = 'zehner'
      j += 1
      continue
    }
    const einer = EINER[k]
    if (einer != null) {
      if (dezimal) {
        n += einer * stelle
        stelle /= 10
        gesehen = true
        letzter = 'einer'
        j += 1
        continue
      }
      if (letzter === 'zehner' && einer < 10) {
        n += einer
        letzter = 'einer'
        j += 1
        continue
      }
      if (letzter === 'hundert' && einer < 100) {
        n += einer
        letzter = 'einer'
        j += 1
        continue
      }
      if (!gesehen) {
        n = einer
        gesehen = true
        letzter = 'einer'
        j += 1
        continue
      }
    }
    break
  }
  if (!gesehen || j === start) return null
  return { n, bis: j }
}

function prozentLaenge(teile: string[], i: number): number {
  const k = kern(teile[i] ?? '')
  if (k === 'percent' || k === 'percentage' || k === 'pct') return 1
  if (k === 'per' && kern(teile[i + 1] ?? '') === 'cent') return 2
  return 0
}

/** „ninety percent“ wird „90%“. Andere Wörter bleiben. */
export function ziffernImText(text: string): string {
  const woerter = text.trim().split(/\s+/).filter(Boolean)
  if (!woerter.length) return text.trim()
  const toks = tokenisiere(woerter)
  const teile = toks.map((t) => t.text)
  const benutzt = new Set<number>()
  const ersatz = new Map<number, string>()
  let t = 0
  while (t < toks.length) {
    const zahl = liesZahl(teile, t)
    const prozent = zahl ? prozentLaenge(teile, zahl.bis) : 0
    if (zahl && prozent) {
      const von = toks[t]!.index
      const bis = toks[zahl.bis + prozent - 1]!.index
      for (let i = von; i <= bis; i++) benutzt.add(i)
      ersatz.set(von, formatiereProzent(zahl.n))
      t = zahl.bis + prozent
      continue
    }
    t += 1
  }
  const out: string[] = []
  for (let i = 0; i < woerter.length; i++) {
    const neu = ersatz.get(i)
    if (neu) out.push(neu)
    else if (!benutzt.has(i)) out.push(woerter[i]!)
  }
  return out.join(' ')
}

type Zeitwort = { text: string; startMs: number; endMs: number }

/** Fasst „ninety“ + „percent“ zu einem Caption-Wort „90%“ über dasselbe Zeitfenster. */
export function ziffernInZeitworten<T extends Zeitwort>(worte: T[]): T[] {
  if (worte.length < 2) return worte
  const text = ziffernImText(worte.map((w) => w.text).join(' '))
  const neu = text.split(/\s+/).filter(Boolean)
  if (neu.join(' ') === worte.map((w) => w.text).join(' ')) return worte
  const out: T[] = []
  let i = 0
  for (const stueck of neu) {
    if (i >= worte.length) break
    if (stueck === worte[i]!.text) {
      out.push(worte[i]!)
      i += 1
      continue
    }
    const start = worte[i]!.startMs
    let j = i
    let gesammelt = ''
    while (j < worte.length) {
      gesammelt = ziffernImText(worte.slice(i, j + 1).map((w) => w.text).join(' '))
      j += 1
      if (gesammelt === stueck) break
    }
    const letzte = worte[Math.max(i, j - 1)]!
    out.push({ ...worte[i]!, text: stueck, startMs: start, endMs: letzte.endMs })
    i = j
  }
  return i === worte.length && out.length ? out : worte
}

const OFFENE_ENDEN: { satz: RegExp; wort: RegExp; zu: string }[] = [
  { satz: /\bso the question is\b/i, wort: /\bis[.!?…:]*$/i, zu: 'is:' },
  { satz: /\band it starts with\b/i, wort: /\bwith[.!?…:]*$/i, zu: 'with:' },
  { satz: /\bhere is how\b/i, wort: /\bhow[.!?…:]*$/i, zu: 'how:' },
  { satz: /\bhere is why\b/i, wort: /\bwhy[.!?…:]*$/i, zu: 'why:' },
]

/** Offene Überleitung: die Caption endet mit einem Doppelpunkt, nicht mit einem Punkt. */
export function captionBruecke(text: string, beat: string): string {
  const quelle = `${beat}\n${text}`
  const ende = OFFENE_ENDEN.find((o) => o.satz.test(quelle) && o.wort.test(text.trim()))
  if (!ende) return text
  return text.replace(ende.wort, ende.zu)
}
