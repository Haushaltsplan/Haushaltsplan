const h = await fetch('https://finance.hermes.com/en/key-figures/', {
  headers: { 'User-Agent': 'Mozilla/5.0' },
}).then((r) => r.text())

const years = [...h.matchAll(/\b(20\d{2})\b/g)].map((m) => m[1])
const uniq = [...new Set(years)].sort()
console.log('years in page', uniq.slice(0, 30))

for (const pat of ['turnover', 'revenue', 'sales', 'chart', 'keyFigure', 'drupal-settings']) {
  const i = h.toLowerCase().indexOf(pat)
  if (i >= 0) console.log(pat, 'at', i, h.slice(i, i + 200).replace(/\s+/g, ' '))
}
