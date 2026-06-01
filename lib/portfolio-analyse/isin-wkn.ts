import type { IsinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'
import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

const DE_EXCH = new Set(['GY', 'GR', 'GT', 'GF', 'GD', 'GS', 'GM', 'DE', 'XETRA', 'XETR'])
const WKN_RE = /^[A-Z0-9]{6}$/

type FigiZeile = { ticker?: string; exchCode?: string }

/** WKN aus OpenFIGI (Xetra/Tradegate-Ticker) oder manueller Kenntnis-Tabelle. */
export function wknAusFigiOderKenntnis(isin: string, figiRows: FigiZeile[], kenntnis?: IsinKenntnis | null): string | null {
  const manuell = kenntnis?.wkn ?? isinKenntnis(isin)?.wkn
  if (manuell) return manuell.toUpperCase()

  for (const row of figiRows) {
    const ex = (row.exchCode ?? '').toUpperCase()
    const t = (row.ticker ?? '').trim().toUpperCase()
    if (!DE_EXCH.has(ex) || !WKN_RE.test(t)) continue
    return t
  }
  return null
}
