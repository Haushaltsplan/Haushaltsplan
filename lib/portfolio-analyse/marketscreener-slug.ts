import { isinKenntnis } from '@/lib/portfolio-analyse/isin-kenntnisse'

/** Bekannte Slugs (finances-URL: /quote/stock/{slug}/finances/). */
const SLUGS: Record<string, string> = {
  // Alphabet
  US02079K1079: 'ALPHABET-INC-24203373',
  US02079K3059: 'ALPHABET-INC-24203373',
  // Konservativ US
  US57636Q1040: 'MASTERCARD-INC-17163',
  US78409V1044: 'S-P-GLOBAL-INC-191560905',
  US5949181045: 'MICROSOFT-CORPORATION-4835',
  US55354G1004: 'MSCI-INC-13685317',
  US92826C8394: 'VISA-INC-6469',
  US6795801009: 'OLD-DOMINION-FREIGHT-LINE-10355',
  US94106L1098: 'WASTE-MANAGEMENT-INC-14885',
  US9078181081: 'UNION-PACIFIC-CORPORATION-14750',
  US5801351017: 'MCDONALD-S-CORPORATION-4833',
  IE000S9YS762: 'LINDE-PLC-16584236',
  US4370761029: 'HOME-DEPOT-INC-4836',
  US7757111049: 'ROLLINS-INC-14259',
  US1729081059: 'CINTAS-CORPORATION-4861',
  // EU / CH
  FR0000052292: 'HERMES-INTERNATIONAL-4657',
  NL0010273215: 'ASML-HOLDING-N-V-12002973',
  NL0000395903: 'WOLTERS-KLUWER-N-V-6291',
  CH1175448666: 'STRAUMANN-HOLDING-AG-9364975',
  CH0418792922: 'SIKA-AG-2955924',
  GB0004052071: 'HALMA-PLC-9590130',
  // Moderat US
  US91324P1021: 'UNITEDHEALTH-GROUP-INC-14750',
  US8835561023: 'THERMO-FISHER-SCIENTIFIC-INC-14623',
  US7611521078: 'RESMED-INC-14277',
  US98978V1035: 'ZOETIS-INC-12482719',
  US81762P1021: 'SERVICENOW-INC-10912979',
  US49714P1084: 'KINSALE-CAPITAL-GROUP-INC-31339903',
  US3841091040: 'GRACO-INC-12894',
  US9224751084: 'VEEVA-SYSTEMS-INC-16739207',
  CA01626P1484: 'ALIMENTATION-COUCHE-TARD-INC-1410907',
  US0404132054: 'ARISTA-NETWORKS-INC-16617700',
  // Spekulativ
  US0576652004: 'BALCHEM-CORPORATION-10364',
  US23804L1035: 'DATADOG-INC-11661379',
  // Sonstige (Forecast / Diagnose)
  US67066G1040: 'NVIDIA-CORPORATION-57355629',
  US0378331005: 'APPLE-INC-4849',
  US0231351067: 'AMAZON-COM-INC-12864605',
  US0079031078: 'ADVANCED-MICRO-DEVICES-INC-19475876',
  DE0006580806: 'MENSCH-UND-MASCHINE-SOFTWARE-436035',
}

function slugAusName(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function marketscreenerSlugKandidaten(
  isin: string,
  name: string,
  symbolYahoo?: string | null,
): string[] {
  const isinNorm = isin.trim().toUpperCase()
  const out: string[] = []
  const add = (s: string) => {
    const t = s.trim()
    if (t && !out.includes(t)) out.push(t)
  }

  const hard = SLUGS[isinNorm]
  if (hard) add(hard)

  const k = isinKenntnis(isinNorm)
  if (k?.name) {
    const n = slugAusName(k.name)
    if (n.length > 3) {
      add(`${n}-CORP`)
      add(`${n}-INC`)
      add(`${n}-PLC`)
      add(`${n}-AG`)
      add(n)
    }
  }

  const sym = (symbolYahoo ?? k?.symbolYahoo ?? '').trim().toUpperCase()
  if (sym && !sym.includes('.')) {
    add(`${slugAusName(sym)}-CORP`)
    add(`${slugAusName(sym)}-INC`)
  }

  if (name.trim()) {
    const n = slugAusName(name)
    if (n.length > 3) add(n)
  }

  return out
}
