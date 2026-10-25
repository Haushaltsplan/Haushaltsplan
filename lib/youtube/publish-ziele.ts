/** Dünnes Gerüst: YouTube ist angebunden, die anderen warten auf Konto/Audit/Credits. */

export type PublishZielId = 'youtube' | 'instagram' | 'x' | 'tiktok'

export type PublishZiel = {
  id: PublishZielId
  label: string
  aktiv: boolean
  hinweis: string | null
}

export const PUBLISH_ZIELE: PublishZiel[] = [
  { id: 'youtube', label: 'YouTube', aktiv: true, hinweis: null },
  {
    id: 'instagram',
    label: 'Instagram Reels',
    aktiv: false,
    hinweis: 'Professional-Konto und Meta-App — noch nicht angebunden.',
  },
  { id: 'x', label: 'X', aktiv: false, hinweis: 'X-API-Credits — noch nicht angebunden.' },
  {
    id: 'tiktok',
    label: 'TikTok',
    aktiv: false,
    hinweis: 'Ohne TikTok-Audit nur privat — noch nicht angebunden.',
  },
]
