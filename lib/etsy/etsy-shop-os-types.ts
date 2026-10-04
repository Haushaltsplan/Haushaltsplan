/** Gemeinsame Typen für Etsy Shop-OS (Phasen A–G). */

export type EtsyShopOsModul =
  | 'geld'
  | 'betrieb'
  | 'wachstum'
  | 'zahlen'
  | 'kunden'
  | 'strategie'

export type EtsyKostenZeile = {
  holzEur: number
  oelEur: number
  schleifEur: number
  werkzeugEur: number
  stromEur: number
  verpackungEur: number
  sonstigesEur: number
  arbeitsstunden: number
  stundensatzEur: number
  versandAnteilEur?: number
}

export type EtsyShopEinstellungen = {
  zielMargePct: number
  etsyGebuehrPct: number
  paymentGebuehrPct: number
  paymentGebuehrFix: number
  /** Verschnitt/Ausschuss/Gemeinkosten auf Material+Arbeit, Default 12 % */
  gemeinkostenAufschlagPct: number
  /** MwSt-Satz, Default 19 (DE). Bei Kleinunternehmer: 0 */
  mwstSatzPct: number
  /** Listing-Preis ist Brutto (inkl. MwSt) — typisch für DE-Endkunden */
  preisIstBrutto: boolean
  kapazitaetProWoche: number
  starSeller: EtsyStarSellerCheck
}

export type EtsyStarSellerCheck = {
  antwortzeitOk?: boolean
  versandfensterOk?: boolean
  caseRateOk?: boolean
  bewertungenOk?: boolean
  notiz?: string
}

export type EtsyBestellStatus = 'neu' | 'fertigung' | 'verpacken' | 'versendet' | 'erledigt' | 'problem'

export type EtsyRohholzStatus = 'gekauft' | 'trocknung' | 'bereit' | 'verarbeitet' | 'verworfen'

export type EtsyPreisAmpel = 'zu_billig' | 'fair' | 'premium' | 'ohne_kosten'

export type EtsyMargeErgebnis = {
  materialEur: number
  arbeitEur: number
  gemeinkostenEur: number
  variableEur: number
  /** Brutto-Listingpreis (wie auf Etsy) */
  bruttoPreisEur: number | null
  /** Netto-Erlös vor Gebühren (MwSt herausgerechnet falls brutto) */
  nettoErloesEur: number | null
  mwstEur: number
  gebuehrenEur: number
  gesamtkostenEur: number
  /** Netto nach Kosten+Gebühren (Unternehmer-Ergebnis vor ESt) */
  nettoEur: number
  margePct: number | null
  /** Empfohlener Brutto-Mindestpreis auf Etsy */
  mindestpreisEur: number
  ampel: EtsyPreisAmpel
}

export type EtsyKillOrScale = 'nachschaerfen' | 'premium' | 'pausieren' | 'skalieren' | 'halten'

export function summeMaterial(k: EtsyKostenZeile): number {
  return (
    k.holzEur +
    k.oelEur +
    k.schleifEur +
    k.werkzeugEur +
    k.stromEur +
    k.verpackungEur +
    k.sonstigesEur +
    (k.versandAnteilEur ?? 0)
  )
}

/**
 * Regelbasierte Marge / Mindestpreis / Ampel — ohne KI.
 *
 * Modell (DE Handwerk auf Etsy):
 * - Etsy-/Payment-Fees auf den Brutto-Transaktionsbetrag (Buyer zahlt).
 * - MwSt ist Durchlaufposten: bei `preisIstBrutto` wird sie aus dem Preis herausgerechnet,
 *   bevor die Unternehmer-Marge auf dem Netto-Erlös gemessen wird.
 * - Gemeinkosten-Aufschlag deckt Verschnitt/Risse/Werkstatt (aus Rohholz-Pipeline).
 * - Mindestpreis = Brutto-Listingpreis, der Zielmarge nach Fees+MwSt+Gemeinkosten erreicht.
 */
export function berechneMarge(
  verkaufspreisEur: number | null,
  kosten: EtsyKostenZeile,
  einstellungen: Pick<
    EtsyShopEinstellungen,
    | 'zielMargePct'
    | 'etsyGebuehrPct'
    | 'paymentGebuehrPct'
    | 'paymentGebuehrFix'
    | 'gemeinkostenAufschlagPct'
    | 'mwstSatzPct'
    | 'preisIstBrutto'
  >,
): EtsyMargeErgebnis {
  const materialEur = summeMaterial(kosten)
  const arbeitEur = Math.max(0, kosten.arbeitsstunden) * Math.max(0, kosten.stundensatzEur)
  const basis = materialEur + arbeitEur
  const gkPct = Math.max(0, Math.min(80, einstellungen.gemeinkostenAufschlagPct ?? 12)) / 100
  const gemeinkostenEur = Math.round(basis * gkPct * 100) / 100
  const variableEur = Math.round((basis + gemeinkostenEur) * 100) / 100

  const brutto = verkaufspreisEur != null && verkaufspreisEur > 0 ? verkaufspreisEur : null
  const mwstSatz = Math.max(0, Math.min(30, einstellungen.mwstSatzPct ?? 0)) / 100
  const bruttoAlsNetto =
    brutto == null
      ? null
      : einstellungen.preisIstBrutto && mwstSatz > 0
        ? brutto / (1 + mwstSatz)
        : brutto
  const mwstEur =
    brutto != null && bruttoAlsNetto != null ? Math.round((brutto - bruttoAlsNetto) * 100) / 100 : 0

  // Etsy fees on gross transaction amount
  const gebuehrenEur = brutto
    ? Math.round(
        ((brutto * (einstellungen.etsyGebuehrPct + einstellungen.paymentGebuehrPct)) / 100 +
          einstellungen.paymentGebuehrFix) *
          100,
      ) / 100
    : 0

  const gesamtkostenEur = Math.round((variableEur + gebuehrenEur) * 100) / 100
  const nettoEur =
    bruttoAlsNetto != null ? Math.round((bruttoAlsNetto - gesamtkostenEur) * 100) / 100 : -gesamtkostenEur
  // Marge auf Netto-Erlös (ohne MwSt), nicht auf Brutto — sonst unterschätzt Kleinunternehmer / überschätzt USt-Pflichtige
  const margePct =
    bruttoAlsNetto != null && bruttoAlsNetto > 0
      ? Math.round((nettoEur / bruttoAlsNetto) * 1000) / 10
      : null

  const ziel = Math.max(5, Math.min(90, einstellungen.zielMargePct)) / 100
  const feePct = (einstellungen.etsyGebuehrPct + einstellungen.paymentGebuehrPct) / 100
  // Brutto B: NettoErloes = B/(1+mwst) bzw. B; Fees = B*feePct + fix
  // NettoErgebnis = NettoErloes - variable - Fees ≥ ziel * NettoErloes
  // → NettoErloes*(1-ziel) ≥ variable + B*feePct + fix
  const mwstFaktor = einstellungen.preisIstBrutto && mwstSatz > 0 ? 1 + mwstSatz : 1
  let mindestpreisEur: number
  if (1 - ziel - feePct * mwstFaktor > 0.05) {
    // variable + fix ≤ NettoErloes*(1-ziel) - B*feePct; B = NettoErloes * mwstFaktor
    // variable + fix ≤ B/mwstFaktor*(1-ziel) - B*feePct
    // variable + fix ≤ B * ((1-ziel)/mwstFaktor - feePct)
    const denom = (1 - ziel) / mwstFaktor - feePct
    mindestpreisEur =
      denom > 0.05
        ? Math.ceil(((variableEur + einstellungen.paymentGebuehrFix) / denom) * 100) / 100
        : Math.ceil(variableEur * 2.4 * mwstFaktor * 100) / 100
  } else {
    mindestpreisEur = Math.ceil(variableEur * 2.4 * mwstFaktor * 100) / 100
  }

  let ampel: EtsyPreisAmpel = 'ohne_kosten'
  if (variableEur > 0 && brutto != null) {
    if (margePct != null && margePct < ziel * 100 - 10) ampel = 'zu_billig'
    else if (margePct != null && margePct > ziel * 100 + 15) ampel = 'premium'
    else ampel = 'fair'
  } else if (variableEur <= 0) {
    ampel = 'ohne_kosten'
  }

  return {
    materialEur: Math.round(materialEur * 100) / 100,
    arbeitEur: Math.round(arbeitEur * 100) / 100,
    gemeinkostenEur,
    variableEur,
    bruttoPreisEur: brutto,
    nettoErloesEur: bruttoAlsNetto != null ? Math.round(bruttoAlsNetto * 100) / 100 : null,
    mwstEur,
    gebuehrenEur,
    gesamtkostenEur,
    nettoEur,
    margePct,
    mindestpreisEur,
    ampel,
  }
}

export function berlinIsoWoche(d = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' })
  const parts = fmt.formatToParts(d)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  const utc = new Date(Date.UTC(y, m - 1, day))
  const dow = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - dow)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** API/UI-Ergebnisformen (ohne server-only). */

export type EtsyGeldListing = {
  listingId: number
  title: string
  priceEur: number | null
  url: string | null
  views: number | null
  favoriten: number | null
  kosten: EtsyKostenZeile | null
  marge: EtsyMargeErgebnis
}

export type EtsyFeeLedgerUi = {
  fees30Eur: number
  gross30Eur: number
  net30Eur: number
  ledgerDebits30Eur: number
  ledgerCredits30Eur: number
  paymentsCount30: number
  ledgerCount30: number
  vergleichModell: {
    modellGebuehren30: number
    deltaEur: number
    hinweis: string
  }
  letzteEintraege: Array<{
    entryId: number
    amountEur: number | null
    description: string
    entryType: string
    at: string | null
  }>
}

export type EtsyGeldErgebnis = {
  einstellungen: EtsyShopEinstellungen
  listings: EtsyGeldListing[]
  pnl: {
    umsatz30: number
    /** Modell-Schätzung (6,5%+4%+0,25€) */
    gebuehren30: number
    /** Echte Fees aus Payment/Ledger wenn vorhanden */
    gebuehrenEcht30: number | null
    material30: number
    netto30: number
    verkaufe30: number
  }
  feeLedger: EtsyFeeLedgerUi | null
  portfolio: {
    aktiverWertEur: number
    listingsMitKosten: number
    listingsOhneKosten: number
    toteKapitalEur: number
    toteListings: Array<{ listingId: number; title: string; priceEur: number; tageOhneVerkauf: number }>
  }
  vorlagen: Array<{
    id: string
    name: string
    holzart: string | null
    kosten: EtsyKostenZeile
  }>
}

export type EtsyFunnelListing = {
  listingId: number
  title: string
  priceEur: number | null
  views7: number
  favs7: number
  verkaufe30: number
  viewToFavPct: number | null
  favToSalePct: number | null
  score: number | null
  tageSeitVerkauf: number | null
  killOrScale: EtsyKillOrScale
  grund: string
}

export type EtsyZahlenErgebnis = {
  funnelShop: {
    views7: number
    favs7: number
    verkaufe30: number
    viewToFavPct: number | null
    favToSalePct: number | null
  }
  entscheidungen: Array<{ titel: string; detail: string; listingId?: number; prio: number }>
  zombies: EtsyFunnelListing[]
  listings: EtsyFunnelListing[]
  forecast: { verkaufe30: number; verkaufe90: number; hinweis: string }
}

export type EtsyWachstumErgebnis = {
  saisonAktiv: Array<{ id: string; name: string; tag: string }>
  kampagnen: Array<{
    id: string
    saisonId: string
    listingId: number
    listingTitle: string
    tagGeplant: boolean
    giftFoto: boolean
    preisOk: boolean
    erledigt: boolean
    notiz: string
  }>
  content: Array<{
    id: string
    listingId: number | null
    listingTitle: string
    kanal: string
    idee: string
    geplantFuer: string | null
    erledigt: boolean
  }>
  abTests: Array<{
    id: string
    listingId: number
    listingTitle: string
    variante: string
    aktiv: boolean
    titel: string | null
    gestartetAt: string
    notiz: string
  }>
  reviews: Array<{
    id: string
    receiptId: number | null
    listingId: number | null
    kaeuferName: string
    sterne: number | null
    zitat: string
    angefragtAt: string | null
    fuerListingNutzen: boolean
  }>
  reviewAufgaben: Array<{ receiptId: number; kaeuferName: string; listingTitle: string; tageSeitKauf: number }>
  starSeller: {
    antwortzeitOk: boolean
    versandfensterOk: boolean
    caseRateOk: boolean
    bewertungenOk: boolean
    notiz: string
    score: number
  }
  fotoHinweise: Array<{ listingId: number; title: string; hinweis: string }>
  geschenkBudgets: Array<{ budget: number; listings: Array<{ listingId: number; title: string; priceEur: number }> }>
}

export type EtsyKundenErgebnis = {
  kaeufer: Array<{
    key: string
    name: string
    landIso: string | null
    kaeufe: number
    umsatzEur: number
    letzteKaufAt: string | null
    holzVorlieben: string[]
    anlaesse: string[]
    notiz: string
  }>
  crmAufgaben: Array<{
    id: string
    kaeuferKey: string
    kaeuferName: string
    art: string
    faelligAm: string
    erledigt: boolean
    text: string
  }>
  gravuren: Array<{
    id: string
    receiptId: number | null
    listingId: number | null
    kaeuferName: string
    textWunsch: string
    aufschlagEur: number
    status: string
    notiz: string
  }>
  nachrichten: Array<{
    id: string
    prioritaet: string
    betreff: string
    kaeuferName: string
    erledigt: boolean
    notiz: string
    createdAt: string
  }>
  /** Käufertexte aus Receipts — Etsy hat keine Conversations-API */
  receiptNachrichten: Array<{
    receiptId: number
    kaeuferName: string
    listingTitle: string
    messageFromBuyer: string
    giftMessage: string
    gekauftAt: string | null
  }>
  conversationsHinweis: string
}

export type EtsyCeoBriefing = {
  woche: string
  umsatz30: number
  netto30: number
  verkaufe30: number
  topListing: { listingId: number; title: string; verkaufe30: number } | null
  flopListing: { listingId: number; title: string; views7: number } | null
  aktionen: Array<{ titel: string; detail: string; listingId?: number }>
  konkurrenzHinweis: string | null
  kapazitaet: { proWoche: number; offeneBestellungen: number; auslastungPct: number }
  algoAlarme: Array<{ listingId: number; title: string; detail: string }>
}

export type EtsyStrategieErgebnis = {
  briefing: EtsyCeoBriefing
  rohholz: Array<{
    id: string
    holzart: string
    beschreibung: string
    status: EtsyRohholzStatus
    kostenEur: number | null
    gekauftAt: string | null
    bereitAt: string | null
    listingId: number | null
    notiz: string
  }>
  killOrScale: Array<{
    listingId: number
    title: string
    aktion: string
    grund: string
    views7: number
    verkaufe30: number
  }>
}
