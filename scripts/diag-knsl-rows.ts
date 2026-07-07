import { readFileSync } from 'fs'

const table = readFileSync('scripts/.cache-KNSL-division-table.html', 'utf8')

function zellenText(tdHtml: string): string {
  return tdHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

for (const row of [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]) {
  const zellen = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => zellenText(c[1]!))
  if (zellen[0] && /total (commercial|personal)/i.test(zellen[0])) {
    console.log('ROW:', JSON.stringify(zellen.slice(0, 8)))
  }
}
