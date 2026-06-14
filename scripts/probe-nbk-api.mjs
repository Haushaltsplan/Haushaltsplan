const url = 'https://www.justetf.com/scripts/custom/nbk-components.min.js?20260521-093909'
const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
const js = await r.text()

const apis = [...js.matchAll(/\/api\/[a-zA-Z0-9_\-/?=&.%]+/g)].map((m) => m[0])
console.log([...new Set(apis)].sort().join('\n'))
