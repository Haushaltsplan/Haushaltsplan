-- Basiseinheit pro Artikel (kg / Liter / Stück) + Kauf-Menge/-Einheit pro Einkaufszeile.
-- Ø-Preis = Summe(gesamtpreis) / Summe(basis_menge); Bestand in Basiseinheit.

ALTER TABLE public.produkte
  ADD COLUMN IF NOT EXISTS basis_einheit text NOT NULL DEFAULT 'Stück';

UPDATE public.produkte
SET basis_einheit = CASE
  WHEN lower(trim(einheit)) IN ('kg', 'kilogramm') THEN 'kg'
  WHEN lower(trim(einheit)) IN ('l', 'liter', 'litre') OR lower(trim(einheit)) LIKE '%liter%' THEN 'Liter'
  ELSE 'Stück'
END;

COMMENT ON COLUMN public.produkte.basis_einheit IS 'Vergleichs- und Bestandseinheit: kg | Liter | Stück';

ALTER TABLE public.lager_einkauf
  ADD COLUMN IF NOT EXISTS kauf_menge numeric,
  ADD COLUMN IF NOT EXISTS kauf_einheit text,
  ADD COLUMN IF NOT EXISTS basis_menge numeric,
  ADD COLUMN IF NOT EXISTS basis_einheit text;

CREATE OR REPLACE FUNCTION public.lager_nach_basis_umrechnen(
  p_menge numeric,
  p_von text,
  p_basis text
) RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := lower(trim(replace(coalesce(p_von, ''), ' ', '')));
  b text := trim(coalesce(p_basis, ''));
BEGIN
  IF p_menge IS NULL OR p_menge <= 0 THEN
    RETURN p_menge;
  END IF;
  IF b = 'Stück' THEN
    RETURN p_menge;
  END IF;
  IF b = 'kg' THEN
    IF v IN ('g', 'gramm', 'gr') THEN
      RETURN p_menge / 1000.0;
    END IF;
    IF v IN ('kg', 'kilogramm') THEN
      RETURN p_menge;
    END IF;
    RETURN p_menge;
  END IF;
  IF b = 'Liter' THEN
    IF v IN ('ml', 'milliliter') THEN
      RETURN p_menge / 1000.0;
    END IF;
    IF v IN ('l', 'liter', 'litre') OR v LIKE '%liter%' THEN
      RETURN p_menge;
    END IF;
    IF trim(coalesce(p_von, '')) = 'Liter' THEN
      RETURN p_menge;
    END IF;
    RETURN p_menge;
  END IF;
  RETURN p_menge;
END;
$$;

-- Alte Zeilen: menge galt in der Einheit des Artikels (produkte.einheit) → Basiseinheit.
UPDATE public.lager_einkauf e
SET
  kauf_menge = e.menge,
  kauf_einheit = trim(p.einheit),
  basis_einheit = p.basis_einheit,
  basis_menge = public.lager_nach_basis_umrechnen(e.menge, trim(p.einheit), p.basis_einheit)
FROM public.produkte p
WHERE p.id = e.produkt_id;

UPDATE public.lager_einkauf
SET menge = basis_menge;

UPDATE public.lagerbestand lb
SET aktuelle_menge = round(
  public.lager_nach_basis_umrechnen(lb.aktuelle_menge, trim(p.einheit), p.basis_einheit)::numeric,
  6
)
FROM public.produkte p
WHERE p.id = lb.produkt_id;

UPDATE public.lager_verbrauch v
SET menge = round(
  public.lager_nach_basis_umrechnen(v.menge, trim(p.einheit), p.basis_einheit)::numeric,
  6
)
FROM public.produkte p
WHERE p.id = v.produkt_id;

UPDATE public.produkte
SET einheit = CASE basis_einheit
  WHEN 'kg' THEN 'kg'
  WHEN 'Liter' THEN 'Liter'
  ELSE 'Stück'
END;

ALTER TABLE public.lager_einkauf
  ALTER COLUMN kauf_menge SET NOT NULL,
  ALTER COLUMN kauf_einheit SET NOT NULL,
  ALTER COLUMN basis_menge SET NOT NULL,
  ALTER COLUMN basis_einheit SET NOT NULL;

COMMENT ON COLUMN public.lager_einkauf.menge IS 'Menge in Basiseinheit des Artikels (wie basis_menge).';
COMMENT ON COLUMN public.lager_einkauf.kauf_menge IS 'Menge wie auf dem Kassenzettel.';
COMMENT ON COLUMN public.lager_einkauf.kauf_einheit IS 'Einheit auf dem Zettel (z. B. g, kg, ml, Liter, Stück).';
COMMENT ON COLUMN public.lager_einkauf.basis_menge IS 'Menge umgerechnet in produkte.basis_einheit.';
COMMENT ON COLUMN public.lager_einkauf.basis_einheit IS 'Kopie der Basiseinheit zum Zeitpunkt der Buchung.';

COMMENT ON TABLE public.lager_einkauf IS 'Kassenzeilen; gewichteter Ø-Preis = Summe(gesamtpreis) / Summe(basis_menge)';
