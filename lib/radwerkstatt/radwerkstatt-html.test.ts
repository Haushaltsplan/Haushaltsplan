/**
 *   npx tsx lib/radwerkstatt/radwerkstatt-html.test.ts
 */
import { extrahiereProduktHinweise, seiteWirktGesperrt } from '@/lib/radwerkstatt/radwerkstatt-html'
import { parseRadwerkstattListe } from '@/lib/radwerkstatt/radwerkstatt-store'
import { istPrivateOderLokaleIp, normalisiereProduktUrl, pruefeHttpUrlForm } from '@/lib/radwerkstatt/radwerkstatt-url'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(istPrivateOderLokaleIp('127.0.0.1'), 'loopback')
assert(istPrivateOderLokaleIp('10.1.2.3'), 'rfc1918 10')
assert(istPrivateOderLokaleIp('192.168.0.4'), 'rfc1918 192.168')
assert(istPrivateOderLokaleIp('172.16.0.1'), 'rfc1918 172.16')
assert(istPrivateOderLokaleIp('169.254.169.254'), 'link-local')
assert(!istPrivateOderLokaleIp('1.1.1.1'), 'öffentlich')
assert(istPrivateOderLokaleIp('::1'), 'ipv6 loopback')

let abgelehnt = false
try {
  pruefeHttpUrlForm('http://127.0.0.1/admin')
} catch {
  abgelehnt = true
}
assert(abgelehnt, 'lokaler Link')

abgelehnt = false
try {
  pruefeHttpUrlForm('file:///C:/geheim')
} catch {
  abgelehnt = true
}
assert(abgelehnt, 'file-Link')

const sauber = normalisiereProduktUrl('https://shop.example/kette/?utm_source=nl&id=3#oben')
assert(sauber === 'https://shop.example/kette?id=3', sauber)

const html = `<!doctype html><html><head>
<title>Shop | Kettenschloss</title>
<meta property="og:title" content="Muc-Off Kettenreiniger 400 ml">
<meta property="og:image" content="https://cdn.example/kette.jpg">
<meta property="og:description" content="Entfernt Öl von der Kette.">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Muc-Off Kettenreiniger","description":"Reiniger für die Kette.","image":"https://cdn.example/kette.jpg","offers":{"@type":"Offer","price":"12.99","priceCurrency":"EUR"}}
</script>
</head><body><p>Für die Werkstatt.</p></body></html>`

const hinweis = extrahiereProduktHinweise(html, 'https://shop.example/produkt')
assert(hinweis.name === 'Muc-Off Kettenreiniger', hinweis.name)
assert(hinweis.preisEur === 12.99, String(hinweis.preisEur))
assert(hinweis.bildUrl === 'https://cdn.example/kette.jpg', hinweis.bildUrl)
assert(hinweis.beschreibung.includes('Kette'), hinweis.beschreibung)
assert(hinweis.text.includes('Werkstatt'), hinweis.text)
assert(!hinweis.text.includes('ld+json'), 'Skript nicht im Text')

const liste = parseRadwerkstattListe([
  {
    id: 'a1',
    liste: 'bedarf',
    art: 'verbrauch',
    name: 'Kettenöl',
    einsatzbereich: 'Kette schmieren',
    preisEur: 9.5,
    haltbarkeit: 'ca. 20 Anwendungen',
    verwendungsrhythmus: 'alle 200 km',
    anzahl: 2,
  },
  { id: '', name: 'ohne id' },
  { id: 'x', liste: 'nope', name: 'falsche liste' },
])
assert(liste.length === 1, 'nur gültige Zeile')
assert(liste[0]?.anzahl === 2, 'anzahl')
assert(liste[0]?.art === 'verbrauch', 'art')
assert(liste[0]?.haltbarkeit === 'ca. 20 Anwendungen', 'haltbarkeit')

const shopify = extrahiereProduktHinweise(
  `<html><head>
<meta property="og:title" content="Bio Drivetrain Cleaner">
<meta property="og:image" content="https://cdn.example/reiniger.png">
</head><body><script>{"price":{"amount":22.0,"currencyCode":"GBP"}}</script></body></html>`,
  'https://shop.example/p',
)
assert(shopify.preisEur === null, 'GBP ist kein Euro-Preis')
assert(shopify.preisText.includes('22') && shopify.preisText.includes('GBP'), shopify.preisText)
assert(shopify.bildUrl === 'https://cdn.example/reiniger.png', shopify.bildUrl)

const bike24 = extrahiereProduktHinweise(
  `<html><head>
<meta property="og:title" content="SRAM FORCE Kette | E1 - lila | BIKE24">
<meta property="og:image:url" content="https://cdn.example/og.jpg">
<script type="application/ld+json">
{"@type":"ProductGroup","name":"SRAM FORCE Kette | E1","hasVariant":[
  {"@type":"Product","name":"SRAM FORCE Kette | E1 - silber","offers":{"@type":"Offer","price":"41.99","priceCurrency":"EUR","url":"https://www.bike24.de/p1.html"},"image":["https://cdn.example/silber.jpg"]},
  {"@type":"Product","name":"SRAM FORCE Kette | E1 - lila","description":"Flattop-Kette für 12-fach-Rennrad.","offers":{"@type":"Offer","price":"49.99","priceCurrency":"EUR","url":"https://www.bike24.de/p1928720.html"},"image":["https://cdn.example/lila.jpg"]}
]}
</script>
</head><body>nav</body></html>`,
  'https://www.bike24.de/p1928720.html?sku=3136593',
)
assert(bike24.name === 'SRAM FORCE Kette | E1 - lila', bike24.name)
assert(bike24.preisEur === 49.99, String(bike24.preisEur))
assert(bike24.bildUrl === 'https://cdn.example/lila.jpg', bike24.bildUrl)
assert(bike24.beschreibung.includes('Flattop'), bike24.beschreibung)

assert(seiteWirktGesperrt('<html><title>Access Denied</title><body>edgesuite</body></html>'), 'gesperrt')
assert(!seiteWirktGesperrt('<html><title>SRAM FORCE Kette</title><body>' + 'x'.repeat(3000) + '</body></html>'), 'offen')

console.log('radwerkstatt-html.test ok')
