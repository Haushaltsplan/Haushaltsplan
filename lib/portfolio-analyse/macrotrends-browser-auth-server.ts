/**
 * Macrotrends hinter Cloudflare Turnstile:
 * Node-fetch + Cookies reicht nicht (cf_clearance ist an den Browser gebunden).
 * Abruf läuft über echtes Chrome per CDP (connectOverCDP), Navigationen strikt seriell.
 *
 * Setup: `npm run macrotrends:chrome` — einmal Challenge im Fenster bestätigen.
 * Optional: MACROTRENDS_CDP_PORT (Standard 9222), MACROTRENDS_AUTO_LAUNCH=0 zum Abschalten.
 */

import 'server-only'

import { spawn, type ChildProcess } from 'child_process'
import fs from 'fs'
import http from 'http'
import path from 'path'
import type { Browser, BrowserContext, Page } from 'playwright'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const WARM_URL = 'https://www.macrotrends.net/stocks/charts/MSFT/microsoft/pe-ratio'
const PROFILE_DIR = path.join(process.cwd(), '.cache', 'macrotrends-chrome-cdp')
const DEFAULT_CDP_PORT = 9222
const CHALLENGE_WAIT_MS = 120_000
const NAV_TIMEOUT_MS = 90_000

type MtState = {
  browser: Browser | null
  context: BrowserContext | null
  page: Page | null
  connectPromise: Promise<BrowserContext> | null
  chromeProc: ChildProcess | null
  forceBrowser: boolean
  navQueue: Promise<void>
}

const g = globalThis as unknown as { __macrotrendsMt?: MtState }

function state(): MtState {
  if (!g.__macrotrendsMt) {
    g.__macrotrendsMt = {
      browser: null,
      context: null,
      page: null,
      connectPromise: null,
      chromeProc: null,
      forceBrowser: false,
      navQueue: Promise.resolve(),
    }
  }
  return g.__macrotrendsMt
}

function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
}

function cdpPort(): number {
  const n = Number(process.env.MACROTRENDS_CDP_PORT ?? DEFAULT_CDP_PORT)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CDP_PORT
}

function autoLaunchErlaubt(): boolean {
  return process.env.MACROTRENDS_AUTO_LAUNCH !== '0'
}

function chromePfad(): string | null {
  const env = process.env.CHROME_PATH?.trim()
  if (env && fs.existsSync(env)) return env
  const candidates = [
    path.join(process.env['ProgramFiles'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  return candidates.find((p) => p && fs.existsSync(p)) ?? null
}

function cdpErreichbar(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, { timeout: 1500 }, (res) => {
      res.resume()
      resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 500)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

function starteChromeCdp(port: number): void {
  const chrome = chromePfad()
  if (!chrome) {
    console.warn(
      '[macrotrends-auth] Chrome nicht gefunden. Setze CHROME_PATH oder starte: npm run macrotrends:chrome',
    )
    return
  }
  fs.mkdirSync(PROFILE_DIR, { recursive: true })
  const st = state()
  if (st.chromeProc && !st.chromeProc.killed) return

  console.info(`[macrotrends-auth] Starte Chrome (CDP :${port}) — ggf. Cloudflare im Fenster bestätigen`)
  st.chromeProc = spawn(
    chrome,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      WARM_URL,
    ],
    { detached: true, stdio: 'ignore', windowsHide: false },
  )
  st.chromeProc.unref()
}

async function warteAufCdp(port: number, maxMs: number): Promise<boolean> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    if (await cdpErreichbar(port)) return true
    await pause(500)
  }
  return false
}

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function istChallengeHtml(html: string, title?: string): boolean {
  if (title && /just a moment|nur einen moment/i.test(title)) return true
  const kopf = html.slice(0, 8_000)
  return /just a moment|cf-mitigated|challenge-platform|turnstile/i.test(kopf)
}

function htmlHatDaten(html: string): boolean {
  return (
    html.includes('var originalData') ||
    html.includes('var chartData') ||
    html.includes('var dataDaily') ||
    html.length > 50_000
  )
}

async function connectOverCdp(port: number): Promise<BrowserContext> {
  const { chromium } = await import('playwright')
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 8_000 })
  const context = browser.contexts()[0] ?? (await browser.newContext({ userAgent: USER_AGENT }))
  const st = state()
  st.browser = browser
  st.context = context
  return context
}

async function warteChallengeWeg(page: Page, maxMs: number): Promise<boolean> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const title = await page.title().catch(() => '')
    const html = await page.content().catch(() => '')
    if (!istChallengeHtml(html, title) && htmlHatDaten(html)) return true
    if (!istChallengeHtml(html, title) && html.length > 15_000) return true
    await pause(1_500)
  }
  const title = await page.title().catch(() => '')
  const html = await page.content().catch(() => '')
  return !istChallengeHtml(html, title) && html.length > 5_000
}

async function scrapePage(context: BrowserContext): Promise<Page> {
  const st = state()
  if (st.page && !st.page.isClosed()) return st.page
  // Eigene Tab-Seite — nicht die Warm-URL-Tabs mischen
  const page = await context.newPage()
  st.page = page
  return page
}

/** Stellt CDP-Chrome bereit (verbindet oder startet). */
export async function ensureMacrotrendsBrowser(): Promise<BrowserContext | null> {
  if (isServerless()) {
    console.warn(
      '[macrotrends-auth] Vercel/Serverless — Chrome-CDP nicht möglich. Lokal scrapen: npm run macrotrends:chrome + npm run dev.',
    )
    return null
  }

  const st = state()
  if (st.context) {
    try {
      await st.context.pages()
      return st.context
    } catch {
      st.context = null
      st.browser = null
      st.page = null
    }
  }
  if (st.connectPromise) return st.connectPromise

  st.connectPromise = (async () => {
    const port = cdpPort()
    try {
      if (!(await cdpErreichbar(port))) {
        if (!autoLaunchErlaubt()) {
          throw new Error(
            `Kein Chrome-CDP auf :${port}. Starte: npm run macrotrends:chrome`,
          )
        }
        starteChromeCdp(port)
        const ok = await warteAufCdp(port, 20_000)
        if (!ok) {
          throw new Error(`Chrome-CDP :${port} nicht erreichbar nach Start`)
        }
      }

      const context = await connectOverCdp(port)

      // Warm-Tab nur für Challenge; Scrapes nutzen eigene Seite
      let warm = context.pages().find((p) => p.url().includes('macrotrends.net'))
      if (!warm) {
        warm = context.pages()[0] ?? (await context.newPage())
        await warm.goto(WARM_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
      }
      const cleared = await warteChallengeWeg(warm, CHALLENGE_WAIT_MS)
      if (!cleared) {
        console.warn(
          '[macrotrends-auth] Cloudflare noch aktiv — bitte Checkbox im Chrome-Fenster bestätigen, dann Scrape erneut.',
        )
      } else {
        console.info('[macrotrends-auth] Chrome-CDP bereit (Cloudflare ok)')
      }

      st.page = null // scrapePage legt eigene Seite an
      return context
    } finally {
      st.connectPromise = null
    }
  })()

  try {
    return await st.connectPromise
  } catch (e) {
    console.warn(
      '[macrotrends-auth] Browser-Setup fehlgeschlagen:',
      e instanceof Error ? e.message : e,
    )
    return null
  }
}

async function gotoUndLesen(page: Page, url: string): Promise<string | null> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Macrotrends/CF bricht Navigation oft ab, obwohl die Seite schon da ist.
    if (!/ERR_ABORTED|interrupted by another navigation/i.test(msg)) throw e
    const early = await page.content().catch(() => '')
    if (early && htmlHatDaten(early) && !istChallengeHtml(early)) return early
  }

  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    const title = await page.title().catch(() => '')
    const html = await page.content().catch(() => '')
    if (istChallengeHtml(html, title)) {
      const ok = await warteChallengeWeg(page, CHALLENGE_WAIT_MS)
      if (!ok) return null
      continue
    }
    if (htmlHatDaten(html) || html.length > 8_000) return html
    await pause(800)
  }
  const html = await page.content().catch(() => '')
  return html && !istChallengeHtml(html) ? html : null
}

/** HTML über Chrome-CDP laden (einziger zuverlässiger Weg hinter Turnstile). */
export async function fetchMacrotrendsHtmlViaBrowser(url: string): Promise<string | null> {
  const st = state()
  await st.navQueue
  let release!: () => void
  st.navQueue = new Promise((r) => {
    release = r
  })

  try {
    const context = await ensureMacrotrendsBrowser()
    if (!context) return null

    const page = await scrapePage(context)
    st.forceBrowser = true

    try {
      return await gotoUndLesen(page, url)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // ERR_ABORTED / interrupted: einmal neue Seite, erneut
      if (/ERR_ABORTED|interrupted by another navigation/i.test(msg)) {
        console.warn('[macrotrends-auth] Navigation abgebrochen — Retry mit neuem Tab')
        try {
          if (st.page && !st.page.isClosed()) await st.page.close().catch(() => undefined)
        } catch {
          /* ignore */
        }
        st.page = null
        const page2 = await scrapePage(context)
        try {
          return await gotoUndLesen(page2, url)
        } catch (e2) {
          console.warn(
            '[macrotrends-auth] Navigation fehlgeschlagen:',
            e2 instanceof Error ? e2.message : e2,
          )
          return null
        }
      }
      console.warn('[macrotrends-auth] Navigation fehlgeschlagen:', msg)
      return null
    }
  } finally {
    release()
  }
}

export function macrotrendsPreferBrowser(): boolean {
  return state().forceBrowser
}

export function markMacrotrendsBrowserRequired(): void {
  state().forceBrowser = true
}

/** true wenn Chrome-CDP schon lauscht — dann sofort Browser-Pfad, kein Node-403. */
export async function macrotrendsCdpVerfuegbar(): Promise<boolean> {
  return cdpErreichbar(cdpPort())
}

/** @deprecated Cookie-Pfad — CF bindet Clearance an den Browser; nur noch Env-Stub. */
export async function ensureMacrotrendsCookies(_force = false): Promise<string> {
  return (process.env.MACROTRENDS_COOKIE ?? process.env.MACROTRENDS_CF_COOKIE ?? '').trim()
}

export function macrotrendsUserAgent(): string {
  return USER_AGENT
}

export function invalidateMacrotrendsCookies(): void {
  // Browser-Session behalten
}
