/**
 * Patch: fehlendes Eigenkapital/Goodwill/Forderungen aus Macrotrends-Bilanz
 * in bestehende Cache-Pakete mergen (1 URL/Ticker statt Full-Scrape).
 *
 * npx tsx --conditions=react-server scripts/repair-fundamental-cache.mts
 */
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
require('./mock-server-only.cjs')

import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i < 1) continue
  const k = t.slice(0, i).trim()
  let v = t.slice(i + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(k in process.env)) process.env[k] = v
}
process.env.MACROTRENDS_RELAY_URL = 'http://127.0.0.1:8787'

const logPath = '.cache/repair-progress.jsonl'
fs.writeFileSync(logPath, '')
function log(obj: unknown) {
  const line = typeof obj === 'string' ? obj : JSON.stringify(obj)
  fs.appendFileSync(logPath, line + '\n')
  console.log(line)
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const { baueKontextWerte } = await import('../lib/portfolio-analyse/fundamentaldaten-kontext-werte.ts')
const {
  korrigiereEffizienzKeyMetrics,
  korrigiereFwdWachstumKeyMetrics,
  schaetzungenRohAusPaket,
} = await import('../lib/portfolio-analyse/fundamentaldaten-key-metrics.ts')
const { ergaenzeFcfRenditeKeyMetrics, ergaenzeFcfRenditeZeilen } = await import(
  '../lib/portfolio-analyse/fundamentaldaten-fcf-rendite-zeilen.ts'
)
const { ergaenzeMargenZeilen } = await import('../lib/portfolio-analyse/fundamentaldaten-margen-zeilen.ts')
const { ergaenzeRoicAusBilanz } = await import('../lib/portfolio-analyse/fundamentaldaten-roic-berechnung.ts')
const {
  periodenOhneLeereSchaetzungen,
  bereinigeSchaetzungsniveausInZeilen,
} = await import('../lib/portfolio-analyse/fundamentaldaten-format.ts')
const { FUNDAMENTALDATEN_CACHE_VERSION, fundamentaldatenFingerprint } = await import(
  '../lib/portfolio-analyse/fundamentaldaten-paket-cache-server.ts'
)
const { markMacrotrendsBrowserRequired } = await import(
  '../lib/portfolio-analyse/macrotrends-browser-auth-server.ts'
)
const {
  ladeMacrotrendsStatementSerien,
  loeseMacrotrendsIdent,
} = await import('../lib/portfolio-analyse/macrotrends-scraper-server.ts')
const { isinKenntnis } = await import('../lib/portfolio-analyse/isin-kenntnisse.ts')

function histCount(paket: { perioden: any[]; zeilen: any[] }, id: string): number {
  const z = paket.zeilen.find((r: any) => r.id === id)
  if (!z) return 0
  const hist = paket.perioden.filter((p: any) => !p.istSchaetzung && !p.istNtm && !p.istLtm)
  let n = 0
  for (const p of hist) {
    const v = z.werte[p.iso]
    if (v != null && Number.isFinite(v)) n++
  }
  return n
}

function korrigierePaket(paket: any) {
  if (!paket?.ok) return paket
  const zeilen = bereinigeSchaetzungsniveausInZeilen(paket.perioden, structuredClone(paket.zeilen))
  ergaenzeFcfRenditeZeilen(paket.perioden, zeilen)
  ergaenzeMargenZeilen(paket.perioden, zeilen)
  ergaenzeRoicAusBilanz(paket.perioden, zeilen)
  const perioden = periodenOhneLeereSchaetzungen(paket.perioden, zeilen)
  const cleaned = { ...paket, perioden, zeilen }
  const schaetz = schaetzungenRohAusPaket(cleaned)
  const kontext = baueKontextWerte({
    yahoo: null,
    roh: { perioden: cleaned.perioden, zeilen: cleaned.zeilen },
    schaetzungen: schaetz,
    yahooFinanz: null,
  })
  return {
    ...cleaned,
    keyMetrics: korrigiereEffizienzKeyMetrics(
      ergaenzeFcfRenditeKeyMetrics(
        korrigiereFwdWachstumKeyMetrics(cleaned.keyMetrics ?? [], schaetz, cleaned),
        cleaned,
      ),
      cleaned,
      kontext,
    ),
  }
}

const SLUG_TO_ID: Array<{ slugs: string[]; id: string; label: string; einheit: string }> = [
  {
    slugs: ['total-share-holder-equity', 'total-stockholder-equity', 'total-stockholders-equity'],
    id: 'eigenkapital',
    label: 'Eigenkapital',
    einheit: 'waehrung_usd_mio',
  },
  {
    slugs: ['goodwill', 'goodwill-intangible-assets-total'],
    id: 'goodwill',
    label: 'Goodwill',
    einheit: 'waehrung_usd_mio',
  },
  {
    slugs: ['receivables-total', 'net-receivables'],
    id: 'forderungen',
    label: 'Forderungen (netto)',
    einheit: 'waehrung_usd_mio',
  },
  {
    slugs: ['total-assets'],
    id: 'gesamtvermoegen',
    label: 'Gesamtvermögen',
    einheit: 'waehrung_usd_mio',
  },
  {
    slugs: ['total-liabilities'],
    id: 'gesamtverbindlichkeiten',
    label: 'Gesamtverbindlichkeiten',
    einheit: 'waehrung_usd_mio',
  },
  {
    slugs: ['cash-on-hand'],
    id: 'bargeld',
    label: 'Bargeld & Äquivalente',
    einheit: 'waehrung_usd_mio',
  },
  {
    slugs: ['long-term-debt', 'total-debt'],
    id: 'gesamtverschuldung',
    label: 'Langfristige Schulden (Macrotrends-Fallback)',
    einheit: 'waehrung_usd_mio',
  },
  {
    slugs: ['total-current-assets'],
    id: 'umlaufvermoegen',
    label: 'Umlaufvermögen',
    einheit: 'waehrung_usd_mio',
  },
  {
    slugs: ['total-current-liabilities'],
    id: 'kurzfrist_verbindl',
    label: 'Kurzfristige Verbindlichkeiten',
    einheit: 'waehrung_usd_mio',
  },
]

function mergeSerieIntoPaket(paket: any, id: string, label: string, einheit: string, serie: Map<string, number>) {
  let z = paket.zeilen.find((r: any) => r.id === id)
  if (!z) {
    z = { id, label, gruppe: 'bilanz', einheit, werte: {} }
    paket.zeilen.push(z)
  }
  for (const [iso, v] of serie) {
    if (v != null && Number.isFinite(v)) z.werte[iso] = v
  }
}

const { data: rows, error } = await sb
  .from('fundamentaldaten_paket_cache')
  .select('cache_key,paket_json,isin,ticker,frequenz')
  .like('cache_key', '%|jahr')
if (error) {
  log({ error: error.message })
  process.exit(1)
}

markMacrotrendsBrowserRequired()

const needBs: typeof rows = []
let fixedOnly = 0
for (const row of rows ?? []) {
  const ek = histCount(row.paket_json, 'eigenkapital')
  const umsatz = histCount(row.paket_json, 'umsatz')
  if (umsatz >= 6 && ek < 4) {
    needBs.push(row)
  } else if (umsatz >= 6 && ek >= 4) {
    const after = korrigierePaket(structuredClone(row.paket_json))
    await sb.from('fundamentaldaten_paket_cache').upsert(
      {
        cache_key: row.cache_key,
        isin: row.isin,
        ticker: row.ticker,
        frequenz: 'jahr',
        cache_version: FUNDAMENTALDATEN_CACHE_VERSION,
        fingerprint: fundamentaldatenFingerprint(after),
        paket_json: after,
        aktualisiert_am: new Date().toISOString(),
      },
      { onConflict: 'cache_key' },
    )
    fixedOnly++
  }
}
log({ phase: 'effizienz-only', fixedOnly, needBs: needBs.length })

let patched = 0
let failed = 0

for (let i = 0; i < needBs.length; i++) {
  const row = needBs[i]!
  const paket = structuredClone(row.paket_json)
  const ticker =
    (paket.ticker || row.ticker || '').toString().trim().toUpperCase() ||
    row.cache_key.split('|')[0]!
  const isin = (row.isin || row.cache_key.split('|')[0] || '').toString()
  const ken = isin.length >= 12 ? isinKenntnis(isin) : null
  const slugHint =
    ken?.macrotrendsSlug?.trim() ||
    (typeof paket.slug === 'string' ? paket.slug.trim() : '') ||
    undefined
  try {
    let ident =
      (await loeseMacrotrendsIdent(ken?.macrotrendsTicker ?? ticker, {
        erwarteterTicker: ken?.macrotrendsTicker ?? ticker,
        firmenname: ken?.name ?? paket.firmenname ?? ticker,
        slug: slugHint,
      })) ?? null
    // Ohne Suche: Ticker+Slug aus Paket (Search-Seiten erzeugen oft Relay-502)
    if (!ident && slugHint) {
      ident = {
        ticker: (ken?.macrotrendsTicker ?? ticker).toUpperCase(),
        slug: slugHint,
        firmenname: ken?.name ?? paket.firmenname ?? ticker,
      }
    }
    if (!ident && /^[A-Z]{1,5}$/.test(ticker)) {
      // last resort: slug = lower ticker (funktioniert für MSFT/MA/… oft nicht, aber besser als Suche)
      ident = null
    }
    if (!ident) {
      failed++
      log({ key: row.cache_key, ok: false, reason: 'kein-ident', ticker })
      continue
    }
    const serien = await ladeMacrotrendsStatementSerien(ident, 'balance-sheet', 'jahr')
    if (!serien || serien.size === 0) {
      failed++
      log({ key: row.cache_key, ticker: ident.ticker, ok: false, reason: 'bs-leer' })
      continue
    }
    for (const def of SLUG_TO_ID) {
      let hit: Map<string, number> | null = null
      for (const s of def.slugs) {
        if (serien.has(s)) {
          hit = serien.get(s)!
          break
        }
      }
      if (hit) mergeSerieIntoPaket(paket, def.id, def.label, def.einheit, hit)
    }

    const after = korrigierePaket(paket)
    const ek = histCount(after, 'eigenkapital')
    if (ek < 4) {
      failed++
      log({ key: row.cache_key, ticker: ident.ticker, ok: false, ek, reason: 'ek-noch-duenn' })
      continue
    }
    await sb.from('fundamentaldaten_paket_cache').upsert(
      {
        cache_key: row.cache_key,
        isin: row.isin ?? (isin.length >= 12 ? isin : null),
        ticker: ident.ticker,
        frequenz: 'jahr',
        cache_version: FUNDAMENTALDATEN_CACHE_VERSION,
        fingerprint: fundamentaldatenFingerprint(after),
        paket_json: after,
        aktualisiert_am: new Date().toISOString(),
      },
      { onConflict: 'cache_key' },
    )
    patched++
    const km = (id: string) => after.keyMetrics?.find((m: any) => m.id === id)?.wert
    log({
      key: row.cache_key,
      ticker: ident.ticker,
      ok: true,
      ek,
      brutto: km('ltm_brutto'),
      roic: km('ltm_roic'),
      roicX: km('ltm_roic_ex_gw'),
      rev3: km('rev_cagr_3y'),
    })
  } catch (e) {
    failed++
    log({ key: row.cache_key, ok: false, error: e instanceof Error ? e.message : String(e) })
  }
  await new Promise((r) => setTimeout(r, 400))
}

log({ done: true, fixedOnly, patched, failed, totalNeedBs: needBs.length })
process.exit(failed > needBs.length * 0.3 ? 1 : 0)
