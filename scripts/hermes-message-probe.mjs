const h = await fetch('https://finance.hermes.com/en/publications/message-executive-management-2025', {
  headers: { 'User-Agent': 'Mozilla/5.0 Chrome/131' },
}).then((r) => r.text())
console.log('uuid', h.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)?.slice(0, 5))
console.log('drupal', h.includes('drupalSettings'))
const ds = h.match(/drupalSettings\s*,\s*(\{[\s\S]*?\})\s*\)/)?.[1]
if (ds) console.log('settings len', ds.length)
// search webcast presentation pdf in raw html
for (const kw of ['webcast', 'presentation', 'message', 'pdf_file', 's3fs']) {
  console.log(kw, (h.match(new RegExp(kw, 'gi')) ?? []).length)
}
