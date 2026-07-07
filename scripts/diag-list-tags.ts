import { readFileSync } from 'fs'
for (const sym of process.argv.slice(2)) {
  const h = readFileSync(`scripts/.cache-${sym}.html`, 'utf8')
  const tags = new Set<string>()
  const re = /name="(?:[a-zA-Z0-9_-]+:)?([A-Za-z0-9]+TableTextBlock)"/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(h))) tags.add(m[1]!)
  console.log(`\n${sym} (${tags.size} tags):`)
  for (const t of [...tags].sort()) {
    if (/segment|revenue|geograph|disaggreg|product|customer|operating|area|franchis|business|premium|insurance|commodity|rail/i.test(t)) {
      console.log(' ', t)
    }
  }
}
