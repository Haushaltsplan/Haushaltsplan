import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// reuse v2 logic quickly: print smallest cost positions + turbo-like names
const env = {}
for (const line of readFileSync(resolve('.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
let rows = []
let offset = 0
while (true) {
  const { data } = await sb.from('portfolio_analyse_buchung').select('isin,typ,stueck,betrag_eur,kurs_eur,parqet_typ,wertpapier_name,datum').order('datum').range(offset, offset + 999)
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 1000) break
  offset += 1000
}

const map = new Map()
for (const b of rows) {
  if (!b.isin || (b.typ !== 'kauf' && b.typ !== 'verkauf')) continue
  const isin = b.isin.toUpperCase()
  const cur = map.get(isin) ?? { stk: 0, name: b.wertpapier_name || isin }
  const s = Math.abs(b.stueck || 0)
  if (b.typ === 'kauf') cur.stk += s
  else cur.stk -= s
  if (b.wertpapier_name) cur.name = b.wertpapier_name
  map.set(isin, cur)
}
const open = [...map.entries()]
  .map(([isin, v]) => ({ isin, stk: Math.round(v.stk * 1e8) / 1e8, name: v.name }))
  .filter((p) => p.stk > 1e-8)
  .sort((a, b) => a.stk - b.stk)

console.log('open positions', open.length)
console.log('smallest 15', open.slice(0, 15))
console.log(
  'turbo/knockout-like',
  open.filter((p) => /turbo|mini|knock|hebel|warrant|zertifikat/i.test(p.name) || p.isin.startsWith('DE000')),
)
