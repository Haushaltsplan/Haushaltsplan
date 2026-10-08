/**
 *   npx tsx lib/portfolio-analyse/titel-vergleich-parse.test.ts
 */
import { parseDeZahl } from '@/lib/portfolio-analyse/titel-vergleich-parse'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(parseDeZahl('−1,2 %') === -1.2, 'unicode minus')
assert(parseDeZahl('-1,2 %') === -1.2, 'ascii minus')
assert(parseDeZahl('+0,5 %') === 0.5, 'plus')
assert(parseDeZahl('(1,2 %)') === -1.2, 'klammern pct')
assert(parseDeZahl('(0,85)') === -0.85, 'klammern mult')
assert(parseDeZahl('12,34×') === 12.34, 'multiple')
assert(parseDeZahl('1,20 Pp. ✓') === 1.2, 'Pp')
assert(parseDeZahl('−2,10 (niedrig)') === -2.1, 'beneish')
assert(parseDeZahl('–') == null, 'dash')
assert(parseDeZahl('NM') == null, 'nm')

console.log('titel-vergleich-parse.test.ts: ok')
