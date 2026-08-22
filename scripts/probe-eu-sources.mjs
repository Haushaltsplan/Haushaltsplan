const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0'

async function main() {
  const urls = [
    'https://info.amf-france.org/fr/declaration-dirigeant',
    'https://bdif.amf-france.org/fr-FR',
    'https://www.amf-france.org/fr/declarations-dirigeants',
    'https://transactions-amf.swaoo.com/?q=FR0000052292',
  ]
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': ua }, redirect: 'follow' })
      console.log(r.status, r.url.slice(0, 100))
    } catch (e) {
      console.log('ERR', u, e.message)
    }
  }
  const h = await fetch('https://finance.hermes.com/en/publications/', {
    headers: { 'User-Agent': ua },
  })
  const html = await h.text()
  const pdfs = [
    ...html.matchAll(/https:\/\/assets-finance\.hermes\.com\/s3fs-public\/[^"']+\.pdf/gi),
  ].map((m) => m[0].replace(/&amp;/g, '&'))
  const urd = [...new Set(pdfs)].filter((p) => /urd|publishing|annual|registration/i.test(p)).slice(0, 10)
  console.log('hermes', h.status, 'pdfs', pdfs.length, 'urd', urd)
}

main()
