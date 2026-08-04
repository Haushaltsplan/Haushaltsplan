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
let o = 0
for (;;) {
  const { data } = await sb
    .from('portfolio_analyse_buchung')
    .select('datum,typ,quelle,betrag_eur,isin,parqet_typ')
    .order('datum', { ascending: false })
    .range(o, o + 999)
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 1000) break
  o += 1000
}
const csv = rows.filter((b) => b.quelle !== 'pdf')
const lastBuy = csv.find((b) => b.typ === 'kauf')
console.log({
  lastCsvAny: csv[0],
  lastCsvBuy: lastBuy,
  csvCount: csv.length,
  pdfCount: rows.filter((b) => b.quelle === 'pdf').length,
  total: rows.length,
})
