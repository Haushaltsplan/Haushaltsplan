/**
 * Lädt für Movers-KIs den **Fließtext** aus den Quellen-URLs (nicht nur RSS-Snippets).
 * Nutzt Mozilla Readability auf dem Server (Next.js Route/Server Components).
 */

import 'server-only'

const FETCH_TIMEOUT_MS = 12_000
const MAX_FLIESSTEXT_ZEICHEN = 16_000
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

function urlIstFuerFetchErlaubt(raw: string): boolean {
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const h = u.hostname.toLowerCase()
    if (h === 'localhost' || h.endsWith('.local') || /^127\.\d+\.\d+\.\d+$/.test(h)) return false
    if (h === '0.0.0.0' || h.startsWith('192.168.') || h.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(h))
      return false
    return true
  } catch {
    return false
  }
}

function bereinigeUndKuerzen(text: string): string | null {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length < 140) return null
  return t.length > MAX_FLIESSTEXT_ZEICHEN ? `${t.slice(0, MAX_FLIESSTEXT_ZEICHEN - 1)}…` : t
}

async function extrahiereLesetextAusHtml(html: string, url: string): Promise<string | null> {
  try {
    const { JSDOM } = await import('jsdom')
    const { Readability } = await import('@mozilla/readability')
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    let t = article?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (t.length < 160) {
      const ps = [...dom.window.document.querySelectorAll('p')]
        .map((p) => p.textContent?.trim() ?? '')
        .filter((x) => x.length > 40)
      t = ps.join('\n\n').replace(/\s+/g, ' ').trim()
    }
    return bereinigeUndKuerzen(t)
  } catch {
    return null
  }
}

/** Versucht eine Verlag-URL aus einer Google-News-Zwischenseite zu lesen (HTML kann sich ändern). */
function publisherUrlAusGoogleNewsHtml(html: string): string | null {
  const bekannte =
    /https:\/\/(?:www\.)?(?:reuters\.com|bloomberg\.com|cnbc\.com|marketwatch\.com|wsj\.com|ft\.com|investing\.com|finance\.yahoo\.com|businessinsider\.com|seekingalpha\.com)[^\s"'<>\\]*/gi
  let m = bekannte.exec(html)
  if (m) return m[0].replace(/\\+/g, '').replace(/&amp;/g, '&')

  const blocked =
    /google\.com|googleusercontent|gstatic|youtube\.com|youtu\.be|facebook\.com|twitter\.com|x\.com|instagram\.com|schema\.org/i

  const anchorRe = /<a[^>]+href=["'](https?:\/\/[^"'>\s]+)["']/gi
  let ma: RegExpExecArray | null
  while ((ma = anchorRe.exec(html))) {
    let u = ma[1].replace(/&amp;/g, '&')
    if (blocked.test(u)) continue
    if (u.includes('news.google.com')) continue
    if (u.length > 28) return u
  }
  return null
}

export async function holeNachrichtenFliesstext(url: string, tiefe = 0): Promise<string | null> {
  const raw = url.trim()
  if (!urlIstFuerFetchErlaubt(raw) || tiefe > 2) return null

  try {
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(raw, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })
    clearTimeout(tid)
    if (!res.ok) return null
    const html = await res.text()
    const finalUrl = res.url || raw

    let text = await extrahiereLesetextAusHtml(html, finalUrl)

    if (
      (!text || text.length < 260) &&
      /news\.google\.com/i.test(finalUrl) &&
      tiefe < 2
    ) {
      const weiter = publisherUrlAusGoogleNewsHtml(html)
      if (weiter && weiter !== raw && urlIstFuerFetchErlaubt(weiter)) {
        const zweit = await holeNachrichtenFliesstext(weiter, tiefe + 1)
        if (zweit && zweit.length >= (text?.length ?? 0)) text = zweit
      }
    }

    return text
  } catch {
    return null
  }
}

/** Pro Symbol bis zu N Artikel laden; begrenzte Parallelität gegenüber dem Datenbank-/Publisher-Spam. */
export async function ergaenzeMoversMitArtikelKoerper<
  T extends { schlagzeilen: Array<{ href: string }> },
>(
  zeilen: T[],
  opts?: { artikelProSymbol?: number; parallelitaet?: number },
): Promise<Array<T & { artikelKoerperTexte: string[] }>> {
  const artikelProSymbol = Math.max(1, Math.min(3, opts?.artikelProSymbol ?? 2))
  const parallelitaet = Math.max(2, Math.min(10, opts?.parallelitaet ?? 6))

  type Aufgabe = { zi: number; si: number; url: string }
  const aufgaben: Aufgabe[] = []
  zeilen.forEach((z, zi) => {
    z.schlagzeilen.forEach((s, si) => {
      if (si >= artikelProSymbol) return
      aufgaben.push({ zi, si, url: s.href })
    })
  })

  const koerper: string[][] = zeilen.map((z) => new Array(z.schlagzeilen.length).fill(''))

  for (let off = 0; off < aufgaben.length; off += parallelitaet) {
    const chunk = aufgaben.slice(off, off + parallelitaet)
    await Promise.all(
      chunk.map(async (a) => {
        const t = await holeNachrichtenFliesstext(a.url)
        koerper[a.zi][a.si] = t ?? ''
      }),
    )
  }

  return zeilen.map((z, zi) => ({
    ...z,
    artikelKoerperTexte: koerper[zi],
  }))
}
