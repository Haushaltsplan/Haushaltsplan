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
const { data } = await sb.from('portfolio_analyse_buchung').select('datum').order('datum').limit(1)
const { data: data2 } = await sb.from('portfolio_analyse_buchung').select('datum').order('datum', { ascending: false }).limit(1)
const first = data?.[0]?.datum
const last = data2?.[0]?.datum
const d1 = new Date(`${first}T12:00:00`)
const d2 = new Date('2026-07-01T12:00:00')
const years = (d2 - d1) / (365.25 * 86400000)
const inv = 79836.68
const T = 94943.53
const totalReturn = T / inv - 1
const annual = (Math.pow(1 + totalReturn, 1 / years) - 1) * 100
console.log('first', first, 'years', years.toFixed(2))
console.log('simple total return', (totalReturn * 100).toFixed(2), '% annualized', annual.toFixed(2), '%')
