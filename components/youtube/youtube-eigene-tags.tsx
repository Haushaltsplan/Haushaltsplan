'use client'

import { useState } from 'react'
import { tagBereinigen } from '@/lib/youtube/youtube-tags'

export function YoutubeEigeneTags({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState('')

  function hinzu(roh = text) {
    const neu = roh
      .split(/[,;\n]/)
      .map(tagBereinigen)
      .filter(Boolean)
    if (!neu.length) return
    const next = [...tags]
    for (const tag of neu) {
      if (next.some((t) => t.toLowerCase() === tag.toLowerCase())) continue
      next.push(tag)
    }
    onChange(next)
    setText('')
  }

  return (
    <div className="mt-3">
      <label className="block text-xs text-[var(--app-text-muted)]">Eigene Tags</label>
      <div className="mt-1 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            hinzu()
          }}
          placeholder="payments, moat"
          className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-red-500/40"
        />
        <button
          type="button"
          onClick={() => hinzu()}
          className="shrink-0 rounded-lg border border-[var(--app-border)] px-3 py-1 text-xs text-[var(--app-text-muted)]"
        >
          Hinzufügen
        </button>
      </div>
      {tags.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="rounded-full border border-[var(--app-border)] px-2 py-0.5 text-[11px] text-[var(--app-text)]"
            >
              {tag} ×
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">Komma oder Enter. Die Tags kommen zusätzlich zu Hashtags und Suchbegriffen.</p>
      )}
    </div>
  )
}
