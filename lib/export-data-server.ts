/**
 * Kompakter Live-Export der Haushalts-Finanzen (für Chat-/External-API).
 * Service-Role + Owner-Filter — kein RLS-Bypass ohne explizite owner_user_id.
 */
import 'server-only'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { ordneKategorieZu } from '@/lib/finanz-kategorisierung'
import {
  effektiveVermoegenKlasse,
  gruppiereVermoegen,
  type VermoegenAnzeigePosten,
} from '@/lib/finanz-vermoegen'
import { primaererOwnerUserId } from '@/lib/request-owner'

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function aktuellerMonat(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function summeJeKategorie(
  rows: Array<{ kategorie?: string | null; betrag?: number | null }>,
  limit: number,
): Array<{ name: string; betrag: number }> {
  const m = new Map<string, number>()
  for (const r of rows) {
    const name = String(r.kategorie ?? 'Ohne Bezeichnung').trim() || 'Ohne Bezeichnung'
    const b = Number(r.betrag)
    if (!Number.isFinite(b)) continue
    m.set(name, (m.get(name) || 0) + b)
  }
  return [...m.entries()]
    .map(([name, betrag]) => ({ name, betrag: r2(betrag) }))
    .sort((a, b) => b.betrag - a.betrag)
    .slice(0, limit)
}

function wertAusPositionen(positionen: unknown): number | null {
  if (!Array.isArray(positionen) || positionen.length === 0) return null
  let summe = 0
  let hat = false
  for (const p of positionen) {
    if (!p || typeof p !== 'object') continue
    const r = p as Record<string, unknown>
    const w = Number(r.wertEur ?? r.wert_eur ?? r.wertLiveEur)
    if (Number.isFinite(w)) {
      summe += w
      hat = true
    }
  }
  return hat ? r2(summe) : null
}

export type ExportDataPayload = {
  stand: string
  monat: string
  saldo: number
  summeEinnahmen: number
  summeAusgaben: number
  einnahmenNachKategorie: Array<{ name: string; betrag: number }>
  ausgabenNachKategorie: Array<{ name: string; betrag: number }>
  anzahlEinnahmen: number
  anzahlAusgaben: number
  restTopfEur: number | null
  dauerauftraege: Array<{ typ: string; kategorie: string; betrag: number }>
  sparrateMonatEur: number
  vermoegen: {
    gesamtEur: number
    depotEur: number | null
    nachKlasse: Array<{ klasse: string; label: string; betragEur: number; anteilProzent: number }>
    posten: Array<{ titel: string; klasse: string; betragEur: number }>
  }
}

export async function ladeExportData(): Promise<ExportDataPayload> {
  const ownerUserId = await primaererOwnerUserId()
  if (!ownerUserId) {
    throw new Error('Kein Owner-Konto gefunden (APP_ALLOWED_EMAILS / auth.users).')
  }

  const admin = createSupabaseAdmin()
  const monat = aktuellerMonat()

  const [einRes, ausRes, daRes, vermRes, snapRes, topfMetaRes, topfMonRes] = await Promise.all([
    admin
      .from('einnahmen')
      .select('betrag, kategorie, datum')
      .eq('owner_user_id', ownerUserId)
      .gte('datum', `${monat}-01`)
      .lt('datum', naechsterMonatIso(monat)),
    admin
      .from('ausgaben')
      .select('betrag, kategorie, datum')
      .eq('owner_user_id', ownerUserId)
      .gte('datum', `${monat}-01`)
      .lt('datum', naechsterMonatIso(monat)),
    admin
      .from('dauerauftraege')
      .select('typ, kategorie, betrag')
      .eq('owner_user_id', ownerUserId)
      .order('tag_des_monats', { ascending: true })
      .limit(40),
    admin
      .from('finanz_vermoegen')
      .select('id, titel, betrag, klasse')
      .eq('owner_user_id', ownerUserId)
      .order('erstellt_am', { ascending: true }),
    admin
      .from('portfolio_analyse_snapshot')
      .select('depotwert_eur, positionen')
      .eq('owner_user_id', ownerUserId)
      .order('erfasst_am', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('finanz_rest_topf_meta')
      .select('stand_offset')
      .eq('owner_user_id', ownerUserId)
      .eq('id', 1)
      .maybeSingle(),
    admin
      .from('finanz_rest_topf_monatsbuchung')
      .select('saldo_monat')
      .eq('owner_user_id', ownerUserId),
  ])

  for (const [label, err] of [
    ['einnahmen', einRes.error],
    ['ausgaben', ausRes.error],
    ['dauerauftraege', daRes.error],
    ['finanz_vermoegen', vermRes.error],
  ] as const) {
    if (err) console.warn(`[export-data] ${label}:`, err.message)
  }

  const einnahmen = (einRes.data ?? []) as Array<{ betrag?: number; kategorie?: string }>
  const ausgaben = (ausRes.data ?? []) as Array<{ betrag?: number; kategorie?: string }>
  const dauerauftraege = (daRes.data ?? []) as Array<{
    typ?: string
    kategorie?: string
    betrag?: number
  }>

  const gesEin = einnahmen.reduce((a, r) => a + (Number.isFinite(Number(r.betrag)) ? Number(r.betrag) : 0), 0)
  const gesAus = ausgaben.reduce((a, r) => a + (Number.isFinite(Number(r.betrag)) ? Number(r.betrag) : 0), 0)

  const daCompact = dauerauftraege.map((d) => ({
    typ: String(d.typ || 'ausgabe').toLowerCase().trim() === 'einnahme' ? 'einnahme' : 'ausgabe',
    kategorie: String(d.kategorie ?? 'Ohne Bezeichnung').trim() || 'Ohne Bezeichnung',
    betrag: r2(Number(d.betrag) || 0),
  }))
  const sparrateMonatEur = r2(
    daCompact
      .filter((d) => d.typ === 'ausgabe' && ordneKategorieZu(d.kategorie, null, false) === 'sparen')
      .reduce((a, p) => a + p.betrag, 0),
  )

  let restTopfEur: number | null = null
  if (!topfMetaRes.error && !topfMonRes.error) {
    const offset = Number((topfMetaRes.data as { stand_offset?: number } | null)?.stand_offset) || 0
    const sum = ((topfMonRes.data ?? []) as Array<{ saldo_monat?: number }>).reduce(
      (a, r) => a + (Number(r.saldo_monat) || 0),
      0,
    )
    restTopfEur = r2(offset + sum)
  }

  const rows: VermoegenAnzeigePosten[] = ((vermRes.data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const titel = String(r.titel ?? '')
    return {
      id: String(r.id),
      titel,
      betrag: Number(r.betrag) || 0,
      klasse: effektiveVermoegenKlasse(titel, typeof r.klasse === 'string' ? r.klasse : null),
      quelle: 'manuell' as const,
    }
  })

  let depotEur: number | null = null
  if (!snapRes.error && snapRes.data) {
    const snap = snapRes.data as { depotwert_eur?: number | null; positionen?: unknown }
    depotEur =
      snap.depotwert_eur != null && Number.isFinite(Number(snap.depotwert_eur))
        ? Number(snap.depotwert_eur)
        : wertAusPositionen(snap.positionen)
  }
  if (depotEur != null && depotEur !== 0) {
    rows.push({
      id: '__depot',
      titel: 'Depot (Portfolio-Analyse)',
      betrag: depotEur,
      klasse: 'aktien',
      quelle: 'depot',
    })
  }

  const { gesamt, klassenMitWert } = gruppiereVermoegen(rows)

  return {
    stand: new Date().toISOString(),
    monat,
    saldo: r2(gesEin - gesAus),
    summeEinnahmen: r2(gesEin),
    summeAusgaben: r2(gesAus),
    einnahmenNachKategorie: summeJeKategorie(einnahmen, 18),
    ausgabenNachKategorie: summeJeKategorie(ausgaben, 18),
    anzahlEinnahmen: einnahmen.length,
    anzahlAusgaben: ausgaben.length,
    restTopfEur,
    dauerauftraege: daCompact,
    sparrateMonatEur,
    vermoegen: {
      gesamtEur: gesamt,
      depotEur,
      nachKlasse: klassenMitWert
        .filter((k) => k.betrag !== 0)
        .map((k) => ({
          klasse: k.key,
          label: k.label,
          betragEur: k.betrag,
          anteilProzent: Math.round(k.anteil * 1000) / 10,
        })),
      posten: rows
        .filter((p) => p.betrag !== 0)
        .map((p) => ({ titel: p.titel, klasse: p.klasse, betragEur: r2(p.betrag) }))
        .sort((a, b) => b.betragEur - a.betragEur)
        .slice(0, 40),
    },
  }
}

function naechsterMonatIso(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
  return `${next.y}-${String(next.m).padStart(2, '0')}-01`
}
