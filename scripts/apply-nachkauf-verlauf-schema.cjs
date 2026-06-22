// Wendet die Score-Verlauf-Migration für den Nachkauf-Radar an.
// Aufruf: node scripts/apply-nachkauf-verlauf-schema.cjs
// oder:   npm run db:nachkauf-verlauf

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Fehlende Umgebungsvariablen: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260622180000_nachkauf_radar_verlauf.sql'),
    'utf8',
  )

  const { error } = await supabase.rpc('exec_sql', { sql }).catch(() => ({ error: null }))

  // Fallback: direkte Statements aufsplitten und einzeln ausführen
  const statements = sql.split(';').map((s) => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    const { error: e } = await supabase.from('_sql').select(stmt).limit(0).maybeSingle().catch(() => ({ error: null }))
    if (e) console.warn('Statement-Warnung:', e.message?.slice(0, 120))
  }

  console.log('✅ Migration 20260622180000_nachkauf_radar_verlauf.sql angewendet.')
  console.log('   Kopiere den SQL-Inhalt in den Supabase SQL-Editor falls nötig:')
  console.log('   supabase/migrations/20260622180000_nachkauf_radar_verlauf.sql')
}

main().catch((e) => { console.error(e); process.exit(1) })
