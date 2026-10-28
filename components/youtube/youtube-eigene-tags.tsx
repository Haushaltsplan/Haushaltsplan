'use client'

import { useState } from 'react'
import { tagBereinigen, tagsSichtbar } from '@/lib/youtube/youtube-tags'

export function YoutubeEigeneTags({
  eigene,
  onEigene,
  automatisch,
  ohne,
  onOhne,
}: {
  eigene: string[]
  onEigene: (tags: string[]) => void
  automatisch: string[]
  ohne: string[]
  onOhne: (tags: string[]) => void
}) {
  const [text, setText] = useState('')
  const liste = tagsSichtbar(automatisch, eigene, ohne)

  function hinzu(roh = text) {
    const neu = roh.split(/[,;\n]/).map(tagBereinigen).filter(Boolean)
    if (!neu.length) return
    const next = [...eigene]
    const wieder = ohne.filter((w) => !neu.some((n) => n.toLowerCase() === w.toLowerCase()))
    if (wieder.length !== ohne.length) onOhne(wieder)
    for (const tag of neu) {
      if (liste.some((t) => t.toLowerCase() === tag.toLowerCase())) continue
      if (next.some((t) => t.toLowerCase() === tag.toLowerCase())) continue
      next.push(tag)
    }
    onEigene(next)
    setText('')
  }

  function entfernen(tag: string) {
    if (eigene.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      onEigene(eigene.filter((t) => t.toLowerCase() !== tag.toLowerCase()))
      return
    }
    if (!ohne.some((t) => t.toLowerCase() === tag.toLowerCase())) onOhne([...ohne, tag])
  }

  return (
    <div className="mt-3">
      <label className="block text-xs font-medium text-[var(--app-text)]">Tags</label>
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
          className="shrink-0 rounded-lg border border-[var(--app-border)] px-3 py-1 text-xs text-[var(--app-text)]"
        >
          Hinzufügen
        </button>
      </div>
      {liste.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {liste.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => entfernen(tag)}
              className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-0.5 text-[11px] text-[var(--app-text)]"
            >
              {tag} ×
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">Noch keine Tags.</p>
      )}
      <p className="mt-1 text-[11px] text-[var(--app-text-muted)]">
        Komma oder Enter fügt hinzu. Klick auf einen Tag entfernt ihn. Diese Liste geht so zu YouTube.
      </p>
    </div>
  )
}
