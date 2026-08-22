const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131'
const body = new URLSearchParams({
  f_page: '1',
  f_societes: 'HERMES',
  f_isin: 'FR0000052292',
})

const res = await fetch('https://transactions-amf.swaoo.com/', {
  method: 'POST',
  headers: {
    'User-Agent': ua,
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'text/html',
  },
  body,
})
const html = await res.text()
console.log('status', res.status, 'len', html.length)
console.log('hermes count', (html.match(/HERM[EÈ]S/gi) || []).length)

// extract table rows
const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
let n = 0
for (const row of rows) {
  const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
    c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  )
  if (cells.length < 4) continue
  if (!/herm/i.test(cells.join(' '))) continue
  console.log(cells.slice(0, 9).join(' | '))
  if (++n >= 12) break
}
