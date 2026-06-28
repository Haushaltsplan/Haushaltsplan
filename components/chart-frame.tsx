import type { ReactNode } from 'react'
import { appTableScrollInlineClassName } from '@/components/page-shell'

/** Edler Chart-Container — Glas-Oberfläche, optionaler Titel. */
export function ChartFrame({
  title,
  subtitle,
  action,
  children,
  className = '',
  scroll = false,
  padding = 'default',
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  scroll?: boolean
  padding?: 'default' | 'compact' | 'none'
}) {
  const bodyPad =
    padding === 'none' ? '' : padding === 'compact' ? 'app-chart-frame-body-compact' : 'app-chart-frame-body'
  const body = scroll ? (
    <div className={appTableScrollInlineClassName}>
      <div className={bodyPad}>{children}</div>
    </div>
  ) : (
    <div className={bodyPad}>{children}</div>
  )

  return (
    <div className={['app-chart-frame', className].filter(Boolean).join(' ')}>
      {title ? (
        <div className="app-chart-frame-header">
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-[var(--app-text)]">{title}</div>
            {subtitle ? <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">{subtitle}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {body}
    </div>
  )
}
