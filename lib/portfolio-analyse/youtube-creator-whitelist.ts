/**
 * Ausgewählte YouTube-Kanäle für die Fundamentaldaten-Leiste.
 *
 * Nur diese Creator tauchen auf — kein globales YouTube-Search.
 * channelId = UC… (YouTube → Kanal → Teilen / URL /channel/UC…).
 *
 * Eintrag ergänzen:
 *   { channelId: 'UCxxxxxxxxxxxxxxxxxxxxxx', name: 'Kanalname', handle: '@handle' },
 */
export type YoutubeCreator = {
  channelId: string
  name: string
  handle?: string
}

export const YOUTUBE_CREATORS: readonly YoutubeCreator[] = [
  {
    channelId: 'UC8a0K6N5RIyI5-O7RZ1JqhQ',
    name: 'Maximilian Gamperling',
    handle: '@MaximilianGamperling',
  },
  {
    channelId: 'UCfCT7SSFEWyG4th9ZmaGYqQ',
    name: 'Joseph Carlson After Hours',
    handle: '@JosephCarlsonAfterHours',
  },
  {
    channelId: 'UCbta0n8i6Rljh0obO7HzG9A',
    name: 'Joseph Carlson',
    handle: '@JosephCarlsonShow',
  },
  {
    channelId: 'UC0IhDpNR4NizZ3UPFJXEm1A',
    name: 'Wealth Value Passion | Nico Santura',
    handle: '@Wealth-Value-Passion',
  },
  {
    channelId: 'UCs60_Z83HU76uygzHRQl0kA',
    name: 'Brian Feroldi',
    handle: '@BrianFeroldiYT',
  },
  {
    channelId: 'UCEhigSJQgvj9ADwYRYLkapA',
    name: 'Brian Stoffel',
    handle: '@brianstoffelyt',
  },
]

export function hatYoutubeCreators(): boolean {
  return YOUTUBE_CREATORS.some((c) => /^UC[\w-]{20,}$/.test(c.channelId.trim()))
}
