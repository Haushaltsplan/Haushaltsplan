/**
 * Macrotrends-Heim-Relay für die öffentliche App (Vercel).
 *
 * 1) Startet Chrome-CDP (Cloudflare einmal bestätigen)
 * 2) HTTP-Server :8787 — POST /fetch { url } → HTML
 * 3) Cloudflare-Tunnel → öffentliche HTTPS-URL
 *
 * Die Tunnel-URL + Secret in Vercel Env setzen:
 *   MACROTRENDS_RELAY_URL=https://….trycloudflare.com
 *   MACROTRENDS_RELAY_SECRET=… (steht in .cache/macrotrends-relay-secret.txt)
 *
 *   npm run macrotrends:relay
 */

import { createServer } from 'http'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const cacheDir = path.join(root, '.cache')
const profile = path.join(cacheDir, 'macrotrends-chrome-cdp')
const secretFile = path.join(cacheDir, 'macrotrends-relay-secret.txt')
const urlFile = path.join(cacheDir, 'macrotrends-relay-url.txt')
const cloudflared = path.join(cacheDir, 'bin', 'cloudflared.exe')

const CDP_PORT = Number(process.env.MACROTRENDS_CDP_PORT || 9222)
const RELAY_PORT = Number(process.env.MACROTRENDS_RELAY_PORT || 8787)
const WARM = 'https://www.macrotrends.net/stocks/charts/MSFT/microsoft/pe-ratio'

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH
  const cands = [
    path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  ]
  return cands.find((p) => p && fs.existsSync(p))
}

function ensureSecret() {
  fs.mkdirSync(cacheDir, { recursive: true })
  if (fs.existsSync(secretFile)) return fs.readFileSync(secretFile, 'utf8').trim()
  const s = crypto.randomBytes(24).toString('hex')
  fs.writeFileSync(secretFile, s, 'utf8')
  return s
}

async function cdpUp() {
  try {
    const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`, { signal: AbortSignal.timeout(1500) })
    return r.ok
  } catch {
    return false
  }
}

function startChrome() {
  const chrome = findChrome()
  if (!chrome) throw new Error('Chrome nicht gefunden (CHROME_PATH)')
  fs.mkdirSync(profile, { recursive: true })
  console.log(`Chrome CDP :${CDP_PORT}`)
  const child = spawn(
    chrome,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      WARM,
    ],
    { detached: true, stdio: 'ignore' },
  )
  child.unref()
}

async function waitCdp(ms = 25_000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (await cdpUp()) return
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('Chrome-CDP nicht erreichbar')
}

let browser
let page
let nav = Promise.resolve()

async function ensurePage() {
  if (!browser) {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`)
  }
  const ctx = browser.contexts()[0] ?? (await browser.newContext())
  if (!page || page.isClosed()) {
    page = await ctx.newPage()
  }
  return page
}

async function fetchHtml(url) {
  await nav
  let release
  nav = new Promise((r) => {
    release = r
  })
  try {
    const p = await ensurePage()
    try {
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    } catch (e) {
      const msg = String(e?.message || e)
      if (!/ERR_ABORTED|interrupted/i.test(msg)) throw e
    }
    const deadline = Date.now() + 45_000
    while (Date.now() < deadline) {
      const title = await p.title().catch(() => '')
      const html = await p.content().catch(() => '')
      const cf = /just a moment|nur einen moment/i.test(title) || /just a moment|turnstile/i.test(html.slice(0, 4000))
      const ok =
        !cf &&
        (html.includes('var originalData') ||
          html.includes('var chartData') ||
          html.includes('var dataDaily') ||
          html.length > 40_000)
      if (ok) return html
      if (!cf && html.length > 8_000) return html
      await new Promise((r) => setTimeout(r, 1000))
    }
    const html = await p.content()
    if (/just a moment/i.test(html.slice(0, 2000))) {
      throw new Error('Cloudflare noch aktiv — Checkbox im Chrome-Fenster bestätigen')
    }
    return html
  } finally {
    release()
  }
}

function startServer(secret) {
  const server = createServer(async (req, res) => {
    const send = (code, obj) => {
      res.writeHead(code, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(obj))
    }
    if (req.method === 'GET' && req.url === '/health') {
      return send(200, { ok: true })
    }
    if (req.method !== 'POST' || req.url !== '/fetch') {
      return send(404, { ok: false, error: 'not found' })
    }
    const auth = req.headers.authorization || ''
    if (auth !== `Bearer ${secret}`) {
      return send(401, { ok: false, error: 'unauthorized' })
    }
    let body = ''
    for await (const chunk of req) body += chunk
    let url
    try {
      url = JSON.parse(body).url
    } catch {
      return send(400, { ok: false, error: 'bad json' })
    }
    if (!url || typeof url !== 'string' || !url.startsWith('https://www.macrotrends.net/')) {
      return send(400, { ok: false, error: 'url must be macrotrends.net https' })
    }
    try {
      const html = await fetchHtml(url)
      return send(200, { ok: true, html, len: html.length })
    } catch (e) {
      return send(502, { ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  })
  server.listen(RELAY_PORT, '127.0.0.1', () => {
    console.log(`Relay http://127.0.0.1:${RELAY_PORT}`)
  })
  return server
}

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (!(k in process.env)) process.env[k] = v
  }
}

async function registerRelayInSupabase(baseUrl, secret) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    console.warn('Supabase-Env fehlt — Relay nur lokal/Env, nicht in DB registriert.')
    return
  }
  const secret_hash = crypto.createHash('sha256').update(secret).digest('hex')
  const res = await fetch(`${url}/rest/v1/macrotrends_scrape_relay?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      id: 1,
      base_url: baseUrl,
      secret_hash,
      secret_plain: secret,
      updated_at: new Date().toISOString(),
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    console.warn('Supabase-Register fehlgeschlagen:', res.status, t.slice(0, 200))
    console.warn('→ Migration 20260922210000_macrotrends_scrape_relay.sql ausführen.')
  } else {
    console.log('Relay in Supabase registriert — öffentliche App findet die URL automatisch.')
  }
}

function startTunnel(secret) {
  if (!fs.existsSync(cloudflared)) {
    console.warn('cloudflared fehlt (.cache/bin/cloudflared.exe) — nur lokaler Relay.')
    return null
  }
  console.log('Starte Cloudflare-Tunnel …')
  const child = spawn(cloudflared, ['tunnel', '--url', `http://127.0.0.1:${RELAY_PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let registered = false
  const onData = (buf) => {
    const t = buf.toString()
    process.stdout.write(t)
    const m = t.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
    if (m && !registered) {
      registered = true
      fs.writeFileSync(urlFile, m[0], 'utf8')
      console.log('\n========== Vercel (optional, falls keine DB) ==========')
      console.log(`MACROTRENDS_RELAY_URL=${m[0]}`)
      console.log(`MACROTRENDS_RELAY_SECRET=${secret}`)
      console.log('======================================================\n')
      console.log('Fenster + Tunnel offen lassen während öffentlichem Scrape.')
      void registerRelayInSupabase(m[0], secret)
    }
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  child.on('exit', (code) => console.warn('cloudflared exit', code))
  return child
}

loadEnvLocal()
const secret = ensureSecret()
if (!(await cdpUp())) {
  startChrome()
  await waitCdp()
}
console.log('Secret:', secretFile)
startServer(secret)
startTunnel(secret)
