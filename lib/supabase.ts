import { createClient } from '@supabase/supabase-js'

const urlRaw = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
const keyRaw = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

/**
 * Ohne echte Werte bricht `createClient` ab — passiert z. B. bei Vercel-Builds, solange
 * die Variablen im Dashboard noch nicht gesetzt sind. Platzhalter erlauben `next build`;
 * mit echten Keys in Production ersetzt sich das Verhalten automatisch.
 */
const supabaseUrl =
  urlRaw ||
  'https://build-placeholder.supabase.co'
const supabaseAnonKey =
  keyRaw ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDI3NjA2NTIsImV4cCI6MTk1ODMzNjY1Mn0.build-placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** `true`, wenn in .env / Vercel echte Supabase-Keys hinterlegt sind. */
export function istSupabaseClientKonfiguriert(): boolean {
  return Boolean(urlRaw && keyRaw)
}
