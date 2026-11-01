/**
 *   npx tsx lib/radwerkstatt/radwerkstatt-html.test.ts
 */
import { bike24IdKandidaten } from '@/lib/radwerkstatt/radwerkstatt-bike24'
import { extrahiereProduktHinweise, hinweisReicht, seiteWirktGesperrt } from '@/lib/radwerkstatt/radwerkstatt-html'
import { betragAusShopifyPreis, shopifyHtmlAusProdukt, shopifyProduktPfad } from '@/lib/radwerkstatt/radwerkstatt-shopify'
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
assert(bike24IdKandidaten('https://www.bike24.de/p1144433.html?origin=CP').includes('144433'), 'bike24 id')
assert(bike24IdKandidaten('https://www.bike24.de/p1928720.html').includes('928720'), 'bike24 kette')
assert(bike24IdKandidaten('https://www.bike-components.de/de/x').length === 0, 'kein bike24')

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
assert(
  seiteWirktGesperrt('<html><head><title> </title></head><body>bm-verify akamai-loading-screen</body></html>'),
  'prüfseite',
)

const varianten = extrahiereProduktHinweise(
  `<html><head>
<meta property="og:site_name" content="bike-components">
<script type="application/ld+json">
{"@type":"ProductGroup","name":"Kette CN-HG71 6-/7-/8-fach","brand":{"@type":"Brand","name":"Shimano"},"image":"https://cdn.example/kette.jpg","hasVariant":[
  {"@type":"Product","name":"silber | 116","offers":{"@type":"Offer","price":"16.99","priceCurrency":"EUR","url":"https://www.bike-components.de/de/Shimano/Kette-CN-HG71-6-7-8-fach-p40008/"}},
  {"@type":"Product","name":"silber | 138","offers":{"@type":"Offer","price":"19.99","priceCurrency":"EUR","url":"https://www.bike-components.de/de/Shimano/Kette-CN-HG71-6-7-8-fach-p40008/"}}
]}
</script>
</head><body><p>Hyperglide-Kette.</p></body></html>`,
  'https://www.bike-components.de/de/Shimano/Kette-CN-HG71-6-7-8-fach-p40008/',
)
assert(varianten.name === 'Shimano Kette CN-HG71 6-/7-/8-fach', varianten.name)
assert(varianten.preisEur === 16.99, String(varianten.preisEur))
assert(varianten.bildUrl === 'https://cdn.example/kette.jpg', varianten.bildUrl)
assert(!seiteWirktGesperrt('<html><title>SRAM FORCE Kette</title><body>' + 'x'.repeat(3000) + '</body></html>'), 'offen')

const rose = extrahiereProduktHinweise(
  `<html><head>
<title>Park Tool Kettennieter CT-3.2 | Rose Bikes</title>
<meta property="og:site_name" content="Rose Bikes">
<meta property="og:title" content="Park Tool Kettennieter CT-3.2 | Rose Bikes">
<meta property="og:image" content="https://cdn.example/logo.png">
<link rel="image_src" href="https://cdn.example/ct.jpg">
</head><body>
<nav>Helme Sale 9,99 €</nav>
<span itemprop="price" content="39.95"></span>
<span itemprop="priceCurrency" content="EUR"></span>
<p>Nieten für 6- bis 12-fach-Ketten.</p>
</body></html>`,
  'https://www.rosebikes.de/ct-3',
)
assert(rose.name === 'Park Tool Kettennieter CT-3.2', rose.name)
assert(rose.preisEur === 39.95, String(rose.preisEur))
assert(rose.bildUrl === 'https://cdn.example/ct.jpg', rose.bildUrl)
assert(!rose.text.includes('Helme'), rose.text)
assert(hinweisReicht(rose), 'rose reicht')

const huelle = extrahiereProduktHinweise(
  '<html><head><title>Shop</title></head><body>Bitte JavaScript aktivieren.</body></html>',
  'https://shop.example/',
)
assert(!hinweisReicht(huelle), 'leere Hülle')

const einPreis = extrahiereProduktHinweise(
  `<html><head><meta property="og:title" content="Silca Kettenwachs"><meta property="og:image" content="https://cdn.example/wachs.jpg"></head><body><p>Das Teil kostet 18,50 €.</p></body></html>`,
  'https://silca.example/wachs',
)
assert(einPreis.preisEur === 18.5, String(einPreis.preisEur))

const versand = extrahiereProduktHinweise(
  `<html><head><title>Unklarer Preis</title></head><body><p>12,99 € und Versand 4,90 €</p></body></html>`,
  'https://shop.example/unklar',
)
assert(versand.preisEur === 12.99, String(versand.preisEur))

const zweiPreise = extrahiereProduktHinweise(
  `<html><head><title>Unklarer Preis</title></head><body><p>12,99 € oder 19,99 €</p></body></html>`,
  'https://shop.example/unklar',
)
assert(zweiPreise.preisEur === null, 'mehrere Euro-Beträge')

const stattPreis = extrahiereProduktHinweise(
  `<html><head><meta property="og:title" content="Muc-Off Dry Lube"><meta property="og:image" content="https://cdn.example/lube.jpg"></head><body><p>um 10,99 € statt 15,49 €</p></body></html>`,
  'https://www.alltricks.de/p',
)
assert(stattPreis.preisEur === 10.99, String(stattPreis.preisEur))

const ausfuehrung = extrahiereProduktHinweise(
  `<html><head><script type="application/ld+json">
{"@type":"ProductGroup","name":"CN-HG71C 6/7/8-speed Chain","brand":{"@type":"Brand","name":"Shimano"},"image":"https://cdn.example/hg71.jpg","hasVariant":[
  {"@type":"Product","name":"CN-HG71C 6/7/8-speed Chain - 138 links","offers":{"@type":"Offer","price":"18.99","priceCurrency":"EUR","url":"https://www.bike-discount.de/en/shimano-cn-hg71c-6/7/8-speed-chain?number=138"}},
  {"@type":"Product","name":"CN-HG71C 6/7/8-speed Chain - 116 links","offers":{"@type":"Offer","price":"16.99","priceCurrency":"EUR","url":"https://www.bike-discount.de/en/shimano-cn-hg71c-6/7/8-speed-chain?number=116"}}
]}
</script></head><body>Kette</body></html>`,
  'https://www.bike-discount.de/en/shimano-cn-hg71c-6/7/8-speed-chain',
)
assert(ausfuehrung.name === 'Shimano CN-HG71C 6/7/8-speed Chain', ausfuehrung.name)
assert(ausfuehrung.preisEur === 16.99, String(ausfuehrung.preisEur))
assert(ausfuehrung.bildUrl === 'https://cdn.example/hg71.jpg', ausfuehrung.bildUrl)

const markeDoppelt = extrahiereProduktHinweise(
  `<html><head><script type="application/ld+json">
{"@type":"Product","name":"Optimize Graphen-Kettenwachs","brand":{"@type":"Brand","name":"Optimize GmbH"},"image":"https://cdn.example/wachs.png","offers":{"@type":"Offer","price":"69.99","priceCurrency":"EUR"}}
</script></head><body>Wachs</body></html>`,
  'https://www.optimize.bike/products/optimize-graphene-chain-wax',
)
assert(markeDoppelt.name === 'Optimize Graphen-Kettenwachs', markeDoppelt.name)

const shopifyPfad = shopifyProduktPfad('https://www.optimize.bike/products/optimize-graphene-chain-wax?variant=5')
assert(shopifyPfad?.handle === 'optimize-graphene-chain-wax', shopifyPfad?.handle ?? '')
assert(shopifyPfad?.variant === '5', shopifyPfad?.variant ?? '')
assert(shopifyProduktPfad('https://www.bike-components.de/de/Shimano/Kette') === null, 'kein Shopify')
assert(betragAusShopifyPreis(6999) === 69.99, String(betragAusShopifyPreis(6999)))

const shopifySeite = extrahiereProduktHinweise(
  shopifyHtmlAusProdukt(
    {
      title: 'Optimize Graphen-Kettenwachs',
      vendor: 'Optimize GmbH',
      description: '<p>Flüssiges Graphen-Kettenwachs für die Rennradkette.</p>',
      price: 6999,
      featured_image: '//cdn.shopify.com/s/files/wachs.png',
      variants: [{ id: 5, title: 'Default Title', price: 6999 }],
    },
    'EUR',
    'https://www.optimize.bike/products/optimize-graphene-chain-wax',
  ),
  'https://www.optimize.bike/products/optimize-graphene-chain-wax',
)
assert(shopifySeite.name === 'Optimize Graphen-Kettenwachs', shopifySeite.name)
assert(shopifySeite.preisEur === 69.99, String(shopifySeite.preisEur))
assert(shopifySeite.bildUrl.includes('cdn.shopify.com'), shopifySeite.bildUrl)
assert(shopifySeite.beschreibung.includes('Graphen'), shopifySeite.beschreibung)

const shopifyFremd = extrahiereProduktHinweise(
  shopifyHtmlAusProdukt(
    { title: 'Dry Lube', vendor: 'Muc-Off', price: 1299, featured_image: 'https://cdn.shopify.com/s/files/dry.png' },
    'GBP',
    'https://muc-off.com/products/dry-lube',
  ),
  'https://muc-off.com/products/dry-lube',
)
assert(shopifyFremd.preisEur === null, 'GBP bleibt ohne Euro')
assert(shopifyFremd.preisText.includes('GBP'), shopifyFremd.preisText)

const eingebettet = extrahiereProduktHinweise(
  `<html><head><title>Seite</title><script type="application/ld+json">
{"@type":"WebPage","mainEntity":{"@type":"IndividualProduct","name":"Silca Pumpe","description":"Minipumpe für Rennrad.","image":"https://cdn.example/silca.jpg","offers":{"@type":"Offer","price":"45.00","priceCurrency":"EUR"}}}
</script></head><body>ok</body></html>`,
  'https://silca.example/pumpe',
)
assert(eingebettet.name === 'Silca Pumpe', eingebettet.name)
assert(eingebettet.preisEur === 45, String(eingebettet.preisEur))
assert(eingebettet.bildUrl === 'https://cdn.example/silca.jpg', eingebettet.bildUrl)

console.log('radwerkstatt-html.test ok')
