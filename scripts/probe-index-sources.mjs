const urls = [
  'https://www.slickcharts.com/sp500',
  'https://www.slickcharts.com/nasdaq100',
  'https://api.nasdaq.com/api/nasdaq-100/nasdaq-100-summary',
  'https://api.nasdaq.com/api/nasdaq-100/nasdaq-100-inclusion',
]

for (const url of urls) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json, text/html',
      },
    })
    const ct = r.headers.get('content-type') || ''
    const t = await r.text()
    console.log('\n', url, r.status, ct.slice(0, 40), t.length)
    if (ct.includes('json')) console.log(t.slice(0, 500))
    else {
      const rows = [...t.matchAll(/<tr>[\s\S]*?<\/tr>/g)].slice(0, 3)
      console.log('rows', rows.length)
      const nvda = t.includes('NVIDIA') || t.includes('Nvidia')
      console.log('nvidia', nvda)
      const weights = [...t.matchAll(/(\d+\.\d+)%/g)].slice(0, 5).map((m) => m[1])
      console.log('weights', weights)
    }
  } catch (e) {
    console.log(url, e.message)
  }
}
