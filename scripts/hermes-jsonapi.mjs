const UA = 'Mozilla/5.0 Chrome/131'
const uuid = '04860767-429a-4900-a7a3-98066a99600f'
for (const url of [
  `https://finance.hermes.com/jsonapi/node/publication/${uuid}`,
  `https://finance.hermes.com/jsonapi/node/article/${uuid}`,
  `https://finance.hermes.com/en/jsonapi/node/publication/${uuid}`,
  `https://finance.hermes.com/api/publications/${uuid}`,
]) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  const t = await r.text()
  console.log(url, r.status, t.slice(0, 300))
}
