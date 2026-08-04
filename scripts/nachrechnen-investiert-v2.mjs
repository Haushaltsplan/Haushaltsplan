/**
 * Exakte Nachbildung von depotStandBisDatum + SpinOffCost/SpinOff-Logik.
 * node scripts/nachrechnen-investiert-v2.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const env = {}
for (const line of readFileSync(resolve('.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

let rows = []
let offset = 0
while (true) {
  const { data, error } = await sb.from('portfolio_analyse_buchung').select('*').order('datum').range(offset, offset + 999)
  if (error) throw error
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 1000) break
  offset += 1000
}

const { data: snap } = await sb
  .from('portfolio_analyse_snapshot')
  .select('*')
  .order('erstellt_am', { ascending: false })
  .limit(1)
  .maybeSingle()

const UI = 80167.27
const r2 = (n) => Math.round(n * 100) / 100
const r4 = (n) => Math.round(n * 1e4) / 1e4
const POSITION_STUECK_DEZIMALEN = 8
function rundeStueck(n) {
  if (!Number.isFinite(n)) return 0
  const f = 10 ** POSITION_STUECK_DEZIMALEN
  return Math.round(n * f) / f
}

function istAktiendividendeAlsKauf(b) {
  if (!b.isin || b.typ !== 'kauf') return false
  const parqet = (b.parqet_typ ?? '').trim()
  const t = `${b.wertpapier_name ?? ''} ${parqet}`.toLowerCase()
  const stk = Math.abs(b.stueck ?? 0)
  if (/wahl[\s-]?dividend|aktiendividend|stock[\s_-]?dividend|dividende\s+in\s+aktien|ausschüttung\s+aktie/.test(t))
    return stk > 0
  if (/^transferin$/i.test(parqet) && stk > 0 && b.betrag_eur > 0) return true
  if (b.isin.toUpperCase() === 'DE0006580806' && stk > 0) {
    if (b.betrag_eur <= 0.01 && b.kurs_eur > 0) return true
    if (/ertrag|dividend|ausschütt|wahl/i.test(t)) return true
  }
  return false
}

function normalisiere(b) {
  const stueck = Math.abs(b.stueck ?? 0)
  let kursEur = b.kurs_eur > 0 ? b.kurs_eur : null
  let betragEur = r2(Math.abs(b.betrag_eur))
  if ((b.typ === 'kauf' || b.typ === 'verkauf') && stueck > 0 && kursEur != null && betragEur > 0) {
    if (stueck > 1.01 && Math.abs(betragEur - kursEur) <= 0.05) betragEur = r2(stueck * kursEur)
    else if (stueck < 0.999 && Math.abs(betragEur - kursEur) <= 0.05) kursEur = r4(betragEur / stueck)
  }
  const hw = stueck > 0 && kursEur != null ? r2(stueck * kursEur) : null
  return { stueck, kursEur, betragEur, hw }
}

function kaufEinstand(b) {
  if (istAktiendividendeAlsKauf(b)) {
    if (b.betrag_eur > 0) return r2(b.betrag_eur)
    const stk = Math.abs(b.stueck ?? 0)
    if (stk > 0 && b.kurs_eur > 0) return r2(stk * b.kurs_eur)
    return 0
  }
  const n = normalisiere(b)
  if (n.hw != null && n.hw > 0) {
    if (n.hw < n.betragEur - 0.02) return n.hw
    if (Math.abs(n.hw - n.betragEur) <= 0.02) return n.hw
  }
  return n.betragEur
}

function spinOffBereitsGebucht(buchungen, spin) {
  const child = spin.childIsin.toUpperCase()
  return buchungen.some(
    (b) =>
      b.datum === spin.datum &&
      b.isin?.toUpperCase() === child &&
      (b.parqet_typ === 'SpinOff' || b.parqet_typ === 'Spinoff'),
  )
}

const SPIN = {
  parentIsin: 'US78409V1044',
  childIsin: 'US60744M1062',
  childName: 'Mobility Global',
  datum: '2026-07-01',
  ratio: 1,
  childKostenAnteil: 0.05,
}

function alleTage(von, bis) {
  const out = []
  const d = new Date(von + 'T12:00:00Z')
  const end = new Date(bis + 'T12:00:00Z')
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

function run(opts) {
  const { useHeal = true, useSyntheticSpin = true, skipAktienDivCash = false } = opts
  const heute = new Date().toISOString().slice(0, 10)
  const sortiert = [...rows].filter((b) => b.datum <= heute).sort((a, b) => a.datum.localeCompare(b.datum))
  const tage = alleTage(sortiert[0].datum, heute)
  const byTag = new Map()
  for (const b of sortiert) {
    const list = byTag.get(b.datum) ?? []
    list.push(b)
    byTag.set(b.datum, list)
  }
  const map = new Map()
  let cash = 0

  for (const tag of tage) {
    for (const b of byTag.get(tag) ?? []) {
      const n = useHeal ? normalisiere(b) : {
        stueck: Math.abs(b.stueck ?? 0),
        kursEur: b.kurs_eur > 0 ? b.kurs_eur : null,
        betragEur: r2(Math.abs(b.betrag_eur)),
        hw: null,
      }

      // cash
      if (b.typ === 'einzahlung') cash += n.betragEur
      else if (b.typ === 'auszahlung') cash -= n.betragEur
      else if (b.typ === 'kauf') {
        const skipCash = skipAktienDivCash && istAktiendividendeAlsKauf(b)
        if (!skipCash && b.parqet_typ !== 'SpinOff' && b.parqet_typ !== 'Spinoff' && b.parqet_typ !== 'SpinOffCost') {
          cash -= n.betragEur
        }
      } else if (b.typ === 'verkauf') cash += n.betragEur
      else if (b.typ === 'dividende' || b.typ === 'zins') cash += n.betragEur
      else if (b.typ === 'steuer' || b.typ === 'gebuehr') cash -= n.betragEur

      if (!b.isin) continue
      const isin = b.isin.toUpperCase()
      const cur = map.get(isin) ?? { stueck: 0, kosten: 0, name: b.wertpapier_name || isin }

      if (b.typ === 'kauf') {
        let stk = n.stueck
        if (stk <= 0 && n.kursEur) stk = n.betragEur / n.kursEur
        stk = rundeStueck(stk)
        if (stk > 0) {
          cur.stueck += stk
          cur.kosten += useHeal ? kaufEinstand(b) : r2(b.betrag_eur)
        }
      } else if (b.parqet_typ === 'SpinOffCost' && b.betrag_eur > 0) {
        cur.kosten = r2(Math.max(0, cur.kosten - b.betrag_eur))
      } else if (b.typ === 'verkauf') {
        let stk = n.stueck
        if (stk <= 0 && n.kursEur) stk = n.betragEur / n.kursEur
        stk = rundeStueck(stk)
        if (cur.stueck > 0 && stk > 0) {
          const anteil = Math.min(1, stk / cur.stueck)
          cur.kosten = r2(cur.kosten * (1 - anteil))
          cur.stueck = Math.max(0, cur.stueck - stk)
        } else {
          cur.kosten = Math.max(0, cur.kosten - n.betragEur)
        }
      }
      if (b.wertpapier_name) cur.name = b.wertpapier_name
      map.set(isin, cur)
    }

    // synthetic spin-off
    if (useSyntheticSpin && tag === SPIN.datum && !spinOffBereitsGebucht(rows, SPIN)) {
      const parent = map.get(SPIN.parentIsin)
      if (parent && parent.stueck >= 1e-8) {
        const childStueck = rundeStueck(parent.stueck * SPIN.ratio)
        if (childStueck >= 1e-8) {
          const anteil = Math.min(0.95, Math.max(0.01, SPIN.childKostenAnteil))
          const childKosten = r2(parent.kosten * anteil)
          parent.kosten = r2(Math.max(0, parent.kosten - childKosten))
          const child = map.get(SPIN.childIsin) ?? { stueck: 0, kosten: 0, name: SPIN.childName }
          child.stueck += childStueck
          child.kosten += childKosten
          child.name = SPIN.childName
          map.set(SPIN.childIsin, child)
        }
      }
    }

    // split
    if (tag === '2025-12-18') {
      const cur = map.get('US81762P1021')
      if (cur && cur.stueck > 0) cur.stueck = rundeStueck(cur.stueck * 5)
    }
  }

  let einstand = 0
  const pos = []
  for (const [isin, v] of map) {
    const stk = rundeStueck(v.stueck)
    if (stk < 1e-8) continue
    const kost = r2(v.kosten)
    einstand += kost
    pos.push({ isin, name: (v.name || '').slice(0, 40), stueck: stk, kosten: kost })
  }
  einstand = r2(einstand)
  cash = r2(cash)
  const investiert = r2(einstand + Math.max(0, cash))
  pos.sort((a, b) => b.kosten - a.kosten)
  return { einstand, cash, investiert, n: pos.length, pos }
}

function runIgnoreSpinOffCost(opts) {
  const saved = rows
  rows = rows.map((b) =>
    b.parqet_typ === 'SpinOffCost' ? { ...b, parqet_typ: 'IGNORED_SpinOffCost' } : b,
  )
  const r = run(opts)
  rows = saved
  return r
}

const variants = {
  aktuell_app: run({ useHeal: true, useSyntheticSpin: true, skipAktienDivCash: false }),
  ohne_synthetic_spin: run({ useHeal: true, useSyntheticSpin: false, skipAktienDivCash: false }),
  ohne_heal: run({ useHeal: false, useSyntheticSpin: true, skipAktienDivCash: false }),
  skip_aktiendiv_cash: run({ useHeal: true, useSyntheticSpin: true, skipAktienDivCash: true }),
  nur_spinoffcost_kein_synth: run({ useHeal: true, useSyntheticSpin: false, skipAktienDivCash: false }),
  synth_ohne_spinoffcost_buchung: runIgnoreSpinOffCost({
    useHeal: true,
    useSyntheticSpin: true,
    skipAktienDivCash: false,
  }),
  weder_synth_noch_cost: runIgnoreSpinOffCost({
    useHeal: true,
    useSyntheticSpin: false,
    skipAktienDivCash: false,
  }),
}

const snapPos = Array.isArray(snap?.positionen) ? snap.positionen : []
const snapIsins = new Set(snapPos.map((p) => (p.isin || '').toUpperCase()).filter(Boolean))

const app = variants.aktuell_app
const nurInBuchungen = app.pos.filter((p) => !snapIsins.has(p.isin))
const kostenNurBuchungen = r2(nurInBuchungen.reduce((s, p) => s + p.kosten, 0))
const einstandNurSnapshotIsins = r2(app.pos.filter((p) => snapIsins.has(p.isin)).reduce((s, p) => s + p.kosten, 0))

const best = Object.entries(variants)
  .map(([k, v]) => ({ k, investiert: v.investiert, delta: r2(v.investiert - UI), n: v.n, cash: v.cash }))
  .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))

console.log(
  JSON.stringify(
    {
      ui: UI,
      snapshotPositionen: snapPos.length,
      varianten: best,
      zombiePositionenNichtImSnapshot: {
        anzahl: nurInBuchungen.length,
        kosten: kostenNurBuchungen,
        liste: nurInBuchungen.slice(0, 20),
      },
      einstandNurSnapshotIsins,
      spinOffCostInCsv: 184.16,
      hinweis:
        'SpinOffCost-Buchung UND synthetischer Spin-off können Parent-Kosten doppelt kürzen. Zombies (Turbos) halten Einstand hoch.',
    },
    null,
    2,
  ),
)
