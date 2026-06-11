/** HTML → Text / Links ohne jsdom (Vercel-serverless-tauglich). */

const BLOCK_TAGS = /<\/?(?:p|div|li|td|tr|h[1-6]|br|section|article)[^>]*>/gi

export function htmlZuFliesstext(html: string): string {
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(BLOCK_TAGS, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")

  const parts = t
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 25)

  const deduped: string[] = []
  const seen = new Set<string>()
  for (const p of parts) {
    const key = p.slice(0, 80)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(p)
  }

  const joined = deduped.join('\n\n')
  if (joined.length > 500) return joined
  return t.replace(/\s+/g, ' ').trim()
}

export type HtmlLink = { href: string; text: string }

function resolveHref(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).href.split('#')[0]
  } catch {
    return href.split('#')[0]
  }
}

export function linksAusHtml(html: string, baseUrl: string): HtmlLink[] {
  const out: HtmlLink[] = []
  const re = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const href = resolveHref(m[1], baseUrl)
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (href && !href.startsWith('javascript:')) out.push({ href, text: text || href })
  }
  return out
}
