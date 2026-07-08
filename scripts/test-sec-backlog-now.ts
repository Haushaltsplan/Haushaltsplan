/** npx tsx scripts/test-sec-backlog-now.ts */
import { ladeSecBacklogHistorieFuerTicker } from '../lib/portfolio-analyse/sec-edgar-backlog-server'

ladeSecBacklogHistorieFuerTicker('NOW')
  .then((b) => console.log(b ? `OK ${b.anzahlJahre}J ${b.label}` : 'null'))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
