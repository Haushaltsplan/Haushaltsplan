import 'server-only'

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText, type ModelMessage } from 'ai'
import {
  geminiApiKeyFreeConfigured,
  geminiFreeTierFlashModelKandidaten,
  resolveGeminiFreeTierProvider,
  resolveCoachProvider,
} from '@/lib/ki-coach-backend'

export type AiSdkGeminiMode = 'free' | 'auto'

/**
 * Gemini via Vercel AI SDK — respektiert Free-Tier-Key-Trennung.
 * `free`: nur GEMINI_API_KEY_FREE (Finance-Coach / Berater).
 * `auto`: Free bevorzugt, sonst resolveCoachProvider.
 */
export function resolveAiSdkGemini(mode: AiSdkGeminiMode = 'free'): {
  apiKey: string
  models: string[]
} | null {
  if (mode === 'free') {
    const free = resolveGeminiFreeTierProvider()
    if (!free) return null
    return { apiKey: free.apiKey, models: geminiFreeTierFlashModelKandidaten() }
  }
  const free = resolveGeminiFreeTierProvider()
  if (free && geminiApiKeyFreeConfigured()) {
    return { apiKey: free.apiKey, models: geminiFreeTierFlashModelKandidaten() }
  }
  const any = resolveCoachProvider()
  if (!any || any.provider !== 'gemini') return null
  return { apiKey: any.apiKey, models: geminiFreeTierFlashModelKandidaten() }
}

export async function streamGeminiText(opts: {
  system: string
  messages: ModelMessage[]
  mode?: AiSdkGeminiMode
  /** Ignoriert für Gemini 3.x (Sampling-Params deprecated / bald 400). */
  temperature?: number
  maxOutputTokens?: number
}) {
  const resolved = resolveAiSdkGemini(opts.mode ?? 'free')
  if (!resolved) {
    throw new Error('Gemini nicht konfiguriert (GEMINI_API_KEY_FREE / GEMINI_API_KEY).')
  }

  const google = createGoogleGenerativeAI({ apiKey: resolved.apiKey })
  const modelId = resolved.models[0] ?? 'gemini-3.5-flash'

  // Kein temperature/topP/topK — Modell-Defaults.
  return streamText({
    model: google(modelId),
    system: opts.system,
    messages: opts.messages,
    maxOutputTokens: opts.maxOutputTokens ?? 4096,
  })
}
