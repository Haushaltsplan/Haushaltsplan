/**
 * Startet Google Chrome mit Remote-Debugging für Macrotrends-Scrapes.
 * Einmal Cloudflare/Turnstile im Fenster bestätigen — danach nutzt der
 * Next-Server dieselbe Session per CDP (Port 9222).
 *
 *   npm run macrotrends:chrome
 */
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const profile = path.join(root, '.cache', 'macrotrends-chrome-cdp')
const port = Number(process.env.MACROTRENDS_CDP_PORT || 9222)
const warm = 'https://www.macrotrends.net/stocks/charts/MSFT/microsoft/pe-ratio'

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH
  }
  const candidates = [
    path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  return candidates.find((p) => p && fs.existsSync(p))
}

const chrome = findChrome()
if (!chrome) {
  console.error('Chrome nicht gefunden. CHROME_PATH setzen.')
  process.exit(1)
}

fs.mkdirSync(profile, { recursive: true })
console.log(`Chrome CDP :${port}`)
console.log('Profil:', profile)
console.log('Nach Cloudflare-OK: „Alle aktualisieren“ / Einzeltitel in der App scrapen.')

const child = spawn(
  chrome,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    warm,
  ],
  { detached: true, stdio: 'ignore' },
)
child.unref()
