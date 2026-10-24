import type { MoatShortVerdict } from '@/remotion/moat-short-types'

const ABSCHIED =
  /\b(thanks for watching|thank you|thanks for|follow for|subscribe|see you|that's the video|watch next|hit like|link in|comment below)\b/i

export function fallbackLand(verdict: MoatShortVerdict, value: string): string {
  if (verdict === 'wide') return `Wide moat. The proof is ${value}.`
  if (verdict === 'narrow') return `Narrow moat. Still, ${value} is the tell.`
  return `No real moat. ${value} already said so.`
}

/** Letzter Satz vor dem Restart — muss die Hook-Zahl tragen und darf nicht nach Abschied klingen. */
export function saubererLand(land: string, verdict: MoatShortVerdict, value: string): string {
  const t = land.replace(/\s+/g, ' ').trim()
  if (!t || !t.includes(value) || ABSCHIED.test(t) || /\bout of 10\b/i.test(t)) {
    return fallbackLand(verdict, value)
  }
  return t
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
  if (value && !land.includes(value)) w.push(`Die Landung nennt ${value} nicht — dann ergibt der Restart keinen Sinn.`)
  if (ABSCHIED.test(land) || /\bout of 10\b/i.test(land)) {
    w.push('Die Landung klingt nach Schluss. Streiche Score und Abschied, ende auf der Hook-Zahl.')
  }
  return w
}
