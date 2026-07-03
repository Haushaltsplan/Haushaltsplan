import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const raw = readFileSync(resolve('.env.local'), 'utf8')
const env = {}
for (const line of raw.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
let rows = []
for (let o = 0; ; o += 1000) {
  const { data } = await sb.from('portfolio_analyse_buchung').select('*').order('datum').range(o, o + 999)
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 1000) break
}

const TARGET_NET = 1692.87
const TARGET_BRUTTO = 2091.9
const TARGET_STEUER = 399.03
const TARGET_GEB = 316.75

// smartbroker in name
let sbDiv = 0
let noSb = 0
for (const r of rows) {
  if (r.typ !== 'dividende') continue
  const name = (r.wertpapier_name ?? '').toLowerCase()
  if (/smart\s*broker|smartbroker/.test(name)) sbDiv += r.betrag_eur
  else noSb += r.betrag_eur
}
console.log('smartbroker div', sbDiv, 'without', noSb, 'total', sbDiv + noSb)

// parqet only (csv from parqet export?)
let parqetTypDiv = 0
for (const r of rows) {
  if (r.typ !== 'dividende') continue
  if (/^dividend$/i.test(r.parqet_typ ?? '')) parqetTypDiv += r.betrag_eur
}
console.log('parqet_typ dividend', parqetTypDiv)

// exclude smartbroker + diff
console.log('noSb vs target net', noSb, 'diff', noSb - TARGET_NET)

// kauf fee: betrag - stueck*kurs
let feeFromKurs = 0
let feeFromIrr = 0
for (const r of rows) {
  if (r.typ !== 'kauf' && r.typ !== 'verkauf') continue
  const stk = Math.abs(r.stueck ?? 0)
  const kurs = r.kurs_eur
  if (stk > 0 && kurs > 0) {
    const hw = Math.round(stk * kurs * 100) / 100
    const diff = Math.abs(r.betrag_eur) - hw
    if (diff > 0.01) {
      if (r.typ === 'kauf') feeFromKurs += diff
      else feeFromKurs += diff // verkauf fee reduces proceeds
    }
  }
}
console.log('fee from kurs diff (kauf+verkauf)', feeFromKurs)

// only kauf
let kaufFee = 0
for (const r of rows) {
  if (r.typ !== 'kauf') continue
  const stk = Math.abs(r.stueck ?? 0)
  if (stk > 0 && r.kurs_eur > 0) {
    const hw = stk * r.kurs_eur
    if (r.betrag_eur > hw + 0.01) kaufFee += r.betrag_eur - hw
  }
}
console.log('kauf fee only', kaufFee)

// verkauf fee
let verkFee = 0
for (const r of rows) {
  if (r.typ !== 'verkauf') continue
  const stk = Math.abs(r.stueck ?? 0)
  if (stk > 0 && r.kurs_eur > 0) {
    const hw = stk * r.kurs_eur
    if (hw > r.betrag_eur + 0.01) verkFee += hw - r.betrag_eur
  }
}
console.log('verkauf fee (hw - betrag)', verkFee, 'sum fees', kaufFee + verkFee)

// parqet amount on dividend rows from raw - check if amount stored is gross in some imports
// csv rows with steuer
const withSteuer = rows.filter((r) => r.typ === 'dividende' && r.steuer_eur > 0)
console.log('div with steuer_eur', withSteuer.length, 'sum steuer', withSteuer.reduce((s, r) => s + r.steuer_eur, 0))

// Estimate: if all div gross = net / (1 - 0.19075)
const allNet = rows.filter((r) => r.typ === 'dividende').reduce((s, r) => s + r.betrag_eur, 0)
const estBrutto = allNet / (1 - TARGET_STEUER / TARGET_BRUTTO)
const estSteuer = estBrutto - allNet
console.log('\nest brutto from all net', estBrutto.toFixed(2), 'est steuer', estSteuer.toFixed(2))
console.log('est brutto noSb', (noSb / (1 - TARGET_STEUER / TARGET_BRUTTO)).toFixed(2))
