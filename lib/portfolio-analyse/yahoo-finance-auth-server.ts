const YAHOO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

const CACHE_MS = 30 * 60 * 1000

export type YahooFinanceAuth = {
  crumb: string
  cookie: string
}

let cached: { auth: YahooFinanceAuth; at: number } | null = null

function parseSetCookie(res: Response, jar: Map<string, string>) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  for (const c of list) {
    const [kv] = c.split(';')
    const eq = kv.indexOf('=')
    if (eq > 0) jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim())
  }
  if (list.length > 0) return
  const single = res.headers.get('set-cookie')
  if (!single) return
  for (const part of single.split(/,(?=[^;]+?=)/)) {
    const [kv] = part.split(';')
    const eq = kv.indexOf('=')
    if (eq > 0) jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim())
  }
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

/** Cookie + Crumb für quoteSummary (Yahoo verlangt das seit 2024). */
export async function holeYahooFinanceAuth(): Promise<YahooFinanceAuth | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.auth

  const jar = new Map<string, string>()
  try {
    let res = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': YAHOO_UA },
      redirect: 'manual',
      cache: 'no-store',
    })
    parseSetCookie(res, jar)

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (loc) {
        res = await fetch(loc, {
          headers: { 'User-Agent': YAHOO_UA, Cookie: cookieHeader(jar) },
          cache: 'no-store',
        })
        parseSetCookie(res, jar)
      }
    }

    const cookie = cookieHeader(jar)
    res = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': YAHOO_UA, Cookie: cookie },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const crumb = (await res.text()).trim()
    if (!crumb) return null

    const auth = { crumb, cookie }
    cached = { auth, at: Date.now() }
    return auth
  } catch {
    return null
  }
}

export const YAHOO_FINANCE_FETCH_HEADERS = {
  'User-Agent': YAHOO_UA,
  Referer: 'https://finance.yahoo.com/',
  Accept: 'application/json',
} as const
