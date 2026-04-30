import { decodeXmlText, parseGoogleNewsRssItems } from '@/lib/google-news-rss'
import { resolveCoachProvider, runCoachCompletion } from '@/lib/ki-coach-backend'

const NASDAQ100_WIKI_RAW_URL = 'https://en.wikipedia.org/w/index.php?title=Nasdaq-100&action=raw'

/** Yahoo blockiert oft `/v7/finance/quote` mit 401; `/v7/finance/spark` liefert dieselben Meta-Kurse zuverlässiger. */
const YAHOO_SPARK_BATCH = 20

const YAHOO_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://finance.yahoo.com/',
  Accept: 'application/json',
} as const
const NEWS_PRO_AKTION = 3
const POLYGON_API_KEY = (process.env.POLYGON_API_KEY || process.env.NEXT_PUBLIC_POLYGON_API_KEY || '').trim()

export type Nasdaq100MoverEintrag = {
  symbol: string
  name: string
  sektor: string | null
  branche: string | null
  /** Tagesveränderung der letzten regulären US-Sitzung, % */
  aenderungProzent: number
  kurs: number | null
  /** Unix-Sekunden der Kurszeit (Yahoo) */
  kursZeitUnix: number | null
  schlagzeilen: Array<{ titel: string; href: string }>
  /** Kurzfassung aus dem führenden Artikel (KI falls konfiguriert). */
  artikelZusammenfassung: string
  /** Begründung der Tagesbewegung (als ausklappbare Zusatzinfo in der UI). */
  begruendung: string
}

export type Nasdaq100MoversBericht = {
  /** Anzeige z. B. „Letzte NYSE/Nasdaq-Sitzung“ */
  sessionLabel: string
  top10: Nasdaq100MoverEintrag[]
  flop10: Nasdaq100MoverEintrag[]
  fehler: string | null
  /** Hinweis wenn keine KI — Einordnung nur Schlagzeilen */
  kiHinweis: string | null
  anzahlPositiv: number
  anzahlNegativ: number
  anzahlUnveraendert: number
}

function stripHtmlTags(s: string): string {
  return decodeXmlText(s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function cleanWikiCell(raw: string): string {
  let s = raw
  s = s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, ' ')
  s = s.replace(/<ref[^\/]*\/>/gi, ' ')
  s = s.replace(/\{\{[^{}]*\}\}/g, ' ')
  s = s.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
  s = s.replace(/\[\[([^\]]+)\]\]/g, '$1')
  s = s.replace(/''+/g, '')
  s = stripHtmlTags(s)
  return s.replace(/\s+/g, ' ').trim()
}

function yahooSymbolAusCsv(symbol: string): string {
  return symbol.trim().replace(/\./g, '-')
}

function teileArray<T>(arr: T[], groesse: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += groesse) out.push(arr.slice(i, i + groesse))
  return out
}

async function ladeKonstituenten(): Promise<Array<{ symbol: string; name: string; sektor: string | null; branche: string | null }>> {
  const res = await fetch(NASDAQ100_WIKI_RAW_URL, {
    next: { revalidate: 86_400 },
    headers: { 'User-Agent': 'omnia/1.0 (private; nasdaq100 constituents)' },
  })
  if (!res.ok) throw new Error(`Nasdaq-100 Konstituenten: HTTP ${res.status}`)
  const wiki = await res.text()
  const tables = [...wiki.matchAll(/\{\|[\s\S]*?\|\}/g)]
  let tableInhalt = ''
  for (const t of tables) {
    const low = t[0].toLowerCase()
    if (low.includes('! ticker') && low.includes('! company') && (low.includes('industry') || low.includes('sector'))) {
      tableInhalt = t[0]
      break
    }
  }
  if (!tableInhalt) throw new Error('Nasdaq-100 Konstituenten: passende Tabelle nicht gefunden.')

  const out: Array<{ symbol: string; name: string; sektor: string | null; branche: string | null }> = []
  const rows = tableInhalt.split(/\n\|-/g)
  for (const row of rows) {
    if (!/\n\|/.test(row)) continue
    const cols: string[] = []
    for (const lineRaw of row.split('\n')) {
      const line = lineRaw.trim()
      if (!line.startsWith('|') || line.startsWith('|-') || line.startsWith('|}')) continue
      const payload = line.slice(1).trim()
      if (!payload) continue
      if (payload.includes('||')) {
        cols.push(...payload.split('||').map((x) => cleanWikiCell(x)))
      } else {
        cols.push(cleanWikiCell(payload))
      }
    }
    if (cols.length < 2) continue
    const symbolRaw = cols[0]?.trim()
    const symbol = symbolRaw ? symbolRaw.replace(/\s+/g, '').toUpperCase() : ''
    const name = cols[1]?.trim()
    const sektor = cols[2]?.trim() || null
    const branche = cols[3]?.trim() || null
    if (symbol && name && /^[A-Z.\-]+$/.test(symbol)) out.push({ symbol, name, sektor, branche })
  }
  if (out.length < 80) throw new Error('Nasdaq-100 Konstituenten unvollständig geladen.')
  return out
}

type YahooQuoteRoh = {
  symbol?: string
  regularMarketChangePercent?: number
  regularMarketPrice?: number
  regularMarketTime?: number
}

type PolygonSnapshotTicker = {
  ticker?: string
  updated?: number
  day?: { c?: number }
  prevDay?: { c?: number }
}

type YahooSparkMeta = {
  regularMarketPrice?: number
  regularMarketTime?: number
  previousClose?: number
  chartPreviousClose?: number
}

function yahooZeitAlsUnixSekunden(t: number | undefined): number | null {
  if (t == null || !Number.isFinite(t)) return null
  if (t > 1e12) return Math.floor(t / 1000)
  return Math.floor(t)
}

function prozentVonSchlusskursZuPreis(preis: number, vorherigerSchluss: number): number | null {
  if (!Number.isFinite(preis) || !Number.isFinite(vorherigerSchluss) || vorherigerSchluss === 0) return null
  return Math.round(((preis - vorherigerSchluss) / vorherigerSchluss) * 10_000) / 100
}

async function ladeYahooQuotes(symbols: string[]): Promise<YahooQuoteRoh[]> {
  const sym = [...new Set(symbols.map((s) => s.trim()).filter(Boolean))]
  const batches = teileArray(sym, YAHOO_SPARK_BATCH)
  const alle: YahooQuoteRoh[] = []
  for (const batch of batches) {
    const u = new URL('https://query1.finance.yahoo.com/v7/finance/spark')
    u.searchParams.set('symbols', batch.join(','))
    const res = await fetch(u.toString(), {
      next: { revalidate: 600 },
      headers: YAHOO_FETCH_HEADERS,
    })
    if (!res.ok) throw new Error(`Yahoo Finance: HTTP ${res.status}`)
    const j = (await res.json()) as {
      spark?: {
        result?: Array<{ symbol?: string; response?: Array<{ meta?: YahooSparkMeta }> }>
      }
    }
    for (const zeile of j.spark?.result ?? []) {
      const ySym = zeile.symbol?.trim()
      const meta = zeile.response?.[0]?.meta
      if (!ySym || !meta) continue
      const preis = meta.regularMarketPrice
      const vorSchluss = meta.previousClose ?? meta.chartPreviousClose
      const pct =
        preis != null && vorSchluss != null ? prozentVonSchlusskursZuPreis(Number(preis), Number(vorSchluss)) : null
      if (pct == null || !Number.isFinite(pct)) continue
      alle.push({
        symbol: ySym,
        regularMarketChangePercent: pct,
        regularMarketPrice: preis != null ? Number(preis) : undefined,
        regularMarketTime: meta.regularMarketTime,
      })
    }
  }
  return alle
}

async function ladePolygonQuotes(symbolsCsv: string[]): Promise<YahooQuoteRoh[]> {
  if (!POLYGON_API_KEY) throw new Error('POLYGON_API_KEY fehlt')
  const symbolSet = new Set(symbolsCsv.map((s) => s.trim()).filter(Boolean))
  const u = new URL('https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers')
  u.searchParams.set('apiKey', POLYGON_API_KEY)
  u.searchParams.set('limit', '1000')
  const res = await fetch(u.toString(), {
    next: { revalidate: 60 },
    headers: { 'User-Agent': 'omnia/1.0 (private; sp500 polygon)' },
  })
  if (!res.ok) throw new Error(`Polygon: HTTP ${res.status}`)
  const j = (await res.json()) as { tickers?: PolygonSnapshotTicker[] }
  const out: YahooQuoteRoh[] = []
  for (const t of j.tickers ?? []) {
    const symbol = t.ticker?.trim()
    if (!symbol || !symbolSet.has(symbol)) continue
    const preis = t.day?.c
    const prev = t.prevDay?.c
    if (preis == null || prev == null) continue
    const pct = prozentVonSchlusskursZuPreis(Number(preis), Number(prev))
    if (pct == null || !Number.isFinite(pct)) continue
    out.push({
      symbol,
      regularMarketChangePercent: pct,
      regularMarketPrice: Number(preis),
      regularMarketTime: t.updated != null && Number.isFinite(Number(t.updated)) ? Math.floor(Number(t.updated) / 1_000_000_000) : undefined,
    })
  }
  return out
}

type ArtikelInfo = { schlagzeilen: Array<{ titel: string; href: string }>; zusammenfassungRoh: string | null }

async function ladeArtikelInfoFuerAktie(symbol: string, unternehmensname: string): Promise<ArtikelInfo> {
  const q = encodeURIComponent(
    `(${symbol} OR "${unternehmensname.replace(/"/g, '')}") (Aktie OR stock OR earnings OR Quartalszahlen OR guidance)`,
  )
  const url = `https://news.google.com/rss/search?q=${q}&hl=de&gl=DE&ceid=DE:de`
  try {
    const res = await fetch(url, {
      next: { revalidate: 900 },
      headers: { 'User-Agent': 'omnia/1.0 (private; sp500 mover news)' },
    })
    if (!res.ok) return { schlagzeilen: [], zusammenfassungRoh: null }
    const xml = await res.text()
    const items = parseGoogleNewsRssItems(xml, 'Google News', NEWS_PRO_AKTION * 2)
    const schlagzeilen = items
      .map((x) => ({
        titel: x.titel.replace(/\s+/g, ' ').trim(),
        href: x.href.trim(),
      }))
      .filter((x) => x.titel.length > 0 && x.href.length > 0)
      .map((x) => ({ ...x, titel: x.titel.length > 160 ? `${x.titel.slice(0, 157)}…` : x.titel }))
      .slice(0, NEWS_PRO_AKTION)

    const descRaw = /<description[^>]*>([\s\S]*?)<\/description>/i.exec(xml)?.[1] ?? ''
    const desc = decodeXmlText(descRaw).replace(/\s+/g, ' ').trim()
    const zusammenfassungRoh = desc.length >= 30 ? (desc.length > 320 ? `${desc.slice(0, 317)}…` : desc) : null
    return { schlagzeilen, zusammenfassungRoh }
  } catch {
    return { schlagzeilen: [], zusammenfassungRoh: null }
  }
}

function begruendungAusSchlagzeilen(schlagzeilen: Array<{ titel: string; href: string }>, prozent: number): string {
  if (schlagzeilen.length === 0) {
    return `Für diese Aktie (${prozent >= 0 ? '+' : ''}${prozent.toFixed(2)} %) wurden in den abgefragten News keine klaren Tages-Schlagzeilen gefunden. Marktbewegungen entstehen oft durch viele parallele Faktoren.`
  }
  const richtung = prozent >= 0 ? 'positiv' : 'negativ'
  return `Laut aktuellen Schlagzeilen könnte die ${richtung} Tagesbewegung u. a. damit zusammenhängen: „${schlagzeilen[0].titel}“. Das ist keine sichere Ursache — Kurse reagieren auf viele Einflüsse gleichzeitig.`
}

function zusammenfassungFallback(zusammenfassungRoh: string | null, schlagzeilen: Array<{ titel: string; href: string }>): string {
  if (zusammenfassungRoh && zusammenfassungRoh.length > 0) return zusammenfassungRoh
  if (schlagzeilen.length >= 2) return `${schlagzeilen[0].titel} ${schlagzeilen[1].titel}`
  if (schlagzeilen[0]) return schlagzeilen[0].titel
  return 'Keine belastbare Artikelzusammenfassung verfügbar.'
}

function jsonAusKiAntwort(roh: string): Record<string, string> | null {
  let t = roh.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  }
  try {
    const j = JSON.parse(t) as unknown
    if (!j || typeof j !== 'object' || Array.isArray(j)) return null
    const o = j as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && v.trim()) out[k.toUpperCase()] = v.trim()
    }
    return Object.keys(out).length ? out : null
  } catch {
    return null
  }
}

async function kiEinordnungenFuerAlle(
  zeilen: Array<{
    symbol: string
    name: string
    sektor: string | null
    branche: string | null
    aenderungProzent: number
    schlagzeilen: Array<{ titel: string; href: string }>
    zusammenfassungRoh: string | null
  }>,
): Promise<Record<string, { summary: string; reason: string }> | null> {
  const coach = resolveCoachProvider()
  if (!coach) return null

  const payload = {
    aktien: zeilen.map((z) => ({
      symbol: z.symbol,
      name: z.name,
      sektor: z.sektor,
      branche: z.branche,
      aenderungProzent: Math.round(z.aenderungProzent * 100) / 100,
      schlagzeilen: z.schlagzeilen,
      zusammenfassungRoh: z.zusammenfassungRoh,
    })),
  }

  const systemText = `Du bist ein präziser Finanzredakteur (Deutsch).
Du bekommst pro Aktie Symbol, Name, Sektor/Branche, Tagesveränderung in Prozent (letzte reguläre US-Handelssitzung), 0–3 Schlagzeilen und optional einen kurzen Rohtext aus dem Artikel.
Schreibe für JEDES Symbol genau einen Eintrag in einem JSON-Objekt: Schlüssel = Symbol in GROSSBUCHSTABEN, Wert = Objekt mit "summary" und "reason".
Regeln:
- "summary": 2-3 Sätze, konkret und inhaltlich dicht. Nenne die wichtigsten Treiber aus den gelieferten Quellen und wenn sinnvoll den Branchenkontext.
- "reason": 2 Sätze mit klarer Herleitung aus den Quellen, warum die Tagesbewegung plausibel ist.
- Nutze nur gelieferte Inhalte; keine erfundenen Zahlen oder Ereignisse.
- Schreibe klar und direkt, vermeide schwammige Formulierungen wie „könnte“, „möglicherweise“, „laut Medien“, außer es ist zwingend.
- Keine Anlageberatung, keine Kauf-/Verkaufsempfehlung.
Antwort NUR als JSON-Objekt, keine Markdown-Fences, kein weiterer Text.`

  const userText = JSON.stringify(payload)

  const res = await runCoachCompletion(coach.provider, coach.apiKey, systemText, [{ role: 'user', content: userText }], {
    temperature: 0.25,
  })
  if (!res.ok) return null
  let t = res.reply.trim()
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    const out: Record<string, { summary: string; reason: string }> = {}
    for (const [k, v] of Object.entries(j ?? {})) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue
      const o = v as Record<string, unknown>
      const summary = typeof o.summary === 'string' ? o.summary.trim() : ''
      const reason = typeof o.reason === 'string' ? o.reason.trim() : ''
      if (!summary && !reason) continue
      out[k.toUpperCase()] = { summary, reason }
    }
    return Object.keys(out).length ? out : null
  } catch {
    return null
  }
}

export async function ladeNasdaq100MoversBericht(): Promise<Nasdaq100MoversBericht> {
  try {
    const konst = await ladeKonstituenten()
    const symZuName = new Map(konst.map((k) => [k.symbol, k.name]))
    const symZuSektor = new Map(konst.map((k) => [k.symbol, k.sektor]))
    const symZuBranche = new Map(konst.map((k) => [k.symbol, k.branche]))
    const yahooSymbole = konst.map((k) => yahooSymbolAusCsv(k.symbol))

    let datenQuelle = 'Yahoo Finance (Spark)'
    let quotes: YahooQuoteRoh[]
    try {
      quotes = POLYGON_API_KEY ? await ladePolygonQuotes(konst.map((k) => k.symbol)) : await ladeYahooQuotes(yahooSymbole)
      if (POLYGON_API_KEY) datenQuelle = 'Polygon Snapshot'
    } catch {
      quotes = await ladeYahooQuotes(yahooSymbole)
      datenQuelle = 'Yahoo Finance (Spark, Fallback)'
    }
    const yahooZuCsv = new Map<string, string>()
    for (const k of konst) {
      yahooZuCsv.set(yahooSymbolAusCsv(k.symbol), k.symbol)
    }

    const mitAenderung: Array<{
      symbol: string
      name: string
      sektor: string | null
      branche: string | null
      aenderungProzent: number
      kurs: number | null
      kursZeitUnix: number | null
    }> = []

    for (const q of quotes) {
      const ys = q.symbol
      if (!ys) continue
      const csvSym = yahooZuCsv.get(ys) ?? ys.replace(/-/g, '.')
      const pct = q.regularMarketChangePercent
      if (pct == null || !Number.isFinite(Number(pct))) continue
      const name = symZuName.get(csvSym) ?? q.symbol ?? csvSym
      mitAenderung.push({
        symbol: csvSym,
        name,
        sektor: symZuSektor.get(csvSym) ?? null,
        branche: symZuBranche.get(csvSym) ?? null,
        aenderungProzent: Math.round(Number(pct) * 100) / 100,
        kurs: q.regularMarketPrice != null && Number.isFinite(Number(q.regularMarketPrice)) ? Number(q.regularMarketPrice) : null,
        kursZeitUnix: yahooZeitAlsUnixSekunden(q.regularMarketTime),
      })
    }

    if (mitAenderung.length < 50) {
      return {
        sessionLabel: '—',
        top10: [],
        flop10: [],
        fehler: 'Zu wenige Kursdaten vom Datenanbieter — bitte später erneut versuchen.',
        kiHinweis: null,
        anzahlPositiv: 0,
        anzahlNegativ: 0,
        anzahlUnveraendert: 0,
      }
    }

    const sortiert = [...mitAenderung].sort((a, b) => b.aenderungProzent - a.aenderungProzent)
    const top10roh = sortiert.slice(0, 10)
    const flop10roh = [...mitAenderung].sort((a, b) => a.aenderungProzent - b.aenderungProzent).slice(0, 10)

    const sessionUnix = top10roh[0]?.kursZeitUnix ?? flop10roh[0]?.kursZeitUnix ?? null
    let sessionLabel = `Letzte reguläre US-Handelssitzung (NYSE/Nasdaq) · Quelle: ${datenQuelle}`
    if (sessionUnix != null) {
      try {
        const d = new Date(sessionUnix * 1000)
        sessionLabel = `Kursstand: ${d.toLocaleString('de-DE', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} (New York) · Quelle: ${datenQuelle}`
      } catch {
        /* ignore */
      }
    }

    const alle20 = [...top10roh, ...flop10roh]
    const artikelInfos: ArtikelInfo[] = []
    for (const batch of teileArray(alle20, 5)) {
      const teil = await Promise.all(batch.map((z) => ladeArtikelInfoFuerAktie(z.symbol, z.name)))
      artikelInfos.push(...teil)
    }

    const mitNews = alle20.map((z, i) => ({
      symbol: z.symbol,
      name: z.name,
      sektor: z.sektor,
      branche: z.branche,
      aenderungProzent: z.aenderungProzent,
      kurs: z.kurs,
      kursZeitUnix: z.kursZeitUnix,
      schlagzeilen: artikelInfos[i]?.schlagzeilen ?? [],
      zusammenfassungRoh: artikelInfos[i]?.zusammenfassungRoh ?? null,
    }))

    const kiMap = await kiEinordnungenFuerAlle(mitNews)
    const kiHinweisBasis = resolveCoachProvider()
      ? null
      : 'Optional: Mit GEMINI_API_KEY oder OPENAI_API_KEY in .env.local liefert die Seite zusätzlich kurze KI-Einordnungen zu den Schlagzeilen.'
    const kiHinweis =
      POLYGON_API_KEY && datenQuelle.startsWith('Polygon')
        ? kiHinweisBasis
        : [kiHinweisBasis, 'Für stabilere Live-Daten kannst du POLYGON_API_KEY in .env.local setzen.']
            .filter(Boolean)
            .join(' ')

    const baueEintraege = (slice: typeof mitNews) =>
      slice.map((z) => {
        const ki = kiMap?.[z.symbol.toUpperCase()]
        const summaryFallback = zusammenfassungFallback(z.zusammenfassungRoh, z.schlagzeilen)
        const begruendungFallback = begruendungAusSchlagzeilen(z.schlagzeilen, z.aenderungProzent)
        return {
          symbol: z.symbol,
          name: z.name,
          sektor: z.sektor,
          branche: z.branche,
          aenderungProzent: z.aenderungProzent,
          kurs: z.kurs,
          kursZeitUnix: z.kursZeitUnix,
          schlagzeilen: z.schlagzeilen,
          artikelZusammenfassung: ki?.summary && ki.summary.length > 0 ? ki.summary : summaryFallback,
          begruendung: ki?.reason && ki.reason.length > 0 ? ki.reason : begruendungFallback,
        }
      })

    const top10 = baueEintraege(mitNews.slice(0, 10))
    const flop10 = baueEintraege(mitNews.slice(10, 20))

    const anzahlPositiv = mitAenderung.filter((x) => x.aenderungProzent > 0).length
    const anzahlNegativ = mitAenderung.filter((x) => x.aenderungProzent < 0).length
    const anzahlUnveraendert = mitAenderung.length - anzahlPositiv - anzahlNegativ

    return {
      sessionLabel,
      top10,
      flop10,
      fehler: null,
      kiHinweis,
      anzahlPositiv,
      anzahlNegativ,
      anzahlUnveraendert,
    }
  } catch (e) {
    return {
      sessionLabel: '—',
      top10: [],
      flop10: [],
      fehler: e instanceof Error ? e.message : 'Nasdaq-100 Movers konnten nicht geladen werden.',
      kiHinweis: null,
      anzahlPositiv: 0,
      anzahlNegativ: 0,
      anzahlUnveraendert: 0,
    }
  }
}
