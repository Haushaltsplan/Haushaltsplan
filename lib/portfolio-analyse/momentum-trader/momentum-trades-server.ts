import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { berechnePnlEur } from '@/lib/portfolio-analyse/momentum-trader/momentum-position-sizing'
import { MOMENTUM_DEFAULT_RISK_EUR, MOMENTUM_MAX_RISK_EUR } from '@/lib/portfolio-analyse/momentum-trader/momentum-constants'
import type {
  MomentumPlaybook,
  MomentumRichtung,
  MomentumTrade,
} from '@/lib/portfolio-analyse/momentum-trader/momentum-trader-types'

const TABLE = 'momentum_trades' as const

type TradeDbZeile = {
  id: string
  symbol: string
  playbook: string
  direction: string
  entry_date: string
  entry_price: number
  stop_price: number | null
  target_price: number | null
  exit_date: string | null
  exit_price: number | null
  risk_eur: number
  pnl_eur: number | null
  rule_compliance: boolean
  notizen: string | null
  erstellt_am: string
}

function dbZuTrade(row: TradeDbZeile): MomentumTrade {
  return {
    id: row.id,
    symbol: row.symbol,
    playbook: row.playbook as MomentumPlaybook,
    direction: row.direction as MomentumRichtung,
    entryDate: row.entry_date,
    entryPrice: Number(row.entry_price),
    stopPrice: row.stop_price != null ? Number(row.stop_price) : null,
    targetPrice: row.target_price != null ? Number(row.target_price) : null,
    exitDate: row.exit_date,
    exitPrice: row.exit_price != null ? Number(row.exit_price) : null,
    riskEur: Number(row.risk_eur),
    pnlEur: row.pnl_eur != null ? Number(row.pnl_eur) : null,
    ruleCompliance: row.rule_compliance,
    notizen: row.notizen,
    erstelltAm: row.erstellt_am,
  }
}

export async function ladeMomentumTrades(sb: SupabaseClient): Promise<MomentumTrade[]> {
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .order('entry_date', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => dbZuTrade(r as TradeDbZeile))
}

export async function erstelleMomentumTrade(
  sb: SupabaseClient,
  input: {
    symbol: string
    playbook: MomentumPlaybook
    direction: MomentumRichtung
    entryDate: string
    entryPrice: number
    stopPrice?: number | null
    targetPrice?: number | null
    riskEur?: number
    notizen?: string | null
    ruleCompliance?: boolean
  },
): Promise<MomentumTrade> {
  const riskEur = Math.min(
    MOMENTUM_MAX_RISK_EUR,
    Math.max(1, input.riskEur ?? MOMENTUM_DEFAULT_RISK_EUR),
  )

  const { data, error } = await sb
    .from(TABLE)
    .insert({
      symbol: input.symbol.trim().toUpperCase(),
      playbook: input.playbook,
      direction: input.direction,
      entry_date: input.entryDate,
      entry_price: input.entryPrice,
      stop_price: input.stopPrice ?? null,
      target_price: input.targetPrice ?? null,
      risk_eur: riskEur,
      rule_compliance: input.ruleCompliance ?? true,
      notizen: input.notizen ?? null,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Trade konnte nicht gespeichert werden.')
  return dbZuTrade(data as TradeDbZeile)
}

export async function schliesseMomentumTrade(
  sb: SupabaseClient,
  id: string,
  input: {
    exitDate: string
    exitPrice: number
    ruleCompliance?: boolean
    notizen?: string | null
  },
): Promise<MomentumTrade> {
  const { data: existing, error: loadErr } = await sb.from(TABLE).select('*').eq('id', id).single()
  if (loadErr || !existing) throw new Error('Trade nicht gefunden.')

  const row = existing as TradeDbZeile
  const stop = row.stop_price != null ? Number(row.stop_price) : null
  let pnl: number | null = null
  if (stop != null) {
    pnl = berechnePnlEur(
      row.direction as MomentumRichtung,
      Number(row.entry_price),
      stop,
      input.exitPrice,
      Number(row.risk_eur),
    )
  }

  const { data, error } = await sb
    .from(TABLE)
    .update({
      exit_date: input.exitDate,
      exit_price: input.exitPrice,
      pnl_eur: pnl,
      rule_compliance: input.ruleCompliance ?? row.rule_compliance,
      notizen: input.notizen ?? row.notizen,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Trade konnte nicht aktualisiert werden.')
  return dbZuTrade(data as TradeDbZeile)
}

export async function loescheMomentumTrade(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
