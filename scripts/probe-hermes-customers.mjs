async function pdfZuText(buffer) {
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
  return ((await pdfParse(buffer)).text || '').replace(/\s+/g, ' ')
}
const url =
  'https://assets-finance.hermes.com/s3fs-public/node/pdf_file/2026-04/1777391712/260320_hermes_urd2025_en.pdf'
const text = await pdfZuText(Buffer.from(await (await fetch(url)).arrayBuffer()))

for (const n of ['10%', '10 %', 'concentration', 'main customers', 'largest customer', 'customers representing', 'no single']) {
  let from = 0
  for (let c = 0; c < 2; c++) {
    const i = text.toLowerCase().indexOf(n.toLowerCase(), from)
    if (i < 0) break
    const snip = text.slice(Math.max(0, i - 60), i + 200)
    if (/customer|client|buyer|distributor/i.test(snip)) {
      console.log('---', n, '---')
      console.log(snip)
    }
    from = i + n.length
  }
}

const rd = text.match(/research and development[\s\S]{0,400}/i)
console.log('RD block', rd?.[0]?.slice(0, 400))
