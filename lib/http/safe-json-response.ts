/** JSON aus Fetch-Antworten — HTML-Fehlerseiten abfangen (SEC, Vercel, …). */

export function istHtmlAntwort(text: string): boolean {
  const s = text.trimStart().slice(0, 32).toLowerCase()
  return s.startsWith('<!doctype') || s.startsWith('<html') || s.startsWith('<!')
}

export async function leseAlsJson<T>(res: Response): Promise<T | null> {
  const text = await res.text()
  if (!text.trim() || istHtmlAntwort(text)) return null
  const s = text.trimStart()
  if (!s.startsWith('{') && !s.startsWith('[')) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export function jsonParseFehlerNachricht(kontext: string): string {
  return `${kontext}: Antwort war kein JSON (HTML-Fehlerseite). Bitte später erneut versuchen.`
}
