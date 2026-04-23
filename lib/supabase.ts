import { createClient } from '@supabase/supabase-js'

// Diese Zeilen laden deine Schlüssel aus der .env.local Datei
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Hier wird die Verbindung offiziell gestartet
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
