const h = await (await fetch('https://corporate.couche-tard.com/financial-reporting?cat=29', { headers: { 'User-Agent': 'Mozilla/5.0' } })).text()
const dl = [...h.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]).filter((u) => /download|\.pdf/i.test(u))
console.log('download links', dl.length)
for (const u of dl.slice(0, 8)) console.log(u)
