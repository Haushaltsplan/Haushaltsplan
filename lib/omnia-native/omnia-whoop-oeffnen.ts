/**
 * Öffnet die separate Omnia-Whoop-App (Android Intent / Custom Scheme).
 * Sitzungstokens gehören nicht in die URL — vorher Zwischenablage nutzen.
 */

const WHOOP_PACKAGE = 'de.omnia.whoop'

/** Startet Omnia Whoop (Login / Fitness), ohne Tokens in der URL. */
export async function oeffneOmniaWhoopApp(): Promise<boolean> {
  if (typeof window === 'undefined') return false

  // Android Intent → Launcher der Whoop-App
  const intent =
    `intent:#Intent;action=android.intent.action.MAIN;` +
    `category=android.intent.category.LAUNCHER;` +
    `package=${WHOOP_PACKAGE};end`

  try {
    window.location.href = intent
    return true
  } catch {
    /* weiter */
  }

  try {
    window.location.href = `${WHOOP_PACKAGE}://auth/login`
    return true
  } catch {
    return false
  }
}
