const UA = 'Mozilla/5.0'
const urls = [
  'https://finance.hermes.com/en/',
  'https://finance.hermes.com/en/key-figures/',
  'https://finance.hermes.com/en/financial-data/',
  'https://finance.hermes.com/en/publications/',
]
for (const url of urls) {
  try {
    const h = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text())
    console.log(url, h.length, '2012', /2012/.test(h), '2015', /2015/.test(h), 'revenue', /revenue|turnover|chiffre/i.test(h))
  } catch (e) {
    console.log(url, 'fail')
  }
}
