/** npx tsx scripts/probe-sa-segment-margen.ts */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

async function probe(slug: string) {
  for (const path of [
    `/stocks/${slug}/metrics/revenue-by-segment/`,
    `/stocks/${slug}/metrics/operating-income-by-segment/`,
    `/stocks/${slug}/metrics/operating-margin-by-segment/`,
    `/stocks/${slug}/metrics/`,
  ]) {
    const r = await fetch(`https://stockanalysis.com${path}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) })
    const t = await r.text()
    if (!r.ok) continue
    const labels = [...t.matchAll(/>([^<]{8,70}(?:margin|Margin|operating income|Operating Income)[^<]{0,30})</g)].map((m) =>
      m[1]!.trim(),
    )
    if (labels.length) console.log(slug, path.replace(`/stocks/${slug}/metrics/`, ''), [...new Set(labels)].slice(0, 6))
  }
}

async function main() {
  for (const slug of ['googl', 'msft', 'now']) await probe(slug)
}

main()
