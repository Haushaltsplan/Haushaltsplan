import 'server-only'

import {
  baueSecBerichtEintrag,
  ladeSecEdgarBerichteHistorie,
  ladeSecEdgarBerichtVolltext,
} from '@/lib/portfolio-analyse/sec-edgar-filings-server'
import {
  ladeIrFinanzberichteHistorie,
  ladeIrFinanzberichtVolltext,
} from '@/lib/portfolio-analyse/ir-financial-reports-server'
import { zusammenfassungMitMarktkontext } from '@/lib/portfolio-analyse/marktkontext-ki-server'
import {
  ladeSecBerichtKiCacheEintrag,
  ladeSecBerichtKiCacheFuerTicker,
  loescheSecBerichtKiCacheEintrag,
  speichereSecBerichtKiCache,
} from '@/lib/portfolio-analyse/sec-berichte-ki-cache-server'
import { loesePortfolioIsin } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { SEC_BERICHTE_SYSTEM_PROMPT } from '@/lib/portfolio-analyse/sec-berichte-prompt'
import type { SecBerichtAnfrage, SecBerichtEintrag, SecBerichtePaket } from '@/lib/portfolio-analyse/sec-berichte-types'
import { resolveCoachProviderFromMode, runCoachCompletion, earningsCallGeminiModelKandidaten } from '@/lib/ki-coach-backend'

const MAX_REPORT_CHARS = 120_000
const serverCache = new Map<string, { at: number; paket: SecBerichtePaket }>()
const CACHE_MS = 12 * 60 * 60 * 1000
/** Cache-Version — generische 8-K-ER (Periodenende + Scan trotz 424B2-Flut). */
const LIST_CACHE_VERSION = 9

type ListCache = {
  expiresAt: number
  berichte: SecBerichtEintrag[]
  summaries: Map<string, string>
  quelle: 'sec_edgar' | 'ir_pdf'
  texte: Map<string, string>
}

const listCache = new Map<string, ListCache>()

function tickerKey(ticker: string): string {
  return ticker.trim().toUpperCase()
}

function cacheKey(anfrage: SecBerichtAnfrage): string {
  const isin =
    loesePortfolioIsin({
      isin: anfrage.isin,
      ticker: anfrage.ticker,
      firmenname: anfrage.firmenname,
    }) ?? anfrage.isin?.trim().toUpperCase() ?? ''
  return [LIST_CACHE_VERSION, tickerKey(anfrage.ticker), isin].join('|')
}

function leerPaket(ticker: string, fehler?: string): SecBerichtePaket {
  return {
    ok: false,
    ticker,
    berichte: [],
    aktiverBerichtId: null,
    geladenAm: new Date().toISOString(),
    ausCache: false,
    fehler: fehler ?? null,
    hinweis: 'Quartals- und Jahresberichte über SEC EDGAR (US-Melder). EU-Titel: Investor Relations.',
  }
}

function bauePaket(
  ticker: string,
  berichte: SecBerichtEintrag[],
  summaries: Map<string, string>,
  opts: {
    aktiverBerichtId?: string | null
    ausCache?: boolean
    fehler?: string | null
    hinweis?: string | null
  },
): SecBerichtePaket {
  const merged = berichte.map((b) => ({
    ...b,
    zusammenfassung: summaries.get(b.id) ?? b.zusammenfassung ?? null,
  }))
  return {
    ok: merged.length > 0,
    ticker,
    berichte: merged,
    aktiverBerichtId: opts.aktiverBerichtId ?? null,
    geladenAm: new Date().toISOString(),
    ausCache: opts.ausCache ?? false,
    fehler: opts.fehler ?? null,
    hinweis: opts.hinweis ?? null,
  }
}

async function ladePersistenteSummaries(ticker: string, cache: ListCache): Promise<void> {
  const gespeichert = await ladeSecBerichtKiCacheFuerTicker(ticker)
  for (const [berichtId, eintrag] of gespeichert) {
    if (!cache.summaries.has(berichtId)) {
      cache.summaries.set(berichtId, eintrag.zusammenfassung)
    }
  }
}

async function summaryAusPersistenz(
  ticker: string,
  berichtId: string,
  accession: string,
  forceKi?: boolean,
): Promise<string | null> {
  if (forceKi) return null
  const hit = await ladeSecBerichtKiCacheEintrag(ticker, berichtId)
  if (!hit) return null
  if (hit.accession && hit.accession !== accession) {
    await loescheSecBerichtKiCacheEintrag(ticker, berichtId)
    return null
  }
  return hit.zusammenfassung
}

async function ladeBerichteListe(
  ticker: string,
  opts: { force?: boolean; isin?: string | null; firmenname?: string | null; symbolYahoo?: string | null },
): Promise<ListCache> {
  const key = tickerKey(ticker)
  const isin = loesePortfolioIsin({
    isin: opts.isin,
    ticker,
    symbolYahoo: opts.symbolYahoo,
    firmenname: opts.firmenname,
  })
  const listKey = `${LIST_CACHE_VERSION}|${key}|${isin ?? ''}`
  const hit = listCache.get(listKey)
  if (hit && hit.expiresAt > Date.now() && !opts.force) {
    await ladePersistenteSummaries(ticker, hit)
    return hit
  }

  const { cik, berichte, texte } = await ladeSecEdgarBerichteHistorie(ticker)
  if (cik !== 0) {
    const eintraege = berichte.map((f) => {
      const text = texte.get(f.accession)
      return baueSecBerichtEintrag(f, cik, text, false)
    })
    const cache: ListCache = {
      expiresAt: Date.now() + CACHE_MS,
      berichte: eintraege,
      summaries: hit?.summaries ?? new Map(),
      quelle: 'sec_edgar',
      texte,
    }
    await ladePersistenteSummaries(ticker, cache)
    listCache.set(listKey, cache)
    return cache
  }

  const ir = await ladeIrFinanzberichteHistorie({
    ticker,
    isin,
    firmenname: opts.firmenname,
    symbolYahoo: opts.symbolYahoo,
  })
  const cache: ListCache = {
    expiresAt: Date.now() + CACHE_MS,
    berichte: ir.berichte,
    summaries: hit?.summaries ?? new Map(),
    quelle: 'ir_pdf',
    texte: ir.texte,
  }
  await ladePersistenteSummaries(ticker, cache)
  listCache.set(listKey, cache)
  return cache
}

async function zusammenfasseBericht(
  text: string,
  meta: { ticker: string; label: string; formular: string; firmenname?: string | null },
): Promise<string> {
  const provider = resolveCoachProviderFromMode('gemini')
  if (!provider) {
    throw new Error('KI nicht konfiguriert — GEMINI_API_KEY in .env.local setzen.')
  }

  const clipped =
    text.length > MAX_REPORT_CHARS
      ? `${text.slice(0, MAX_REPORT_CHARS)}\n\n[… Bericht gekürzt …]`
      : text

  const userText = [
    `Unternehmen: ${meta.firmenname?.trim() || meta.ticker} (${meta.ticker})`,
    `Bericht: ${meta.label} (${meta.formular})`,
    '',
    '--- SEC-BERICHT ---',
    clipped,
  ].join('\n')

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    SEC_BERICHTE_SYSTEM_PROMPT,
    [{ role: 'user', content: userText }],
    {
      temperature: 0.35,
      skipMessageTrim: true,
      geminiModels: earningsCallGeminiModelKandidaten(),
    },
  )

  if (!result.ok) throw new Error(result.hint)
  const basis = result.reply
  return zusammenfassungMitMarktkontext(basis, {
    ticker: meta.ticker,
    firmenname: meta.firmenname,
    berichtLabel: `${meta.label} (${meta.formular})`,
  })
}

export async function ladeSecBerichte(anfrage: SecBerichtAnfrage): Promise<SecBerichtePaket> {
  const ticker = anfrage.ticker?.trim() ?? ''
  if (!ticker) return leerPaket('', 'Ticker fehlt.')

  const berichtId = anfrage.berichtId?.trim() || null

  if (anfrage.accession?.trim() && !berichtId) {
    const hit = await ladeSecEdgarBerichtVolltext(ticker, anfrage.accession.trim())
    if (!hit) return leerPaket(ticker, 'Bericht nicht gefunden.')
    return {
      ok: true,
      ticker,
      berichte: [{ ...hit.eintrag, textAuszug: hit.text.slice(0, 12_000), textZeichen: hit.text.length, textVollstaendig: true, zusammenfassung: null }],
      aktiverBerichtId: hit.eintrag.id,
      geladenAm: new Date().toISOString(),
      ausCache: false,
      hinweis: null,
    }
  }

  const key = cacheKey(anfrage)
  if (!berichtId && !anfrage.force) {
    const cached = serverCache.get(key)
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return { ...cached.paket, ausCache: true }
    }
  }

  try {
    const cache = await ladeBerichteListe(ticker, {
      force: anfrage.force,
      isin: loesePortfolioIsin({
        isin: anfrage.isin,
        ticker,
        firmenname: anfrage.firmenname,
      }),
      firmenname: anfrage.firmenname,
    })
    const ausCache = !anfrage.force && listCache.has(key)
    const quelleLabel = cache.quelle === 'ir_pdf' ? 'Investor Relations (PDF)' : 'SEC EDGAR'

    if (!berichtId) {
      const paket = bauePaket(ticker, cache.berichte, cache.summaries, {
        ausCache,
        fehler:
          cache.berichte.length === 0
            ? cache.quelle === 'ir_pdf'
              ? 'Keine Finanzberichte auf der IR-Seite gefunden.'
              : 'Keine 10-Q/10-K/Ergebnisberichte bei SEC gefunden.'
            : null,
        hinweis:
          cache.berichte.length > 0
            ? `${quelleLabel} · KI-Analyse beim Öffnen eines Berichts`
            : 'Quartalsberichte ggf. manuell auf der Investor-Relations-Seite.',
      })
      serverCache.set(key, { at: Date.now(), paket })
      return paket
    }

    const meta = cache.berichte.find((b) => b.id === berichtId)
    if (!meta) return leerPaket(ticker, 'Bericht nicht in der Liste.')

    let hitText: string | null = cache.texte.get(meta.accession) ?? null
    let hitEintrag = meta

    if (!hitText || hitText.length < 200) {
      if (cache.quelle === 'sec_edgar') {
        const hit = await ladeSecEdgarBerichtVolltext(ticker, meta.accession)
        if (hit && hit.text.length >= 200) {
          hitText = hit.text
          hitEintrag = { ...meta, ...hit.eintrag }
        }
      } else {
        const hit = await ladeIrFinanzberichtVolltext(meta.accession, meta.url)
        if (hit && hit.text.length >= 200) {
          hitText = hit.text
          hitEintrag = { ...meta, ...hit.eintrag }
          cache.texte.set(meta.accession, hit.text)
        }
      }
    }

    if (!hitText || hitText.length < 200) {
      return {
        ...bauePaket(ticker, cache.berichte, cache.summaries, { aktiverBerichtId: berichtId, ausCache }),
        fehler: 'Volltext konnte nicht geladen werden.',
      }
    }

    cache.berichte = cache.berichte.map((b) =>
      b.id === berichtId
        ? {
            ...b,
            ...hitEintrag,
            textAuszug: hitText!.slice(0, 12_000),
            textZeichen: hitText!.length,
            textVollstaendig: true,
            zusammenfassung: cache.summaries.get(berichtId) ?? b.zusammenfassung,
          }
        : b,
    )

    if (!cache.summaries.has(berichtId) || anfrage.forceKi) {
      const cached = await summaryAusPersistenz(ticker, berichtId, meta.accession, anfrage.forceKi)
      if (cached) {
        cache.summaries.set(berichtId, cached)
      } else {
        try {
          const summary = await zusammenfasseBericht(hitText, {
            ticker,
            label: meta.label,
            formular: meta.formular,
            firmenname: anfrage.firmenname,
          })
          cache.summaries.set(berichtId, summary)
          try {
            await speichereSecBerichtKiCache({
              ticker,
              berichtId,
              accession: meta.accession,
              zusammenfassung: summary,
            })
          } catch (persistErr) {
            console.warn('SEC-Berichte KI-Cache nicht schreibbar', persistErr)
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'KI-Zusammenfassung fehlgeschlagen'
          return {
            ...bauePaket(ticker, cache.berichte, cache.summaries, {
              aktiverBerichtId: berichtId,
              ausCache,
              hinweis: `${quelleLabel} · KI-Analyse beim Öffnen eines Berichts`,
            }),
            ok: true,
            fehler: msg,
          }
        }
      }
    }

    const paket = bauePaket(ticker, cache.berichte, cache.summaries, {
      aktiverBerichtId: berichtId,
      ausCache,
      hinweis: `${quelleLabel} · KI-Analyse (Gemini)`,
    })
    serverCache.set(key, { at: Date.now(), paket })
    return paket
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Bericht-Abruf fehlgeschlagen'
    return leerPaket(ticker, msg)
  }
}
