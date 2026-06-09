/**
 * Einmalig: Passwort für Supabase-Login setzen (ohne Recovery-E-Mail).
 *
 * Voraussetzung in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...   (Supabase → Project Settings → API)
 *
 * Nutzung (nur lokal am PC):
 *   node scripts/set-auth-password.cjs deine@email.de
 *
 * Das Passwort wird interaktiv abgefragt (nicht in der Shell-History).
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')
const { createClient } = require('@supabase/supabase-js')

const root = path.join(__dirname, '..')

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

function fragePasswort(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(prompt, (antwort) => {
      rl.close()
      resolve(antwort)
    })
  })
}

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    console.error('Nutzung: node scripts/set-auth-password.cjs deine@email.de')
    process.exit(1)
  }

  const env = { ...loadEnvLocal(), ...process.env }
  const url = (env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) {
    console.error(
      'Fehlt in .env.local: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY\n' +
        '(Supabase → Project Settings → API → service_role secret)',
    )
    process.exit(1)
  }

  const pass1 = await fragePasswort('Neues Passwort: ')
  const pass2 = await fragePasswort('Passwort wiederholen: ')
  if (!pass1 || pass1.length < 8) {
    console.error('Passwort mindestens 8 Zeichen.')
    process.exit(1)
  }
  if (pass1 !== pass2) {
    console.error('Passwörter stimmen nicht überein.')
    process.exit(1)
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: liste, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) {
    console.error('Nutzerliste fehlgeschlagen:', listErr.message)
    process.exit(1)
  }

  const user = (liste.users || []).find((u) => (u.email || '').toLowerCase() === email)
  if (!user) {
    console.error(`Kein Nutzer mit E-Mail ${email} gefunden.`)
    process.exit(1)
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, { password: pass1 })
  if (updErr) {
    console.error('Passwort setzen fehlgeschlagen:', updErr.message)
    process.exit(1)
  }

  console.log(`Passwort für ${email} gesetzt. Jetzt in der Omnia-App mit E-Mail + Passwort anmelden.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
