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

export function umstritteneWoerter(text: string): string | null {
  const treffer = text.match(/\b(guaranteed returns?|risk[- ]free|get rich|100%\s*(profit|return)|sichere rendite|kein risiko)\b/i)
  return treffer?.[0] ?? null
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

export function titelScore(text: string, ticker: string, haupt: string): number {
  const t = text.trim()
  const len = t.length
  const laenge = len >= 40 && len <= 60 ? 40 : len >= 28 && len <= 70 ? 20 : 0
  const tk = ticker.trim()
  const hatTicker = tk.length >= 1 && new RegExp(`\\b${tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t) ? 25 : 0
  const neugier = /(\?|\b(why|how|what|is|can)\b)/i.test(t) ? 20 : 0
  const kopf = t.slice(0, 40).toLowerCase()
  const begriff = haupt.trim().toLowerCase()
  const vorn = begriff.length >= 2 && kopf.includes(begriff) ? 15 : 0
  const memo = t.includes(':') || /\b(back on track|stock analysis|breakdown|explained)\b/i.test(t) ? 30 : 0
  return Math.max(0, laenge + hatTicker + neugier + vorn - memo)
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
  const zahl = /\d/.test(opts.metricValue) ? opts.metricValue.trim() : null
  const frage = opts.hook.trim()
  const roh = [
    frage,
    ...fallbackShortsTitel(name, zahl),
    zahl ? `Why ${name}'s ${opts.metricLabel} is ${zahl}` : '',
    `Is ${name} a moat or just a big name?`,
  ]
  const gesehen = new Set<string>()
  const titel: VidiqTitel[] = []
  for (const zeile of roh) {
    const text = zeile.replace(/\s+/g, ' ').trim()
    if (!shortsTitelTaucht(text) || gesehen.has(text.toLowerCase())) continue
    gesehen.add(text.toLowerCase())
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

const TICKER_STOP = new Set(['CEO', 'CFO', 'FCF', 'EPS', 'GDP', 'ETF', 'IPO', 'ROE', 'ROI', 'ROIC', 'ROCE', 'GAAP', 'USA', 'EU', 'UK', 'AI', 'IT', 'PE', 'YOY', 'QOQ', 'SEC', 'FDA', 'NYSE'])

function tickerAus(tags: string[], titel: string): string | null {
  for (const roh of [...tags, ...titel.split(/\s+/)]) {
    const t = roh.replace(/[^A-Za-z]/g, '')
    if (/^[A-Z]{2,5}$/.test(t) && !TICKER_STOP.has(t)) return t
  }
  return null
}

function nameGespalten(name: string): string | null {
  const spaced = name.replace(/([a-z])([A-Z])/g, '$1 $2').trim()
  if (!spaced || spaced.toLowerCase() === name.toLowerCase()) return null
  return spaced
}

/** Suchphrase zuerst, dann Ticker und die getrennte Schreibweise. Das ist der Teil, den die Suche noch liest. */
export function tagsFuerShort(opts: { titel: string; beschreibung: string; tags: string[] }): string[] {
  const wort = suchwortAusTitel(opts.titel)
  const ticker = tickerAus(opts.tags, opts.titel)
  const text = `${opts.titel} ${opts.beschreibung}`.toLowerCase()
  const roh: string[] = []
  if (wort) {
    roh.push(wort, `${wort} stock`)
    const gespalten = nameGespalten(wort)
    if (gespalten) roh.push(gespalten, `${gespalten} stock`)
  }
  if (ticker) roh.push(ticker, `${ticker} stock`)
  if (/\bmoat\b/i.test(text) && wort) roh.push(`${wort} moat`)
  if (/\bearnings\b/i.test(text) && wort) roh.push(`${wort} earnings`)
  const zahl = opts.titel.match(/\d+(?:[.,]\d+)?%/)
  if (zahl && wort && /\bmargin\b/i.test(text)) roh.push(`${wort} margin`)
  const phrase = opts.titel
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
    .replace(/\s+\S*$/, '')
    .trim()
  if (phrase.length >= 12) roh.push(phrase)
  for (const alt of opts.tags) {
    if (wort && alt.toLowerCase().includes(wort.toLowerCase())) roh.push(alt)
    else if (ticker && alt.toUpperCase().includes(ticker)) roh.push(alt)
  }
  return tagsZusammen(roh, [])
}

/** Erste Zeile trägt das Suchwort. Danach genau drei Hashtags, die YouTube über dem Titel zeigt. */
export function beschreibungFuerShort(opts: { titel: string; beschreibung: string; tags: string[]; vorschlag: string }): string {
  const wort = suchwortAusTitel(opts.titel)
  const zahl = opts.titel.match(/\d+(?:[.,]\d+)?%/)?.[0] ?? null
  const ticker = tickerAus(opts.tags, opts.titel)
  let kern = opts.vorschlag
    .replace(/#\w+/g, ' ')
    .replace(/not investment advice\.?/gi, ' ')
    .replace(/altered or synthetic media\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!kern) kern = wort ? `${wort} is the question in this short.` : 'This short asks one question about the business.'
  if (wort && !kern.toLowerCase().includes(wort.toLowerCase())) kern = `${wort}. ${kern}`
  if (zahl && !kern.includes(zahl)) kern = `${kern} The number already in the title is ${zahl}.`
  if (!/[.!?]$/.test(kern)) kern = `${kern}.`
  kern = kern.charAt(0).toUpperCase() + kern.slice(1)
  if (kern.length < 90) kern = `${kern} The short is about that business, not a price target.`
  const hashWort = (wort || 'stocks').replace(/[^\p{L}\p{N}]/gu, '') || 'stocks'
  const dritter = ticker && ticker.toLowerCase() !== hashWort.toLowerCase() ? ticker : /\bearnings\b/i.test(opts.titel) ? 'earnings' : 'moat'
  return `${kern}\n\nNot investment advice.\n#Shorts #${hashWort} #${dritter}`
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

export type ShortScoreTeil = { name: string; punkte: number; max: number }

export type ShortScore = {
  gesamt: number
  stufe: string
  seo: number
  leistung: number | null
  outlier: number | null
  teile: ShortScoreTeil[]
}

function kappen(wert: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(wert)))
}

/** 50 % SEO aus den Metadaten, 50 % Leistung aus Halt, Reaktion und Outlier. */
export function scoreFuerShort(opts: {
  titel: string
  beschreibung: string
  tags: string[]
  views: number
  likes: number
  comments: number
  gesehenProzent: number | null
  vergleichsMedian: number | null
}): ShortScore {
  const titel = opts.titel.trim()
  const beschreibung = opts.beschreibung.trim()
  const wort = hauptwort(titel).toLowerCase()
  const kopf = titel.slice(0, 60).toLowerCase()
  const imTitel = wort.length > 3 && kopf.includes(wort)
  const inTags = wort.length > 3 && opts.tags.some((t) => t.toLowerCase().includes(wort))
  const inBeschreibung = wort.length > 3 && beschreibung.toLowerCase().includes(wort)
  const teile: ShortScoreTeil[] = [
    { name: 'Titellänge', punkte: titel.length >= 40 && titel.length <= 60 ? 20 : titel.length >= 28 && titel.length <= 70 ? 10 : 0, max: 20 },
    { name: 'Suchwort im Titel', punkte: imTitel ? 15 : 0, max: 15 },
    { name: 'Tags', punkte: opts.tags.length >= 5 ? 20 : opts.tags.length >= 3 ? 10 : 0, max: 20 },
    { name: 'Suchwort in Tags', punkte: inTags ? 15 : 0, max: 15 },
    { name: 'Suchwort in Beschreibung', punkte: inBeschreibung ? 15 : 0, max: 15 },
    { name: 'Beschreibung', punkte: beschreibung.length >= 120 ? 10 : beschreibung.length >= 80 ? 5 : 0, max: 10 },
    { name: 'Dreifach', punkte: imTitel && inTags && inBeschreibung ? 5 : 0, max: 5 },
  ]
  const seo = teile.reduce((summe, teil) => summe + teil.punkte, 0)
  const outlier = opts.vergleichsMedian && opts.vergleichsMedian > 0 ? opts.views / opts.vergleichsMedian : null
  let leistung: number | null = null
  if (opts.gesehenProzent != null) {
    const halt = kappen((opts.gesehenProzent / 100) * 40, 40)
    const rate = opts.views > 0 ? (opts.likes + opts.comments) / opts.views : 0
    const reaktion = kappen((rate / 0.03) * 30, 30)
    const ausreisser = outlier == null ? 15 : kappen(Math.log2(Math.max(outlier, 0.05)) * 10 + 15, 30)
    leistung = halt + reaktion + ausreisser
  }
  const gesamt = leistung == null ? seo : Math.round(seo * 0.5 + leistung * 0.5)
  return { gesamt, stufe: chanceStufe(gesamt), seo, leistung, outlier, teile }
}

const FUELLWOERTER = /^(why|how|what|who|is|are|the|a|an|of|to|and|for|in|on|at|do|does|can)$/i

export type ShortEmpfehlung = { stufe: 'hoch' | 'mittel' | 'ok'; text: string }

function hauptwort(titel: string): string {
  const wort = titel
    .replace(/'s\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .find((w) => w.length > 3 && !FUELLWOERTER.test(w))
  return wort ?? ''
}

const MEMO_TITEL = /\b(back on track|stock analysis|breakdown|explained|deep dive|you won't believe|game-changer|the tell)\b|:/i

/** Eine Zeile, die im Feed wie ein Short klingt: 40–60 Zeichen, kein Doppelpunkt, kein Memo. */
export function shortsTitelTaucht(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length < 40 || t.length > 60) return false
  if (MEMO_TITEL.test(t)) return false
  return /(\?|\b(why|how|what|is|are|does|do|can|can't|keeps|prints|holds|means|costs|pays|owns|makes|leaves|explains)\b)/i.test(t)
}

export function suchwortAusTitel(titel: string): string {
  return hauptwort(titel)
}

/** Fünf verschiedene gesprochene Titel. Firma und Zahl nur aus dem, was schon dasteht. */
export function fallbackShortsTitel(name: string, zahl: string | null): string[] {
  const n = name.replace(/\s+/g, ' ').trim()
  if (n.length < 2) return []
  const paare = [
    [`Why can't rivals copy ${n}'s model?`, `Why can't rivals really copy ${n}'s model?`],
    [`Is ${n} a moat or just a famous name?`, `Is ${n} really a moat or just a famous name?`],
    [`What happens if customers leave ${n}?`, `What happens if customers leave ${n} behind?`],
    zahl
      ? [`Why does ${n} still print ${zahl}?`, `Why does ${n} still manage to print ${zahl}?`]
      : [`What is ${n} actually selling?`, `What is ${n} actually selling to customers?`],
    [`The one number that explains ${n}`, `The one number that really explains ${n}`],
  ]
  const out: string[] = []
  const gesehen = new Set<string>()
  for (const [kurz, lang] of paare) {
    const text = [kurz, lang].map((z) => z.replace(/\s+/g, ' ').trim()).find((z) => shortsTitelTaucht(z))
    if (!text) continue
    const stamm = text.toLowerCase().split(/\s+/).slice(0, 3).join(' ')
    if (gesehen.has(stamm)) continue
    gesehen.add(stamm)
    out.push(text)
  }
  return out
}

/** Konkrete Schritte aus den Metadaten und, falls vorhanden, dem gesehenen Anteil. */
export function empfehlungenFuerShort(opts: {
  titel: string
  beschreibung: string
  tags: string[]
  views: number
  likes: number
  comments: number
  gesehenProzent: number | null
}): ShortEmpfehlung[] {
  const titel = opts.titel.trim()
  const beschreibung = opts.beschreibung.trim()
  const wort = hauptwort(titel).toLowerCase()
  const liste: ShortEmpfehlung[] = []
  if (titel.length < 40 || titel.length > 60) {
    liste.push({
      stufe: titel.length < 20 || titel.length > 80 ? 'hoch' : 'mittel',
      text: `Titel hat ${titel.length} Zeichen. Ziel sind 40–60, mit dem Suchwort vorn.`,
    })
  }
  if (opts.tags.length < 5) {
    liste.push({ stufe: 'hoch', text: `Nur ${opts.tags.length} Tags. Mindestens 5: Ticker, Firma, moat, stock, die Kennzahl.` })
  }
  if (beschreibung.length < 80) {
    liste.push({ stufe: 'hoch', text: 'Beschreibung ist zu dünn. Hook, die Kennzahl und „Not investment advice“ gehören hinein.' })
  }
  if (wort && !beschreibung.toLowerCase().includes(wort)) {
    liste.push({ stufe: 'mittel', text: `„${wort}“ steht im Titel, aber nicht in der Beschreibung.` })
  }
  if (wort && !opts.tags.some((t) => t.toLowerCase().includes(wort))) {
    liste.push({ stufe: 'mittel', text: `„${wort}“ fehlt in den Tags.` })
  }
  if (!/#\w/.test(beschreibung)) {
    liste.push({ stufe: 'mittel', text: 'Keine Hashtags in der Beschreibung. #Shorts und der Ticker reichen.' })
  }
  if (opts.gesehenProzent != null && opts.gesehenProzent < 40) {
    liste.push({ stufe: 'hoch', text: `Nur ${Math.round(opts.gesehenProzent)} % gesehen. Die Frage oder die Zahl muss in der ersten Sekunde da sein.` })
  } else if (opts.gesehenProzent != null && opts.gesehenProzent < 60) {
    liste.push({ stufe: 'mittel', text: `${Math.round(opts.gesehenProzent)} % gesehen. Die Zahl früher sprechen, der Halt reißt danach.` })
  }
  const reaktion = opts.views > 100 ? (opts.likes + opts.comments) / opts.views : null
  if (reaktion != null && reaktion < 0.01) {
    liste.push({ stufe: 'mittel', text: 'Wenig Likes und Kommentare. Der angepinnte Kommentar sollte eine Streitfrage sein, kein Abo-Spruch.' })
  }
  if (!liste.length) {
    liste.push({ stufe: 'ok', text: 'Titel, Tags und Beschreibung sitzen. Als Nächstes zählt, ob die erste Sekunde hält.' })
  }
  const rang = { hoch: 0, mittel: 1, ok: 2 }
  return liste.sort((a, b) => rang[a.stufe] - rang[b.stufe])
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
