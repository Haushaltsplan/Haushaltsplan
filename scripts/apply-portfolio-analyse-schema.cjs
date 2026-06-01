/**
 * Wendet alle portfolio_analyse-Migrationen in supabase/migrations/ an.
 *
 * Automatisch: DATABASE_URL / SUPABASE_DB_URL / DIRECT_URL in .env.local
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync, spawn } = require('child_process')

const root = path.join(__dirname, '..')
const migrationsDir = path.join(root, 'supabase', 'migrations')

function portfolioAnalyseSqlDateien() {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.includes('portfolio_analyse') && f.endsWith('.sql'))
    .sort()
    .map((f) => path.join(migrationsDir, f))
}

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
    const tmp = path.join(os.tmpdir(), `portfolio-analyse-schema-${Date.now()}.sql`)
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
  const sqlPaths = portfolioAnalyseSqlDateien()
  if (sqlPaths.length === 0) {
    console.error('Keine portfolio_analyse-Migrationen in', migrationsDir)
    process.exit(1)
  }
  const sql = sqlPaths.map((p) => `-- ${path.basename(p)}\n${fs.readFileSync(p, 'utf8')}`).join('\n\n')
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
    console.log('Verbinde mit Datenbank und führe portfolio_analyse-Migrationen aus …')
    await client.connect()
    for (const p of sqlPaths) {
      console.log('  →', path.basename(p))
      await client.query(fs.readFileSync(p, 'utf8'))
    }
    await client.end()
    console.log('Fertig —', sqlPaths.length, 'Migration(en) angewendet.')
    return
  }

  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL || '')
  const dash = ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : 'https://supabase.com/dashboard'

  console.log('\n=== Kein DATABASE_URL in .env.local ===\n')
  console.log('Dateien:', sqlPaths.map((p) => path.basename(p)).join(', '))
  if (copySqlToClipboard(sql)) {
    console.log('\n→ SQL wurde in die Zwischenablage kopiert.\n')
  } else {
    console.log('\n→ Öffne die Datei oben und kopiere den Inhalt manuell.\n')
  }
  console.log('1) Browser öffnet sich — sonst:', dash)
  console.log('2) Strg+V einfügen, dann „Run“.')
  console.log('\nAutomatisch beim nächsten Mal: DATABASE_URL in .env.local → npm run db:portfolio-analyse\n')

  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', dash], { detached: true, stdio: 'ignore' }).unref()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
