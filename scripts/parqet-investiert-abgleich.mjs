/**
 * Finde welche Definition 78.803,78 € (Parqet) trifft.
 * node scripts/parqet-investiert-abgleich.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const PARQET = 78803.78
const env = {}
for (const line of readFileSync(resolve('.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
let rows = []
let offset = 0
while (true) {
  const { data } = await sb.from('portfolio_analyse_buchung').select('*').order('datum').range(offset, offset + 999)
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 1000) break
  offset += 1000
}

const r2 = (n) => Math.round(n * 100) / 100
const r4 = (n) => Math.round(n * 1e4) / 1e4
const rundeStueck = (n) => Math.round(n * 1e8) / 1e8

function istTransferIn(b) {
  return /^transferin$/i.test((b.parqet_typ ?? '').trim())
}
function istTransferOut(b) {
  return /^transferout$/i.test((b.parqet_typ ?? '').trim())
}
function istBuy(b) {
  return b.typ === 'kauf' && !istTransferIn(b)
}
function istAktiendiv(b) {
  if (b.typ !== 'kauf' || !b.isin) return false
  if (istTransferIn(b) && b.betrag_eur > 0 && Math.abs(b.stueck ?? 0) > 0) return true
  const t = `${b.wertpapier_name ?? ''} ${b.parqet_typ ?? ''}`.toLowerCase()
  return /wahl[\s-]?dividend|aktiendividend|stock[\s_-]?dividend/.test(t)
}
function normalisiere(b) {
  const stueck = Math.abs(b.stueck ?? 0)
  let kursEur = b.kurs_eur > 0 ? b.kurs_eur : null
  let betragEur = r2(Math.abs(b.betrag_eur))
  if ((b.typ === 'kauf' || b.typ === 'verkauf') && stueck > 0 && kursEur != null) {
    if (stueck > 1.01 && Math.abs(betragEur - kursEur) <= 0.05) betragEur = r2(stueck * kursEur)
    else if (stueck < 0.999 && Math.abs(betragEur - kursEur) <= 0.05) kursEur = r4(betragEur / stueck)
  }
  const hw = stueck > 0 && kursEur ? r2(stueck * kursEur) : null
  return { stueck, kursEur, betragEur, hw }
}
function einstandKauf(b, mode) {
  // mode: 'hw' | 'betrag' | 'hw_prefer'
  const n = normalisiere(b)
  if (mode === 'betrag') return n.betragEur
  if (n.hw != null && n.hw > 0) {
    if (mode === 'hw') return n.hw
    // hw_prefer: wie App
    if (n.hw < n.betragEur - 0.02 || Math.abs(n.hw - n.betragEur) <= 0.02) return n.hw
  }
  return n.betragEur
}

function run(opts) {
  const {
    excludeTransferIn = false,
    transferInCostZero = false,
    excludeTransferOutEffect = false,
    useHw = true,
    applySpinOffCost = true,
    addChildFromSpinCost = true,
    skipSyntheticPct = true,
  } = opts

  const map = new Map()
  const heute = new Date().toISOString().slice(0, 10)
  const sortiert = rows.filter((b) => b.datum <= heute).sort((a, b) => a.datum.localeCompare(b.datum))

  for (const b of sortiert) {
    if (!b.isin && b.parqet_typ !== 'SpinOffCost') continue
    const isin = b.isin?.toUpperCase()
    const n = normalisiere(b)

    if (b.typ === 'kauf' && isin) {
      if (excludeTransferIn && istTransferIn(b)) continue
      const cur = map.get(isin) ?? { stueck: 0, kosten: 0 }
      let stk = rundeStueck(n.stueck)
      if (stk <= 0 && n.kursEur) stk = rundeStueck(n.betragEur / n.kursEur)
      if (stk <= 0) continue
      let kost = einstandKauf(b, useHw ? 'hw_prefer' : 'betrag')
      if (transferInCostZero && istTransferIn(b)) kost = 0
      if (transferInCostZero && istAktiendiv(b)) kost = 0
      cur.stueck += stk
      cur.kosten += kost
      map.set(isin, cur)
    } else if (b.parqet_typ === 'SpinOffCost' && applySpinOffCost && isin) {
      const cur = map.get(isin) ?? { stueck: 0, kosten: 0 }
      cur.kosten = r2(Math.max(0, cur.kosten - b.betrag_eur))
      map.set(isin, cur)
    } else if (b.typ === 'verkauf' && isin) {
      if (excludeTransferOutEffect && istTransferOut(b)) continue
      const cur = map.get(isin)
      if (!cur || cur.stueck <= 0) continue
      let stk = rundeStueck(n.stueck)
      if (stk <= 0) continue
      const anteil = Math.min(1, stk / cur.stueck)
      cur.kosten = r2(cur.kosten * (1 - anteil))
      cur.stueck = Math.max(0, cur.stueck - stk)
      map.set(isin, cur)
    }

    // Spin day after bookings
    if (b.datum === '2026-07-01' && addChildFromSpinCost) {
      // applied once below
    }
  }

  // Apply spin once at end of 2026-07-01 processing — re-sim day based
  // Simpler: after full loop, if child missing shares from spin, already handled in day loop
  // Re-run with day grouping for spin
  return finalize(map)
}

function finalize(map) {
  // also need spin - rebuild properly day by day
  return null
}

/** Day-by-day engine */
function engine(opts) {
  const {
    excludeTransferInShares = false, // ignore TransferIn completely
    transferInZeroCost = false, // shares yes, cost 0
    aktiendivZeroCost = false,
    useBetragNotHw = false,
    spinMode = 'cost_booking_child', // 'cost_booking_child' | 'double_old' | 'none' | 'pct_only'
  } = opts

  const map = new Map()
  const heute = new Date().toISOString().slice(0, 10)
  const sortiert = rows.filter((b) => b.datum <= heute).sort((a, b) => a.datum.localeCompare(b.datum))
  const byTag = new Map()
  for (const b of sortiert) {
    const list = byTag.get(b.datum) ?? []
    list.push(b)
    byTag.set(b.datum, list)
  }
  const tage = [...byTag.keys()].sort()

  for (const tag of tage) {
    for (const b of byTag.get(tag) ?? []) {
      const n = normalisiere(b)
      const isin = b.isin?.toUpperCase()

      if (b.typ === 'kauf' && isin) {
        if (excludeTransferInShares && istTransferIn(b)) continue
        const cur = map.get(isin) ?? { stueck: 0, kosten: 0 }
        let stk = rundeStueck(n.stueck)
        if (stk <= 0 && n.kursEur) stk = rundeStueck(n.betragEur / n.kursEur)
        if (stk <= 0) continue
        let kost = useBetragNotHw ? n.betragEur : einstandKauf(b, 'hw_prefer')
        if (transferInZeroCost && istTransferIn(b)) kost = 0
        if (aktiendivZeroCost && istAktiendiv(b)) kost = 0
        cur.stueck += stk
        cur.kosten += kost
        map.set(isin, cur)
      } else if (b.parqet_typ === 'SpinOffCost' && isin && spinMode !== 'none' && spinMode !== 'pct_only') {
        const cur = map.get(isin) ?? { stueck: 0, kosten: 0 }
        cur.kosten = r2(Math.max(0, cur.kosten - b.betrag_eur))
        map.set(isin, cur)
      } else if (b.typ === 'verkauf' && isin) {
        if (istTransferOut(b)) {
          // TransferOut: Parqet entfernt Bestand — wir auch
        }
        const cur = map.get(isin)
        if (!cur || cur.stueck <= 0) continue
        let stk = rundeStueck(n.stueck)
        if (stk <= 0 && n.kursEur) stk = rundeStueck(n.betragEur / n.kursEur)
        if (stk <= 0) continue
        const anteil = Math.min(1, stk / cur.stueck)
        cur.kosten = r2(cur.kosten * (1 - anteil))
        cur.stueck = Math.max(0, cur.stueck - stk)
        map.set(isin, cur)
      }
    }

    if (tag === '2026-07-01' && spinMode !== 'none') {
      const parent = map.get('US78409V1044')
      if (parent && parent.stueck > 1e-8) {
        const childStueck = rundeStueck(parent.stueck)
        const child = map.get('US60744M1062') ?? { stueck: 0, kosten: 0 }
        if (spinMode === 'cost_booking_child') {
          child.stueck += childStueck
          child.kosten += 184.16
        } else if (spinMode === 'double_old') {
          const ck = r2(parent.kosten * 0.05)
          parent.kosten = r2(parent.kosten - ck)
          child.stueck += childStueck
          child.kosten += ck
        } else if (spinMode === 'pct_only') {
          const ck = r2(parent.kosten * 0.05)
          parent.kosten = r2(parent.kosten - ck)
          child.stueck += childStueck
          child.kosten += ck
        }
        map.set('US60744M1062', child)
      }
    }
    if (tag === '2025-12-18') {
      const cur = map.get('US81762P1021')
      if (cur) cur.stueck = rundeStueck(cur.stueck * 5)
    }
  }

  let einstand = 0
  let nPos = 0
  let transferInStillOpenCost = 0
  for (const [isin, v] of map) {
    if (v.stueck < 1e-8) continue
    nPos++
    einstand += r2(v.kosten)
  }
  return { einstand: r2(einstand), nPos, delta: r2(r2(einstand) - PARQET) }
}

// Sum helpers
let sumTransferIn = 0
let sumTransferInOpenEstimate = 0
let sumBuyHw = 0
let sumBuyBetrag = 0
const transferIns = []
for (const b of rows) {
  if (istTransferIn(b)) {
    sumTransferIn += b.betrag_eur
    transferIns.push({
      d: b.datum,
      isin: b.isin,
      betrag: b.betrag_eur,
      stk: b.stueck,
      name: (b.wertpapier_name || '').slice(0, 40),
    })
  }
  if (b.typ === 'kauf' && !istTransferIn(b)) {
    const n = normalisiere(b)
    sumBuyBetrag += n.betragEur
    sumBuyHw += n.hw ?? n.betragEur
  }
}

const variants = {
  app_fix_spin: engine({ spinMode: 'cost_booking_child' }),
  exclude_all_transferin: engine({ excludeTransferInShares: true, spinMode: 'cost_booking_child' }),
  transferin_zero_cost: engine({ transferInZeroCost: true, spinMode: 'cost_booking_child' }),
  aktiendiv_zero_cost: engine({ aktiendivZeroCost: true, spinMode: 'cost_booking_child' }),
  exclude_transferin_no_spin_child: engine({ excludeTransferInShares: true, spinMode: 'none' }),
  transferin_zero_no_spin: engine({ transferInZeroCost: true, spinMode: 'none' }),
  betrag_not_hw: engine({ useBetragNotHw: true, spinMode: 'cost_booking_child' }),
  exclude_ti_betrag: engine({ excludeTransferInShares: true, useBetragNotHw: true, spinMode: 'cost_booking_child' }),
  old_double_spin: engine({ spinMode: 'double_old' }),
  pct_spin_only: engine({ spinMode: 'pct_only' }),
}

// Also: open cost minus remaining TransferIn cost contribution — hard
// Try: app einstand - sum of TransferIn that are Wahldividende only
let wahlDivSum = 0
for (const b of rows) {
  if (!istAktiendiv(b)) continue
  // only clear Wahldividende text or MUM
  const t = `${b.wertpapier_name ?? ''} ${b.parqet_typ ?? ''}`.toLowerCase()
  if (/^transferin$/i.test(b.parqet_typ) || /wahl|aktiendividend|stock/.test(t)) {
    wahlDivSum += b.betrag_eur
  }
}

const ranked = Object.entries(variants)
  .map(([k, v]) => ({ k, ...v, abs: Math.abs(v.delta) }))
  .sort((a, b) => a.abs - b.abs)

console.log(
  JSON.stringify(
    {
      parqet: PARQET,
      sumTransferIn: r2(sumTransferIn),
      wahlDivSum: r2(wahlDivSum),
      bestMatches: ranked.slice(0, 8),
      all: ranked,
      // manual combos from best app number
      appMinusWahlDiv: r2(variants.app_fix_spin.einstand - wahlDivSum),
      appMinusAllTransferIn: r2(variants.app_fix_spin.einstand - sumTransferIn),
      appMinus1528: r2(variants.app_fix_spin.einstand - 1528.37),
    },
    null,
    2,
  ),
)

// Find subset of TransferIns summing to ~1528.37
const target = r2(variants.app_fix_spin.einstand - PARQET)
console.log('\nTarget gap:', target)
const tis = transferIns.map((t) => ({ ...t, betrag: r2(t.betrag) }))
// single matches
for (const t of tis) {
  if (Math.abs(t.betrag - target) < 1) console.log('single TI match', t)
}
// sum of turbo transferins
let turboTi = 0
const turbos = []
for (const t of tis) {
  if (/turbo|mini|knock|hebel|citi|hsbc/i.test(t.name) || (t.isin || '').startsWith('DE000K') || (t.isin || '').startsWith('DE000H')) {
    turboTi += t.betrag
    turbos.push(t)
  }
}
console.log('turbo TransferIn sum', r2(turboTi), 'count', turbos.length)
console.log('app - turbo TI', r2(variants.app_fix_spin.einstand - turboTi))

// TransferIns still in open positions? approximate by isin still having stueck
const open = engine({ spinMode: 'cost_booking_child' })
// rebuild open isins from exclude run difference
const withTi = variants.app_fix_spin.einstand
const withoutTi = variants.exclude_all_transferin.einstand
console.log('cost attributed to TransferIn shares still open (approx)', r2(withTi - withoutTi))
