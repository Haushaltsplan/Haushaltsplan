import type { Metadata } from 'next'
import { PortfolioNewsTerminalClient } from '@/components/portfolio-analyse/portfolio-news-terminal.client'

export const metadata: Metadata = {
  title: 'News-Terminal · Portfolioanalyse',
}

export default function PortfolioNewsPage() {
  return <PortfolioNewsTerminalClient />
}
