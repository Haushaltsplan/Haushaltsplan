import {
  extrahiereIxbrlTextBlock,
  parseOperatingSegmente,
  parseSpaltenOrientierteSegmente,
} from '@/lib/portfolio-analyse/sec-edgar-segment-extraktion'

// minimal copy test
const labels = ['Walmart U.S.', 'Walmart International', "Sam's Club U.S. (1)", 'Membership and other income', 'Total revenues']

for (const l of labels) {
  const n = l.replace(/\s*\(\s*\d+\s*\)\s*$/g, '').trim()
  const skip = /^(net revenue|total revenue|revenue|total)$/i.test(n)
  const fin = /membership/i.test(n)
  console.log(l, '->', n, 'skip', skip, 'fin', fin)
}
