/** Helfer für Haltbarkeit (MHD) und Mindestbestand der Speisekammer (Grocy-Stil). */

export type MhdStatus = 'abgelaufen' | 'bald' | 'ok' | 'keine'

/** Ab so vielen Tagen bis zum MHD gilt ein Artikel als „läuft bald ab". */
export const MHD_BALD_TAGE = 7

function heuteMitternacht(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function parseMhd(mhd?: string | null): Date | null {
  if (!mhd) return null
  // Erwartet 'YYYY-MM-DD' (Supabase date); lokal als Mitternacht interpretieren.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(mhd)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  d.setHours(0, 0, 0, 0)
  return Number.isFinite(d.getTime()) ? d : null
}

/** Tage bis zum MHD (negativ = bereits abgelaufen, 0 = heute). */
export function tageBisMhd(mhd?: string | null): number | null {
  const d = parseMhd(mhd)
  if (!d) return null
  const diff = d.getTime() - heuteMitternacht().getTime()
  return Math.round(diff / 86_400_000)
}

export function mhdStatus(mhd?: string | null, schwelleTage: number = MHD_BALD_TAGE): MhdStatus {
  const tage = tageBisMhd(mhd)
  if (tage == null) return 'keine'
  if (tage < 0) return 'abgelaufen'
  if (tage <= schwelleTage) return 'bald'
  return 'ok'
}

/** Kurzlabel z. B. „12.06." bzw. „heute", „morgen", „vor 2 T". */
export function mhdKurzLabel(mhd?: string | null): string {
  const d = parseMhd(mhd)
  if (!d) return ''
  const tage = tageBisMhd(mhd)
  if (tage === 0) return 'heute'
  if (tage === 1) return 'morgen'
  if (tage != null && tage < 0) return `vor ${Math.abs(tage)} T`
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

export function mhdVollLabel(mhd?: string | null): string {
  const d = parseMhd(mhd)
  if (!d) return ''
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function istUnterMindestbestand(menge: number, mindestbestand?: number | null): boolean {
  if (mindestbestand == null || !Number.isFinite(mindestbestand) || mindestbestand <= 0) return false
  return menge < mindestbestand
}
