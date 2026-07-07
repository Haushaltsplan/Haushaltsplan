/**
 * npx tsx scripts/probe-ms-search-links.ts
 */
async function main() {
  for (const q of ['MSFT', 'US5949181045', 'ASML', 'NL0010273215']) {
    const html = await (
      await fetch(`https://www.marketscreener.com/search/?q=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
    ).text()
    const block = html.match(/id="instruments"[\s\S]*?<\/table>/i)?.[0] ?? html.slice(0, 200000)
    const links = [...block.matchAll(/href="(\/quote\/stock\/[A-Z0-9-]+-\d+\/)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)]
      .slice(0, 5)
      .map((m) => ({ url: m[1], text: m[2].replace(/<[^>]+>/g, '').trim().slice(0, 80) }))
    console.log('\n===', q, '===')
    for (const l of links) console.log(l.url, '|', l.text)
  }
}

main()
