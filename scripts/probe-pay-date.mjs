const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

async function auth() {
  const jar = new Map();
  const store = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(";");
      const eq = kv.indexOf("=");
      if (eq > 0) jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim());
    }
  };
  const cookieHdr = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  let r = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA }, redirect: "manual" });
  store(r);
  r = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": UA, Cookie: cookieHdr() },
  });
  return { crumb: (await r.text()).trim(), cookie: cookieHdr() };
}

async function summary(sym, modules) {
  const { crumb, cookie } = await auth();
  const u = new URL(
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}`,
  );
  u.searchParams.set("modules", modules);
  u.searchParams.set("crumb", crumb);
  const res = await fetch(u.toString(), {
    headers: { "User-Agent": UA, Cookie: cookie, Referer: "https://finance.yahoo.com/" },
  });
  const j = await res.json();
  return j.quoteSummary?.result?.[0] ?? j.quoteSummary?.error;
}

for (const sym of ["MUM.DE", "WKL.AS"]) {
  const sd = await summary(sym, "summaryDetail");
  const cal = await summary(sym, "calendarEvents");
  console.log("\n===", sym, "===");
  console.log("summaryDetail ex", sd?.exDividendDate, "div", sd?.dividendDate);
  console.log("calendar ex", cal?.exDividendDate, "div", cal?.dividendDate);
}

// scrape yahoo quote page key strings
const { crumb, cookie } = await auth();
const html = await (
  await fetch("https://finance.yahoo.com/quote/MUM.DE/", {
    headers: { "User-Agent": UA, Cookie: cookie },
  })
).text();
for (const pat of [
  /dividendDate[^}]{0,80}/gi,
  /Ex-Dividend[^<]{0,120}/gi,
  /Pay Date[^<]{0,120}/gi,
  /Zahlung[^<]{0,120}/gi,
  /"exDividendDate":\{"raw":(\d+)/,
  /"dividendDate":\{"raw":(\d+)/,
]) {
  const m = html.match(pat);
  if (m) console.log("html", pat, m.slice(0, 3));
}
