import { z } from 'zod'

const coachImageSchema = z.object({
  mimeType: z.string().min(3).max(64),
  base64: z.string().min(1),
})

const coachMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(8000),
  images: z.array(coachImageSchema).max(8).optional(),
})

export const financeCoachBodySchema = z.object({
  messages: z.array(coachMessageSchema).min(1).max(24),
  context: z.unknown().optional(),
})

export type FinanceCoachBody = z.infer<typeof financeCoachBodySchema>
