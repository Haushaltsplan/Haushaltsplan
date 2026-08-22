const ua = 'Mozilla/5.0'
const body = new URLSearchParams({
  f_page: '1',
  f_societes: 'HERMES INTERNATIONAL',
  f_isin: '',
})
const res = await fetch('https://transactions-amf.swaoo.com/', {
  method: 'POST',
  headers: {
    'User-Agent': ua,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body,
})
const html = await res.text()
import { writeFileSync } from 'fs'
writeFileSync('scripts/_amf-hermes.html', html)
// strip tags near HERMES
const idx = html.toUpperCase().indexOf('HERM')
console.log('idx', idx, 'len', html.length)
console.log(html.slice(Math.max(0, idx - 100), idx + 800).replace(/<[^>]+>/g, ' | ').replace(/\s+/g, ' '))
