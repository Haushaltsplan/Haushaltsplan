import { peersFuerTicker } from '@/lib/portfolio-analyse/peer-vergleich-data'
import { firmenKurzname } from '@/lib/youtube/youtube-keywords'
import { tagBereinigen, tagsZusammen } from '@/lib/youtube/youtube-tags'

export type VidiqVideo = {
  id: string
  titel: string
  kanalId: string
  kanal: string
  veroeffentlicht: string
  views: number
  likes: number
  comments: number
  abonnenten: number
  tags: string[]
  beschreibung: string
  tempoSeitUpload: number
  tempoDelta: number | null
  engagement: number | null
  outlier: number | null
}

export type VidiqTitel = { text: string; score: number }

export type VidiqSeoPunkt = { id: string; ok: boolean; label: string }

export type VidiqTagGruppe = { gruppe: string; tags: string[] }

const STUFEN = [
  { bis: 19, name: 'sehr niedrig' },
  { bis: 39, name: 'niedrig' },
  { bis: 59, name: 'mittel' },
  { bis: 79, name: 'hoch' },
  { bis: 100, name: 'sehr hoch' },
] as const

export function chanceStufe(wert: number): string {
  const w = Math.max(0, Math.min(100, Math.round(wert)))
  return STUFEN.find((s) => w <= s.bis)?.name ?? 'sehr hoch'
}

export function videoIdAusText(roh: string): string | null {
  const text = roh.trim()
  if (/^[\w-]{11}$/.test(text)) return text
  try {
    const url = new URL(text)
    const kurz = url.hostname.includes('youtu.be') ? url.pathname.replace(/^\//, '').slice(0, 11) : ''
    if (/^[\w-]{11}$/.test(kurz)) return kurz
    const v = url.searchParams.get('v') ?? ''
    if (/^[\w-]{11}$/.test(v)) return v
    const shorts = url.pathname.match(/\/shorts\/([\w-]{11})/)
    return shorts?.[1] ?? null
  } catch {
    return null
  }
}

export function stundenSeit(iso: string, jetzt = Date.now()): number {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return 1
  return Math.max(1 / 60, (jetzt - ms) / 3_600_000)
}

export function tempoSeitUpload(views: number, iso: string, jetzt = Date.now()): number {
  return views / stundenSeit(iso, jetzt)
}

export function tempoAusDelta(vorherViews: number, nachherViews: number, stunden: number): number | null {
  if (stunden < 0.25) return null
  return (nachherViews - vorherViews) / stunden
}

export function engagementQuote(likes: number, comments: number, views: number): number | null {
  if (views <= 0) return null
  return (likes + comments) / views
}

export function median(werte: number[]): number | null {
  const liste = werte.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!liste.length) return null
  const mitte = Math.floor(liste.length / 2)
  if (liste.length % 2) return liste[mitte] ?? null
  return ((liste[mitte - 1] ?? 0) + (liste[mitte] ?? 0)) / 2
}

/** Letzte 10 Videos des Kanals, nicht der lebenslange Schnitt. */
export function outlierGegen(views: number, vergleichsviews: number[]): number | null {
  const basis = median(vergleichsviews)
  if (basis == null || basis <= 0) return null
  return views / basis
}

export function nachfragePunkte(begriffe: string[], fragen: string[], haupt: string): number {
  const kern = haupt.trim().toLowerCase()
  const treffer = kern.length >= 3 && begriffe.some((b) => b.toLowerCase().includes(kern))
  const roh = Math.min(40, begriffe.length * 3) + Math.min(8, fragen.length * 2) + (treffer ? 10 : 0)
  return Math.max(0, Math.min(50, roh))
}

/** Hohe Views pro Stunde auf großen Kanälen machen die Phrase schwer. */
export function wettbewerbPunkte(videos: { tempoSeitUpload: number; abonnenten: number }[]): number {
  if (!videos.length) return 25
  const tempo = median(videos.map((v) => v.tempoSeitUpload)) ?? 1
  const gross = videos.filter((v) => v.abonnenten >= 100_000).length / videos.length
  const ausTempo = Math.min(35, Math.log10(Math.max(1, tempo)) * 8)
  return Math.max(0, Math.min(50, Math.round(ausTempo + gross * 20)))
}

export function chanceWert(nachfrage: number, wettbewerb: number): number {
  return Math.max(0, Math.min(100, Math.round(nachfrage + (50 - wettbewerb))))
}

function titelKuerzen(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length <= 100 ? t : `${t.slice(0, 97).trim()}...`
}

export function titelScore(text: string, ticker: string, haupt: string): number {
  const t = text.trim()
  const len = t.length
  const laenge = len >= 40 && len <= 60 ? 40 : len >= 28 && len <= 70 ? 20 : 0
  const tk = ticker.trim()
  const hatTicker = tk.length >= 1 && new RegExp(`\\b${tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t) ? 25 : 0
  const neugier = /(\?|^(why|how|what|is|can)\b)/i.test(t) ? 20 : 0
  const kopf = t.slice(0, 60).toLowerCase()
  const begriff = haupt.trim().toLowerCase()
  const vorn = begriff.length >= 2 && kopf.includes(begriff) ? 15 : 0
  return laenge + hatTicker + neugier + vorn
}

export function fuenfTitel(opts: {
  ticker: string
  firmenname: string
  hook: string
  kicker: string
  metricValue: string
  metricLabel: string
}): VidiqTitel[] {
  const name = firmenKurzname(opts.firmenname) || opts.ticker
  const haupt = name
  const frage = /\?\s*$/.test(opts.hook.trim()) ? opts.hook.trim() : `Why does ${name} keep that edge?`
  const roh = [
    frage,
    `${opts.ticker} ${opts.metricLabel}: ${opts.metricValue}`,
    opts.kicker.trim() ? `${name}: ${opts.kicker.trim()}` : `${name} moat check`,
    `Is ${name} a moat at ${opts.metricValue}?`,
    `${opts.ticker} moat: ${opts.metricLabel} ${opts.metricValue}`,
  ]
  const gesehen = new Set<string>()
  const titel: VidiqTitel[] = []
  for (const zeile of roh) {
    const text = titelKuerzen(zeile)
    const key = text.toLowerCase()
    if (!text || gesehen.has(key)) continue
    gesehen.add(key)
    titel.push({ text, score: titelScore(text, opts.ticker, haupt) })
  }
  return titel.slice(0, 5)
}

export function hashtagsFuer(ticker: string, firmenname: string): string[] {
  const name = firmenKurzname(firmenname).replace(/[^A-Za-z0-9]/g, '')
  const tk = ticker.replace(/[^A-Za-z0-9]/g, '')
  return [...new Set(['Shorts', 'investing', 'moat', tk, name].filter((h) => h.length >= 2))].map((h) => `#${h}`)
}

export function beschreibungEntwurf(opts: {
  hook: string
  firmenname: string
  ticker: string
  metricValue: string
  metricLabel: string
}): string {
  const tags = hashtagsFuer(opts.ticker, opts.firmenname).join(' ')
  return [
    opts.hook.trim(),
    '',
    `${opts.metricLabel}: ${opts.metricValue}`,
    '',
    'Not investment advice. Altered or synthetic media.',
    tags,
  ].join('\n')
}

export function tagGruppen(opts: {
  ticker: string
  firmenname: string
  metricLabel: string
  suchphrasen: string[]
  isin?: string | null
}): VidiqTagGruppe[] {
  const name = firmenKurzname(opts.firmenname)
  const tk = opts.ticker.trim().toUpperCase()
  const peers = peersFuerTicker(tk, opts.isin)
  const gruppen: VidiqTagGruppe[] = [
    { gruppe: 'Ticker', tags: [tk, `${tk} stock`, `${tk} moat`, name].filter(Boolean) },
    { gruppe: 'Kennzahl', tags: [opts.metricLabel, `${name} ${opts.metricLabel}`].filter((t) => t.trim().length > 1) },
    { gruppe: 'Wettbewerber', tags: peers.flatMap((p) => [p, `${p} stock`]) },
    { gruppe: 'Nische', tags: opts.suchphrasen },
  ]
  return gruppen
    .map((g) => ({
      gruppe: g.gruppe,
      tags: [...new Set(g.tags.map((t) => tagBereinigen(t)).filter(Boolean))],
    }))
    .filter((g) => g.tags.length)
}

export function empfohleneTags(gruppen: VidiqTagGruppe[]): string[] {
  return tagsZusammen(
    gruppen.flatMap((g) => g.tags),
    [],
  )
}

export function tagZeichen(tags: string[]): number {
  return tags.reduce((summe, tag, i) => summe + tag.length + (i ? 1 : 0), 0)
}

export function seoCheckliste(opts: {
  titel: string
  beschreibung: string
  tags: string[]
  haupt: string
}): { punkte: VidiqSeoPunkt[]; score: number } {
  const titel = opts.titel.trim()
  const beschreibung = opts.beschreibung
  const haupt = opts.haupt.trim().toLowerCase()
  const kopf = titel.slice(0, 60).toLowerCase()
  const imTitel = haupt.length >= 2 && kopf.includes(haupt)
  const inBeschreibung = haupt.length >= 2 && beschreibung.toLowerCase().includes(haupt)
  const inTags = haupt.length >= 2 && opts.tags.some((t) => t.toLowerCase().includes(haupt))
  const punkte: VidiqSeoPunkt[] = [
    { id: 'tags', ok: opts.tags.length >= 5, label: 'Mindestens 5 Tags' },
    { id: 'titel', ok: imTitel, label: 'Hauptbegriff in den ersten 60 Zeichen des Titels' },
    { id: 'beschreibung', ok: inBeschreibung, label: 'Hauptbegriff in der Beschreibung' },
    { id: 'dreifach', ok: imTitel && inBeschreibung && inTags, label: 'Hauptbegriff in Titel, Tags und Beschreibung' },
    { id: 'laenge', ok: titel.length >= 40 && titel.length <= 60, label: 'Titellänge 40–60 Zeichen' },
    {
      id: 'hinweis',
      ok: /not investment advice/i.test(beschreibung) && metricWertDrin(beschreibung),
      label: 'Beschreibung mit Kennzahl und Hinweis',
    },
  ]
  const score = Math.round((punkte.filter((p) => p.ok).length / punkte.length) * 100)
  return { punkte, score }
}

function metricWertDrin(beschreibung: string): boolean {
  return /\d/.test(beschreibung)
}

export function paketText(opts: { titel: string; beschreibung: string; tags: string[]; hashtags: string[] }): string {
  return [`Titel: ${opts.titel}`, '', 'Beschreibung:', opts.beschreibung, '', `Hashtags: ${opts.hashtags.join(' ')}`, `Tags: ${opts.tags.join(',')}`].join('\n')
}

export function abstandTage(daten: string[]): number | null {
  const zeiten = daten.map((d) => Date.parse(d)).filter((n) => Number.isFinite(n)).sort((a, b) => b - a)
  if (zeiten.length < 2) return null
  const luecken: number[] = []
  for (let i = 1; i < zeiten.length; i++) luecken.push((zeiten[i - 1]! - zeiten[i]!) / 86_400_000)
  return median(luecken)
}
