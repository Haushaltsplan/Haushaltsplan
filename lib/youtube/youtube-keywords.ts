/** YouTube-Suchleisten-Vorschläge — kein VidIQ, keine search.list-Quota. */

export async function sucheYoutubePhrasen(ticker: string, firmenname: string): Promise<string[]> {
  const name = firmenname.split(/[,(]/)[0]?.trim() || firmenname
  const seeds = [`${ticker}`, `${ticker} moat`, `${ticker} stock`, `${name} moat`, `${name} stock`].filter(
    (s, i, a) => s.length >= 2 && a.indexOf(s) === i,
  )
  const treffer = await Promise.all(seeds.slice(0, 4).map((q) => youtubeSuggest(q)))
  const nadeln = [ticker, ...name.split(/\s+/).filter((w) => w.length > 2)].map((w) => w.toLowerCase())
  const unique: string[] = []
  for (const liste of treffer) {
    for (const s of liste) {
      const n = s.replace(/\s+/g, ' ').trim()
      if (n.length < 4 || n.length > 48) continue
      const low = n.toLowerCase()
      if (!nadeln.some((w) => low.includes(w))) continue
      if (unique.some((u) => u.toLowerCase() === low)) continue
      unique.push(n)
      if (unique.length >= 6) return unique
    }
  }
  return unique
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
