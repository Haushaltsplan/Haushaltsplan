import type { MoatShortVerdict } from '@/remotion/moat-short-types'

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
const SATZ_MAX_WOERTER = 14

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
  return w
}

export function hashtagTicker(ticker: string): string {
  const t = ticker.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return t || 'STOCKS'
}

export function titelFuerUpload(roh: string, ticker: string, metrik: string): string {
  let t = roh.replace(/\s+/g, ' ').replace(/!{2,}|\?{2,}/g, '!').trim()
  if (t.length > 8 && t === t.toUpperCase()) t = `${t.charAt(0)}${t.slice(1).toLowerCase()}`
  if (!t.toLowerCase().includes(ticker.toLowerCase())) t = `${ticker} ${t}`
  if (t.length > 50) t = t.slice(0, 50).replace(/\s+\S*$/, '').trim()
  if (t.length < 24) t = `${ticker}: ${metrik} moat`.slice(0, 50)
  return t
}

export function beschreibungFuerUpload(roh: string, firmenname: string, ticker: string, metrik: string): string {
  const kern =
    roh
      .replace(/#\w+/g, ' ')
      .replace(/not investment advice\.?/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220) || `${ticker} moat in one number.`
  return `${firmenname} (${ticker}): ${metrik} moat check.\n\n${kern}\n\nNot investment advice.\n#${hashtagTicker(ticker)} #investing #moat`
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
