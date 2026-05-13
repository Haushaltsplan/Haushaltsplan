'use client'

import { Fragment, type ReactNode } from 'react'

/** `**fett**` — schlichtes Inline-Markdown. */
export function formatInlineMarkdown(text: string, strongClassName: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
      return (
        <strong key={i} className={strongClassName}>
          {p.slice(2, -2)}
        </strong>
      )
    }
    return <Fragment key={i}>{p}</Fragment>
  })
}

export type CoachFormattedAccent = 'violet' | 'teal' | 'emerald'

const HEADING_LG: Record<CoachFormattedAccent, string> = {
  violet: 'text-[15px] font-bold tracking-tight text-violet-100',
  teal: 'text-[15px] font-bold tracking-tight text-teal-200',
  emerald: 'text-[15px] font-bold tracking-tight text-emerald-200',
}

const HEADING_SM: Record<CoachFormattedAccent, string> = {
  violet: 'text-[13px] font-bold tracking-tight text-violet-200/95',
  teal: 'text-[13px] font-bold tracking-tight text-teal-300/95',
  emerald: 'text-[13px] font-bold tracking-tight text-emerald-200/95',
}

type CoachFormattedReplyProps = {
  content: string
  accent?: CoachFormattedAccent
  /** Fließtext-Absätze (Listen nutzen ggf. `listTextClass`). */
  paragraphClassName?: string
  listClassName?: string
  strongClassName?: string
}

/**
 * Überschriften (# …), Aufzählungen, nummerierte Listen, Absätze, `**fett**`.
 * Für Chat-Antworten (Finanz-Coach, Rezept-Coach, …).
 */
export function CoachFormattedReply({
  content,
  accent = 'violet',
  paragraphClassName,
  listClassName,
  strongClassName,
}: CoachFormattedReplyProps) {
  const strong =
    strongClassName ??
    (accent === 'emerald' ? 'font-semibold text-emerald-50' : 'font-semibold text-slate-100')

  const para =
    paragraphClassName ??
    (accent === 'emerald'
      ? 'text-[13px] leading-relaxed text-emerald-100/95'
      : 'text-[13px] leading-relaxed text-slate-200/95')

  const list =
    listClassName ??
    (accent === 'emerald'
      ? 'list-outside space-y-1.5 pl-4 text-[13px] leading-snug text-emerald-100/90'
      : 'list-outside space-y-1.5 pl-4 text-[13px] leading-snug text-slate-200/95')

  const raw = content.replace(/\r\n/g, '\n').trimEnd()
  const lines = raw.split('\n')
  const out: ReactNode[] = []
  let key = 0

  const isHeading = (s: string) => /^#{1,3}\s+/.test(s.trim())
  const isBullet = (s: string) => /^[-*•]\s+/.test(s.trim())
  const isNumbered = (s: string) => /^\d{1,2}\.\s+/.test(s.trim())

  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ''
    const t = line.trim()

    if (!t) {
      i++
      continue
    }

    if (isHeading(t)) {
      const level = (t.match(/^#+/)?.[0] ?? '#').length
      const text = t.replace(/^#+\s+/, '')
      const cls = level <= 2 ? HEADING_LG[accent] : HEADING_SM[accent]
      out.push(
        <h4 key={key++} className={`${cls} mt-1 first:mt-0`}>
          {formatInlineMarkdown(text, strong)}
        </h4>,
      )
      i++
      continue
    }

    if (isBullet(t) || isNumbered(t)) {
      const ordered = isNumbered(t)
      const items: string[] = []
      while (i < lines.length) {
        const lt = (lines[i] ?? '').trim()
        if (!lt) break
        if (ordered && !isNumbered(lt)) break
        if (!ordered && !isBullet(lt)) break
        const stripped = lt.replace(/^[-*•]\s+/, '').replace(/^\d{1,2}\.\s+/, '')
        items.push(stripped)
        i++
      }
      const ListTag = ordered ? 'ol' : 'ul'
      out.push(
        <ListTag
          key={key++}
          className={`${list} ${ordered ? 'list-decimal' : 'list-disc'}`}
        >
          {items.map((item, j) => (
            <li key={j} className="pl-1">
              {formatInlineMarkdown(item, strong)}
            </li>
          ))}
        </ListTag>,
      )
      continue
    }

    const paraLines: string[] = []
    while (i < lines.length) {
      const lt = (lines[i] ?? '').trim()
      if (!lt) break
      if (isHeading(lt) || isBullet(lt) || isNumbered(lt)) break
      paraLines.push(lines[i]!.trim())
      i++
    }
    if (paraLines.length) {
      out.push(
        <p key={key++} className={para}>
          {formatInlineMarkdown(paraLines.join(' '), strong)}
        </p>,
      )
    }
  }

  return <div className="space-y-2.5">{out}</div>
}
