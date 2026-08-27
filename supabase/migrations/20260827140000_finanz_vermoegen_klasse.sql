-- Anlageklasse für Vermögensposten (Bank, Aktien, P2P, Bausparer, Fonds, Rente, Sonstiges).
-- Bestehende Zeilen werden anhand des Titels grob zugeordnet.

ALTER TABLE public.finanz_vermoegen
  ADD COLUMN IF NOT EXISTS klasse text NOT NULL DEFAULT 'sonstiges';

ALTER TABLE public.finanz_vermoegen
  DROP CONSTRAINT IF EXISTS finanz_vermoegen_klasse_check;

ALTER TABLE public.finanz_vermoegen
  ADD CONSTRAINT finanz_vermoegen_klasse_check
  CHECK (klasse IN ('bank', 'aktien', 'fonds', 'p2p', 'bausparer', 'rente', 'sonstiges'));

UPDATE public.finanz_vermoegen
SET klasse = 'bausparer'
WHERE klasse = 'sonstiges'
  AND titel ~* '(bauspar|schwäbisch hall|schwaebisch hall|wüstenrot|wuestenrot|bausparkasse|\blbs\b)';

UPDATE public.finanz_vermoegen
SET klasse = 'p2p'
WHERE klasse = 'sonstiges'
  AND titel ~* '(p2p|mintos|bondora|peerberry|auxmoney|estateguru|twino|robocash|viainvest|peer-to-peer)';

UPDATE public.finanz_vermoegen
SET klasse = 'rente'
WHERE klasse = 'sonstiges'
  AND titel ~* '(uniprofirente|uniprofi|riester|rürup|ruerup|altersvorsorge|betriebsrente|lebensversicherung|pensionskasse)';

UPDATE public.finanz_vermoegen
SET klasse = 'fonds'
WHERE klasse = 'sonstiges'
  AND titel ~* '(uniglobal|union investment|fondsspar|\bfonds?\b|\bfond\b|investmentfonds)';

UPDATE public.finanz_vermoegen
SET klasse = 'aktien'
WHERE klasse = 'sonstiges'
  AND titel ~* '(trade republic|traderepublic|parqet|scalable|smartbroker|justtrade|flatex|consorsbank|comdirect|\baktie|\bdepot\b|wertpapier)';

UPDATE public.finanz_vermoegen
SET klasse = 'bank'
WHERE klasse = 'sonstiges'
  AND titel ~* '(tagesgeld|festgeld|giro|sparbuch|bargeld|sparkasse|volksbank|ing-diba|postbank|n26|c24|\bkonto\b|\bbank)';
