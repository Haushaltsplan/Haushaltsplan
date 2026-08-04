/**
 * Vollständige Nachrechnung Hero-/Rendite-Investiert.
 * node scripts/nachrechnen-investiert.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envRaw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
const env = {}
for (const line of envRaw.split('\n')) {
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

const UI = 80167.27
const r2 = (n) => Math.round(n * 100) / 100
const r4 = (n) => Math.round(n * 10000) / 10000

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

function istCorporateActionOhneCash(b) {
  return b.parqet_typ === 'SpinOff' || b.parqet_typ === 'Spinoff' || b.parqet_typ === 'SpinOffCost'
}

function normalisiere(b) {
  const stueck = Math.abs(b.stueck ?? 0)
  let kursEur = b.kurs_eur > 0 ? b.kurs_eur : null
  let betragEur = r2(Math.abs(b.betrag_eur))
  let geheilt = false
  if ((b.typ === 'kauf' || b.typ === 'verkauf') && stueck > 0 && kursEur != null && betragEur > 0) {
    if (stueck > 1.01 && Math.abs(betragEur - kursEur) <= 0.05) {
      betragEur = r2(stueck * kursEur)
      geheilt = true
    } else if (stueck < 0.999 && Math.abs(betragEur - kursEur) <= 0.05) {
      kursEur = r4(betragEur / stueck)
      geheilt = true
    }
  }
  const hw = stueck > 0 && kursEur != null ? r2(stueck * kursEur) : null
  return { stueck, kursEur, betragEur, hw, geheilt }
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

// Spin-off wie corporate-actions.ts
const SPIN_OFFS = [
  {
    parentIsin: 'US78409V1044',
    childIsin: 'US60744M1062',
    childName: 'Mobility Global',
    datum: '2026-07-01',
    ratio: 1,
    childKostenAnteil: 0.05,
  },
]

const SPLITS = [{ isin: 'US81762P1021', datum: '2025-12-18', faktor: 5 }]

function applySpinOff(map, tag) {
  for (const spin of SPIN_OFFS) {
    if (spin.datum !== tag) continue
    const parent = map.get(spin.parentIsin)
    if (!parent || parent.stueck <= 0) continue
    const childStueck = r4(parent.stueck * spin.ratio)
    if (childStueck <= 0) continue
    const anteil = spin.childKostenAnteil ?? 0
    const childKosten = r2(parent.kosten * anteil)
    parent.kosten = r2(parent.kosten - childKosten)
    const child = map.get(spin.childIsin) || {
      stueck: 0,
      kosten: 0,
      name: spin.childName,
    }
    child.stueck += childStueck
    child.kosten += childKosten
    child.name = spin.childName
    map.set(spin.childIsin, child)
    map.set(spin.parentIsin, parent)
  }
}

function applySplits(map, tag) {
  for (const s of SPLITS) {
    if (s.datum !== tag) continue
    const cur = map.get(s.isin)
    if (!cur || cur.stueck <= 0) continue
    cur.stueck = r4(cur.stueck * s.faktor)
    // kosten unverändert
    map.set(s.isin, cur)
  }
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

const heute = new Date().toISOString().slice(0, 10)
const sortiert = [...rows].filter((b) => b.datum <= heute).sort((a, b) => a.datum.localeCompare(b.datum))
const von = sortiert[0]?.datum
const tage = alleTage(von, heute)
const byTag = new Map()
for (const b of sortiert) {
  const list = byTag.get(b.datum) ?? []
  list.push(b)
  byTag.set(b.datum, list)
}

const map = new Map()
let cash = 0
let sumKaeufeBrutto = 0
let sumKaeufeEinstand = 0
let sumVerkaeufe = 0
let sumEinzahlungen = 0
let sumAuszahlungen = 0
let sumDiv = 0
let sumGebuehr = 0
let sumSteuer = 0
let aktienDivEinstand = 0
let geheiltN = 0

for (const tag of tage) {
  for (const b of byTag.get(tag) ?? []) {
    const n = normalisiere(b)
    if (n.geheilt) geheiltN++

    if (b.typ === 'einzahlung') {
      cash += n.betragEur
      sumEinzahlungen += n.betragEur
    } else if (b.typ === 'auszahlung') {
      cash -= n.betragEur
      sumAuszahlungen += n.betragEur
    } else if (b.typ === 'kauf') {
      if (!istCorporateActionOhneCash(b)) cash -= n.betragEur
      sumKaeufeBrutto += n.betragEur
      if (b.isin) {
        const isin = b.isin.toUpperCase()
        const cur = map.get(isin) || { stueck: 0, kosten: 0, name: b.wertpapier_name || isin }
        let stk = n.stueck
        if (stk <= 0 && n.kursEur) stk = n.betragEur / n.kursEur
        if (stk > 0) {
          const e = kaufEinstand(b)
          cur.stueck += stk
          cur.kosten += e
          sumKaeufeEinstand += e
          if (istAktiendividendeAlsKauf(b)) aktienDivEinstand += e
        }
        map.set(isin, cur)
      }
    } else if (b.typ === 'verkauf') {
      cash += n.betragEur
      sumVerkaeufe += n.betragEur
      if (b.isin) {
        const isin = b.isin.toUpperCase()
        const cur = map.get(isin)
        if (cur && cur.stueck > 0) {
          let stk = n.stueck
          if (stk <= 0 && n.kursEur) stk = n.betragEur / n.kursEur
          if (stk > 0) {
            const anteil = Math.min(1, stk / cur.stueck)
            cur.kosten = r2(cur.kosten * (1 - anteil))
            cur.stueck = Math.max(0, cur.stueck - stk)
          }
        } else if (cur) {
          cur.kosten = Math.max(0, cur.kosten - n.betragEur)
        }
      }
    } else if (b.parqet_typ === 'SpinOffCost' && b.betrag_eur > 0 && b.isin) {
      const isin = b.isin.toUpperCase()
      const cur = map.get(isin)
      if (cur) cur.kosten = r2(Math.max(0, cur.kosten - b.betrag_eur))
    } else if (b.typ === 'dividende' || b.typ === 'zins') {
      cash += n.betragEur
      sumDiv += n.betragEur
    } else if (b.typ === 'steuer') {
      cash -= n.betragEur
      sumSteuer += n.betragEur
    } else if (b.typ === 'gebuehr') {
      cash -= n.betragEur
      sumGebuehr += n.betragEur
    }
  }
  applySpinOff(map, tag)
  applySplits(map, tag)
}

let einstand = 0
let positionen = 0
const top = []
for (const [isin, v] of map) {
  if (v.stueck < 1e-8) continue
  positionen++
  const kost = r2(v.kosten)
  einstand += kost
  top.push({ isin, name: (v.name || '').slice(0, 28), stueck: r4(v.stueck), kosten: kost })
}
einstand = r2(einstand)
cash = r2(cash)
const investiert = r2(einstand + Math.max(0, cash))
top.sort((a, b) => b.kosten - a.kosten)

// Alternativdefinitionen
const altNurEinzahlungenNetto = r2(sumEinzahlungen - sumAuszahlungen)
const altKaeufeMinusVerkaeufe = r2(sumKaeufeEinstand - sumVerkaeufe) // sinnlos oft
const altEinstandOhneAktienDiv = r2(einstand - aktienDivEinstand) // rough

console.log(
  JSON.stringify(
    {
      ui: UI,
      nachgerechnet: {
        einstand,
        cash,
        cashClamped: Math.max(0, cash),
        investiert,
        deltaZuUi: r2(investiert - UI),
        positionen,
        geheiltTrades: geheiltN,
      },
      summen: {
        einzahlungen: r2(sumEinzahlungen),
        auszahlungen: r2(sumAuszahlungen),
        einzahlungenNetto: altNurEinzahlungenNetto,
        kaeufeEinstand: r2(sumKaeufeEinstand),
        verkaeufeCash: r2(sumVerkaeufe),
        dividenden: r2(sumDiv),
        gebuehren: r2(sumGebuehr),
        steuern: r2(sumSteuer),
        aktienDivEinstand: r2(aktienDivEinstand),
      },
      alternativeDefinitionen: {
        'A_Einstand+CashClamp (App/Parqet zugeführt offen)': investiert,
        'B_Nur Einzahlungen−Auszahlungen': altNurEinzahlungenNetto,
        'C_Einstand ohne Aktiendividenden-Einstand (rough)': altEinstandOhneAktienDiv,
      },
      top10Einstand: top.slice(0, 10),
      mobility: map.get('US60744M1062') || null,
      spgi: map.get('US78409V1044')
        ? {
            stueck: r4(map.get('US78409V1044').stueck),
            kosten: r2(map.get('US78409V1044').kosten),
          }
        : null,
    },
    null,
    2,
  ),
)
