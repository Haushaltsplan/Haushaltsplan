-- Bestehende Biere von „Getränke“ → „Bier“ (nach neuer Warengruppe).
UPDATE public.produkte
SET kategorie = 'Bier'
WHERE lower(trim(kategorie)) IN ('getränke', 'getraenke', 'getranke')
  AND (
    lower(name) ~ '(bier|pils|urhell|weizen|radler|hacklberger|stiegl|goesser|gauder|zipfer|puntigamer|bräu|braeu|brew|lager|ötti|otti)'
    OR lower(name) = 'bier'
  );
