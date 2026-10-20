import { MOAT_CHECK, MOAT_CHECK_PLATTFORM_ZUSATZ } from '@/lib/investment-mantra-data'

export const MOAT_KI_JSON_SCHEMA = {
  type: 'object',
  properties: {
    geschaeftsmodell: { type: 'string' },
    pfeiler: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            enum: ['preissetzungsmacht', 'replikationsbarriere', 'wechselkosten', 'marktdichte'],
          },
          score: { type: 'number' },
          begruendung: { type: 'string' },
          risiko: { type: 'string' },
        },
        required: ['id', 'score', 'begruendung', 'risiko'],
      },
    },
    score: { type: 'number' },
    urteil: { type: 'string', enum: ['tief', 'moderat', 'schwach', 'unklar'] },
    kaufwuerdig: { type: 'boolean' },
    kaufHinweis: { type: 'string' },
    zerstoerungsszenarien: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'geschaeftsmodell',
    'pfeiler',
    'score',
    'urteil',
    'kaufwuerdig',
    'kaufHinweis',
    'zerstoerungsszenarien',
  ],
} as const

export function baueMoatKiSystemPrompt(): string {
  const pfeiler = MOAT_CHECK.map(
    (p) =>
      `- **${p.id}** — ${p.titel}\n  ${p.beschreibung}\n  Killerfrage: ${p.killerFrage}`,
  ).join('\n')

  return `Du bist ein skeptischer Quality-/Moat-Analyst für einen privaten Investor, der NUR Unternehmen mit tiefem, dauerhaftem Burggraben kauft.

## Aufgabe
Bewerte das Geschäftsmodell und die Unzerstörbarkeit des Burggrabens. Antworte NUR als JSON gemäß Schema.

## Moat-Pfeiler (alle vier bewerten, Score 1–10)
${pfeiler}

Plattform-Zusatz (wenn SaaS/Netzwerk): ${MOAT_CHECK_PLATTFORM_ZUSATZ}

## Kalibrierung (streng)
- 9–10: klarer, historisch bewährter Burggraben (z. B. Visa-Netzwerk, Hermès-Marke, ASML-Oligopol)
- 7–8: solider Moat, aber angreifbar oder noch jung
- 5–6: Wettbewerbsvorteil unsicher / austauschbar
- 1–4: schwacher oder kein Moat — Commodity, Mode, harte Konkurrenz

Bias: Im Zweifel niedriger scoren. Marketing-Floskeln („Innovation“, „Ökosystem“) ohne strukturellen Beweis zählen nicht.

## kaufwuerdig
true, wenn Gesamtscore ≥ 7 UND alle Pfeiler ≥ 6 UND mindestens zwei Pfeiler ≥ 7.
Hinweis: Hohe Reinvestitionen / KI-CapEx allein machen ein intaktes Moat nicht ungültig —
nur echte Erosion (Preissetzung weg, Wechselkosten weg, Markt offen) senkt den Score unter 7.
urteil „tief“ ab Score ≥ 8, „moderat“ bei 6–7 (7 kann trotzdem kaufwürdig sein).
Sonst false mit klarem kaufHinweis.

## Sprache
Deutsch, knapp, konkret. Keine Anlageberatung-Disclaimer-Romane.`
}

export function baueMoatKiUserPrompt(opts: {
  ticker: string
  firmenname: string
  isin?: string | null
  sektor?: string | null
  branche?: string | null
  beschreibung?: string | null
  kennzahlenKontext: string
}): string {
  return [
    `Ticker: ${opts.ticker}`,
    `Name: ${opts.firmenname}`,
    opts.isin ? `ISIN: ${opts.isin}` : null,
    opts.sektor ? `Sektor: ${opts.sektor}` : null,
    opts.branche ? `Branche: ${opts.branche}` : null,
    '',
    'Firmenbeschreibung (App):',
    opts.beschreibung?.trim() || '(keine)',
    '',
    'Kennzahlen-/Mantra-Kontext (nur zur Einordnung, nicht blind übernehmen):',
    opts.kennzahlenKontext,
    '',
    'Bewerte jetzt die vier Moat-Pfeiler und die Kaufwürdigkeit für einen strengen Quality-Investor.',
  ]
    .filter((z) => z != null)
    .join('\n')
}
