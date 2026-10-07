/**
 * Investment-Journal KI: Auto-Fill (leere Felder) + Quartals-Gegenprüfung.
 * GEMINI_API_KEY_FREE — kein Billing-Flag.
 */

import 'server-only'

import {
  geminiFreeTierFlashModelKandidaten,
  resolveGeminiFreeTierProvider,
  runCoachCompletion,
} from '@/lib/ki-coach-backend'
import { ladeDepotRadarAktien } from '@/lib/portfolio-analyse/depot-gewichte-server'
import { ladeEarningsCallKiCacheFuerTicker } from '@/lib/portfolio-analyse/earnings-call-unternehmen-cache-server'
import { ladeFundamentaldatenPaketCacheFuerAnfrage } from '@/lib/portfolio-analyse/fundamentaldaten-paket-cache-server'
import type { FundamentalKeyMetric, FundamentaldatenPaket } from '@/lib/portfolio-analyse/fundamentaldaten-types'
import {
  ladeAktivenJournalEintrag,
  ladeJournalEintraege,
  speichereJournalEintrag,
  speichereJournalGegenpruefung,
} from '@/lib/portfolio-analyse/investment-journal-server'
import {
  JOURNAL_FILL_JSON_SCHEMA,
  JOURNAL_FILL_SYSTEM_PROMPT,
  JOURNAL_GEGENPRUEFUNG_JSON_SCHEMA,
  JOURNAL_GEGENPRUEFUNG_SYSTEM_PROMPT,
  JOURNAL_PRIORITAET_METRIC_IDS,
} from '@/lib/portfolio-analyse/investment-journal-prompts'
import type {
  JournalAutoFillErgebnis,
  JournalEintrag,
  JournalGegenpruefungBatchErgebnis,
  JournalGegenpruefungStatus,
} from '@/lib/portfolio-analyse/investment-journal-types'
import { ladeAlleQuartalsKiDiffAusCloud } from '@/lib/portfolio-analyse/quartals-ki-diff-cache-server'
import { ladeSecBerichtKiCacheFuerTicker } from '@/lib/portfolio-analyse/sec-berichte-ki-cache-server'

const PAUSE_MS = 900

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function tickerAusDepot(symbolYahoo: string | null, candidates: string[], isin: string): string {
  const sym = (symbolYahoo || candidates[0] || '').trim().toUpperCase()
  if (sym) return sym
  return isin.trim().toUpperCase()
}

function parseJsonObject(reply: string): Record<string, unknown> | null {
  const cleaned = reply
    .replace(/^\uFEFF/, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  try {
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
      } catch {
        return null
      }
    }
    return null
  }
}

function formatMetricWert(m: FundamentalKeyMetric): string {
  if (m.zahl != null && Number.isFinite(m.zahl)) {
    return m.wert?.trim() || m.zahl.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  }
  if (m.wert != null && String(m.wert).trim() !== '') return String(m.wert)
  return '—'
}

function priorisiereKeyMetrics(metriken: FundamentalKeyMetric[]): FundamentalKeyMetric[] {
  const prio = new Map(JOURNAL_PRIORITAET_METRIC_IDS.map((id, i) => [id, i]))
  const scored = metriken
    .filter((m) => (m.wert != null && String(m.wert).trim() !== '') || m.zahl != null)
    .map((m, idx) => {
      const id = String(m.id ?? '').toLowerCase()
      let rank = prio.get(id as (typeof JOURNAL_PRIORITAET_METRIC_IDS)[number])
      if (rank == null) {
        for (const [pid, r] of prio) {
          if (id.includes(pid) || id.includes(pid.replace(/_/g, ''))) {
            rank = r + 50
            break
          }
        }
      }
      return { m, rank: rank ?? 200 + idx }
    })
  scored.sort((a, b) => a.rank - b.rank)
  const top = scored.slice(0, 28).map((x) => x.m)
  if (top.length < 12) {
    for (const m of metriken) {
      if (top.length >= 20) break
      if (!top.some((t) => t.id === m.id) && (m.wert != null || m.zahl != null)) top.push(m)
    }
  }
  return top
}

function keyMetricsBlock(metriken: FundamentalKeyMetric[]): string {
  const top = priorisiereKeyMetrics(metriken)
  if (!top.length) return ''
  const zeilen = top.map((m) => {
    const gruppe = m.gruppe ? ` [${m.gruppe}]` : ''
    return `- ${m.label ?? m.id}${gruppe}: ${formatMetricWert(m)} (id=${m.id})`
  })
  return `### Key Metrics (Anker — exakt so zitieren)\n${zeilen.join('\n')}`
}

function mantraBlock(paket: FundamentaldatenPaket): string {
  const mantra = paket.mantra
  if (!mantra) return ''
  const z = mantra.zusammenfassung
  const teile = [
    `### Mantra / Quality-Audit`,
    `Anker: ${mantra.anker ?? '—'}`,
    `Ampel: ${mantra.ampel ?? '—'} (${mantra.ampelHinweis ?? '—'})`,
    z
      ? `Scorecard: erfüllt ${z.erfuellt}, nicht erfüllt ${z.nichtErfuellt}, keine Daten ${z.keineDaten}, qualitativ ${z.qualitativ}`
      : null,
  ].filter(Boolean) as string[]

  const checks = [...(mantra.standard ?? []), ...(mantra.sektor ?? [])]
    .filter((c) => c.status === 'erfuellt' || c.status === 'nicht_erfuellt')
    .slice(0, 10)
  for (const c of checks) {
    teile.push(
      `- [${c.status}] ${c.kennzahl}: ${c.istWert ?? '—'} (Ziel ${c.zielwert}) — ${(c.hinweis ?? '').slice(0, 180)}`,
    )
  }
  return teile.join('\n')
}

async function ladePaket(opts: {
  ticker: string
  isin: string
  name: string
  symbolYahoo: string | null
}): Promise<FundamentaldatenPaket | null> {
  try {
    const hit = await ladeFundamentaldatenPaketCacheFuerAnfrage({
      isin: opts.isin,
      symbolYahoo: opts.symbolYahoo ?? opts.ticker,
      name: opts.name,
      frequenz: 'jahr',
      tickerOverride: opts.ticker,
    })
    return hit?.paket ?? null
  } catch {
    return null
  }
}

async function baueFillKontext(opts: {
  ticker: string
  isin: string
  name: string
  symbolYahoo: string | null
}): Promise<string> {
  const teile: string[] = [
    `### Stammdaten`,
    `Ticker: ${opts.ticker}`,
    `Name: ${opts.name}`,
    `ISIN: ${opts.isin}`,
  ]

  const p = await ladePaket(opts)
  if (p) {
    teile.push(`Branche: ${p.branche ?? '—'} · Sektor: ${p.sektor ?? '—'}`)
    if (p.beschreibung) teile.push(`### Profil\n${p.beschreibung.slice(0, 1_200)}`)
    const km = keyMetricsBlock(p.keyMetrics ?? [])
    if (km) teile.push(km)
    const man = mantraBlock(p)
    if (man) teile.push(man)

    // Wichtige Jahreszeilen als Zusatz-Anker
    const zeilen = (p.zeilen ?? []).filter((z) =>
      /^(umsatz|eps|fcf|ebit|roic|bruttomarge|ebit_marge|fcf_marge)$/i.test(z.id),
    )
    if (zeilen.length && p.perioden?.length) {
      const letzte = p.perioden.filter((per) => !per.istSchaetzung && !per.istNtm).slice(-4)
      const kompakt = zeilen.slice(0, 8).map((z) => {
        const vals = letzte
          .map((per) => {
            const key = per.iso
            const v = z.werte?.[key]
            return v != null ? `${per.label}=${Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2 })}` : null
          })
          .filter(Boolean)
        return vals.length ? `- ${z.label ?? z.id}: ${vals.join(', ')}` : null
      })
      const lines = kompakt.filter(Boolean)
      if (lines.length) teile.push(`### Historische Reihe (letzte Jahre)\n${lines.join('\n')}`)
    }
  } else {
    teile.push('Hinweis: Kein Fundamentaldaten-Cache — nur Stammdaten. Nur schreiben, was belegbar ist.')
  }

  return teile.join('\n\n')
}

async function baueGegenpruefungKontext(opts: {
  ticker: string
  isin: string | null
  name: string
}): Promise<{
  text: string
  quartalHint: string
  hatDaten: boolean
}> {
  const teile: string[] = []
  let quartalHint = ''
  let hatDaten = false

  // Aktuelle Key Metrics zum Zahlenvergleich (Anker vs. jetzt)
  const paket = await ladePaket({
    ticker: opts.ticker,
    isin: opts.isin || '',
    name: opts.name,
    symbolYahoo: opts.ticker,
  })
  if (paket) {
    const km = keyMetricsBlock(paket.keyMetrics ?? [])
    if (km) {
      hatDaten = true
      teile.push(`### Aktuelle Key Metrics (Vergleichsbasis zum Journal)\n${km.replace('### Key Metrics (Anker — exakt so zitieren)\n', '')}`)
    }
  }

  try {
    const earn = await ladeEarningsCallKiCacheFuerTicker(opts.ticker)
    const rows = [...earn.entries()].sort((a, b) =>
      String(b[1].aktualisiertAm).localeCompare(String(a[1].aktualisiertAm)),
    )
    for (const [id, row] of rows.slice(0, 3)) {
      hatDaten = true
      if (!quartalHint) quartalHint = id
      teile.push(
        `### Earnings ${id}\nAktualisiert: ${row.aktualisiertAm}\nSentiment: ${row.sentimentScore ?? '—'}\n${row.zusammenfassung.slice(0, 5_500)}`,
      )
    }
  } catch {
    /* ignore */
  }

  try {
    const sec = await ladeSecBerichtKiCacheFuerTicker(opts.ticker)
    const rows = [...sec.entries()].sort((a, b) =>
      String(b[1].aktualisiertAm).localeCompare(String(a[1].aktualisiertAm)),
    )
    for (const [id, row] of rows.slice(0, 2)) {
      hatDaten = true
      teile.push(`### SEC/IR ${id}\n${row.zusammenfassung.slice(0, 3_500)}`)
    }
  } catch {
    /* ignore */
  }

  try {
    const diffs = (await ladeAlleQuartalsKiDiffAusCloud())
      .filter((d) => d.ticker.trim().toUpperCase() === opts.ticker.trim().toUpperCase())
      .sort((a, b) => String(b.aktualisiertAm).localeCompare(String(a.aktualisiertAm)))
    for (const d of diffs.slice(0, 3)) {
      hatDaten = true
      teile.push(
        `### Quartals-Diff ${d.typ} · ${d.aktuellId} vs ${d.vorherId}\n${d.diff.slice(0, 3_000)}`,
      )
    }
  } catch {
    /* ignore */
  }

  return {
    text: teile.join('\n\n') || 'Keine Earnings-/SEC-/Diff-/Metric-Daten im Cache.',
    quartalHint: quartalHint || 'aktuell',
    hatDaten,
  }
}

function normalisiereWatchpoints(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith('-') || l.startsWith('•') ? l.replace(/^•\s*/, '- ') : `- ${l}`))
  return lines.slice(0, 6).join('\n')
}

export async function generiereJournalFelder(opts: {
  ticker: string
  name: string
  kontext: string
}): Promise<{ these: string; kaufgrund: string; watchpoints: string; kiModell: string }> {
  const provider = resolveGeminiFreeTierProvider()
  if (!provider) throw new Error('GEMINI_API_KEY_FREE fehlt')

  // Nur 3.8: 3.5-flash antwortet oft stundenlang mit 503 „high demand“ und
  // überschreibt dann die eigentliche Ursache (Timeout/Denk-Budget auf 3.8).
  const models = [geminiFreeTierFlashModelKandidaten()[0]!]

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    JOURNAL_FILL_SYSTEM_PROMPT,
    [
      {
        role: 'user',
        content: [
          `Unternehmen: ${opts.name} (${opts.ticker})`,
          '',
          'KONTEXT:',
          opts.kontext,
          '',
          'Erzeuge jetzt das Journal-JSON (these, kaufgrund, watchpoints) nach den Quality-Compounder-Regeln — mit festen Ankerzahlen aus den Key Metrics.',
        ].join('\n'),
      },
    ],
    {
      geminiModels: models,
      geminiForceFreeApiKey: true,
      jsonResponse: { schema: JOURNAL_FILL_JSON_SCHEMA },
      maxOutputTokens: 8192,
      thinkingMinimal: true,
      timeoutMs: 90_000,
      geminiTotalBudgetMs: 120_000,
    },
  )

  if (!result.ok) throw new Error(result.hint || 'KI-Fill fehlgeschlagen')
  const parsed = parseJsonObject(result.reply)
  if (!parsed) throw new Error('KI-Fill: ungültiges JSON')

  const these = String(parsed.these ?? '').trim()
  const kaufgrund = String(parsed.kaufgrund ?? '').trim()
  const watchpoints = normalisiereWatchpoints(String(parsed.watchpoints ?? '').trim())

  // Teilweise Antworten trotzdem nutzen (besser als Totalausfall)
  if (!these && !kaufgrund && !watchpoints) {
    throw new Error('KI-Fill: leere Antwort')
  }
  if (!these || !kaufgrund || !watchpoints) {
    console.warn(
      `[journal/fill] ${opts.ticker}: unvollständig these=${these.length} kg=${kaufgrund.length} wp=${watchpoints.length}`,
    )
  }

  return {
    these: these.slice(0, 4_000),
    kaufgrund: kaufgrund.slice(0, 3_000),
    watchpoints: watchpoints.slice(0, 3_000),
    kiModell: result.model || models[0] || 'gemini',
  }
}

export async function generiereJournalGegenpruefung(opts: {
  eintrag: JournalEintrag
  earningsKontext: string
  quartalHint: string
}): Promise<{
  status: JournalGegenpruefungStatus
  fazit: string
  quartalLabel: string
  details: Record<string, unknown>
  kiModell: string
}> {
  const provider = resolveGeminiFreeTierProvider()
  if (!provider) throw new Error('GEMINI_API_KEY_FREE fehlt')

  const models = [geminiFreeTierFlashModelKandidaten()[0]!]

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    JOURNAL_GEGENPRUEFUNG_SYSTEM_PROMPT,
    [
      {
        role: 'user',
        content: [
          `Ticker: ${opts.eintrag.ticker} (${opts.eintrag.name})`,
          '',
          '### Journal — These',
          opts.eintrag.these || '(leer)',
          '',
          '### Journal — Kaufgrund',
          opts.eintrag.kaufgrund || '(leer)',
          '',
          '### Journal — Watchpoints (Schwellen)',
          opts.eintrag.watchpoints || '(leer)',
          '',
          `### Update-Kontext (Quartals-/Earnings/Metrics, Hinweis: ${opts.quartalHint})`,
          opts.earningsKontext.slice(0, 32_000),
          '',
          'Prüfe Ankerzahlen und Watchpoints streng nach Status-Kalibrierung. Antworte als JSON.',
        ].join('\n'),
      },
    ],
    {
      geminiModels: models,
      geminiForceFreeApiKey: true,
      jsonResponse: { schema: JOURNAL_GEGENPRUEFUNG_JSON_SCHEMA },
      maxOutputTokens: 8192,
      thinkingMinimal: true,
      timeoutMs: 90_000,
      geminiTotalBudgetMs: 120_000,
    },
  )

  if (!result.ok) throw new Error(result.hint || 'Gegenprüfung fehlgeschlagen')
  const parsed = parseJsonObject(result.reply)
  if (!parsed) throw new Error('Gegenprüfung: ungültiges JSON')

  const statusRaw = String(parsed.status ?? '')
    .toLowerCase()
    .trim()
  const status: JournalGegenpruefungStatus =
    statusRaw === 'intakt' || statusRaw.includes('intakt')
      ? 'intakt'
      : statusRaw === 'beschaedigt' ||
          statusRaw.includes('beschädig') ||
          statusRaw.includes('beschaedig') ||
          statusRaw.includes('broken')
        ? 'beschaedigt'
        : 'unter_beobachtung'

  const fazit = String(parsed.fazit ?? '').trim()
  if (!fazit) throw new Error('Gegenprüfung: leeres Fazit')

  return {
    status,
    fazit: fazit.slice(0, 6_000),
    quartalLabel:
      String(parsed.quartalLabel ?? opts.quartalHint).trim().slice(0, 80) || opts.quartalHint,
    details: {
      watchpointTreffer: Array.isArray(parsed.watchpointTreffer)
        ? parsed.watchpointTreffer.map((x) => String(x).slice(0, 280)).slice(0, 12)
        : [],
      belege: Array.isArray(parsed.belege)
        ? parsed.belege.map((x) => String(x).slice(0, 320)).slice(0, 12)
        : [],
      ankerVergleiche: Array.isArray(parsed.ankerVergleiche)
        ? parsed.ankerVergleiche.map((x) => String(x).slice(0, 280)).slice(0, 12)
        : [],
    },
    kiModell: result.model || models[0] || 'gemini',
  }
}

export async function batchJournalAutoFill(opts?: {
  ticker?: string
  isin?: string
  name?: string
}): Promise<{ ergebnisse: JournalAutoFillErgebnis[]; zusammenfassung: string }> {
  const depot = await ladeDepotRadarAktien()
  const filterTicker = opts?.ticker?.trim().toUpperCase()
  const filterIsin = opts?.isin?.trim().toUpperCase()

  let kandidaten = depot.map((d) => ({
    isin: d.isin,
    name: d.name,
    symbolYahoo: d.symbolYahoo,
    ticker: tickerAusDepot(d.symbolYahoo, d.symbolCandidates, d.isin),
  }))

  if (filterTicker || filterIsin) {
    kandidaten = kandidaten.filter(
      (d) =>
        (filterTicker && (d.ticker === filterTicker || d.isin === filterTicker)) ||
        (filterIsin && d.isin === filterIsin),
    )
    // Scoped-Fill auch ohne Depot-Treffer (Übersicht einzelner Titel)
    if (kandidaten.length === 0 && filterTicker) {
      kandidaten = [
        {
          isin: filterIsin || filterTicker,
          name: opts?.name?.trim() || filterTicker,
          symbolYahoo: filterTicker,
          ticker: filterTicker,
        },
      ]
    }
  }

  const ergebnisse: JournalAutoFillErgebnis[] = []

  for (let i = 0; i < kandidaten.length; i++) {
    const k = kandidaten[i]!
    try {
      const bestehend = await ladeAktivenJournalEintrag(k.ticker)
      const theseVoll = Boolean(bestehend?.these?.trim())
      const kgVoll = Boolean(bestehend?.kaufgrund?.trim())
      const wpVoll = Boolean(bestehend?.watchpoints?.trim())
      if (theseVoll && kgVoll && wpVoll) {
        ergebnisse.push({
          ticker: k.ticker,
          name: k.name,
          status: 'uebersprungen',
          message: 'Alle Felder bereits befüllt',
          eintrag: bestehend ?? undefined,
        })
        continue
      }

      const kontext = await baueFillKontext({
        ticker: k.ticker,
        isin: k.isin,
        name: k.name,
        symbolYahoo: k.symbolYahoo,
      })
      const felder = await generiereJournalFelder({
        ticker: k.ticker,
        name: k.name,
        kontext,
      })
      if (!felder.these.trim() && !felder.kaufgrund.trim() && !felder.watchpoints.trim()) {
        throw new Error('KI lieferte leere Felder')
      }
      const eintrag = await speichereJournalEintrag({
        id: bestehend?.id,
        ticker: k.ticker,
        isin: k.isin,
        name: k.name,
        nurLeereFuellen: true,
        fuelle: felder,
        status: 'aktiv',
      })
      ergebnisse.push({
        ticker: k.ticker,
        name: k.name,
        status: 'befuellt',
        eintrag: eintrag ?? undefined,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[journal/auto-fill] ${k.ticker}:`, msg)
      ergebnisse.push({
        ticker: k.ticker,
        name: k.name,
        status: 'fehler',
        message: msg,
      })
    }
    if (i < kandidaten.length - 1) await sleep(PAUSE_MS)
  }

  const nOk = ergebnisse.filter((e) => e.status === 'befuellt').length
  const nSkip = ergebnisse.filter((e) => e.status === 'uebersprungen').length
  const nErr = ergebnisse.filter((e) => e.status === 'fehler').length
  const errDetail =
    nErr > 0
      ? ergebnisse
          .filter((e) => e.status === 'fehler')
          .slice(0, 3)
          .map((e) => `${e.ticker}: ${e.message || 'Fehler'}`)
          .join(' · ')
      : ''
  return {
    ergebnisse,
    zusammenfassung:
      `${nOk} befüllt · ${nSkip} übersprungen · ${nErr} Fehler (von ${kandidaten.length})` +
      (errDetail ? ` — ${errDetail}` : ''),
  }
}

export async function batchJournalGegenpruefung(opts?: {
  ticker?: string
}): Promise<{ ergebnisse: JournalGegenpruefungBatchErgebnis[]; zusammenfassung: string }> {
  const depot = await ladeDepotRadarAktien()
  const depotTickers = new Set(
    depot.map((d) => tickerAusDepot(d.symbolYahoo, d.symbolCandidates, d.isin)),
  )
  const depotByTicker = new Map(
    depot.map((d) => [tickerAusDepot(d.symbolYahoo, d.symbolCandidates, d.isin), d]),
  )

  const filterTicker = opts?.ticker?.trim().toUpperCase()
  let eintraege = (await ladeJournalEintraege()).filter((e) => e.status === 'aktiv')
  if (filterTicker) {
    eintraege = eintraege.filter((e) => e.ticker === filterTicker)
  } else {
    eintraege = eintraege.filter((e) => depotTickers.has(e.ticker))
  }

  if (!filterTicker) {
    for (const d of depot) {
      const t = tickerAusDepot(d.symbolYahoo, d.symbolCandidates, d.isin)
      if (eintraege.some((e) => e.ticker === t)) continue
      const neu = await speichereJournalEintrag({
        ticker: t,
        isin: d.isin,
        name: d.name,
        these: '',
        kaufgrund: '',
        watchpoints: '',
        status: 'aktiv',
      })
      if (neu) eintraege.push(neu)
    }
  }

  const ergebnisse: JournalGegenpruefungBatchErgebnis[] = []

  for (let i = 0; i < eintraege.length; i++) {
    const e = eintraege[i]!
    const name = e.name || depotByTicker.get(e.ticker)?.name || e.ticker
    try {
      if (!e.these.trim() && !e.watchpoints.trim()) {
        ergebnisse.push({
          ticker: e.ticker,
          name,
          status: 'uebersprungen',
          message: 'These/Watchpoints leer — zuerst befüllen',
        })
        continue
      }

      const { text, quartalHint, hatDaten } = await baueGegenpruefungKontext({
        ticker: e.ticker,
        isin: e.isin,
        name,
      })
      if (!hatDaten) {
        ergebnisse.push({
          ticker: e.ticker,
          name,
          status: 'uebersprungen',
          message: 'Keine Quartals-/Earnings-/Metric-Daten im Cache',
        })
        continue
      }

      const gp = await generiereJournalGegenpruefung({
        eintrag: e,
        earningsKontext: text,
        quartalHint,
      })
      const gespeichert = await speichereJournalGegenpruefung({
        journalId: e.id,
        ticker: e.ticker,
        isin: e.isin,
        quartalLabel: gp.quartalLabel,
        status: gp.status,
        fazit: gp.fazit,
        details: gp.details,
        kiModell: gp.kiModell,
      })
      ergebnisse.push({
        ticker: e.ticker,
        name,
        status: 'geprueft',
        gegenpruefung: gespeichert,
      })
    } catch (err) {
      ergebnisse.push({
        ticker: e.ticker,
        name,
        status: 'fehler',
        message: err instanceof Error ? err.message : String(err),
      })
    }
    if (i < eintraege.length - 1) await sleep(PAUSE_MS)
  }

  const nOk = ergebnisse.filter((x) => x.status === 'geprueft').length
  const nSkip = ergebnisse.filter((x) => x.status === 'uebersprungen').length
  const nErr = ergebnisse.filter((x) => x.status === 'fehler').length
  const errDetail =
    nErr > 0
      ? ergebnisse
          .filter((e) => e.status === 'fehler')
          .slice(0, 3)
          .map((e) => `${e.ticker}: ${e.message || 'Fehler'}`)
          .join(' · ')
      : ''
  return {
    ergebnisse,
    zusammenfassung:
      `${nOk} geprüft · ${nSkip} übersprungen · ${nErr} Fehler (von ${eintraege.length})` +
      (errDetail ? ` — ${errDetail}` : ''),
  }
}
