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

const SATZ_MAX_WOERTER = 10

function woerter(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w && !/^[—–\-,.;:!?…]+$/.test(w))
}

/** ElevenLabs braucht Kommas und Gedankenstriche — Bindestriche mit Leerzeichen werden zu Em-Dashes. */
export function normalisiereTtsPausen(text: string): string {
  return text
    .replace(/\u2013/g, '—')
    .replace(/\s+-\s+/g, ' — ')
    .replace(/\s*—\s*/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Kein Schluss-Punkt: sonst hängt TTS eine Pause an und der Loop stockt. */
export function oeffneSprechende(text: string): string {
  return text.replace(/[.!?…]+$/u, '').replace(/,+$/g, '').trim()
}

export function fallbackLand(verdict: MoatShortVerdict, _value?: string): string {
  if (verdict === 'wide') return 'Nobody else has this lock, which is why'
  if (verdict === 'narrow') return "It's thin — still, that's why"
  return 'The number already told you, which is why'
}

export function istOffeneBruecke(land: string, value?: string): boolean {
  const t = oeffneSprechende(normalisiereTtsPausen(land))
  if (!t || ABSCHIED.test(t) || /\bout of 10\b/i.test(t)) return false
  if (value && t.includes(value)) return false
  if (ZUSAMMENFASSUNG.test(t) && !BRUECKE_ENDE.test(t)) return false
  return BRUECKE_ENDE.test(t) || /—$/.test(t)
}

/** Letzter Satz vor dem Restart — offene Brücke in den Hook, keine Zahl, kein Abschied. */
export function saubererLand(land: string, verdict: MoatShortVerdict, value: string): string {
  const t = oeffneSprechende(normalisiereTtsPausen(land))
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

function hatMikroPausen(text: string): boolean {
  return /[,?—]|—/.test(text)
}

export function scriptTonWarnungen(texte: string[]): string[] {
  const w: string[] = []
  const alles = texte.filter(Boolean).join(' ')
  const verboten = verboteneWoerterIn(alles)
  if (verboten.length) w.push(`KI-Ton im Script: ${verboten.join(', ')} — ersetzen.`)
  const lang = texte.flatMap((t) => zuLangeSaetze(t))
  if (lang.length) w.push(`Sätze über ${SATZ_MAX_WOERTER} Wörter: „${lang[0]}“`)
  const ohnePause = texte.flatMap((t) => saetze(t)).filter((s) => woerter(s).length >= 7 && !hatMikroPausen(s))
  if (ohnePause.length) w.push('Längere Zeilen brauchen ein Komma oder einen Gedankenstrich für die Stimme.')
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
  if (verdict === 'wide') return `Is ${ticker} a wide moat — or just the only shop in town?`
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
