import { z } from 'zod'

export const nachkaufKaufempfehlungBodySchema = z.object({
  budget: z.coerce.number().min(100).max(50_000).optional().default(500),
})

const optionalTrimmed = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v == null) return null
      const t = String(v).trim()
      return t.length > 0 ? t.slice(0, max) : null
    })
    .optional()

export const nachkaufDeepResearchBodySchema = z.object({
  ticker: z.string().trim().min(1).max(32),
  isin: optionalTrimmed(20),
  name: optionalTrimmed(200),
})

export const nachkaufNotizBodySchema = z.object({
  ticker: z.string().trim().min(1).max(32),
  notiz: z.string().max(20_000).optional().default(''),
})

export const nachkaufScanBodySchema = z.object({
  ticker: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v == null) return null
      const t = String(v).trim()
      return t.length > 0 ? t.slice(0, 32) : null
    })
    .optional(),
  erzwingen: z.boolean().optional().default(false),
  nurFehlende: z.boolean().optional().default(false),
  offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
  abschliessen: z.boolean().optional().default(false),
})

export type NachkaufKaufempfehlungBody = z.infer<typeof nachkaufKaufempfehlungBodySchema>
export type NachkaufDeepResearchBody = z.infer<typeof nachkaufDeepResearchBodySchema>
export type NachkaufNotizBody = z.infer<typeof nachkaufNotizBodySchema>
export type NachkaufScanBody = z.infer<typeof nachkaufScanBodySchema>
