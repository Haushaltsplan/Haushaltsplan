/**
 * Wendet supabase/migrations/20260502143000_investment_portfolio.sql an (Portfolio unter Investments).
 *
 * Automatisch: DATABASE_URL / SUPABASE_DB_URL / DIRECT_URL in .env.local
 *
 * Ohne DB-URL: SQL → Zwischenablage + Hinweis zum Supabase-SQL-Editor.
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync, spawn } = require('child_process')

const root = path.join(__dirname, '..')
const sqlPath = path.join(root, 'supabase', 'migrations', '20260502143000_investment_portfolio.sql')

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local')
  if (!fs.existsSync(envPath)) return {}
  const raw = fs.readFileSync(envPath, 'utf8')
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

function projectRefFromUrl(url) {
  try {
    const h = new URL(url).hostname
    return h.split('.')[0] || null
  } catch {
    return null
  }
}

function copySqlToClipboard(sql) {
  if (process.platform === 'win32') {
    const tmp = path.join(os.tmpdir(), `investment-portfolio-schema-${Date.now()}.sql`)
    fs.writeFileSync(tmp, sql, 'utf8')
    const lit = tmp.replace(/'/g, "''")
    execSync(`powershell -NoProfile -Command "Get-Content -Raw -LiteralPath '${lit}' | Set-Clipboard"`, {
      stdio: 'inherit',
    })
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* ignore */
    }
    return true
  }
  return false
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() }
  if (!fs.existsSync(sqlPath)) {
    console.error('SQL fehlt:', sqlPath)
    process.exit(1)
  }
  const sql = fs.readFileSync(sqlPath, 'utf8')
  const dbUrl = env.DATABASE_URL || env.SUPABASE_DB_URL || env.DIRECT_URL

  if (dbUrl) {
    let Client
    try {
      Client = require('pg').Client
    } catch {
      console.error('Paket "pg" fehlt. Bitte ausführen: npm install')
      process.exit(1)
    }
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    console.log('Verbinde mit Datenbank und führe investment_portfolio-Migration aus …')
    await client.connect()
    await client.query(sql)
    await client.end()
    console.log('Fertig — investment_portfolio_flag und investment_portfolio_position sind angelegt.')
    console.log('Supabase Dashboard ggf. neu laden; dann Portfolio-Löschen/Speichern erneut testen.')
    return
  }

  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL || '')
  const dash = ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : 'https://supabase.com/dashboard'

  console.log('\n=== Kein DATABASE_URL in .env.local ===\n')
  console.log('Datei:', sqlPath)
  if (copySqlToClipboard(sql)) {
    console.log('\n→ SQL wurde in die Zwischenablage kopiert.\n')
  } else {
    console.log('\n→ Öffne die Datei oben und kopiere den Inhalt manuell.\n')
  }
  console.log('1) Browser öffnet sich — sonst:', dash)
  console.log('2) Strg+V einfügen, dann „Run“.')
  console.log('\nAutomatisch beim nächsten Mal: DATABASE_URL in .env.local → npm run db:investment-portfolio\n')

  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', dash], { detached: true, stdio: 'ignore' }).unref()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
