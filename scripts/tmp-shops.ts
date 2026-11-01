const URL =
  'https://www.hibike.de/fahrradteile/schaltwerke-umwerfer-schalthebel/shimano-deore-xt-rd-m8100-schaltwerk-12-fach-langer-kafig-schwarz-p1f48cac7a7031e79f59237054907a76d'

async function main() {
  const direkt = await fetch(URL, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  }).catch((e: unknown) => e)
  if (direkt instanceof Response) {
    const text = await direkt.text()
    const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim()
    console.log('direkt', direkt.status, text.length, title)
  } else {
    console.log('direkt', direkt instanceof Error ? direkt.message : direkt)
  }
  const jina = await fetch('https://r.jina.ai/' + URL, {
    headers: { Accept: 'application/json', 'X-Return-Format': 'markdown', 'X-Timeout': '25' },
    signal: AbortSignal.timeout(35000),
  })
  const json = (await jina.json()) as { data?: { title?: string; content?: string } }
  console.log('jina', jina.status, json.data?.title, (json.data?.content ?? '').length)
}

void main()
