const JUNK=/incorporated|recognized|privacy|union\s*\(|&#|payments,|chief executive|officer since|previous business|accounts receivable|contract assets|receivables from contracts|shares outstanding|weighted[- ]average|diluted|basic shares|per share|stockholders|shareholders|remeasurement|held for sale|medical costs|payable|long-term assets|capitalized software|common stock|preferred stock|class [a-z0-9]/i
const BALANCE=/receivable|prepaid|other assets|other current|other liabilities|liabilit|net income|goodwill|intangible|property|equipment|cash and cash|total assets|segment assets/i
for (const l of ['Walmart U.S.','Walmart International',"Sam's Club U.S. (1)"]) {
  console.log(l, { junk: JUNK.test(l), balance: BALANCE.test(l) })
}
