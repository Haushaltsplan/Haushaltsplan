const isin = 'IE00BJXRZJ40'
const res = await fetch('https://api.openfigi.com/v3/mapping', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([{ idType: 'ID_ISIN', idValue: isin }]),
})
const rows = await res.json()
console.log(JSON.stringify(rows, null, 2))
