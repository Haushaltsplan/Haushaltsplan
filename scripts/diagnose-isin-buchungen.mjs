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
const isin = process.argv[2] || 'US60744M1062'
const { data, error } = await sb
  .from('portfolio_analyse_buchung')
  .select('*')
  .eq('isin', isin)
  .order('datum')
if (error) throw error
for (const b of data ?? []) {
  const stk = Math.abs(b.stueck ?? 0)
  const hw = stk > 0 && b.kurs_eur > 0 ? Math.round(stk * b.kurs_eur * 100) / 100 : null
  console.log({
    datum: b.datum,
    typ: b.typ,
    stueck: b.stueck,
    kurs: b.kurs_eur,
    betrag: b.betrag_eur,
    hw,
    ratio: hw && b.betrag_eur ? Math.round((hw / b.betrag_eur) * 100) / 100 : null,
    name: b.wertpapier_name,
    quelle: b.quelle,
    parqet: b.parqet_typ,
  })
}
