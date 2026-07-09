/**
 * Graco/GGG Tracking manuell eintragen + Diagnose.
 * npx tsx scripts/seed-nachkauf-tracking-ggg.ts
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  try {
    const raw = readFileSync('.env.local', 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1]!.trim()] = m[2]!.trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* */
  }
}
loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Supabase env fehlt')
  process.exit(1)
}

const sb = createClient(url, key)
const monat = '2026-07'
const TICKER = 'GGG'
const ISIN = 'US3841091040'
const BETRAG = 200

async function main() {
  // 1. Owner ermitteln
  const buchung = await sb
    .from('portfolio_analyse_buchung')
    .select('owner_user_id')
    .not('owner_user_id', 'is', null)
    .limit(1)
    .maybeSingle()
  let ownerId = buchung.data?.owner_user_id ? String(buchung.data.owner_user_id) : null

  if (!ownerId) {
    const emp = await sb
      .from('nachkauf_kaufempfehlung')
      .select('owner_user_id')
      .not('owner_user_id', 'is', null)
      .limit(1)
      .maybeSingle()
    ownerId = emp.data?.owner_user_id ? String(emp.data.owner_user_id) : null
  }

  console.log('owner_user_id:', ownerId ?? 'FEHLT')

  // 2. Tracking-Tabelle prüfen
  const tableCheck = await sb.from('nachkauf_empfehlung_tracking').select('id', { count: 'exact', head: true })
  if (tableCheck.error) {
    console.error('Tabelle nachkauf_empfehlung_tracking:', tableCheck.error.message)
    console.error('→ Migration 20260708190000_nachkauf_radar_optimierung.sql in Supabase ausführen!')
    process.exit(1)
  }
  console.log('tracking count vorher:', tableCheck.count)

  // 3. Kaufempfehlung prüfen / anlegen
  const empVorher = await sb
    .from('nachkauf_kaufempfehlung')
    .select('*')
    .eq('monat', monat)
    .maybeSingle()
  console.log('kaufempfehlung vorher:', JSON.stringify(empVorher.data, null, 2), empVorher.error?.message)

  if (!ownerId) {
    console.error('Kein owner_user_id — Buchungen in Supabase fehlen?')
    process.exit(1)
  }

  // 4. Scan-Daten für GGG laden
  const scan = await sb.from('nachkauf_radar_scan').select('*').eq('ticker', TICKER).maybeSingle()
  const s = scan.data as Record<string, unknown> | null
  console.log('scan GGG score:', s?.score, 'ampel:', s?.ampel)

  const score = typeof s?.score === 'number' ? s.score : 0
  const ampel = typeof s?.ampel === 'string' ? s.ampel : 'gruen'
  const kaufTrigger = Boolean(s?.kauf_trigger_ausgeloest)
  const forwardPe = typeof s?.forward_pe === 'number' ? s.forward_pe : null
  const premiumDiscount = typeof s?.premium_discount_pct === 'number' ? s.premium_discount_pct : null
  const empfohlenAm =
    (empVorher.data as { erstellt_am?: string } | null)?.erstellt_am ?? new Date().toISOString()

  // 5. Kaufempfehlung upsert (falls basis_allokation fehlt)
  const basisAllokation = [
    {
      ticker: TICKER,
      name: 'Graco',
      betragEur: BETRAG,
      begruendung: 'KI-Portfolio-Empfehlung Juli 2026 — Kaufzone Fluid-Handling',
    },
  ]
  const { error: empErr } = await sb.from('nachkauf_kaufempfehlung').upsert(
    {
      owner_user_id: ownerId,
      monat,
      kandidaten: [TICKER],
      basis_allokation: basisAllokation,
      verkauf_allokation: [],
      ki_text: empVorher.data?.ki_text ?? `Portfolio-Empfehlung ${monat}: ${BETRAG} € in Graco (GGG), 300 € sparen.`,
    },
    { onConflict: 'owner_user_id,monat' },
  )
  if (empErr) console.error('kaufempfehlung upsert:', empErr.message)
  else console.log('kaufempfehlung gespeichert')

  // 6. Tracking-Zeile eintragen
  const { data: inserted, error: trackErr } = await sb
    .from('nachkauf_empfehlung_tracking')
    .upsert(
      {
        owner_user_id: ownerId,
        monat,
        ticker: TICKER,
        isin: ISIN,
        name: 'Graco',
        empfohlen_betrag_eur: BETRAG,
        score,
        ampel,
        kauf_trigger: kaufTrigger,
        forward_pe: forwardPe,
        premium_discount_pct: premiumDiscount,
        kurs_usd: null,
        empfohlen_am: empfohlenAm,
      },
      { onConflict: 'owner_user_id,monat,ticker' },
    )
    .select()

  if (trackErr) {
    console.error('tracking upsert FEHLER:', trackErr.message)
    process.exit(1)
  }
  console.log('tracking eingetragen:', JSON.stringify(inserted, null, 2))

  // 7. Live-Kurs nachziehen
  try {
    const chartRes = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/GGG?interval=1d&range=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    )
    const chart = (await chartRes.json()) as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> }
    }
    const preis = chart.chart?.result?.[0]?.meta?.regularMarketPrice
    if (preis && preis > 0) {
      await sb
        .from('nachkauf_empfehlung_tracking')
        .update({ kurs_usd: preis })
        .eq('ticker', TICKER)
        .eq('monat', monat)
        .eq('owner_user_id', ownerId)
      console.log('kurs_usd gesetzt:', preis)
    }
  } catch (e) {
    console.warn('Live-Kurs optional fehlgeschlagen:', e)
  }

  const nachher = await sb.from('nachkauf_empfehlung_tracking').select('*').eq('owner_user_id', ownerId)
  console.log('tracking gesamt:', nachher.data?.length, 'Zeilen')
}

void main()
