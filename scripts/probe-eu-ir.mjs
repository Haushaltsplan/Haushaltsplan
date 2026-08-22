import { writeFileSync } from 'fs'
const targets = [
  { n: 'ASML', u: 'https://www.asml.com/en/investors/annual-report/2024' },
  { n: 'Halma', u: 'https://www.halma.com/investors/annual-report' },
  { n: 'WKL', u: 'https://www.wolterskluwer.com/en/investors/financials/annual-reports' },
  { n: 'Sika', u: 'https://www.sika.com/en/investors/reports-publications/financial-reports.html' },
  { n: 'AFM', u: 'https://www.afm.nl/nl-nl/sector/registers/meldingenregisters/bestuurders-transacties' },
]
const out = {}
for (const t of targets) {
  try {
    const r = await fetch(t.u, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(18000),
    })
    const h = await r.text()
    const pdfs = [...h.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)].slice(0, 8).map((m) => m[1])
    out[t.n] = { status: r.status, len: h.length, pdfs: pdfs.slice(0, 5), title: (h.match(/<title[^>]*>([^<]+)/i) || [])[1] }
  } catch (e) {
    out[t.n] = { err: String(e.message || e) }
  }
}
writeFileSync('scripts/_eu-ir-probe.json', JSON.stringify(out, null, 2))
console.error(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k,v]) => [k, {status:v.status, pdfs:(v.pdfs||[]).length, err:v.err}]))))
