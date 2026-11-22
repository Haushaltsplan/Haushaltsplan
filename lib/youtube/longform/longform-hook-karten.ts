/**
 * Stumme Einstiegskarten. Werte nur aus Export, Wikidata-Claims oder zwei Wikipedia-Mustern.
 * Fehlt ein Feld, fällt die Karte weg. Nichts davon geht ins Skript-Faktenblatt.
 */
import 'server-only'

import type { FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { lookupIsinMetadaten } from '@/lib/portfolio-analyse/isin-lookup-server'
import { wknAusFigiOderKenntnis } from '@/lib/portfolio-analyse/isin-wkn'
import { usd } from '@/lib/youtube/longform/longform-format'
import type { LongformHookBasis, LongformHookKarte } from '@/lib/youtube/longform/longform-types'

const UA = 'MeinHaushaltLongform/1.0 (stock video fact cards)'
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{10}$/
const STOP = new Set(['inc', 'corp', 'corporation', 'company', 'the', 'ltd', 'limited', 'group', 'holdings', 'plc', 'ag', 'se', 'sa', 'nv', 'co'])

const INDEX_NAME: Record<string, string> = {
  's&p 500': 'S&P 500',
  's&p500': 'S&P 500',
  'nasdaq-100': 'Nasdaq-100',
  'nasdaq 100': 'Nasdaq-100',
  dax: 'DAX',
  'euro stoxx 50': 'EURO STOXX 50',
  'nikkei 225': 'Nikkei 225',
  'ftse 100': 'FTSE 100',
}

type WdSnak = { snaktype?: string; datavalue?: { value?: unknown } }
type WdClaim = { rank?: string; mainsnak?: WdSnak; qualifiers?: Record<string, WdSnak[]> }
type WdEntity = {
  id?: string
  labels?: Record<string, { value?: string }>
  descriptions?: Record<string, { value?: string }>
  sitelinks?: { enwiki?: { title?: string } }
  claims?: Record<string, WdClaim[]>
}

export type HookZusatz = { karten: LongformHookKarte[]; basis: LongformHookBasis }

function token(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
}

function overlap(a: string, b: string): number {
  const ta = new Set(token(a))
  const tb = token(b)
  if (!ta.size || !tb.length) return 0
  const hit = new Set(tb.filter((t) => ta.has(t))).size
  return hit / Math.max(ta.size, new Set(tb).size)
}

function jahrAusZeit(time: unknown): number | null {
  if (typeof time !== 'string') return null
  const m = time.match(/([+-]?\d{4})/)
  if (!m) return null
  const y = Number(m[1])
  const jetzt = new Date().getFullYear()
  if (!Number.isFinite(y) || y < 1600 || y > jetzt) return null
  return y
}

function zeitVonSnak(snak: WdSnak | undefined): number | null {
  const v = snak?.datavalue?.value
  if (!v || typeof v !== 'object') return null
  return jahrAusZeit((v as { time?: unknown }).time)
}

function menge(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const n = Number((value as { amount?: unknown }).amount)
  if (!Number.isFinite(n) || n < 1 || n > 5_000_000) return null
  return Math.round(n)
}

function textVonSnak(snak: WdSnak | undefined): string | null {
  const v = snak?.datavalue?.value
  if (typeof v === 'string') {
    const t = v.replace(/\s+/g, ' ').trim()
    return t || null
  }
  if (v && typeof v === 'object' && typeof (v as { text?: unknown }).text === 'string') {
    const t = (v as { text: string }).text.replace(/\s+/g, ' ').trim()
    return t || null
  }
  return null
}

function qidVonSnak(snak: WdSnak | undefined): string | null {
  const v = snak?.datavalue?.value
  if (!v || typeof v !== 'object') return null
  const id = (v as { id?: unknown }).id
  return typeof id === 'string' && /^Q\d+$/.test(id) ? id : null
}

function claims(e: WdEntity, pid: string): WdClaim[] {
  return (e.claims?.[pid] ?? []).filter((c) => c.rank !== 'deprecated' && c.mainsnak?.snaktype === 'value')
}

function label(map: Map<string, string>, id: string | null): string | null {
  if (!id) return null
  const t = map.get(id)?.replace(/\s+/g, ' ').trim()
  return t || null
}

function indexName(roh: string): string | null {
  return INDEX_NAME[roh.toLowerCase().replace(/\s+/g, ' ').trim()] ?? null
}

function borseKurz(roh: string): string | null {
  const l = roh.toLowerCase()
  if (l.includes('nasdaq')) return 'Nasdaq'
  if (l === 'nyse' || l.includes('new york stock')) return 'NYSE'
  return null
}

function mitarbeiterAusPaket(paket: FundamentaldatenPaket): number | null {
  const seg = paket.erweitert?.secSegmentHistorie
  const direkt = seg?.zusatz.mitarbeiterAnzahl
  if (direkt != null && direkt > 0) return Math.round(direkt)
  const letztes = [...(seg?.kennzahlen?.mitarbeiter ?? [])].sort((a, b) => b.jahr - a.jahr)[0]
  return letztes && letztes.wert > 0 ? Math.round(letztes.wert) : null
}

function kopfzahl(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

async function wd(params: Record<string, string>): Promise<Record<string, unknown> | null> {
  const u = new URL('https://www.wikidata.org/w/api.php')
  u.searchParams.set('format', 'json')
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  const res = await fetch(u, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(8_000),
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as Record<string, unknown>
}

async function sucheEntities(name: string): Promise<string[]> {
  const j = await wd({
    action: 'wbsearchentities',
    search: name,
    language: 'en',
    type: 'item',
    limit: '6',
  })
  const search = (j?.search ?? []) as { id?: string }[]
  return search.map((s) => s.id).filter((id): id is string => typeof id === 'string' && /^Q\d+$/.test(id))
}

async function ladeEntities(ids: string[]): Promise<WdEntity[]> {
  if (!ids.length) return []
  const j = await wd({
    action: 'wbgetentities',
    ids: ids.slice(0, 6).join('|'),
    props: 'claims|labels|descriptions|sitelinks',
    languages: 'en',
  })
  const entities = (j?.entities ?? {}) as Record<string, WdEntity>
  return ids.map((id) => entities[id]).filter((e): e is WdEntity => !!e && !('missing' in e))
}

async function ladeLabels(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const uniq = [...new Set(ids)].filter((id) => /^Q\d+$/.test(id))
  for (let i = 0; i < uniq.length; i += 40) {
    const chunk = uniq.slice(i, i + 40)
    const j = await wd({
      action: 'wbgetentities',
      ids: chunk.join('|'),
      props: 'labels',
      languages: 'en',
    })
    const entities = (j?.entities ?? {}) as Record<string, WdEntity>
    for (const [id, e] of Object.entries(entities)) {
      const v = e.labels?.en?.value
      if (v) map.set(id, v)
    }
  }
  return map
}

function scoreEntity(e: WdEntity, firmenname: string, ticker: string): number {
  const name = e.labels?.en?.value ?? ''
  const desc = e.descriptions?.en?.value ?? ''
  if (/disambiguation/i.test(desc)) return -1
  const ov = overlap(firmenname, name)
  const tickerHit = claims(e, 'P249').some((c) => {
    const t = textVonSnak(c.mainsnak)?.toUpperCase().split('.')[0]
    return t === ticker
  })
  const firma = /compan|corporat|business|manufacturer|enterprise|conglomerate|bank|semiconductor|software|retail/i.test(desc)
  if (tickerHit && ov >= 0.34) return Math.round(ov * 100) + 80
  if (ov >= 0.5 && (firma || !desc || ov >= 0.8)) return Math.round(ov * 100)
  return -1
}

function wikidataJahr(e: WdEntity, pid: string): number | null {
  for (const c of claims(e, pid)) {
    const y = zeitVonSnak(c.mainsnak)
    if (y) return y
  }
  return null
}

function wikidataMitarbeiter(e: WdEntity): number | null {
  const jetzt = new Date().getFullYear()
  let best: { jahr: number; n: number } | null = null
  for (const c of claims(e, 'P1128')) {
    const n = menge(c.mainsnak?.datavalue?.value)
    const stichtag = (c.qualifiers?.P585 ?? []).map(zeitVonSnak).find((y) => y != null) ?? null
    if (n == null || stichtag == null || stichtag < jetzt - 3) continue
    if (!best || stichtag > best.jahr) best = { jahr: stichtag, n }
  }
  return best?.n ?? null
}

function namen(e: WdEntity, pid: string, labels: Map<string, string>, max: number): string[] {
  const out: string[] = []
  for (const c of claims(e, pid)) {
    if (pid === 'P169' && (c.qualifiers?.P582 ?? []).some((s) => zeitVonSnak(s) != null)) continue
    const n = label(labels, qidVonSnak(c.mainsnak))
    if (!n || n.length > 40 || out.some((x) => x.toLowerCase() === n.toLowerCase())) continue
    out.push(n)
    if (out.length >= max) break
  }
  return out
}

function wikiJahr(extract: string): number | null {
  const m = extract.slice(0, 700).match(/\bfounded\s+in\s+(1[89]\d{2}|20\d{2})\b/i)
  const y = m ? Number(m[1]) : null
  const jetzt = new Date().getFullYear()
  return y != null && y >= 1600 && y <= jetzt ? y : null
}

function wikiFrueher(extract: string): string | null {
  const kopf = extract.slice(0, 700)
  if ([...kopf.matchAll(/formerly known as/gi)].length !== 1) return null
  const m = kopf.match(/\bformerly\s+known\s+as\s+([A-Z][A-Za-z0-9&.'’-]+(?:\s+[A-Z][A-Za-z0-9&.'’-]+){0,4})/)
  const name = m?.[1]?.replace(/\s+(Inc|Corp|Corporation|Ltd|Limited|AG|SE|PLC)\.?$/i, '').trim()
  if (!name || name.length > 40) return null
  return name
}

async function wikiVorspann(titel: string): Promise<string | null> {
  const pfad = encodeURIComponent(titel.replace(/ /g, '_'))
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${pfad}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(8_000),
    cache: 'no-store',
  })
  if (!res.ok) return null
  const j = (await res.json()) as { type?: string; extract?: string }
  if (j.type === 'disambiguation') return null
  const extract = j.extract?.trim()
  return extract && extract.length > 40 ? extract : null
}

async function wknFuer(isin: string | null): Promise<string | null> {
  if (!isin || !ISIN_RE.test(isin)) return null
  const direkt = wknAusFigiOderKenntnis(isin, [], isinKenntnis(isin))
  if (direkt) return direkt
  try {
    const rows = await lookupIsinMetadaten([isin])
    return rows[0]?.wkn ?? null
  } catch {
    return null
  }
}

function karte(wert: string | null, label: string, quelle: string): LongformHookKarte | null {
  const v = wert?.replace(/\s+/g, ' ').trim()
  if (!v) return null
  return { wert: v, label, quelle }
}

export async function ladeHookZusatz(paket: FundamentaldatenPaket, isin: string | null): Promise<HookZusatz> {
  const ticker = (paket.symbolYahoo?.split('.')[0] || paket.ticker).trim().toUpperCase()
  const firmenname = paket.firmenname.trim()
  const saubereIsin = isin && ISIN_RE.test(isin.toUpperCase()) ? isin.toUpperCase() : null
  const cap = paket.mantraMeta?.marketCapUsd
  const basis: LongformHookBasis = {
    marketCap: cap != null && cap > 0 ? usd(cap) : null,
    wkn: null,
    isin: saubereIsin,
  }

  const maExport = mitarbeiterAusPaket(paket)
  const glassdoor = paket.erweitert?.arbeitgeber?.glassdoor?.score
  const glassdoorText = glassdoor != null && glassdoor > 0 && glassdoor <= 5 ? glassdoor.toFixed(1) : null

  let founded: LongformHookKarte | null = null
  let founders: LongformHookKarte | null = null
  let hq: LongformHookKarte | null = null
  let employees: LongformHookKarte | null = maExport != null ? karte(kopfzahl(maExport), 'Employees', '10-K') : null
  let ceo: LongformHookKarte | null = null
  let index: LongformHookKarte | null = null
  let ipo: LongformHookKarte | null = null
  let herkunft: LongformHookKarte | null = null
  let motto: LongformHookKarte | null = null
  let exchange: LongformHookKarte | null = null
  let former: LongformHookKarte | null = null

  const [wkn, wiki] = await Promise.all([
    wknFuer(saubereIsin),
    (async () => {
      try {
        const ids = await sucheEntities(firmenname)
        const entities = await ladeEntities(ids)
        const best = entities
          .map((e) => ({ e, score: scoreEntity(e, firmenname, ticker) }))
          .filter((x) => x.score >= 0)
          .sort((a, b) => b.score - a.score)[0]?.e
        if (!best) return null
        const qids = ['P112', 'P159', 'P169', 'P361', 'P793', 'P807', 'P749', 'P414'].flatMap((pid) =>
          claims(best, pid).map((c) => qidVonSnak(c.mainsnak)).filter((id): id is string => !!id),
        )
        const labels = await ladeLabels(qids)
        const titel = best.sitelinks?.enwiki?.title
        const extract = titel ? await wikiVorspann(titel).catch(() => null) : null
        return { best, labels, extract }
      } catch (e) {
        console.warn('[longform] Hook-Karten:', e)
        return null
      }
    })(),
  ])
  basis.wkn = wkn

  if (wiki) {
    const { best, labels, extract } = wiki
    const jahr = wikidataJahr(best, 'P571') ?? (extract ? wikiJahr(extract) : null)
    founded = karte(jahr ? String(jahr) : null, 'Founded', wikidataJahr(best, 'P571') ? 'Wikidata' : 'Wikipedia')
    const gruender = namen(best, 'P112', labels, 3)
    if (gruender.length > 0 && gruender.length <= 2) founders = karte(gruender.join(' & '), 'Founder', 'Wikidata')
    const stadt = namen(best, 'P159', labels, 1)[0]?.split(',')[0]?.trim() ?? null
    hq = karte(stadt && stadt.length <= 32 ? stadt : null, 'Headquarters', 'Wikidata')
    if (!employees) {
      const n = wikidataMitarbeiter(best)
      employees = karte(n ? kopfzahl(n) : null, 'Employees', 'Wikidata')
    }
    ceo = karte(namen(best, 'P169', labels, 1)[0] ?? null, 'CEO', 'Wikidata')
    const indizes = namen(best, 'P361', labels, 12).map(indexName).filter((x): x is string => !!x)
    const reihe = ['S&P 500', 'Nasdaq-100', 'DAX', 'EURO STOXX 50', 'Nikkei 225', 'FTSE 100']
    index = karte(reihe.find((n) => indizes.includes(n)) ?? null, 'Index', 'Wikidata')
    const ipoJahre = claims(best, 'P793')
      .map((c) => {
        const n = label(labels, qidVonSnak(c.mainsnak))
        if (!n || !/initial public offering|^ipo$/i.test(n)) return null
        return (c.qualifiers?.P585 ?? []).map(zeitVonSnak).find((y) => y != null) ?? null
      })
      .filter((y): y is number => y != null)
    ipo = karte(ipoJahre.length ? String(Math.min(...ipoJahre)) : null, 'IPO', 'Wikidata')
    const spun = namen(best, 'P807', labels, 1)[0]
    const parent = namen(best, 'P749', labels, 1)[0]
    const mutter = [spun, parent].find((n) => n && n.toLowerCase() !== firmenname.toLowerCase() && n.length <= 32)
    herkunft = karte(mutter ?? null, spun && mutter === spun ? 'Spun off from' : 'Parent', 'Wikidata')
    const spruch = claims(best, 'P1451')
      .map((c) => textVonSnak(c.mainsnak))
      .find((t) => t && t.length <= 42 && !t.includes('\n'))
    motto = karte(spruch ?? null, 'Motto', 'Wikidata')
    const boersen = namen(best, 'P414', labels, 8).map(borseKurz).filter((x): x is string => !!x)
    exchange = karte(boersen.includes('NYSE') ? 'NYSE' : boersen.includes('Nasdaq') ? 'Nasdaq' : null, 'Listed', 'Wikidata')
    former = karte(extract ? wikiFrueher(extract) : null, 'Formerly', 'Wikipedia')
  }

  const karten = [founded, founders, hq, employees, ceo, index, ipo, herkunft, motto, karte(glassdoorText, 'Glassdoor', 'Glassdoor'), exchange, former].filter(
    (k): k is LongformHookKarte => k != null,
  )
  return { karten, basis }
}
