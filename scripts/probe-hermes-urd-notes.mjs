/** Probe Hermès URD notes extraction. */
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

async function pdfZuText(buffer) {
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
  const data = await pdfParse(buffer)
  return (data.text || '').replace(/\s+/g, ' ').trim()
}

const url =
  'https://assets-finance.hermes.com/s3fs-public/node/pdf_file/2026-04/1777391712/260320_hermes_urd2025_en.pdf'

const res = await fetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0 Chrome/131.0.0.0' },
})
console.log('pdf', res.status)
const buf = Buffer.from(await res.arrayBuffer())
const text = await pdfZuText(buf)
console.log('chars', text.length)

for (const needle of [
  'customer',
  'customer of',
  'customer schedule',
  'less than one year',
  'research and development',
  'customer costs',
  'customer',
  'no customer',
  'customer exceeds',
  'client',
]) {
  const i = text.toLowerCase().indexOf(needle)
  if (i >= 0) console.log('HIT', needle, '→', text.slice(i, i + 180).replace(/\s+/g, ' '))
}

// AMF
const amf = await fetch('https://transactions-amf.swaoo.com/?q=FR0000052292', {
  headers: { 'User-Agent': 'Mozilla/5.0 Chrome/131.0.0.0', Accept: 'text/html' },
})
const html = await amf.text()
console.log('amf', amf.status, 'len', html.length)
const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].slice(0, 5)
console.log('rows sample', rows.length)
console.log(html.slice(0, 500).replace(/\s+/g, ' '))
