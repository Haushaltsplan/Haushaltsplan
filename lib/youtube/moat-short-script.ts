import type { MoatShortVerdict } from '@/remotion/moat-short-types'
import { firmenKurzname, phrasePasst } from '@/lib/youtube/youtube-keywords'

const ABSCHIED =
  /\b(thanks for watching|thank you|thanks for|follow for|subscribe|see you|that's the video|watch next|hit like|link in|comment below)\b/i

const ZUSAMMENFASSUNG =
  /\b(wide moat|narrow moat|no real moat|the proof is|already said so|is the tell|that's the story|in conclusion|to sum up)\b/i

const BRUECKE_ENDE = /(?:which is why|that's why|that is why|and that's why)$/i

const VERBOTENE_WOERTER = [
  'delve',
  'game-changer',
  'game changer',
  'unbelievable',
  'testament',
  'revolutionizing',
  'revolutionize',
  'revolutionise',
  'revolutionary',
  'mind-blowing',
  'mind blowing',
  'pivotal',
  'furthermore',
  'consequently',
  'moreover',
  'therefore',
  'thus',
  'additionally',
  'subsequently',
  'incredible',
  'insane',
  'crazy',
  'massive',
  'juggernaut',
  'powerhouse',
  'unstoppable',
  'groundbreaking',
  'cutting-edge',
  'paradigm',
  'synergy',
  'utilize',
]

const SATZ_MIN_WOERTER = 7
const SATZ_MAX_WOERTER = 12

const FIRMENSPRECH = [
  'operational complexity',
  'capital investment',
  'this ecosystem',
  'the ecosystem',
  'competing global',
  'requires decades of',
  'financial institutions',
  'significant barriers',
  'durable competitive',
  'value proposition',
  'go-to-market',
  'highly differentiated',
  'when leaving this',
  'dominant market position',
  'sustained pricing power',
]

function memoTreffer(satz: string): number {
  return satz.match(/\b(complexity|infrastructure|institutions|ecosystem|proposition|differentiated|operationally|significantly)\b/gi)?.length ?? 0
}

const FALLBACK_SPANNUNG = 'One thing could still break that lock.'

const STOPWÖRTER = new Set(
  'a an the and or but if of to in on for with as is it that this those these be was are were not no so just still could would can cannot because'.split(
    ' ',
  ),
)

const BEDROHUNG_LEAK =
  /\b(regulator|regulatory|regulation|cap|caps|export|control|controls|rival|rivals|china|ban|antitrust|interchange|lawsuit|sanction|sanctions|war|tariff|fee cap)\b/i

const AUFLÖSUNG_LEAK =
  /\b(because|cannot leave|can't leave|can not leave|no second|only shop|banks (can't|cannot|still pay)|merchants can't)\b/i

function woerter(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w && !/^[—–\-,.;:!?…]+$/.test(w))
}

/** Gedankenstrich und „Wort - Wort“ sind KI-Ton. Zwei kurze Sätze oder ein Komma. */
export function ohneKiBindestrich(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, '. ')
    .replace(/\s+-\s+/g, '. ')
    .replace(/\.\s+([a-z])/g, (_, c: string) => `. ${c.toUpperCase()}`)
    .replace(/\.\s*\./g, '.')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Interne Kennzahl-IDs. Gesprochen wird nur das englische Label. */
const KENNZAHL_NAME: Record<string, string> = {
  ltm_brutto: 'gross margin',
  ltm_ebit: 'operating margin',
  ltm_roic: 'return on capital',
  roic_5y_avg: '5-year average ROIC',
  incremental_roic: 'return on new capital',
  fcf_conversion: 'FCF conversion',
  nrr: 'net revenue retention',
  rev_cagr_5y: '5-year revenue growth',
  brutto_std_10y: '10-year margin swing',
  net_debt_ebitda: 'net debt to EBITDA',
  interest_coverage: 'interest coverage',
  aktien_verwaesserung: 'share count change',
  preissetzungsmacht: 'pricing power',
  replikationsbarriere: 'hard to copy',
  wechselkosten: 'switching costs',
  marktdichte: 'market control',
}

function artikelVor(wert: string): string {
  return /^(8|11|18)(?:\D|$)/.test(wert) ? 'an' : 'a'
}

/** „an ltm_ebit of 58.3%“ wird „a 58.3% operating margin“. Gilt für jede Kennzahl-ID. */
export function ohneKennzahlId(text: string): string {
  let t = text
  const ids = Object.keys(KENNZAHL_NAME).sort((a, b) => b.length - a.length)
  for (const id of ids) {
    const name = KENNZAHL_NAME[id]!
    const key = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    t = t.replace(new RegExp(`\\b(?:an?|the)\\s+${key}\\s+of\\s+([\\d.]+%|[\\d.]+\\s*pts|[\\d.]+x)`, 'gi'), (_, wert: string) => {
      return `${artikelVor(wert)} ${wert} ${name}`
    })
    t = t.replace(new RegExp(`\\b${key}\\s+of\\s+([\\d.]+%|[\\d.]+\\s*pts|[\\d.]+x)`, 'gi'), (_, wert: string) => `${wert} ${name}`)
    t = t.replace(new RegExp(`\\b${key}\\b`, 'gi'), (treffer, offset, ganz) => {
      const satzanfang = offset === 0 || /[.!?]\s*$/.test(String(ganz).slice(0, Number(offset)))
      return satzanfang ? name.charAt(0).toUpperCase() + name.slice(1) : name
    })
  }
  return t.replace(/\s+/g, ' ').trim()
}

/** Kein Schluss-Punkt: sonst hängt TTS eine Pause an und der Loop stockt. */
export function oeffneSprechende(text: string): string {
  return text.replace(/[.!?…]+$/u, '').replace(/,+$/g, '').trim()
}

function inhaltsWörter(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9%\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWÖRTER.has(w)),
  )
}

export function istSpannungOhneSpoiler(loop: string, crack: string): boolean {
  const t = ohneKiBindestrich(loop)
  if (!t || ABSCHIED.test(t) || BEDROHUNG_LEAK.test(t) || AUFLÖSUNG_LEAK.test(t)) return false
  if (!crack.trim()) return true
  const a = inhaltsWörter(t)
  const b = inhaltsWörter(crack)
  let treffer = 0
  for (const w of a) if (b.has(w)) treffer += 1
  return treffer < 2
}

export function saubererHookLoop(loop: string, crack: string): string {
  const t = ohneKiBindestrich(loop)
  return istSpannungOhneSpoiler(t, crack) ? t : FALLBACK_SPANNUNG
}

export function fallbackLand(verdict: MoatShortVerdict, _value?: string): string {
  if (verdict === 'wide') return 'Nobody else has a lock like this, which is why'
  if (verdict === 'narrow') return 'The lead is thinner than it looks, which is why'
  return 'The number already told you the story, which is why'
}

/** Landung, wenn du das Urteil selbst setzt. Offene Brücke, kein neuer Fakt. */
export function landFuerPersoenlichesUrteil(verdict: MoatShortVerdict): string {
  if (verdict === 'wide') return 'Nobody else has a lock like this, which is why'
  if (verdict === 'narrow') return 'The lead is thinner than it looks, which is why'
  return 'That advantage is not a moat, which is why'
}

export function istOffeneBruecke(land: string, value?: string): boolean {
  const t = oeffneSprechende(ohneKiBindestrich(land))
  if (!t || ABSCHIED.test(t) || /\bout of 10\b/i.test(t)) return false
  if (value && t.includes(value)) return false
  if (ZUSAMMENFASSUNG.test(t) && !BRUECKE_ENDE.test(t)) return false
  return BRUECKE_ENDE.test(t)
}

/** Letzter Satz vor dem Restart. Offene Brücke in den Hook, keine Zahl, kein Abschied. */
export function saubererLand(land: string, verdict: MoatShortVerdict, value: string): string {
  const t = oeffneSprechende(ohneKiBindestrich(land))
  if (istOffeneBruecke(t, value)) return t
  if (t && !ABSCHIED.test(t) && !/\bout of 10\b/i.test(t) && !(value && t.includes(value)) && !ZUSAMMENFASSUNG.test(t)) {
    return `${t}, which is why`
  }
  return fallbackLand(verdict, value)
}

export function loopSatz(land: string, hook: string): string {
  return `${oeffneSprechende(land)} ${hook.trim()}`.replace(/\s+/g, ' ').trim()
}

export function verboteneWoerterIn(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `
  return VERBOTENE_WOERTER.filter((w) => lower.includes(` ${w} `) || lower.includes(` ${w}.`) || lower.includes(` ${w},`))
}

function saetze(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function zuLangeSaetze(text: string, max = SATZ_MAX_WOERTER): string[] {
  return saetze(text).filter((s) => woerter(s).length > max)
}

export function scriptTonWarnungen(texte: string[]): string[] {
  const w: string[] = []
  const alles = texte.filter(Boolean).join(' ')
  const verboten = verboteneWoerterIn(alles)
  if (verboten.length) w.push(`KI-Ton im Script: ${verboten.join(', ')}. Ersetzen.`)
  const kauder = FIRMENSPRECH.filter((p) => alles.toLowerCase().includes(p))
  if (kauder.length) w.push(`Firmensprech: „${kauder[0]}“. Sag es wie am Tisch, nicht wie im Memo.`)
  const memo = texte.flatMap((t) => saetze(t)).find((s) => memoTreffer(s) >= 2)
  if (memo && !kauder.length) w.push(`Memo-Satz, keine Tischsprache: „${memo}“`)
  if (/[—–]|\s-\s/.test(alles)) w.push('Gedankenstriche im Script. Komma oder ganzer Satz, kein Bindestrich.')
  const lang = texte.flatMap((t) => zuLangeSaetze(t))
  if (lang.length) w.push(`Sätze über ${SATZ_MAX_WOERTER} Wörter: „${lang[0]}“`)
  const fetzen = texte
    .flatMap((t) => saetze(t))
    .filter((s) => {
      const n = woerter(s).length
      return n > 0 && n < SATZ_MIN_WOERTER && !/[?]$/.test(s) && !BRUECKE_ENDE.test(oeffneSprechende(s))
    })
  if (fetzen.length) w.push(`Zu kurz, klingt nach Slogan: „${fetzen[0]}“`)
  const zuLang = texte.find((t) => t.replace(/\s+/g, ' ').trim().length > 78)
  if (zuLang) w.push(`Zu lang, der Untertitel bricht: „${zuLang}“`)
  const feld = alles.match(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/)
  if (feld) w.push(`Interner Feldname im Satz: „${feld[0]}“. Sag die Kennzahl auf Englisch.`)
  return w
}

export function hashtagTicker(ticker: string): string {
  const t = ticker.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return t || 'STOCKS'
}

const TITEL_MIN = 28
const TITEL_MAX = 58

function saubererTitelKern(roh: string): string {
  let t = roh.replace(/#\w+/g, ' ').replace(/\s+/g, ' ').replace(/!{2,}/g, '').replace(/\?{2,}/g, '?').trim()
  if (t.length > 8 && t === t.toUpperCase()) t = `${t.charAt(0)}${t.slice(1).toLowerCase()}`
  return t
}

function kuerzeTitel(t: string): string {
  if (t.length <= TITEL_MAX) return t
  return t.slice(0, TITEL_MAX).replace(/\s+\S*$/, '').replace(/[-–:,]+$/u, '').trim()
}

const FLAUSCH =
  /\b(unmatched|discover the|key numbers|game-changer|delve|in this video|ultimate|you won't believe|incredible|massive|the tell)\b/i

function wortVorne(t: string, wort: string): boolean {
  return t.toLowerCase().startsWith(wort.toLowerCase())
}

function titelScore(t: string, ticker: string, name: string): number {
  let s = 0
  if (name.length >= 4 && wortVorne(t, name)) s += 6
  else if (wortVorne(t, ticker)) s += 2
  if (/\b(moat|why|nobody|copy|monopoly|margin|lock)\b/i.test(t)) s += 3
  if (/\d/.test(t)) s += 2
  if (t.length >= TITEL_MIN && t.length <= TITEL_MAX) s += 4
  else s -= 6
  if (FLAUSCH.test(t) || /\bstock price\b/i.test(t) || /\bbuy now\b/i.test(t)) s -= 8
  if (/^(how to download|watch|official)/i.test(t)) s -= 6
  return s
}

function labelKurz(label: string): string {
  return label.replace(/\b(ltm|ttm|trailing|last twelve months)\b/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

/** „an eight / an eleven“, sonst „a“. */
function artikelVorZahl(metrik: string): 'a' | 'an' {
  const z = metrik.trim().replace(/^[^0-9]+/, '')
  return /^(8|11|18)(\D|$)/.test(z) ? 'an' : 'a'
}

/** Shorts: Firmenname vorne, 28–58 Zeichen, ein korrekter Satzanfang. Suchqueries werden nicht zum Titel. */
export function titelFuerUpload(
  roh: string,
  ticker: string,
  metrik: string,
  suchphrasen: string[] = [],
  opts?: { firmenname?: string; metrikLabel?: string },
): string {
  const name = firmenKurzname(opts?.firmenname || '') || ticker
  const label = labelKurz(opts?.metrikLabel || 'margin') || 'margin'
  const gebaut = kuerzeTitel(`${name}: why ${artikelVorZahl(metrik)} ${metrik} ${label} is the moat`)
  const zweiter = kuerzeTitel(`${name} moat in one number: ${metrik}`)
  const ki = saubererTitelKern(roh)
  const kandidaten = [ki, gebaut, zweiter].filter((t) => t.length >= 8)
  for (const p of suchphrasen) {
    const kern = saubererTitelKern(p)
    if (kern.length >= TITEL_MIN && phrasePasst(kern, ticker, name)) kandidaten.push(kern)
  }
  let best = gebaut.length >= TITEL_MIN ? gebaut : zweiter
  let bestScore = -99
  for (const t of kandidaten.map(kuerzeTitel)) {
    const sc = titelScore(t, ticker, name)
    if (sc > bestScore) {
      best = t
      bestScore = sc
    }
  }
  if (best.length < TITEL_MIN) best = kuerzeTitel(`${name} moat: why ${metrik} still holds`)
  return best.charAt(0).toUpperCase() + best.slice(1)
}

function satzeOhneMeta(roh: string): string[] {
  return roh
    .replace(/#\w+/g, ' ')
    .replace(/not investment advice\.?/gi, ' ')
    .replace(/altered or synthetic media\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
}

function satzGross(s: string): string {
  const t = s.replace(/\s+[—–]\s+/g, ', ').replace(/\s+/g, ' ').trim()
  if (!t) return t
  const mitPunkt = /[.!?]$/.test(t) ? t : `${t}.`
  return mitPunkt.charAt(0).toUpperCase() + mitPunkt.slice(1)
}

function saubereSaetze(roh: string): string[] {
  return satzeOhneMeta(roh)
    .map(satzGross)
    .filter((s) => s.length > 12 && s.length < 180 && !FLAUSCH.test(s) && /^[A-Z0-9"']/.test(s))
}

/** Zeile 1 = echte Suchphrase. Danach zwei korrekte Sätze. Hashtags am Ende. */
export function beschreibungFuerUpload(
  roh: string,
  firmenname: string,
  ticker: string,
  metrik: string,
  titel = '',
  suchphrasen: string[] = [],
  metrikLabel = 'margin',
): string {
  const name = firmenKurzname(firmenname) || ticker
  const label = labelKurz(metrikLabel) || 'margin'
  const suche =
    suchphrasen.find((p) => phrasePasst(p, ticker, firmenname) && /\b(moat|stock|monopoly)\b/i.test(p)) ??
    `${name} moat`
  const erste = satzGross(`${suche} comes down to ${artikelVorZahl(metrik)} ${metrik} ${label}`)
  const titelNorm = titel.replace(/\s+/g, ' ').trim().toLowerCase()
  const kern = saubereSaetze(roh)
    .filter((s) => s.toLowerCase() !== titelNorm && !s.toLowerCase().startsWith(suche.toLowerCase()))
    .slice(0, 2)
    .join(' ')
  const mitte = kern || satzGross(`The question is whether that ${label} is a moat or just a good year`)
  const hash = `#Shorts #${hashtagTicker(ticker)} #investing #moat`
  return `${erste}\n\n${mitte}\n\nNot investment advice. Altered or synthetic media.\n${hash}`
}

export function kommentarFuerUpload(roh: string, verdict: MoatShortVerdict, ticker: string): string {
  const t = roh.replace(/\s+/g, ' ').replace(/#\w+/g, '').trim()
  if (t && !/\b(subscribe|follow|like this)\b/i.test(t) && t.length <= 80) return t
  if (verdict === 'wide') return `Is ${ticker} a wide moat, or just the only shop in town?`
  if (verdict === 'narrow') return `${ticker}: narrow moat. Durable, or one shock away?`
  return `${ticker}: no moat. Agree, or am I missing the lock-in?`
}

export function scriptLoopWarnungen(hook: string, land: string, value: string): string[] {
  const w: string[] = []
  if (value && !hook.includes(value)) w.push(`Der Hook nennt ${value} nicht wörtlich.`)
  if (value && land.includes(value)) {
    w.push(`Die Landung wiederholt ${value} — der Restart stottert. Zahl nur im Hook.`)
  }
  if (ABSCHIED.test(land) || /\bout of 10\b/i.test(land) || ZUSAMMENFASSUNG.test(land)) {
    w.push('Die Landung ist ein Schlusssatz. Mach eine offene Brücke, die in den Hook mündet.')
  }
  if (!istOffeneBruecke(land, value)) {
    w.push(`Loop prüfen: „${loopSatz(land, hook)}“ muss als ein Satz klingen.`)
  }
  return w
}

export function scriptStoryWarnungen(hookLoop: string, crack: string): string[] {
  if (!crack.trim()) return []
  if (istSpannungOhneSpoiler(hookLoop, crack)) return []
  return ['Der Spannungssatz spoilt die Bedrohung. Erst Hook und Säulen, dann der Crack.']
}
