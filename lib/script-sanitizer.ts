/** Gesprochenes Moat-Short: 60–65 Wörter, damit es bei Tempo 1,15 auf 25–27 Sekunden kommt. */

export const MOAT_WORTE_MIN = 60
export const MOAT_WORTE_MAX = 65
export const MOAT_SEKUNDEN_MIN = 25
export const MOAT_SEKUNDEN_MAX = 27

const HAENGT = /\b(to|and|or|the|a|an|of|for|with|into|from|by|at|is|are|was|were|be|being)$/i

/** Steht immer am Ende von hookVisualPrompt. Imagen darf keine Schrift ins Bild setzen. */
export const HOOK_VISUAL_NEGATIV =
  'No text, no logos, no watermarks, no UI overlays, no distorted hands.'

/**
 * System-Anweisung für das Standbild. Beispiele sind die Übersetzung,
 * nicht eine Szene, die auf jede Firma kopiert wird. Die Kamerafahrt macht Remotion.
 */
export const HOOK_VISUAL_ANWEISUNG = `hookVisualPrompt: 40 to 60 English words for one ultra-sharp 9:16 still photograph of THIS company. Five layers, in this order.
1. No text or UI. The prompt must not ask for words, numbers, logos, stock tickers, charts, or UI overlays. Remotion draws every word.
2. One hyper-real, iconic physical subject. Translate what THIS company makes or moves. No abstract finance, no trading floors. A chip-tool or chip company may show glowing golden silicon wafers in a sleek dark cleanroom. A jet-engine company may show a titanium turbine in a moody hangar. A commerce or logistics company may show a high-tech robotic fulfillment floor. Never copy wafers, turbines, or fulfillment floors onto a company that does not make or run that thing.
3. High color contrast. One rich accent against dark shadow: warm gold, electric cyan, emerald green, or deep amber.
4. Commercial photography. Macro lens, shallow depth of field, volumetric studio lighting, 8K hyper-detailed commercial photography. Do not describe camera motion. Remotion moves the still.
5. End the field with exactly: "${HOOK_VISUAL_NEGATIV}"`

/** Hält die Szene bei 40–60 Wörtern und hängt die Imagen-Sperrzeile an. */
export function schliesseHookVisualPrompt(roh: string, fallback: string): string {
  const quelle = (roh || fallback).replace(/\s+/g, ' ').trim()
  const ohneSperre = quelle.replace(/no text,\s*no logos,\s*no watermarks[\s\S]*$/i, '').trim()
  const woerter = ohneSperre.split(' ').filter(Boolean)
  const kern = (woerter.length > 60 ? woerter.slice(0, 60) : woerter).join(' ').replace(/[.,;:]+$/, '')
  return `${kern}. ${HOOK_VISUAL_NEGATIV}`
}

/** Jeder Abschnitt endet als Satz. Ein abgeschnittenes Verb zählt nicht. */
export function satzGeschlossen(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!/[.!?]$/.test(t)) return false
  return !HAENGT.test(t.replace(/[.!?]+$/g, '').trim())
}
