/**
 * Eingebaute Standard-Watchlist (bis du unter Investments eine eigene Liste speicherst).
 * Yahoo-Symbole für Spark-Kurse; `notierung` nur für die Kurszeile in der UI.
 */
export type PortfolioPositionDefinition = {
  name: string
  symbolYahoo: string
  notierung: string
}

export const DEFAULT_PORTFOLIO_POSITIONEN: PortfolioPositionDefinition[] = [
  { name: 'Alphabet', symbolYahoo: 'GOOGL', notierung: 'USD' },
  { name: 'Mastercard', symbolYahoo: 'MA', notierung: 'USD' },
  { name: 'Microsoft', symbolYahoo: 'MSFT', notierung: 'USD' },
  { name: 'Hermès', symbolYahoo: 'RMS.PA', notierung: 'EUR' },
  { name: 'S&P Global', symbolYahoo: 'SPGI', notierung: 'USD' },
  { name: 'Visa', symbolYahoo: 'V', notierung: 'USD' },
  { name: 'ResMed', symbolYahoo: 'RMD', notierung: 'USD' },
  { name: 'ASML Holding', symbolYahoo: 'ASML', notierung: 'USD' },
  { name: 'Zoetis', symbolYahoo: 'ZTS', notierung: 'USD' },
  { name: 'MSCI', symbolYahoo: 'MSCI', notierung: 'USD' },
  { name: 'UnitedHealth', symbolYahoo: 'UNH', notierung: 'USD' },
  { name: 'Thermo Fisher Scientific', symbolYahoo: 'TMO', notierung: 'USD' },
  { name: 'Waste Management', symbolYahoo: 'WM', notierung: 'USD' },
  { name: 'Old Dominion Freight Line', symbolYahoo: 'ODFL', notierung: 'USD' },
  { name: 'LVMH', symbolYahoo: 'MC.PA', notierung: 'EUR' },
  { name: 'ServiceNow', symbolYahoo: 'NOW', notierung: 'USD' },
  { name: 'Linde', symbolYahoo: 'LIN', notierung: 'USD' },
  { name: 'Balchem Corporation', symbolYahoo: 'BCPC', notierung: 'USD' },
  { name: 'Kinsale Capital', symbolYahoo: 'KNSL', notierung: 'USD' },
  { name: 'Home Depot', symbolYahoo: 'HD', notierung: 'USD' },
  { name: 'Halma', symbolYahoo: 'HLMA.L', notierung: 'GBP' },
  { name: 'Arista Networks', symbolYahoo: 'ANET', notierung: 'USD' },
  { name: "McDonald's", symbolYahoo: 'MCD', notierung: 'USD' },
  { name: 'Rollins', symbolYahoo: 'ROL', notierung: 'USD' },
  { name: 'Veeva Systems', symbolYahoo: 'VEEV', notierung: 'USD' },
  { name: 'Sherwin-Williams', symbolYahoo: 'SHW', notierung: 'USD' },
  { name: 'Straumann Holding', symbolYahoo: 'STMN.SW', notierung: 'CHF' },
  { name: 'Graco', symbolYahoo: 'GGG', notierung: 'USD' },
  { name: 'Alimentation Couche-Tard', symbolYahoo: 'ATD.TO', notierung: 'CAD' },
  { name: 'Sika', symbolYahoo: 'SIKA.SW', notierung: 'CHF' },
  { name: 'Danaher', symbolYahoo: 'DHR', notierung: 'USD' },
  { name: 'Datadog', symbolYahoo: 'DDOG', notierung: 'USD' },
  { name: 'Edwards Lifesciences', symbolYahoo: 'EW', notierung: 'USD' },
  { name: 'IMCD', symbolYahoo: 'IMCD.AS', notierung: 'EUR' },
  { name: 'Mensch und Maschine', symbolYahoo: 'MUM.DE', notierung: 'EUR' },
  { name: 'Union Pacific', symbolYahoo: 'UNP', notierung: 'USD' },
  { name: 'Upstart', symbolYahoo: 'UPST', notierung: 'USD' },
  { name: 'Wolters Kluwer', symbolYahoo: 'WKL.AS', notierung: 'EUR' },
  { name: 'Netflix', symbolYahoo: 'NFLX', notierung: 'USD' },
  { name: 'BlackRock', symbolYahoo: 'BLK', notierung: 'USD' },
]
