const h = await fetch('https://finance.hermes.com/en/', {
  headers: { 'User-Agent': 'Mozilla/5.0 Chrome/131' },
}).then((r) => r.text())
const m = [...h.matchAll(/https:\/\/assets-finance\.hermes\.com[^"'\\s<>]+/g)]
console.log(m.map((x) => x[0]))
