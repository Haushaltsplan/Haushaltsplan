/**
 * Multi-EU smoke: AMF Hermès, DGAP ASML/Sika, Parser-Coverage-Flags.
 */
import { writeFileSync, readFileSync } from 'fs'

const UA = 'Mozilla/5.0'
const out = { ok: false, amf: 0, dgapAsml: 0, dgapSika: 0, asmlIr: null, errors: [] }

try {
  const amfBody = new URLSearchParams({
    f_page: '1',
    f_societes: 'HERMES INTERNATIONAL',
    f_isin: 'FR0000052292',
  })
  const amfRes = await fetch('https://transactions-amf.swaoo.com/', {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: amfBody,
  })
  const amfHtml = await amfRes.text()
  out.amf = [...amfHtml.matchAll(/FR0000052292/g)].length
} catch (e) {
  out.errors.push('amf:' + e.message)
}

for (const [key, q] of [
  ['dgapAsml', 'ASML'],
  ['dgapSika', 'Sika'],
]) {
  try {
    const u = new URL('https://www.dgap.de/dgap/News/')
    u.searchParams.set('newsType', 'DD')
    u.searchParams.set('searchWord', q)
    const r = await fetch(u.toString(), { headers: { 'User-Agent': UA } })
    const h = await r.text()
    const n = [...h.matchAll(/Directors'? Dealings|Managers'? Transactions|Eigengeschäfte/gi)].length
    out[key] = n
  } catch (e) {
    out.errors.push(key + ':' + e.message)
  }
}

try {
  const r = await fetch('https://www.asml.com/en/investors/annual-report', {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(15000),
  })
  const h = await r.text()
  out.asmlIr = { status: r.status, pdfs: [...h.matchAll(/\.pdf/gi)].length, len: h.length }
} catch (e) {
  out.errors.push('asml:' + e.message)
}

out.ok = out.amf >= 5 && (out.dgapAsml > 0 || out.dgapSika > 0)
writeFileSync('scripts/_smoke-eu-all.json', JSON.stringify(out, null, 2))
process.stderr.write(JSON.stringify(out) + '\n')
