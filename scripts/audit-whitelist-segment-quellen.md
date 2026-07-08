# Segment-Audit Nachkauf-Whitelist (32 Titel)

Stand: 2026-07-08

| Titel | Ticker | MS Prod | SA Prod | Ratio | Status | Fix |
|-------|--------|---------|---------|-------|--------|-----|
| Alphabet C | GOOG | 403.0B | 403.0B | 1.00 | ok | — |
| Mastercard | MA | 32.8B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| S&P Global | SPGI | 15.5B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| Hermès | RMS | 16.0B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| Microsoft | MSFT | 281.7B | 281.7B | 1.00 | ok | — |
| MSCI | MSCI | 3.1B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| Visa | V | 40.0B | 57.6B | 0.69 | sa_zu_niedrig | SA prüfen / MS bevorzugen |
| Old Dominion Freight Line | ODFL | 5.5B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| Waste Management | WM | 30.9B | 27.5B | 1.12 | ok | — |
| Union Pacific | UNP | 621.0B | 24.5B | 25.34 | ms_aufgeblaeht | Merge bevorzugt SA (Fix aktiv) |
| McDonald's | MCD | 26.9B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| Linde | LIN | 34.0B | 34.0B | 1.00 | ok | — |
| The Home Depot | HD | 24.9B | 152.0B | 0.16 | sa_zu_niedrig | SA prüfen / MS bevorzugen |
| Rollins | ROL | 5.1B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| Cintas | CTAS | 10.3B | 10.8B | 0.96 | ok | — |
| ASML Holding | ASML | 32.7B | 32.7B | 1.00 | ok | — |
| UnitedHealth | UNH | 621.0B | 615.5B | 1.01 | ok | — |
| Thermo Fisher Scientific | TMO | 46.6B | 46.6B | 1.00 | ok | — |
| ResMed | RMD | 8.3B | 5.1B | 1.62 | ms_aufgeblaeht | Merge bevorzugt SA (Fix aktiv) |
| Zoetis | ZTS | 9.4B | 9.5B | 0.99 | ok | — |
| ServiceNow | NOW | 13.3B | 13.3B | 1.00 | ok | — |
| Straumann Holding | STMN | 69.1B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| Halma | H11 | — | — | — | keine_daten | MS+SA fehlen |
| Sika | SIKA | 11.2B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| Kinsale Capital | KNSL | 1.9B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| Graco | GGG | 4.5B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| Veeva Systems | VEEV | 3.2B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| Alimentation Couche-Tard | ATD | 76.5B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| Arista Networks | ANET | 9.0B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| Wolters Kluwer | WKL | 6.1B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| Balchem | BCPC | 1.0B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |
| Datadog | DDOG | 3.4B | — | — | nur_ms | SA-Fallback fehlt — MS nicht validierbar |

## Handlungsbedarf

- **MS aufgebläht** (Merge-Fix greift): UNP, RMD
- **SA fehlt** (nur MS, nicht validierbar): MA, SPGI, RMS, MSCI, ODFL, MCD, ROL, STMN, SIKA, KNSL, GGG, VEEV, ATD, ANET, WKL, BCPC, DDOG
