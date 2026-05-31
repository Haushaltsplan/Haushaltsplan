import { supabase } from '@/lib/supabase'

export type SchnellErgebnis = { ok: boolean; neueMenge?: number; fehler?: string }

/** +1 Basiseinheit: erhöht den Bestand direkt (Korrektur ohne Preis/Einkaufszeile). */
export async function bucheSchnellPlus(produktId: string, aktuelleMenge: number): Promise<SchnellErgebnis> {
  const neu = Math.round((aktuelleMenge + 1) * 1000) / 1000
  const { error } = await supabase
    .from('lagerbestand')
    .upsert({ produkt_id: produktId, aktuelle_menge: neu }, { onConflict: 'produkt_id' })
  if (error) return { ok: false, fehler: error.message }
  return { ok: true, neueMenge: neu }
}

/** −1 Basiseinheit (höchstens der vorhandene Bestand): bucht echten Verbrauch (für Auswertungen). */
export async function bucheSchnellMinus(produktId: string, aktuelleMenge: number): Promise<SchnellErgebnis> {
  if (aktuelleMenge <= 0) return { ok: false, fehler: 'Kein Bestand vorhanden.' }
  const abgang = Math.min(1, aktuelleMenge)
  const res = await fetch('/api/lager/verbrauch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ produkt_id: produktId, menge: abgang, notiz: 'Schnell-Ausbuchung' }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string; neue_menge?: number }
  if (!res.ok) return { ok: false, fehler: data.error || 'Ausbuchen fehlgeschlagen.' }
  return { ok: true, neueMenge: typeof data.neue_menge === 'number' ? data.neue_menge : undefined }
}
