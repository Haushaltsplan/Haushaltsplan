/**
 * Wendet supabase/migrations/20260827140000_finanz_vermoegen_klasse.sql an.
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync, spawn } = require('child_process')

const root = path.join(__dirname, '..')
const sqlPath = path.join(root, 'supabase', 'migrations', '20260827140000_finanz_vermoegen_klasse.sql')

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local')
  if (!fs.existsSync(envPath)) return {}
  const out = {}
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[t.slice(0, i).trim()] = v
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

function resolveDbUrl(env) {
  const direct = env.DATABASE_URL || env.SUPABASE_DB_URL || env.DIRECT_URL
  if (direct) return direct
  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL || '')
  const pw = env.SUPABASE_DB_PASSWORD || env.POSTGRES_PASSWORD
  if (!ref || !pw) return null
  const host =
    env.SUPABASE_DB_HOST ||
    `aws-0-${env.SUPABASE_REGION || 'eu-central-1'}.pooler.supabase.com`
  const port = env.SUPABASE_DB_PORT || '6543'
  const user = env.SUPABASE_DB_USER || `postgres.${ref}`
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pw)}@${host}:${port}/postgres`
}

async function main() {
  const env = { ...process.env, ...loadEnvLocal() }
  const sql = fs.readFileSync(sqlPath, 'utf8')
  const dbUrl = resolveDbUrl(env)
  if (dbUrl) {
    const { Client } = require('pg')
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    await client.connect()
    await client.query(sql)
    await client.end()
    console.log('OK — finanz_vermoegen.klasse Migration angewendet.')
    return
  }
  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL || '')
  const dash = ref
    ? `https://supabase.com/dashboard/project/${ref}/sql/new`
    : 'https://supabase.com/dashboard'
  if (process.platform === 'win32') {
    const tmp = path.join(os.tmpdir(), `finanz-vermoegen-klasse-${Date.now()}.sql`)
    fs.writeFileSync(tmp, sql, 'utf8')
    const lit = tmp.replace(/'/g, "''")
    execSync(`powershell -NoProfile -Command "Get-Content -Raw -LiteralPath '${lit}' | Set-Clipboard"`)
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* ignore */
    }
    console.log('SQL in Zwischenablage. Dashboard öffnen → Paste → Run.')
    spawn('cmd', ['/c', 'start', '', dash], { detached: true, stdio: 'ignore' }).unref()
  } else {
    console.log(sql)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
