/** Trades wo |stk×kurs − betrag| / betrag > 20% — oft falsche Gebühren-Spreads. */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
const env = {}
for (const line of raw.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
let rows = []
let offset = 0
while (true) {
  const { data } = await sb
    .from('portfolio_analyse_buchung')
    .select('datum,typ,isin,stueck,kurs_eur,betrag_eur,wertpapier_name')
    .in('typ', ['kauf', 'verkauf'])
    .order('datum')
    .range(offset, offset + 999)
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 1000) break
  offset += 1000
}

const bad = []
for (const b of rows) {
  const stk = Math.abs(b.stueck || 0)
  if (stk <= 0 || !(b.kurs_eur > 0) || !(b.betrag_eur > 0)) continue
  const hw = Math.round(stk * b.kurs_eur * 100) / 100
  const diff = Math.abs(hw - b.betrag_eur)
  const pct = diff / b.betrag_eur
  if (pct > 0.2 && diff > 5) {
    bad.push({
      datum: b.datum,
      typ: b.typ,
      isin: b.isin,
      stk,
      kurs: b.kurs_eur,
      betrag: b.betrag_eur,
      hw,
      diff: Math.round(diff * 100) / 100,
      pct: Math.round(pct * 1000) / 10,
      name: (b.wertpapier_name || '').slice(0, 40),
    })
  }
}
bad.sort((a, b) => b.diff - a.diff)
console.log('inkonsistent:', bad.length)
console.log(JSON.stringify(bad.slice(0, 25), null, 2))
console.log(
  'summe abs diff (würde als Fee fehlgezählt):',
  Math.round(bad.reduce((s, x) => s + x.diff, 0) * 100) / 100,
)
