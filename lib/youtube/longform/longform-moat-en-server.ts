/** Moat-Freitext einmal ins Englische, nur aus dem vorhandenen Text. */
import 'server-only'

import { resolveCoachProviderFromMode, runCoachCompletion } from '@/lib/ki-coach-backend'
import { englischOderLeer, textIstDeutschFuerBild } from '@/lib/youtube/longform/longform-en'
import type { LongformFaktenblatt, LongformMoat } from '@/lib/youtube/longform/longform-types'

type Roh = {
  geschaeftsmodell?: string
  pfeiler?: { begruendung?: string; risiko?: string }[]
  zerstoerung?: string[]
}

function kurz(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > 140 ? `${t.slice(0, 137).trim()}…` : t
}

function sauber(s: string | null | undefined): string {
  const en = englischOderLeer(s)
  return en ? kurz(en) : ''
}

async function uebersetze(moat: LongformMoat): Promise<Roh | null> {
  const provider = resolveCoachProviderFromMode('gemini')
  if (!provider || provider.provider !== 'gemini') return null
  const nutzer = [
    'Translate each German field into one calm English sentence, at most 140 characters.',
    'Use only what is already in the text. Do not add facts, names, or numbers.',
    'If a field is already English, copy it. Return JSON with the same shape.',
    JSON.stringify({
      geschaeftsmodell: moat.geschaeftsmodell,
      pfeiler: moat.pfeiler.map((p) => ({ begruendung: p.begruendung, risiko: p.risiko })),
      zerstoerung: moat.zerstoerung,
    }),
  ].join('\n\n')
  const schema = {
    type: 'object',
    properties: {
      geschaeftsmodell: { type: 'string' },
      pfeiler: {
        type: 'array',
        items: {
          type: 'object',
          properties: { begruendung: { type: 'string' }, risiko: { type: 'string' } },
          required: ['begruendung', 'risiko'],
        },
      },
      zerstoerung: { type: 'array', items: { type: 'string' } },
    },
    required: ['geschaeftsmodell', 'pfeiler', 'zerstoerung'],
  }
  const r = await runCoachCompletion(provider.provider, provider.apiKey, 'You translate moat notes into English. You never add information.', [{ role: 'user', content: nutzer }], {
    geminiModels: ['gemini-4-hydrogen', 'gemini-3.8-flash'],
    geminiForcePaidApiKey: true,
    jsonResponse: { schema },
    thinkingLevel: 'low',
    timeoutMs: 60_000,
    maxOutputTokens: 4_096,
  })
  if (!r.ok) return null
  try {
    return JSON.parse(r.reply) as Roh
  } catch {
    return null
  }
}

/** Deutscher Moat-Text wird übersetzt. Bleibt er deutsch oder schlägt der Aufruf fehl, ist das Feld leer. */
export async function moatTexteEnglisch(fb: LongformFaktenblatt): Promise<LongformFaktenblatt> {
  const moat = fb.moat
  const burggraben = fb.burggraben
    ? {
        ...fb.burggraben,
        balken: fb.burggraben.balken
          .map((b) => ({
            ...b,
            label: englischOderLeer(b.label) ?? '',
            wertText: englischOderLeer(b.wertText) ?? '–',
          }))
          .filter((b) => b.label),
      }
    : fb.burggraben
  if (!moat) return { ...fb, burggraben }
  const braucht = [moat.geschaeftsmodell, ...moat.pfeiler.flatMap((p) => [p.begruendung, p.risiko]), ...moat.zerstoerung].some((t) =>
    textIstDeutschFuerBild(t),
  )
  const roh = braucht ? await uebersetze(moat).catch(() => null) : null
  const pfeiler = moat.pfeiler.map((p, i) => ({
    ...p,
    begruendung: sauber(roh?.pfeiler?.[i]?.begruendung ?? (braucht ? '' : p.begruendung)),
    risiko: sauber(roh?.pfeiler?.[i]?.risiko ?? (braucht ? '' : p.risiko)),
  }))
  const urteil = englischOderLeer(moat.urteil) ?? ''
  return {
    ...fb,
    burggraben,
    moat: {
      ...moat,
      urteil,
      geschaeftsmodell: sauber(roh?.geschaeftsmodell ?? (braucht ? '' : moat.geschaeftsmodell)),
      pfeiler,
      zerstoerung: (roh?.zerstoerung ?? (braucht ? [] : moat.zerstoerung)).map((z) => sauber(z)).filter(Boolean),
    },
  }
}
