/**
 * Welche Zahl ein Satz im Jahreschart gerade sagt.
 * Die große Zahl und das helle Jahr kommen nur aus den faktIds dieses Satzes.
 */
import { dollarImText, multiple, pct, usdKurz } from '../../lib/youtube/longform/longform-format'
import type { LongformJahresGross, LongformJahreslinie, LongformJahrespunkt, LongformJahresreihe } from '../../lib/youtube/longform/longform-types'

export type ZahlenFakt = { text: string; wert: number | null }

export type ZahlenMarke = {
  id: string
  text: string
  wert: number | null
  farbig: LongformJahresGross['farbig']
  /** Blau nur für die WACC-Linie. Schätzung färbt die Zahl gold, solange sie nicht negativ ist. */
  ton: 'zahl' | 'blau'
  schaetzung: boolean
  /** Jahre, die zu dieser Zahl gehören. Leer, wenn die Zahl keine Säule hat. */
  jahre: number[]
  /** true: erstes und letztes Jahr gleich hell, zum Beispiel die Aktienänderung. */
  spanne: boolean
  linieId: string | null
  caption: string
  /** Kurzes Etikett auf der Säule. Leer, wenn die Höhe nicht dieser Zahl entspricht. */
  kurz: string
  /** Ziffernkern fürs gesprochene Wort, zum Beispiel "37.2". */
  kern: string
}

const SUFFIX = /^(anfang_jahr|ende_jahr|anfang|tief|hoch|e\.\d{4})$/

function letzte<T>(xs: T[]): T | null {
  return xs.length ? xs[xs.length - 1]! : null
}

function istPunkte(linie: LongformJahreslinie): LongformJahrespunkt[] {
  return linie.punkte.filter((p) => !p.schaetzung).sort((a, b) => a.jahr - b.jahr)
}

function standardLinie(reihe: LongformJahresreihe): LongformJahreslinie | null {
  if (reihe.id === 'marge') return reihe.linien.find((l) => l.id === 'ebit') ?? reihe.linien[0] ?? null
  if (reihe.id === 'schulden') return reihe.linien.find((l) => l.id === 'schulden') ?? reihe.linien[0] ?? null
  return reihe.linien[0] ?? null
}

function linieNachId(reihe: LongformJahresreihe, id: string | null): LongformJahreslinie | null {
  if (!id) return standardLinie(reihe)
  return reihe.linien.find((l) => l.id === id) ?? null
}

type Ziel = {
  jahr: number | null
  punkt: LongformJahrespunkt | null
  schaetzung: boolean
  nurJahr: boolean
  art: 'wert' | 'anfang' | 'ende' | 'tief' | 'hoch' | 'schaetzung' | 'jahr-anfang' | 'jahr-ende'
}

function zielAuf(punkte: LongformJahrespunkt[], suffix: string): Ziel | null {
  const fertig = punkte.filter((p) => !p.schaetzung).sort((a, b) => a.jahr - b.jahr)
  const erster = fertig[0] ?? null
  const letzter = letzte(fertig)
  if (suffix === '' || suffix === 'ende') {
    if (!letzter) return null
    return { jahr: letzter.jahr, punkt: letzter, schaetzung: false, nurJahr: false, art: 'ende' }
  }
  if (suffix === 'anfang') {
    if (!erster) return null
    return { jahr: erster.jahr, punkt: erster, schaetzung: false, nurJahr: false, art: 'anfang' }
  }
  if (suffix === 'anfang_jahr') {
    if (!erster) return null
    return { jahr: erster.jahr, punkt: null, schaetzung: false, nurJahr: true, art: 'jahr-anfang' }
  }
  if (suffix === 'ende_jahr') {
    if (!letzter) return null
    return { jahr: letzter.jahr, punkt: null, schaetzung: false, nurJahr: true, art: 'jahr-ende' }
  }
  if (suffix === 'tief' || suffix === 'hoch') {
    if (!fertig.length) return null
    const p = fertig.reduce((m, q) => (suffix === 'tief' ? (q.wert < m.wert ? q : m) : q.wert > m.wert ? q : m), fertig[0]!)
    return { jahr: p.jahr, punkt: p, schaetzung: false, nurJahr: false, art: suffix }
  }
  const schatz = /^e\.(\d{4})$/.exec(suffix)
  if (schatz) {
    const jahr = Number(schatz[1])
    const p = punkte.find((q) => q.jahr === jahr) ?? null
    if (!p) return null
    return { jahr, punkt: p, schaetzung: true, nurJahr: false, art: 'schaetzung' }
  }
  return null
}

function kernAus(text: string): string {
  const m = text.replace(/,/g, '').match(/\d+(?:\.\d+)?/)
  if (!m) return ''
  return m[0].replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

function kuerzen(text: string): string {
  return text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

function linieName(id: string | null, mehrere: boolean): string {
  if (!mehrere || !id) return ''
  if (id === 'brutto') return 'Gross'
  if (id === 'ebit') return 'Operating'
  if (id === 'netto') return 'Net'
  if (id === 'bargeld') return 'Cash'
  if (id === 'schulden') return 'Debt'
  return ''
}

function captionFuer(art: Ziel['art'], jahr: number | null, linieId: string | null, mehrere: boolean, extra: string): string {
  const name = linieName(linieId, mehrere)
  const jahrText = jahr == null ? '' : String(jahr)
  if (extra) return extra
  if (art === 'schaetzung') return name ? `${name} · ${jahrText} estimate` : `${jahrText} estimate`
  if (art === 'tief') return name ? `${name} · low ${jahrText}` : `Low · ${jahrText}`
  if (art === 'hoch') return name ? `${name} · high ${jahrText}` : `High · ${jahrText}`
  if (art === 'jahr-anfang') return name ? `${name} · first year` : 'First year'
  if (art === 'jahr-ende') return name ? `${name} · last year` : 'Last year'
  if (art === 'anfang' || art === 'ende' || art === 'wert') return name ? `${name} · ${jahrText}` : jahrText
  return jahrText
}

function kurzFuer(reihe: LongformJahresreihe, wert: number): string {
  if (reihe.einheit === 'usd') return usdKurz(wert)
  if (reihe.einheit === 'pct') return pct(wert, { vorzeichen: wert < 0 })
  if (reihe.einheit === 'x') return kuerzen(multiple(wert))
  const r = Math.abs(wert) >= 100 ? Math.round(wert) : Math.round(wert * 10) / 10
  return String(r)
}

function aenderungText(text: string, wert: number | null): string {
  if (/unchanged/i.test(text)) return 'Flat'
  if (text.length <= 26) return text
  if (wert == null || !Number.isFinite(wert)) return text
  const abs = Math.abs(wert)
  const n = abs >= 100 ? Math.round(abs) : Math.round(abs * 10) / 10
  if (n === 0) return 'Flat'
  return `${wert > 0 ? '+' : '-'}${n} million`
}

function marke(teil: Omit<ZahlenMarke, 'kern'> & { kern?: string }): ZahlenMarke {
  const text = teil.text.includes('$') ? dollarImText(teil.text, teil.wert) : teil.text
  return { ...teil, text, kern: teil.kern ?? kernAus(text) }
}

function spreadPunkte(linie: LongformJahreslinie, wacc: number): LongformJahrespunkt[] {
  return linie.punkte.map((p) => ({
    jahr: p.jahr,
    wert: Math.round((p.wert - wacc) * 10) / 10,
    schaetzung: p.schaetzung,
  }))
}

function parseEine(id: string, fakt: ZahlenFakt | undefined, reihe: LongformJahresreihe): ZahlenMarke | null {
  if (!id.startsWith('reihe.')) return null
  const body = id.slice('reihe.'.length)
  if (body !== reihe.id && !body.startsWith(`${reihe.id}.`)) return null
  const rest = body === reihe.id ? '' : body.slice(reihe.id.length + 1)
  const text = fakt?.text?.trim() ?? ''
  const wert = fakt?.wert ?? null
  const mehrere = reihe.linien.length > 1

  if (rest === 'wacc' && reihe.wacc != null) {
    return marke({
      id,
      text: text || pct(reihe.wacc),
      wert: wert ?? reihe.wacc,
      farbig: 'hell',
      ton: 'blau',
      schaetzung: false,
      jahre: [],
      spanne: false,
      linieId: null,
      caption: 'Cost of capital',
      kurz: '',
    })
  }

  const wachsLinie = /^(?:(.+)\.)?wachstum$/.exec(rest)
  if (wachsLinie) {
    const linie = wachsLinie[1] ? linieNachId(reihe, wachsLinie[1]) : standardLinie(reihe)
    const fertig = linie ? istPunkte(linie) : []
    const erster = fertig[0]
    const letzter = letzte(fertig)
    if (!erster || !letzter || !text) return null
    const name = linieName(linie?.id ?? null, mehrere)
    return marke({
      id,
      text,
      wert,
      farbig: 'vorzeichen',
      ton: 'zahl',
      schaetzung: false,
      jahre: [erster.jahr, letzter.jahr],
      spanne: true,
      linieId: linie?.id ?? null,
      caption: name ? `${name} · average growth · ${erster.jahr}–${letzter.jahr}` : `Average growth · ${erster.jahr}–${letzter.jahr}`,
      kurz: '',
    })
  }

  if (rest === 'aenderung') {
    const linie = standardLinie(reihe)
    const fertig = linie ? istPunkte(linie) : []
    const a = fertig[0]?.jahr
    const b = letzte(fertig)?.jahr
    const jahre = a != null && b != null ? [a, b] : []
    return marke({
      id,
      text: aenderungText(text, wert),
      wert,
      farbig: 'hell',
      ton: 'zahl',
      schaetzung: false,
      jahre,
      spanne: true,
      linieId: null,
      caption: jahre.length === 2 ? `${jahre[0]}–${jahre[1]}` : 'Share count',
      kurz: '',
    })
  }

  if (rest === 'deckung') {
    const linie = standardLinie(reihe)
    const jahr = linie ? letzte(istPunkte(linie))?.jahr ?? null : null
    return marke({
      id,
      text: text || (wert != null ? pct(wert) : ''),
      wert,
      farbig: 'deckung',
      ton: 'zahl',
      schaetzung: false,
      jahre: jahr == null ? [] : [jahr],
      spanne: false,
      linieId: null,
      caption: jahr == null ? 'Cash to debt' : `Cash to debt · ${jahr}`,
      kurz: '',
    })
  }

  if (rest === 'schnitt' && reihe.schnitt) {
    const n = reihe.schnitt.jahre
    return marke({
      id,
      text: text || (reihe.einheit === 'pct' ? pct(reihe.schnitt.wert) : multiple(reihe.schnitt.wert)),
      wert: wert ?? reihe.schnitt.wert,
      farbig: 'hell',
      ton: 'zahl',
      schaetzung: false,
      jahre: [],
      spanne: false,
      linieId: null,
      caption: reihe.schnitt.nurPositiv ? `${n} positive years` : `${n}-year average`,
      kurz: '',
    })
  }

  if (rest === 'abstand') {
    const linie = standardLinie(reihe)
    const jahr = linie ? letzte(istPunkte(linie))?.jahr ?? null : null
    return marke({
      id,
      text: text || (wert != null ? pct(wert, { vorzeichen: true }) : ''),
      wert,
      farbig: 'hell',
      ton: 'zahl',
      schaetzung: false,
      jahre: jahr == null ? [] : [jahr],
      spanne: false,
      linieId: linie?.id ?? null,
      caption: 'Vs its average',
      kurz: '',
    })
  }

  if (rest === 'spread.ltm') {
    return marke({
      id,
      text: text || (wert != null ? pct(wert, { vorzeichen: true }) : ''),
      wert,
      farbig: 'vorzeichen',
      ton: 'zahl',
      schaetzung: false,
      jahre: [],
      spanne: false,
      linieId: null,
      caption: 'Latest spread',
      kurz: '',
    })
  }

  let linie: LongformJahreslinie | null
  let suffix = rest
  let punkte: LongformJahrespunkt[]
  if (rest === 'spread' || rest.startsWith('spread.')) {
    const basis = standardLinie(reihe)
    if (!basis || reihe.wacc == null) return null
    linie = basis
    suffix = rest === 'spread' ? '' : rest.slice('spread.'.length)
    punkte = spreadPunkte(basis, reihe.wacc)
  } else {
    const head = rest.includes('.') ? rest.slice(0, rest.indexOf('.')) : rest
    const tail = rest.includes('.') ? rest.slice(rest.indexOf('.') + 1) : ''
    const alsLinie = linieNachId(reihe, head)
    if (alsLinie && (tail === '' || SUFFIX.test(tail))) {
      linie = alsLinie
      suffix = tail
    } else if (rest === '' || SUFFIX.test(rest)) {
      linie = standardLinie(reihe)
      suffix = rest
    } else return null
    if (!linie) return null
    punkte = linie.punkte
  }
  if (!linie) return null

  const ziel = zielAuf(punkte, suffix)
  if (!ziel || ziel.jahr == null) return null
  const nurJahr = ziel.nurJahr
  const anzeige = nurJahr ? String(ziel.jahr) : text || (ziel.punkt ? kurzFuer(reihe, reihe.einheit === 'usd' ? ziel.punkt.wert * 1_000_000 : ziel.punkt.wert) : '')
  if (!anzeige) return null
  const zahlWert = nurJahr ? null : wert ?? (ziel.punkt ? (reihe.einheit === 'usd' ? ziel.punkt.wert * 1_000_000 : ziel.punkt.wert) : null)
  const istSpread = rest === 'spread' || rest.startsWith('spread.')
  const farbig: LongformJahresGross['farbig'] =
    reihe.einheit === 'pct' || istSpread ? 'vorzeichen' : reihe.einheit === 'usd' ? 'neutral' : 'hell'
  const kurz =
    !nurJahr && !istSpread && ziel.punkt && zahlWert != null
      ? kurzFuer(reihe, reihe.einheit === 'usd' ? ziel.punkt.wert * 1_000_000 : ziel.punkt.wert)
      : ''
  return marke({
    id,
    text: anzeige,
    wert: zahlWert,
    farbig: nurJahr ? 'hell' : farbig,
    ton: 'zahl',
    schaetzung: ziel.schaetzung,
    jahre: [ziel.jahr],
    spanne: false,
    linieId: linie.id,
    caption: captionFuer(ziel.art, ziel.jahr, linie.id, mehrere, ''),
    kurz,
    kern: nurJahr ? String(ziel.jahr) : kernAus(anzeige) || String(ziel.jahr),
  })
}

export function satzZahlen(
  faktIds: string[],
  fakten: Record<string, ZahlenFakt | undefined>,
  reihe: LongformJahresreihe,
): { marken: ZahlenMarke[]; nebenjahre: number[] } {
  const roh: ZahlenMarke[] = []
  const gesehen = new Set<string>()
  for (const id of faktIds) {
    if (gesehen.has(id)) continue
    const eine = parseEine(id, fakten[id], reihe)
    if (!eine) continue
    gesehen.add(id)
    roh.push(eine)
  }
  const werte = roh.filter((m) => m.wert != null || m.spanne || m.ton === 'blau' || m.kurz)
  const nurJahre = roh.filter((m) => !werte.includes(m))
  if (!werte.length) return { marken: nurJahre, nebenjahre: [] }
  const neben = nurJahre.flatMap((m) => m.jahre).filter((j) => !werte.some((m) => m.jahre.includes(j)))
  return { marken: werte, nebenjahre: neben }
}

/** Jahre, die der Satz nennt, aber nicht die gerade aktive Zahl sind. Die bleiben mit sichtbar. */
export function mitJahre(alle: ZahlenMarke[], aktiv: ZahlenMarke, neben: number[]): number[] {
  const set = new Set<number>(neben)
  for (const m of alle) for (const j of m.jahre) set.add(j)
  for (const j of aktiv.jahre) set.delete(j)
  return [...set]
}

function wortTrifft(wort: string, kern: string): boolean {
  if (!kern) return false
  const nums = wort.replace(/[$,%]/g, '').replace(/,/g, '').match(/\d+(?:\.\d+)?/g) ?? []
  const ziel = kern.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  return nums.some((n) => n.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') === ziel)
}

/** Absoluter Frame, ab dem jede Zahl dieses Satzes gilt. Die erste liegt am Satzanfang. */
export function markenStart(marken: ZahlenMarke[], woerter: { text: string; from: number }[], satzFrom: number, satzBis: number): number[] {
  if (!marken.length) return []
  if (marken.length === 1) return [satzFrom]
  const treffer: number[] = []
  let nach = satzFrom
  for (const m of marken) {
    const w = woerter.find((wort) => wort.from >= nach && (wortTrifft(wort.text, m.kern) || m.jahre.some((j) => wortTrifft(wort.text, String(j)))))
    if (!w) break
    treffer.push(w.from)
    nach = w.from + 1
  }
  if (treffer.length !== marken.length) {
    const span = Math.max(1, satzBis - satzFrom)
    return marken.map((_, i) => satzFrom + Math.round((span * i) / marken.length))
  }
  return treffer.map((frame, i) => (i === 0 ? satzFrom : frame))
}

export function aktiveMarke(
  marken: ZahlenMarke[],
  woerter: { text: string; from: number }[],
  satzFrom: number,
  satzBis: number,
  frame: number,
): { marke: ZahlenMarke; seit: number } | null {
  if (!marken.length || frame < satzFrom) return null
  const starts = markenStart(marken, woerter, satzFrom, satzBis)
  let idx = 0
  for (let i = 0; i < starts.length; i++) if (starts[i]! <= frame) idx = i
  const markeAktiv = marken[idx]
  const seit = starts[idx]
  if (!markeAktiv || seit == null) return null
  return { marke: markeAktiv, seit }
}
