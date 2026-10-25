import { firmenKurzname, phrasePasst } from '@/lib/youtube/youtube-keywords'

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

function hashtagTicker(ticker: string): string {
  return ticker.replace(/[^A-Za-z0-9]/g, '')
}

function titelScore(t: string, ticker: string): number {
  const low = t.toLowerCase()
  const tk = ticker.toLowerCase()
  let s = 0
  if (low.includes(tk)) s += 4
  if (/^\s*[A-Z0-9.]{1,8}\b/.test(t) && low.startsWith(tk)) s += 3
  if (/\b(earnings|beat|miss|call|guidance|eps)\b/i.test(t)) s += 3
  if (/\d/.test(t)) s += 2
  if (t.length >= TITEL_MIN && t.length <= TITEL_MAX) s += 2
  if (/\bstock price\b/i.test(t) || /\bbuy now\b/i.test(t)) s -= 4
  return s
}

export function earningsTitelFuerUpload(
  roh: string,
  ticker: string,
  metrik: string,
  suchphrasen: string[] = [],
  firmenname = '',
): string {
  const name = firmenKurzname(firmenname) || ticker
  const gebaut = kuerzeTitel(`${name} earnings: ${metrik} is not the whole story`)
  const ki = saubererTitelKern(roh)
  const kandidaten = [ki, gebaut].filter((t) => t.length >= 8)
  for (const p of suchphrasen) {
    const kern = saubererTitelKern(p)
    if (kern.length >= TITEL_MIN && phrasePasst(kern, ticker, name)) kandidaten.push(kern)
  }
  let best = gebaut
  let bestScore = -99
  for (const t of kandidaten.map(kuerzeTitel)) {
    const nameVorne = name.length >= 4 && t.toLowerCase().startsWith(name.toLowerCase())
    let sc = titelScore(t, ticker) + (nameVorne ? 4 : 0)
    if (t.length < TITEL_MIN) sc -= 6
    if (/\bthe tell\b/i.test(t)) sc -= 6
    if (sc > bestScore) {
      best = t
      bestScore = sc
    }
  }
  if (best.length < TITEL_MIN) best = kuerzeTitel(`${name}: what the earnings call changed`)
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

export function earningsBeschreibungFuerUpload(
  roh: string,
  firmenname: string,
  ticker: string,
  metrik: string,
  titel = '',
  suchphrasen: string[] = [],
): string {
  const name = firmenKurzname(firmenname) || ticker
  const suche =
    suchphrasen.find((p) => phrasePasst(p, ticker, firmenname) && /\bearnings\b/i.test(p)) ?? `${name} earnings`
  const kopf = /\bearnings$/i.test(suche) ? suche : `${name} earnings`
  const erste = `${kopf.charAt(0).toUpperCase()}${kopf.slice(1)}: the print was ${metrik}, and the call matters more.`
  const titelNorm = titel.replace(/\s+/g, ' ').trim().toLowerCase()
  const kern = satzeOhneMeta(roh)
    .filter((s) => s.toLowerCase() !== titelNorm)
    .filter((s) => !/\b(unmatched|discover the|key numbers|the tell|in this video)\b/i.test(s))
    .slice(0, 2)
    .join(' ')
    .slice(0, 280)
  const mitte = kern || `Guidance and the filing decide whether that print holds for ${name} (${ticker}).`
  const hash = `#Shorts #${hashtagTicker(ticker)} #earnings #investing`
  return `${erste}\n\n${mitte}\n\nNot investment advice. Altered or synthetic media.\n${hash}`
}

export function earningsKommentarFuerUpload(roh: string, ticker: string): string {
  const t = roh.replace(/\s+/g, ' ').replace(/#\w+/g, '').trim()
  if (t && !/\b(subscribe|follow|like this)\b/i.test(t) && t.length <= 80) return t
  return `Did the ${ticker} call change the beat, or the story?`
}

export function earningsLoopWarnungen(hook: string, land: string, value: string): string[] {
  const w: string[] = []
  if (value && value !== '—' && !hook.includes(value)) w.push(`Der Hook nennt ${value} nicht wörtlich.`)
  if (value && value !== '—' && land.includes(value)) {
    w.push(`Die Landung wiederholt ${value} — Zahl nur im Hook.`)
  }
  if (/[.!?]$/.test(land.trim())) {
    w.push('Die Landung ist ein Schlusssatz. Offene Brücke, die in den Hook mündet.')
  }
  return w
}
