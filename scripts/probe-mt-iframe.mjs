const UA = 'Mozilla/5.0'
for (const yb of [15, 30, 50]) {
  const iframe = await fetch(
    `https://www.macrotrends.net/production/stocks/desktop/PRODUCTION/fundamental_iframe.php?t=HESAY&type=revenue&statement=income-statement&freq=A&sub=&yb=${yb}`,
    { headers: { 'User-Agent': UA } },
  ).then((r) => r.text())
  const cm = iframe.match(/var chartData = (\[[\s\S]*?\]);/)
  if (!cm) {
    console.log('yb', yb, 'no chart')
    continue
  }
  const d = JSON.parse(cm[1])
  console.log('yb', yb, 'points', d.length, d[0]?.date, d[d.length - 1]?.date)
}
