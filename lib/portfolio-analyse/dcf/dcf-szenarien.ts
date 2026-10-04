import type { DcfAnnahmen, DcfSzenarioId } from '@/lib/portfolio-analyse/dcf/dcf-types'

function clip(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Bear / Base / Bull relativ zu den aktuellen Basis-Annahmen (Paket-Defaults). */
export function szenarioAnnahmen(basis: DcfAnnahmen, id: DcfSzenarioId): DcfAnnahmen {
  if (id === 'base') return { ...basis }

  if (id === 'bear') {
    return {
      ...basis,
      gStartPct: clip(basis.gStartPct * 0.6, -5, 25),
      waccPct: Math.round((basis.waccPct + 1) * 100) / 100,
      gTerminalPct: clip(basis.gTerminalPct - 0.5, 1.5, 4),
    }
  }

  return {
    ...basis,
    gStartPct: clip(basis.gStartPct * 1.25, -5, 25),
    waccPct: Math.max(4, Math.round((basis.waccPct - 0.75) * 100) / 100),
    gTerminalPct: clip(basis.gTerminalPct + 0.5, 1.5, 3.5),
  }
}

export const DCF_SZENARIO_LABELS: Record<DcfSzenarioId, string> = {
  bear: 'Bear',
  base: 'Base',
  bull: 'Bull',
}
