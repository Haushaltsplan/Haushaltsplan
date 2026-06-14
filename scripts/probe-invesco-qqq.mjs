for (const url of [
  'https://www.invesco.com/us/financial-products/etfs/holdings/main/holdings/0?action=download&ticker=QQQ&format=csv',
  'https://www.invesco.com/us/financial-products/etfs/holdings/main/holdings/0?action=download&ticker=QQQ',
  'https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclass/QQQ/holdings',
  'https://dng-api.invesco.com/cache/v1/accounts/en_US/shareclass/QQQ/holdings?interval=daily',
]) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' } })
    const ct = r.headers.get('content-type') || ''
    const buf = await r.arrayBuffer()
    console.log('\n', url.split('?')[0].slice(-40), r.status, ct.slice(0, 40), buf.byteLength)
    if (ct.includes('json')) console.log(Buffer.from(buf).toString('utf8').slice(0, 400))
    else if (buf.byteLength < 2000) console.log(Buffer.from(buf).toString('utf8'))
    else console.log(Buffer.from(buf).toString('utf8').slice(0, 300))
  } catch (e) {
    console.log(url, e.message)
  }
}
