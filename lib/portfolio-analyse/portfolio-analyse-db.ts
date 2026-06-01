'use client'

import { supabase } from '@/lib/supabase'
import {
  PORTFOLIO_DB_SEITEN_GROESSE,
  PORTFOLIO_MAX_BUCHUNGEN,
  PORTFOLIO_UPSERT_BATCH,
} from '@/lib/portfolio-analyse/limits'
import { normalisiereIsinFuerDb } from '@/lib/portfolio-analyse/parse-hilfen'
import type {
  PortfolioBuchung,
  PortfolioDbBuchung,
  PortfolioDbSnapshot,
  PortfolioPositionSnapshot,
} from '@/lib/portfolio-analyse/types'

type BuchungDbSpalten = {
  realisierterGewinn: boolean
  parqetTyp: boolean
}

function fehlendePortfolioSpalte(message: string): keyof BuchungDbSpalten | null {
  const m = /could not find the '([^']+)' column/i.exec(message)
  if (!m) return null
  if (m[1] === 'realisierter_gewinn_eur') return 'realisierterGewinn'
  if (m[1] === 'parqet_typ') return 'parqetTyp'
  return null
}

function buchungZuDbRow(b: PortfolioBuchung, spalten: BuchungDbSpalten): Record<string, unknown> {
  const row: Record<string, unknown> = {
    buchungs_hash: b.buchungsHash,
    datum: b.datum,
    typ: b.typ,
    isin: normalisiereIsinFuerDb(b.isin),
    wertpapier_name: b.wertpapierName,
    stueck: b.stueck,
    kurs_eur: b.kursEur,
    betrag_eur: b.betragEur,
    asset_klasse: b.assetKlasse,
    quelle: b.quelle,
  }
  if (spalten.realisierterGewinn) row.realisierter_gewinn_eur = b.realisierterGewinnEur ?? null
  if (spalten.parqetTyp) row.parqet_typ = b.parqetTyp ?? null
  return row
}

/** Nur echte „Tabelle fehlt / Schema-Cache“-Fälle — nicht Constraint- oder RLS-Fehler. */
function istSchemaFehltFehler(msg: string, code?: string | null): boolean {
  const c = (code ?? '').toUpperCase()
  if (c === 'PGRST205' || c === '42P01') return true
  const m = msg.toLowerCase()
  if (!m.includes('portfolio_analyse')) return false
  if (
    m.includes('violates') ||
    m.includes('constraint') ||
    m.includes('permission denied') ||
    m.includes('row-level security') ||
    m.includes('jwt')
  ) {
    return false
  }
  return (
    m.includes('schema cache') ||
    m.includes('could not find') ||
    m.includes('does not exist')
  )
}

function mapBuchungRow(row: Record<string, unknown>): PortfolioDbBuchung {
  return {
    id: String(row.id),
    importiert_am: String(row.importiert_am),
    buchungsHash: String(row.buchungs_hash),
    datum: String(row.datum).slice(0, 10),
    typ: row.typ as PortfolioDbBuchung['typ'],
    isin: row.isin ? String(row.isin) : null,
    wertpapierName: row.wertpapier_name ? String(row.wertpapier_name) : null,
    stueck: row.stueck != null ? Number(row.stueck) : null,
    kursEur: row.kurs_eur != null ? Number(row.kurs_eur) : null,
    betragEur: Number(row.betrag_eur),
    realisierterGewinnEur:
      row.realisierter_gewinn_eur != null ? Number(row.realisierter_gewinn_eur) : null,
    parqetTyp: row.parqet_typ != null ? String(row.parqet_typ) : null,
    assetKlasse: row.asset_klasse as PortfolioDbBuchung['assetKlasse'],
    quelle: row.quelle as PortfolioDbBuchung['quelle'],
  }
}

async function ladeAlleBuchungen(): Promise<{
  buchungen: PortfolioDbBuchung[]
  error: { message: string; code?: string } | null
  limitErreicht: boolean
}> {
  const buchungen: PortfolioDbBuchung[] = []
  let offset = 0

  while (buchungen.length < PORTFOLIO_MAX_BUCHUNGEN) {
    const bis = Math.min(offset + PORTFOLIO_DB_SEITEN_GROESSE - 1, PORTFOLIO_MAX_BUCHUNGEN - 1)
    const { data, error } = await supabase
      .from('portfolio_analyse_buchung')
      .select('*')
      .order('datum', { ascending: false })
      .range(offset, bis)

    if (error) {
      return { buchungen: [], error, limitErreicht: false }
    }

    const seite = (data ?? []).map((r) => mapBuchungRow(r as Record<string, unknown>))
    buchungen.push(...seite)

    if (seite.length < PORTFOLIO_DB_SEITEN_GROESSE) {
      return { buchungen, error: null, limitErreicht: false }
    }

    offset += PORTFOLIO_DB_SEITEN_GROESSE
    if (buchungen.length >= PORTFOLIO_MAX_BUCHUNGEN) {
      return { buchungen, error: null, limitErreicht: true }
    }
  }

  return { buchungen, error: null, limitErreicht: true }
}

export async function ladePortfolioAnalyseDaten(): Promise<{
  ok: boolean
  buchungen: PortfolioDbBuchung[]
  snapshot: PortfolioDbSnapshot | null
  schemaFehlt: boolean
  message?: string
  limitErreicht?: boolean
}> {
  const { buchungen: buchungenRaw, error: buchErr, limitErreicht } = await ladeAlleBuchungen()

  if (buchErr) {
    return {
      ok: false,
      buchungen: [],
      snapshot: null,
      schemaFehlt: istSchemaFehltFehler(buchErr.message, buchErr.code),
      message: buchErr.message,
    }
  }

  const { data: snapRaw, error: snapErr } = await supabase
    .from('portfolio_analyse_snapshot')
    .select('*')
    .order('erfasst_am', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (snapErr && istSchemaFehltFehler(snapErr.message, snapErr.code)) {
    return {
      ok: false,
      buchungen: [],
      snapshot: null,
      schemaFehlt: true,
      message: snapErr.message,
    }
  }

  const buchungen = buchungenRaw
  let snapshot: PortfolioDbSnapshot | null = null
  if (snapRaw) {
    const s = snapRaw as Record<string, unknown>
    snapshot = {
      id: String(s.id),
      erfasst_am: String(s.erfasst_am),
      depotwert_eur: s.depotwert_eur != null ? Number(s.depotwert_eur) : null,
      positionen: Array.isArray(s.positionen) ? (s.positionen as PortfolioPositionSnapshot[]) : [],
    }
  }

  return {
    ok: true,
    buchungen,
    snapshot,
    schemaFehlt: false,
    limitErreicht: limitErreicht || undefined,
  }
}

export async function speicherePortfolioImport(
  buchungen: PortfolioBuchung[],
  positionen: PortfolioPositionSnapshot[],
  depotwertEur: number | null,
): Promise<{
  ok: boolean
  eingefuegt: number
  message?: string
  schemaFehlt?: boolean
  /** z. B. fehlende Migration — Import ging trotzdem durch. */
  hinweis?: string
}> {
  if (buchungen.length === 0 && positionen.length === 0) {
    return { ok: false, eingefuegt: 0, message: 'Nichts zum Speichern.' }
  }

  if (buchungen.length > PORTFOLIO_MAX_BUCHUNGEN) {
    return {
      ok: false,
      eingefuegt: 0,
      message: `Maximal ${PORTFOLIO_MAX_BUCHUNGEN.toLocaleString('de-DE')} Buchungen pro Speichervorgang.`,
    }
  }

  let eingefuegt = 0
  let dbSpalten: BuchungDbSpalten = { realisierterGewinn: true, parqetTyp: true }
  const fehlendeSpalten = new Set<keyof BuchungDbSpalten>()
  let hinweis: string | undefined

  if (buchungen.length > 0) {
    for (let i = 0; i < buchungen.length; i += PORTFOLIO_UPSERT_BATCH) {
      const batch = buchungen
        .slice(i, i + PORTFOLIO_UPSERT_BATCH)
        .map((b) => buchungZuDbRow(b, dbSpalten))

      const { data, error } = await supabase
        .from('portfolio_analyse_buchung')
        .upsert(batch, { onConflict: 'owner_user_id,buchungs_hash' })
        .select('id')

      if (error) {
        const fehlend = fehlendePortfolioSpalte(error.message)
        if (fehlend && dbSpalten[fehlend]) {
          dbSpalten = { ...dbSpalten, [fehlend]: false }
          fehlendeSpalten.add(fehlend)
          i -= PORTFOLIO_UPSERT_BATCH
          continue
        }
        return {
          ok: false,
          eingefuegt,
          schemaFehlt: istSchemaFehltFehler(error.message, error.code),
          message: error.message,
        }
      }
      eingefuegt += data?.length ?? 0
    }

    if (fehlendeSpalten.size > 0) {
      hinweis =
        'Datenbank-Migration fehlt noch (Spalten realisierter_gewinn_eur / parqet_typ). ' +
        'Buchungen wurden ohne Parqet-„Realisiert“ gespeichert. ' +
        'Im Supabase SQL-Editor ausführen: supabase/migrations/20260601130000_portfolio_analyse_realisierter_gewinn.sql ' +
        'oder npm run db:portfolio-analyse — danach CSV erneut importieren.'
    }
  }

  if (positionen.length > 0) {
    const positionenDb = positionen.map((p) => ({
      ...p,
      isin: normalisiereIsinFuerDb(p.isin),
    }))
    const { error: snapErr } = await supabase.from('portfolio_analyse_snapshot').insert({
      depotwert_eur: depotwertEur,
      positionen: positionenDb,
    })
    if (snapErr) {
      return {
        ok: false,
        eingefuegt,
        schemaFehlt: istSchemaFehltFehler(snapErr.message, snapErr.code),
        message: snapErr.message,
      }
    }
  }

  return { ok: true, eingefuegt, hinweis }
}

export async function loescheAllePortfolioAnalyseDaten(): Promise<{ ok: boolean; message?: string }> {
  const { error: bErr } = await supabase
    .from('portfolio_analyse_buchung')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (bErr) return { ok: false, message: bErr.message }
  const { error: sErr } = await supabase
    .from('portfolio_analyse_snapshot')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (sErr) return { ok: false, message: sErr.message }
  return { ok: true }
}
