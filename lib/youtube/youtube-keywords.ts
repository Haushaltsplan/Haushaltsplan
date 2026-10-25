/** YouTube-Suchleisten-Vorschläge — kein VidIQ, keine search.list-Quota. */

const RECHTSFORM =
  /\b(inc|incorporated|corp|corporation|ltd|limited|plc|sa|se|nv|ag|holding|holdings|group|company|co)\b\.?/gi

const FINANZ =
  /\b(stock|stocks|share|shares|moat|earnings|dividend|investing|investor|valuation|margin|monopoly|business|guidance|eps|revenue)\b/i

export function firmenKurzname(firmenname: string): string {
  const roh = firmenname.split(/[,(]/)[0]?.trim() || firmenname.trim()
  const ohne = roh.replace(RECHTSFORM, ' ').replace(/\s+/g, ' ').trim()
  return ohne || roh
}

function alsWort(nadel: string, text: string): boolean {
  const n = nadel.trim()
  if (n.length < 2) return false
  const re = new RegExp(`(?:^|[^a-z0-9])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^a-z0-9]|$)`, 'i')
  return re.test(text)
}

/** Kurze Ticker (MA, AI, ON) dürfen nicht als Teilstring in Markiplier oder Marvel matchen. */
export function phrasePasst(phrase: string, ticker: string, firmenname: string): boolean {
  const text = phrase.replace(/\s+/g, ' ').trim()
  if (text.length < 4 || text.length > 48) return false
  const name = firmenKurzname(firmenname)
  const namen = name.split(/\s+/).filter((w) => w.length >= 4)
  if (namen.some((w) => alsWort(w, text))) return true
  const tk = ticker.trim()
  if (tk.length >= 4 && alsWort(tk, text)) return true
  if (tk.length >= 2 && alsWort(tk, text) && FINANZ.test(text)) return true
  return false
}

export async function sucheYoutubePhrasen(
  ticker: string,
  firmenname: string,
  thema: 'moat' | 'earnings' = 'moat',
): Promise<string[]> {
  const name = firmenKurzname(firmenname)
  const kern = name.length >= 4 ? name : ticker.trim()
  const tickerSeed = ticker.trim().length >= 4 ? ticker.trim() : ''
  const seeds =
    thema === 'earnings'
      ? [`${kern} earnings`, `${kern} earnings call`, `${kern} stock`, tickerSeed ? `${tickerSeed} earnings` : '']
      : [`${kern} moat`, `${kern} stock`, `${kern} monopoly`, tickerSeed ? `${tickerSeed} stock` : '']
  const einzig = seeds.filter((s, i, a) => s.trim().length >= 4 && a.indexOf(s) === i)
  const treffer = await Promise.all(einzig.slice(0, 4).map((q) => youtubeSuggest(q)))
  const unique: string[] = []
  const merke = (roh: string) => {
    const n = roh.replace(/\s+/g, ' ').trim()
    if (!phrasePasst(n, ticker, firmenname)) return
    if (unique.some((u) => u.toLowerCase() === n.toLowerCase())) return
    unique.push(n)
  }
  for (const liste of treffer) {
    for (const s of liste) merke(s)
  }
  merke(`${kern} ${thema}`)
  merke(`${kern} stock`)
  return unique.slice(0, 6)
}

async function youtubeSuggest(q: string): Promise<string[]> {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=en&q=${encodeURIComponent(q)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(4_000) })
    if (!res.ok) return []
    const j = (await res.json()) as unknown
    const liste = Array.isArray(j) && Array.isArray(j[1]) ? j[1] : []
    return liste.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}
