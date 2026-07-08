/** npx tsx scripts/probe-sa-macrotrends-slug.ts */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const slugs = [
  'straumann-holding',
  'sika',
  'halma',
  'wolters-kluwer',
  'hermes-international',
  'asml-holding',
  'lin',
]
async function main() {
  for (const slug of slugs) {
    for (const m of ['revenue-by-segment', 'revenue-by-geography']) {
      const p = `/stocks/${slug}/metrics/${m}/`
      const r = await fetch(`https://stockanalysis.com${p}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12_000) })
      if (r.ok) {
        const t = await r.text()
        if (/Date|Period Ending/i.test(t)) console.log('OK', p, t.length)
      }
    }
  }
}
main()
