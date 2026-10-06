/**
 * Investment-Journal KI: Auto-Fill (leere Felder) + Quartals-Gegenprüfung.
 * Nutzt GEMINI_API_KEY_FREE — kein Billing-Flag.
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
import {
  ladeAktivenJournalEintrag,
  ladeJournalEintraege,
  speichereJournalEintrag,
  speichereJournalGegenpruefung,
} from '@/lib/portfolio-analyse/investment-journal-server'
import type {
  JournalAutoFillErgebnis,
  JournalEintrag,
  JournalGegenpruefungBatchErgebnis,
  JournalGegenpruefungStatus,
} from '@/lib/portfolio-analyse/investment-journal-types'
import { ladeAlleQuartalsKiDiffAusCloud } from '@/lib/portfolio-analyse/quartals-ki-diff-cache-server'
import { ladeSecBerichtKiCacheFuerTicker } from '@/lib/portfolio-analyse/sec-berichte-ki-cache-server'

const PAUSE_MS = 900

const FILL_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    these: { type: 'STRING' },
    kaufgrund: { type: 'STRING' },
    watchpoints: { type: 'STRING' },
  },
  required: ['these', 'kaufgrund', 'watchpoints'],
}

const GP_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    status: { type: 'STRING' },
    fazit: { type: 'STRING' },
    quartalLabel: { type: 'STRING' },
    watchpointTreffer: { type: 'ARRAY', items: { type: 'STRING' } },
    belege: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['status', 'fazit', 'quartalLabel'],
}

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

async function baueFillKontext(opts: {
  ticker: string
  isin: string
  name: string
  symbolYahoo: string | null
}): Promise<string> {
  const teile: string[] = [
    `Ticker: ${opts.ticker}`,
    `Name: ${opts.name}`,
    `ISIN: ${opts.isin}`,
  ]
  try {
    const hit = await ladeFundamentaldatenPaketCacheFuerAnfrage({
      isin: opts.isin,
      symbolYahoo: opts.symbolYahoo ?? opts.ticker,
      name: opts.name,
      frequenz: 'jahr',
    })
    const p = hit?.paket
    if (p) {
      teile.push(`Branche: ${p.branche ?? '—'} · Sektor: ${p.sektor ?? '—'}`)
      if (p.beschreibung) teile.push(`Profil: ${p.beschreibung.slice(0, 800)}`)
      const km = (p.keyMetrics ?? []).slice(0, 24).map((m) => `${m.label ?? m.id}: ${m.wert ?? '—'}`)
      if (km.length) teile.push(`Key Metrics:\n- ${km.join('\n- ')}`)
      if (p.mantra) {
        const z = p.mantra.zusammenfassung
        if (z) {
          teile.push(
            `Mantra: erfüllt ${z.erfuellt ?? '?'} / nicht ${z.nichtErfuellt ?? '?'} / keine Daten ${z.keineDaten ?? '?'}`,
          )
        }
      }
    }
  } catch {
    /* ohne Cache weiter */
  }
  return teile.join('\n')
}

async function baueGegenpruefungKontext(ticker: string): Promise<{
  text: string
  quartalHint: string
  hatDaten: boolean
}> {
  const teile: string[] = []
  let quartalHint = ''
  let hatDaten = false

  try {
    const earn = await ladeEarningsCallKiCacheFuerTicker(ticker)
    const rows = [...earn.entries()].sort((a, b) =>
      String(b[1].aktualisiertAm).localeCompare(String(a[1].aktualisiertAm)),
    )
    for (const [id, row] of rows.slice(0, 3)) {
      hatDaten = true
      if (!quartalHint) quartalHint = id
      teile.push(
        `### Earnings ${id}\nSentiment: ${row.sentimentScore ?? '—'}\n${row.zusammenfassung.slice(0, 4_500)}`,
      )
    }
  } catch {
    /* ignore */
  }

  try {
    const sec = await ladeSecBerichtKiCacheFuerTicker(ticker)
    const rows = [...sec.entries()].sort((a, b) =>
      String(b[1].aktualisiertAm).localeCompare(String(a[1].aktualisiertAm)),
    )
    for (const [id, row] of rows.slice(0, 2)) {
      hatDaten = true
      teile.push(`### SEC/IR ${id}\n${row.zusammenfassung.slice(0, 3_000)}`)
    }
  } catch {
    /* ignore */
  }

  try {
    const diffs = (await ladeAlleQuartalsKiDiffAusCloud())
      .filter((d) => d.ticker.trim().toUpperCase() === ticker.trim().toUpperCase())
      .sort((a, b) => String(b.aktualisiertAm).localeCompare(String(a.aktualisiertAm)))
    for (const d of diffs.slice(0, 2)) {
      hatDaten = true
      teile.push(
        `### Quartals-Diff ${d.typ} ${d.aktuellId} vs ${d.vorherId}\n${d.diff.slice(0, 2_500)}`,
      )
    }
  } catch {
    /* ignore */
  }

  return {
    text: teile.join('\n\n') || 'Keine Earnings-/SEC-/Diff-Daten im Cache.',
    quartalHint: quartalHint || 'aktuell',
    hatDaten,
  }
}

export async function generiereJournalFelder(opts: {
  ticker: string
  name: string
  kontext: string
}): Promise<{ these: string; kaufgrund: string; watchpoints: string; kiModell: string }> {
  const provider = resolveGeminiFreeTierProvider()
  if (!provider) throw new Error('GEMINI_API_KEY_FREE fehlt')

  const models = geminiFreeTierFlashModelKandidaten({
    primaryEnvKeys: ['JOURNAL_GEMINI_MODEL', 'FINANCE_COACH_GEMINI_MODEL', 'GEMINI_MODEL'],
  })

  const system = `Du bist Equity-Research-Assistent (Quality-Compounder-Stil).
Schreibe auf Deutsch, nüchtern, ohne Kursziele und ohne Kauf-/Verkaufsempfehlung.
Liefere JSON mit:
- these: 2–4 Sätze Investment-These
- kaufgrund: 2–3 Sätze warum die Position im Depot Sinn ergibt (Qualität, Moat, Kapitalallokation)
- watchpoints: 3–5 konkrete Überwachungspunkte (Kennzahlen/Ereignisse), als Aufzählung mit "- "`

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    system,
    [
      {
        role: 'user',
        content: `Unternehmen:\n${opts.kontext}\n\nErzeuge these, kaufgrund, watchpoints als JSON.`,
      },
    ],
    {
      temperature: 0.35,
      geminiModels: models,
      geminiForceFreeApiKey: true,
      jsonResponse: { schema: FILL_SCHEMA },
      maxOutputTokens: 2048,
      thinkingMinimal: true,
      timeoutMs: 90_000,
    },
  )

  if (!result.ok) throw new Error(result.hint || 'KI-Fill fehlgeschlagen')
  const parsed = parseJsonObject(result.reply)
  if (!parsed) throw new Error('KI-Fill: ungültiges JSON')

  return {
    these: String(parsed.these ?? '').trim().slice(0, 4_000),
    kaufgrund: String(parsed.kaufgrund ?? '').trim().slice(0, 3_000),
    watchpoints: String(parsed.watchpoints ?? '').trim().slice(0, 3_000),
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

  const models = geminiFreeTierFlashModelKandidaten({
    primaryEnvKeys: ['JOURNAL_GEMINI_MODEL', 'FINANCE_COACH_GEMINI_MODEL', 'GEMINI_MODEL'],
  })

  const system = `Du prüfst eine Investment-These gegen aktuelle Quartals-/Earnings-Daten.
Nur Deutsch. Nur Fakten aus dem gelieferten Kontext. Keine Kursziele.
status muss exakt einer sein: intakt | unter_beobachtung | beschaedigt
- intakt: These und Watchpoints unbeschädigt
- unter_beobachtung: erste Risse / gemischte Signale
- beschaedigt: Kernthese klar unter Druck
JSON: status, fazit (4–8 Sätze), quartalLabel, watchpointTreffer (Strings), belege (kurze Zitate/Zahlen).`

  const result = await runCoachCompletion(
    provider.provider,
    provider.apiKey,
    system,
    [
      {
        role: 'user',
        content: [
          `Ticker: ${opts.eintrag.ticker} (${opts.eintrag.name})`,
          '',
          '### These',
          opts.eintrag.these || '(leer)',
          '',
          '### Kaufgrund',
          opts.eintrag.kaufgrund || '(leer)',
          '',
          '### Watchpoints',
          opts.eintrag.watchpoints || '(leer)',
          '',
          `### Quartals-/Earnings-Kontext (Hinweis: ${opts.quartalHint})`,
          opts.earningsKontext.slice(0, 28_000),
          '',
          'Prüfe These und Watchpoints. Antworte als JSON.',
        ].join('\n'),
      },
    ],
    {
      temperature: 0.25,
      geminiModels: models,
      geminiForceFreeApiKey: true,
      jsonResponse: { schema: GP_SCHEMA },
      maxOutputTokens: 3072,
      thinkingMinimal: true,
      timeoutMs: 120_000,
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
          statusRaw.includes('beschaedig')
        ? 'beschaedigt'
        : 'unter_beobachtung'

  return {
    status,
    fazit: String(parsed.fazit ?? '').trim().slice(0, 6_000),
    quartalLabel: String(parsed.quartalLabel ?? opts.quartalHint).trim().slice(0, 80) || opts.quartalHint,
    details: {
      watchpointTreffer: Array.isArray(parsed.watchpointTreffer)
        ? parsed.watchpointTreffer.map((x) => String(x).slice(0, 200)).slice(0, 12)
        : [],
      belege: Array.isArray(parsed.belege)
        ? parsed.belege.map((x) => String(x).slice(0, 300)).slice(0, 12)
        : [],
    },
    kiModell: result.model || models[0] || 'gemini',
  }
}

export async function batchJournalAutoFill(opts?: {
  ticker?: string
}): Promise<{ ergebnisse: JournalAutoFillErgebnis[]; zusammenfassung: string }> {
  const depot = await ladeDepotRadarAktien()
  const filterTicker = opts?.ticker?.trim().toUpperCase()
  const kandidaten = depot
    .map((d) => ({
      isin: d.isin,
      name: d.name,
      symbolYahoo: d.symbolYahoo,
      ticker: tickerAusDepot(d.symbolYahoo, d.symbolCandidates, d.isin),
    }))
    .filter((d) => (filterTicker ? d.ticker === filterTicker || d.isin === filterTicker : true))

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
      ergebnisse.push({
        ticker: k.ticker,
        name: k.name,
        status: 'fehler',
        message: e instanceof Error ? e.message : String(e),
      })
    }
    if (i < kandidaten.length - 1) await sleep(PAUSE_MS)
  }

  const nOk = ergebnisse.filter((e) => e.status === 'befuellt').length
  const nSkip = ergebnisse.filter((e) => e.status === 'uebersprungen').length
  const nErr = ergebnisse.filter((e) => e.status === 'fehler').length
  return {
    ergebnisse,
    zusammenfassung: `${nOk} befüllt · ${nSkip} übersprungen · ${nErr} Fehler (von ${kandidaten.length})`,
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
    depot.map((d) => [
      tickerAusDepot(d.symbolYahoo, d.symbolCandidates, d.isin),
      d,
    ]),
  )

  const filterTicker = opts?.ticker?.trim().toUpperCase()
  let eintraege = (await ladeJournalEintraege()).filter((e) => e.status === 'aktiv')
  if (filterTicker) {
    eintraege = eintraege.filter((e) => e.ticker === filterTicker)
  } else {
    eintraege = eintraege.filter((e) => depotTickers.has(e.ticker))
  }

  // Fehlende Journal-Einträge für Depot anlegen (leere Felder), damit Gegenprüfung möglich ist
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

      const { text, quartalHint, hatDaten } = await baueGegenpruefungKontext(e.ticker)
      if (!hatDaten) {
        ergebnisse.push({
          ticker: e.ticker,
          name,
          status: 'uebersprungen',
          message: 'Keine Quartals-/Earnings-Daten im Cache',
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
  return {
    ergebnisse,
    zusammenfassung: `${nOk} geprüft · ${nSkip} übersprungen · ${nErr} Fehler (von ${eintraege.length})`,
  }
}
