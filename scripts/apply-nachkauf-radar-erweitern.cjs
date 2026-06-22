// Wendet die Erweiterungs-Migration für den Nachkauf-Radar an.
// Aufruf: npm run db:nachkauf-erweitern

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

async function run(sqlFile) {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', sqlFile), 'utf8')
  // Statements aufsplitten (ohne leere Strings)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'))

  let ok = 0
  let warn = 0
  for (const stmt of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt }).single()
      if (error) {
        console.warn(`  ⚠ ${error.message?.slice(0, 100)}`)
        warn++
      } else {
        ok++
      }
    } catch {
      warn++
    }
  }
  console.log(`  ${ok} Statements OK, ${warn} Warnungen (bereits existierende Spalten/Tabellen sind normal)`)
}

async function main() {
  console.log('Wende Migration an: 20260622200000_nachkauf_radar_erweitern.sql')
  await run('20260622200000_nachkauf_radar_erweitern.sql')
  console.log('Wende Migration an: 20260622180000_nachkauf_radar_verlauf.sql')
  await run('20260622180000_nachkauf_radar_verlauf.sql')
  console.log('')
  console.log('✅ Fertig. Falls rpc(exec_sql) nicht verfügbar: SQL direkt im Supabase SQL-Editor ausführen.')
  console.log('   Dateien unter: supabase/migrations/')
}

main().catch(e => { console.error(e); process.exit(1) })
