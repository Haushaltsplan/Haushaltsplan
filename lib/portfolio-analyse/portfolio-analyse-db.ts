'use client'

import { supabase } from '@/lib/supabase'
import type {
  PortfolioBuchung,
  PortfolioDbBuchung,
  PortfolioDbSnapshot,
  PortfolioPositionSnapshot,
} from '@/lib/portfolio-analyse/types'

function istSchemaFehltMessage(msg: string): boolean {
  const m = msg.toLowerCase()
  return m.includes('portfolio_analyse') && (m.includes('does not exist') || m.includes('relation') || m.includes('schema cache'))
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
    assetKlasse: row.asset_klasse as PortfolioDbBuchung['assetKlasse'],
    quelle: row.quelle as PortfolioDbBuchung['quelle'],
  }
}

export async function ladePortfolioAnalyseDaten(): Promise<{
  ok: boolean
  buchungen: PortfolioDbBuchung[]
  snapshot: PortfolioDbSnapshot | null
  schemaFehlt: boolean
  message?: string
}> {
  const { data: buchungenRaw, error: buchErr } = await supabase
    .from('portfolio_analyse_buchung')
    .select('*')
    .order('datum', { ascending: false })

  if (buchErr) {
    return {
      ok: false,
      buchungen: [],
      snapshot: null,
      schemaFehlt: istSchemaFehltMessage(buchErr.message),
      message: buchErr.message,
    }
  }

  const { data: snapRaw, error: snapErr } = await supabase
    .from('portfolio_analyse_snapshot')
    .select('*')
    .order('erfasst_am', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (snapErr && istSchemaFehltMessage(snapErr.message)) {
    return {
      ok: false,
      buchungen: [],
      snapshot: null,
      schemaFehlt: true,
      message: snapErr.message,
    }
  }

  const buchungen = (buchungenRaw ?? []).map((r) => mapBuchungRow(r as Record<string, unknown>))
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

  return { ok: true, buchungen, snapshot, schemaFehlt: false }
}

export async function speicherePortfolioImport(
  buchungen: PortfolioBuchung[],
  positionen: PortfolioPositionSnapshot[],
  depotwertEur: number | null,
): Promise<{ ok: boolean; eingefuegt: number; message?: string; schemaFehlt?: boolean }> {
  if (buchungen.length === 0 && positionen.length === 0) {
    return { ok: false, eingefuegt: 0, message: 'Nichts zum Speichern.' }
  }

  let eingefuegt = 0
  if (buchungen.length > 0) {
    const rows = buchungen.map((b) => ({
      buchungs_hash: b.buchungsHash,
      datum: b.datum,
      typ: b.typ,
      isin: b.isin,
      wertpapier_name: b.wertpapierName,
      stueck: b.stueck,
      kurs_eur: b.kursEur,
      betrag_eur: b.betragEur,
      asset_klasse: b.assetKlasse,
      quelle: b.quelle,
    }))
    const { data, error } = await supabase
      .from('portfolio_analyse_buchung')
      .upsert(rows, { onConflict: 'owner_user_id,buchungs_hash', ignoreDuplicates: true })
      .select('id')

    if (error) {
      return {
        ok: false,
        eingefuegt: 0,
        schemaFehlt: istSchemaFehltMessage(error.message),
        message: error.message,
      }
    }
    eingefuegt = data?.length ?? 0
  }

  if (positionen.length > 0) {
    const { error: snapErr } = await supabase.from('portfolio_analyse_snapshot').insert({
      depotwert_eur: depotwertEur,
      positionen,
    })
    if (snapErr) {
      return {
        ok: false,
        eingefuegt,
        schemaFehlt: istSchemaFehltMessage(snapErr.message),
        message: snapErr.message,
      }
    }
  }

  return { ok: true, eingefuegt }
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
