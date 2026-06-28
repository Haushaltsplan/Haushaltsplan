import type { ReactNode } from 'react'
import { ResponsiveTableWrap } from '@/components/page-shell'
import { appDataTableClass, appTableFrameClass } from '@/lib/app-ui'

/** Responsive Tabelle mit Premium-Rahmen (Header, Hover, Typo). */
export function AppDataTable({
  children,
  className,
  frame = true,
  minWidth,
}: {
  children: ReactNode
  className?: string
  /** Äußerer Kartenrahmen (Standard: an). */
  frame?: boolean
  minWidth?: string
}) {
  const table = (
    <table
      className={[appDataTableClass, minWidth, className].filter(Boolean).join(' ')}
      style={minWidth && !minWidth.startsWith('min-w-') ? { minWidth } : undefined}
    >
      {children}
    </table>
  )

  const scroll = <ResponsiveTableWrap>{table}</ResponsiveTableWrap>
  if (!frame) return scroll
  return <div className={appTableFrameClass}>{scroll}</div>
}
