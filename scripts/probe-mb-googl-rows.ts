/** npx tsx scripts/probe-mb-googl-rows.ts */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

async function main() {
  const html = await fetch('https://www.marketbeat.com/stocks/NASDAQ/GOOGL/financials/', {
    headers: { 'User-Agent': UA },
  }).then((r) => r.text())

  const start = html.indexOf('Annual Balance Sheet')
  const chunk = html.slice(start, start + 400_000)
  for (const m of chunk.matchAll(/<tr[^>]*id="(row-[^"]+-yBal)"[\s\S]*?<\/tr>/gi)) {
    const label =
      m[0].match(/<td[^>]*>(?:<div[^>]*><\/div>)?([^<]+)<\/td>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? ''
    if (/backlog|deferred|performance|contract/i.test(label)) {
      const vals = [...m[0].matchAll(/data-value="([^"]+)"/g)].map((x) => x[1]).slice(-3)
      console.log(m[1], label, vals)
    }
  }
}

main()
