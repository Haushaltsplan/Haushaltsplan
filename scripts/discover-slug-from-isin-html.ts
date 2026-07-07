/**
 * npx tsx scripts/discover-slug-from-isin-html.ts
 */
async function main() {
  const isin = 'US94106L1098'
  const html = await (
    await fetch(`https://www.marketscreener.com/search/?q=${isin}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
  ).text()
  const idx = html.indexOf(isin)
  console.log('idx', idx)
  if (idx >= 0) console.log(html.slice(Math.max(0, idx - 500), idx + 500))
  const links = [...html.matchAll(/href="(\/quote\/stock\/[A-Z0-9-]+-\d+\/)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)]
    .filter((m) => m[2].includes(isin) || /WASTE/i.test(m[2]))
    .slice(0, 5)
  for (const l of links) console.log(l[1], l[2].replace(/<[^>]+>/g, '').trim().slice(0, 60))
}

main()
