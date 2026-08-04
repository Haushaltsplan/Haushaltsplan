import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const env = {}
for (const line of readFileSync(resolve('.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

for (const isin of ['US60744M1062', 'US78409V1044']) {
  const { data } = await sb
    .from('portfolio_analyse_buchung')
    .select('datum,typ,isin,stueck,betrag_eur,kurs_eur,parqet_typ,quelle')
    .eq('isin', isin)
    .order('datum')
  console.log('\n===', isin, 'count', data?.length)
  console.log(JSON.stringify(data, null, 2))
}
