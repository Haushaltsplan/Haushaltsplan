import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const env = {}
for (const line of readFileSync(resolve('.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const { data: spin } = await sb
  .from('portfolio_analyse_buchung')
  .select('datum,typ,isin,stueck,betrag_eur,kurs_eur,parqet_typ,wertpapier_name,quelle')
  .or('isin.eq.US60744M1062,parqet_typ.ilike.%spin%')
  .order('datum')

const { count: einzahlungen } = await sb
  .from('portfolio_analyse_buchung')
  .select('*', { count: 'exact', head: true })
  .eq('typ', 'einzahlung')

const { data: transferIn } = await sb
  .from('portfolio_analyse_buchung')
  .select('datum,isin,stueck,betrag_eur,parqet_typ,wertpapier_name')
  .ilike('parqet_typ', 'transferin')
  .order('datum')

let transferSum = 0
for (const t of transferIn ?? []) transferSum += t.betrag_eur

console.log(JSON.stringify({
  einzahlungen,
  spinOffZeilen: spin,
  transferInCount: transferIn?.length ?? 0,
  transferInSum: Math.round(transferSum * 100) / 100,
  transferInSample: (transferIn ?? []).slice(0, 5),
}, null, 2))
