/** Logos / Flaggen für Segment- & Geo-Mix in der UI. */

export type SegmentVisual = {
  /** simpleicons slug oder null */
  iconSlug: string | null
  iconColor: string
  /** Flaggen-Emoji oder Region-Emoji */
  flagEmoji: string | null
  /** ISO-3166-1 alpha-2 für flagcdn, sonst null */
  flagCode: string | null
  /** Kurz-Buchstabe als Fallback */
  initial: string
}

function initialFromName(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase()
  return t.slice(0, 2).toUpperCase()
}

const PRODUKT_VISUALS: { test: RegExp; slug: string | null; color: string }[] = [
  { test: /google\s+search|search\s*&?\s*other/i, slug: 'google', color: '#4285F4' },
  { test: /youtube/i, slug: 'youtube', color: '#FF0000' },
  { test: /google\s+cloud/i, slug: 'googlecloud', color: '#4285F4' },
  { test: /google\s+network/i, slug: 'google', color: '#34A853' },
  { test: /google\s+services/i, slug: 'google', color: '#EA4335' },
  { test: /subscription|platforms?\s*&?\s*devices|devices/i, slug: 'google', color: '#FBBC05' },
  { test: /other\s+bets/i, slug: null, color: '#A78BFA' },
  { test: /payment\s+network/i, slug: 'mastercard', color: '#EB001B' },
  { test: /value[- ]added/i, slug: 'mastercard', color: '#F79E1B' },
  { test: /intelligent\s+cloud|azure|server\s+products/i, slug: 'microsoftazure', color: '#0078D4' },
  { test: /productivity|microsoft\s+365|office|linked\s*in/i, slug: 'microsoft', color: '#00A4EF' },
  { test: /more\s+personal|windows|gaming|devices/i, slug: 'windows', color: '#0078D4' },
  { test: /dynamics/i, slug: 'microsoft', color: '#002050' },
  { test: /united\s*health|unitedhealthcare/i, slug: null, color: '#002677' },
  { test: /optum/i, slug: null, color: '#E87722' },
]

const GEO_VISUALS: { test: RegExp; emoji: string; code: string | null }[] = [
  { test: /^united\s+states$|^u\.?s\.?a?\.?$|^us$/i, emoji: '🇺🇸', code: 'us' },
  { test: /^non[- ]u\.?s\.?$/i, emoji: '🌐', code: null },
  { test: /^canada$/i, emoji: '🇨🇦', code: 'ca' },
  { test: /^china$|^greater\s+china$/i, emoji: '🇨🇳', code: 'cn' },
  { test: /^japan$/i, emoji: '🇯🇵', code: 'jp' },
  { test: /^united\s+kingdom$|^u\.?k\.?$|^uk$/i, emoji: '🇬🇧', code: 'gb' },
  { test: /^germany$/i, emoji: '🇩🇪', code: 'de' },
  { test: /^france$/i, emoji: '🇫🇷', code: 'fr' },
  { test: /^india$/i, emoji: '🇮🇳', code: 'in' },
  { test: /^brazil$/i, emoji: '🇧🇷', code: 'br' },
  { test: /^mexico$/i, emoji: '🇲🇽', code: 'mx' },
  { test: /^australia$/i, emoji: '🇦🇺', code: 'au' },
  { test: /^korea$|^south\s+korea$/i, emoji: '🇰🇷', code: 'kr' },
  { test: /^emea$/i, emoji: '🌍', code: null },
  { test: /^apac$|^asia\s+pacific$/i, emoji: '🌏', code: null },
  { test: /other\s+americas|latin\s+america/i, emoji: '🌎', code: null },
  { test: /americas|north\s+american/i, emoji: '🌎', code: null },
  { test: /europe|emea|asia\s+pacific|apac|international|other\s+countries|rest\s+of|abroad|foreign/i, emoji: '🌍', code: null },
]

export function segmentVisualFuerName(name: string, art: 'produkt' | 'geo' = 'produkt'): SegmentVisual {
  const initial = initialFromName(name)
  if (art === 'geo') {
    for (const g of GEO_VISUALS) {
      if (g.test.test(name)) {
        return {
          iconSlug: null,
          iconColor: '#94a3b8',
          flagEmoji: g.emoji,
          flagCode: g.code,
          initial,
        }
      }
    }
    return { iconSlug: null, iconColor: '#94a3b8', flagEmoji: '🌐', flagCode: null, initial }
  }

  for (const p of PRODUKT_VISUALS) {
    if (p.test.test(name)) {
      return {
        iconSlug: p.slug,
        iconColor: p.color,
        flagEmoji: null,
        flagCode: null,
        initial,
      }
    }
  }
  return { iconSlug: null, iconColor: '#64748b', flagEmoji: null, flagCode: null, initial }
}

export function simpleIconUrl(slug: string, color: string): string {
  const hex = color.replace('#', '')
  return `https://cdn.simpleicons.org/${encodeURIComponent(slug)}/${hex}`
}

export function flagCdnUrl(code: string, w = 40): string {
  return `https://flagcdn.com/w${w}/${code.toLowerCase()}.png`
}
