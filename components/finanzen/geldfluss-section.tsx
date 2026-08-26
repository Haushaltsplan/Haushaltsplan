'use client'

import { ChartFrame } from '@/components/chart-frame'
import { finanzEmptyClass, finanzToggleGroupClass } from '@/components/finanzen/finanzen-ui'
import { PageSection, PageSectionPanel } from '@/components/page-shell'
import {
  baueFinanzSankey,
  type FinanzSankeyBuchung,
  type FinanzSankeyEbene,
  type FinanzSankeyNode,
} from '@/lib/finanz-sankey'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  ResponsiveContainer,
  Sankey,
  Tooltip,
  type SankeyLinkProps,
  type SankeyNodeProps,
  type TooltipContentProps,
} from 'recharts'

type GeplanteZeile = FinanzSankeyBuchung & { isIn?: boolean; __geplant?: boolean }

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function eurLabel(n: number) {
  const ganz = Math.round(n * 100) % 100 === 0
  return `${n.toLocaleString('de-DE', {
    minimumFractionDigits: ganz ? 0 : 2,
    maximumFractionDigits: ganz ? 0 : 2,
  })} €`
}

function monatLabel(yyyymm: string) {
  const [y, mo] = yyyymm.split('-').map((x) => Number.parseInt(x, 10))
  try {
    return new Date(y, mo - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  } catch {
    return yyyymm
  }
}

function kuerze(label: string, max = 20): string {
  const t = label.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6)
  const n = Number.parseInt(full, 16)
  if (!Number.isFinite(n)) return { r: 100, g: 116, b: 139 }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgba(hex: string, a: number) {
  const { r, g, b } = parseHex(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function labelLinks(ebene?: FinanzSankeyEbene) {
  return ebene === 'quelle' || ebene === 'fehlbetrag' || ebene === 'budget'
}

type NodePayload = FinanzSankeyNode & { value?: number }

const LABEL_STYLE: CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '0.01em',
  fontFamily: 'inherit',
}

function FlussNode({ x, y, width, height, payload }: SankeyNodeProps) {
  const node = payload as unknown as NodePayload
  const farbe = node.farbe || '#94a3b8'
  const ebene = node.ebene
  const wert = Number(node.value) || 0
  const w = Math.max(width, 3)
  const h = Math.max(height, 1)
  const rx = Math.min(w / 2, 3)
  const immer =
    ebene === 'budget' ||
    ebene === 'quelle' ||
    ebene === 'kategorie' ||
    ebene === 'fehlbetrag' ||
    ebene === 'ueberschuss'
  const zweiZeilen = immer ? h >= 22 : h >= 28
  const zeigeLabel = immer || h >= 14
  const links = labelLinks(ebene)
  const gap = 10
  const tx = links ? x - gap : x + w + gap
  const ty = y + h / 2
  const nameMax = ebene === 'posten' ? 18 : 16

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={rgba(farbe, 0.92)} rx={rx} ry={rx} />
      {zeigeLabel ? (
        <text
          x={tx}
          y={ty}
          textAnchor={links ? 'end' : 'start'}
          dominantBaseline="middle"
          fill="var(--app-text)"
          stroke="var(--app-bg)"
          strokeWidth={2}
          paintOrder="stroke"
          style={LABEL_STYLE}
        >
          {zweiZeilen ? (
            <>
              <tspan x={tx} dy="-0.55em" fill="var(--app-text-muted)" stroke="var(--app-bg)" style={{ fontWeight: 400 }}>
                {kuerze(node.name || '', nameMax)}
              </tspan>
              <tspan x={tx} dy="1.35em" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {eurLabel(wert)}
              </tspan>
            </>
          ) : (
            <tspan x={tx} dy="0.32em" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {kuerze(node.name || '', nameMax)}
            </tspan>
          )}
        </text>
      ) : null}
    </g>
  )
}

function FlussLink({
  sourceX,
  targetX,
  sourceY,
  targetY,
  sourceControlX,
  targetControlX,
  linkWidth,
  payload,
  aktiv,
  gedimmt,
}: SankeyLinkProps & { aktiv?: boolean; gedimmt?: boolean }) {
  const extra = payload as unknown as { farbe?: string; target?: { farbe?: string } }
  const farbe = extra.farbe || extra.target?.farbe || '#94a3b8'
  const opacity = aktiv ? 0.48 : gedimmt ? 0.08 : 0.26
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={farbe}
      strokeWidth={Math.max(linkWidth, 1.25)}
      strokeOpacity={opacity}
      strokeLinecap="round"
      style={{ transition: 'stroke-opacity 180ms ease' }}
    />
  )
}

function FlussTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload.length) return null
  const p = payload[0]
  const name = String(p?.name ?? '')
  const value = Number(p?.value) || 0
  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]/95 px-3.5 py-2.5 shadow-[0_12px_40px_-18px_var(--app-shadow-lg)] backdrop-blur-sm">
      <p className="text-[11px] font-medium tracking-tight text-[var(--app-text)]">{name}</p>
      <p className="mt-0.5 text-[13px] tabular-nums tracking-tight text-[var(--app-text-muted)]">{eur(value)}</p>
    </div>
  )
}

export function GeldflussSection({
  einnahmen,
  ausgaben,
  geplant,
  ansichtMonat,
}: {
  einnahmen: FinanzSankeyBuchung[]
  ausgaben: FinanzSankeyBuchung[]
  geplant: GeplanteZeile[]
  ansichtMonat: string
}) {
  const hatGeplant = geplant.length > 0
  const [inklGeplant, setInklGeplant] = useState(true)
  const [hoverLink, setHoverLink] = useState<number | null>(null)

  useEffect(() => {
    setInklGeplant(true)
  }, [ansichtMonat])

  const { ein, aus } = useMemo(() => {
    if (!inklGeplant || !hatGeplant) return { ein: einnahmen, aus: ausgaben }
    const extraEin = geplant.filter((g) => g.isIn)
    const extraAus = geplant.filter((g) => !g.isIn)
    return { ein: [...einnahmen, ...extraEin], aus: [...ausgaben, ...extraAus] }
  }, [einnahmen, ausgaben, geplant, inklGeplant, hatGeplant])

  const fluss = useMemo(() => baueFinanzSankey(ein, aus), [ein, aus])

  const chartHoehe = Math.min(640, Math.max(300, fluss.postenAnzahl * 42 + 72))
  const nodePadding = fluss.postenAnzahl > 18 ? 14 : 22

  const renderNode = useCallback((props: SankeyNodeProps) => <FlussNode {...props} />, [])

  const renderLink = useCallback(
    (props: SankeyLinkProps) => (
      <FlussLink {...props} aktiv={hoverLink === props.index} gedimmt={hoverLink != null && hoverLink !== props.index} />
    ),
    [hoverLink],
  )

  const toggle = hatGeplant ? (
    <div className={`${finanzToggleGroupClass} rounded-full p-[3px]`}>
      <button
        type="button"
        onClick={() => setInklGeplant(true)}
        className={`rounded-full px-2.5 py-1 text-[10px] tracking-wide transition ${
          inklGeplant ? 'bg-[var(--app-surface)] text-[var(--app-text)] shadow-sm' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
        }`}
      >
        Inkl. geplant
      </button>
      <button
        type="button"
        onClick={() => setInklGeplant(false)}
        className={`rounded-full px-2.5 py-1 text-[10px] tracking-wide transition ${
          !inklGeplant ? 'bg-[var(--app-surface)] text-[var(--app-text)] shadow-sm' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
        }`}
      >
        Nur gebucht
      </button>
    </div>
  ) : null

  return (
    <PageSection titleId="finanzen-geldfluss-heading" title="Geldfluss" density="compact">
      <PageSectionPanel density="compact">
        <ChartFrame
          title="Wohin das Geld fließt"
          subtitle={monatLabel(ansichtMonat)}
          action={toggle}
          padding="compact"
        >
          <p className="sr-only">
            Im {monatLabel(ansichtMonat)} fließen {eur(fluss.gesamtEinkommen)} Einkommen gegen{' '}
            {eur(fluss.gesamtAusgaben)} Ausgaben. Saldo {eur(fluss.saldo)}.
          </p>

          {!fluss.hatDaten ? (
            <div className={`${finanzEmptyClass} border-0 bg-transparent`}>
              Noch keine Buchungen in diesem Monat — der Geldfluss erscheint, sobald Einnahmen oder
              Ausgaben da sind.
            </div>
          ) : (
            <>
              <div className="app-h-scroll -mx-1 overflow-x-auto px-1">
                <div className="geldfluss-sankey min-w-[680px]" style={{ height: chartHoehe }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <Sankey
                      data={{ nodes: fluss.nodes, links: fluss.links }}
                      nodeWidth={5}
                      nodePadding={nodePadding}
                      linkCurvature={0.68}
                      iterations={32}
                      sort={false}
                      align="left"
                      verticalAlign="top"
                      margin={{ top: 18, right: 132, bottom: 18, left: 118 }}
                      node={renderNode}
                      link={renderLink}
                      onMouseEnter={(item, type) => {
                        if (type === 'link') setHoverLink(item.index)
                      }}
                      onMouseLeave={() => setHoverLink(null)}
                    >
                      <Tooltip content={FlussTooltip} cursor={false} />
                    </Sankey>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[var(--app-border)] pt-3">
                {fluss.kategorien.map((k) => (
                  <span
                    key={k.key}
                    className="inline-flex items-center gap-1.5 text-[10px] text-[var(--app-text-muted)]"
                  >
                    <span
                      className="h-[3px] w-3.5 rounded-full"
                      style={{ backgroundColor: k.farbe, opacity: 0.75 }}
                    />
                    {k.name}
                    <span className="tabular-nums tracking-tight text-[var(--app-text)]/80">{eurLabel(k.betrag)}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </ChartFrame>
      </PageSectionPanel>
    </PageSection>
  )
}
