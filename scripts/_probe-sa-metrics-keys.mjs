const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const html = await fetch('https://stockanalysis.com/stocks/spgi/financials/metrics/', {
  headers: { 'User-Agent': UA },
  signal: AbortSignal.timeout(25000),
}).then((r) => r.text())

const labelHits = [...html.matchAll(/label:"([^"]{2,80})"/g)]
  .map((m) => m[1])
  .filter((l) => /roic|roiic|increment|invested|return on/i.test(l))
console.log('labels', labelHits)

const idHits = [...html.matchAll(/id:"([^"]{2,60})"/g)]
  .map((m) => m[1])
  .filter((l) => /roic|roiic|increment|invested/i.test(l))
console.log('ids', idHits)

// parse svelte nodes for metric titles in visible text
const textHits = [...html.matchAll(/>([^<]{5,80}(?:ROIC|ROIIC|Incremental)[^<]{0,40})</gi)].slice(0, 15)
console.log('text', textHits.map((m) => m[1]))
