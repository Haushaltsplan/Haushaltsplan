// Wendet supabase/migrations/20261024190000_youtube_oauth.sql an.
// Aufruf: npm run db:youtube-oauth

const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

const root = path.join(__dirname, '..')
const sqlFile = '20261024190000_youtube_oauth.sql'
const sqlPath = path.join(root, 'supabase', 'migrations', sqlFile)

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local')
  if (!fs.existsSync(envPath)) return {}
  const out = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[k] = v
  }
  return out
}

function projectRefFromUrl(url) {
  try {
    return new URL(url).hostname.split('.')[0] || null
  } catch {
    return null
  }
}

function copySqlToClipboard(sql) {
  if (process.platform !== 'win32') return false
  const tmp = path.join(os.tmpdir(), `youtube-oauth-${Date.now()}.sql`)
  fs.writeFileSync(tmp, sql, 'utf8')
  const lit = tmp.replace(/'/g, "''")
  execSync(`powershell -NoProfile -Command "Get-Content -Raw -LiteralPath '${lit}' | Set-Clipboard"`, { stdio: 'inherit' })
  try {
    fs.unlinkSync(tmp)
  } catch {
    /* ignore */
  }
  return true
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() }
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
    await client.connect()
    await client.query(sql)
    await client.end()
    console.log('Fertig — youtube_oauth_tokens und youtube_oauth_pending sind angelegt.')
    return
  }

  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL || '')
  const dash = ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : 'https://supabase.com/dashboard'
  console.log('Kein DATABASE_URL in .env.local — SQL manuell im Editor ausführen.')
  console.log('Datei:', sqlPath)
  if (copySqlToClipboard(sql)) console.log('SQL liegt in der Zwischenablage.')
  console.log('Editor:', dash)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
