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
  /** Originalsprache der Videos — steuert Innertube-hl, damit Titel nicht übersetzt werden. */
  sprache?: 'de' | 'en'
}

export const YOUTUBE_CREATORS: readonly YoutubeCreator[] = [
  // —— Deutsch ——
  {
    channelId: 'UC8a0K6N5RIyI5-O7RZ1JqhQ',
    name: 'Maximilian Gamperling',
    handle: '@MaximilianGamperling',
    sprache: 'de',
  },
  {
    channelId: 'UC0IhDpNR4NizZ3UPFJXEm1A',
    name: 'Wealth Value Passion | Nico Santura',
    handle: '@Wealth-Value-Passion',
    sprache: 'de',
  },
  {
    channelId: 'UCeARcCUiZg79SQQ-2_XNlXQ',
    name: 'Finanzfluss',
    handle: '@Finanzfluss',
    sprache: 'de',
  },
  {
    channelId: 'UCpV9LpCg4uwYCQZ3qoEn_YQ',
    name: 'Aktien mit Kopf',
    handle: '@AktienmitKopf',
    sprache: 'de',
  },
  {
    channelId: 'UCpvNsu17XsZFH3a_6tl_YyQ',
    name: 'Mission Money',
    handle: '@MissionMoney',
    sprache: 'de',
  },
  {
    channelId: 'UCL-F-8nxFtFZ4M3RWkGn6Qw',
    name: 'Daniel Pronk',
    handle: '@DanielPronk',
    sprache: 'de',
  },
  {
    channelId: 'UCNaczJItMhvegH91EtPFbCA',
    name: 'extraETF',
    handle: '@ExtraETF',
    sprache: 'de',
  },
  // —— English ——
  {
    channelId: 'UCfCT7SSFEWyG4th9ZmaGYqQ',
    name: 'Joseph Carlson After Hours',
    handle: '@JosephCarlsonAfterHours',
    sprache: 'en',
  },
  {
    channelId: 'UCbta0n8i6Rljh0obO7HzG9A',
    name: 'Joseph Carlson',
    handle: '@JosephCarlsonShow',
    sprache: 'en',
  },
  {
    channelId: 'UCs60_Z83HU76uygzHRQl0kA',
    name: 'Brian Feroldi',
    handle: '@BrianFeroldiYT',
    sprache: 'en',
  },
  {
    channelId: 'UCEhigSJQgvj9ADwYRYLkapA',
    name: 'Brian Stoffel',
    handle: '@brianstoffelyt',
    sprache: 'en',
  },
  {
    channelId: 'UCAeAB8ABXGoGMbXuYPmiu2A',
    name: 'The Swedish Investor',
    handle: '@TheSwedishInvestor',
    sprache: 'en',
  },
  {
    channelId: 'UCDXTQ8nWmx_EhZ2v-kp7QxA',
    name: 'Ben Felix',
    handle: '@BenFelixCSI',
    sprache: 'en',
  },
  {
    channelId: 'UCFCEuCsyWP0YkP3CZ3Mr01Q',
    name: 'The Plain Bagel',
    handle: '@PlainBagel',
    sprache: 'en',
  },
  {
    channelId: 'UChBVf9YnourrEDTsbbwJPRA',
    name: 'Everything Money',
    handle: '@EverythingMoney',
    sprache: 'en',
  },
  {
    channelId: 'UCASM0cgfkJxQ1ICmRilfHLw',
    name: 'Patrick Boyle',
    handle: '@PatrickBoyleOnFinance',
    sprache: 'en',
  },
  {
    channelId: 'UCvSXMi2LebwJEM1s4bz5IBA',
    name: 'New Money',
    handle: '@NewMoney',
    sprache: 'en',
  },
  {
    channelId: 'UC9TwYQOO9mAxoF4v8ZioySg',
    name: 'Investing with Tom',
    handle: '@InvestingwithTom',
    sprache: 'en',
  },
  {
    channelId: 'UCLvnJL8htRR1T9cbSccaoVw',
    name: 'Aswath Damodaran',
    handle: '@AswathDamodaranonValuation',
    sprache: 'en',
  },
]

export function hatYoutubeCreators(): boolean {
  return YOUTUBE_CREATORS.some((c) => /^UC[\w-]{20,}$/.test(c.channelId.trim()))
}
