-- Storniert eine Verbrauchszeile: Bestand zurück, Zeile löschen; Mahlzeit-Kosten neu berechnen oder Mahlzeit löschen.

DROP FUNCTION IF EXISTS public.lager_verbrauch_rueckgaengig(uuid);

CREATE OR REPLACE FUNCTION public.lager_verbrauch_rueckgaengig(p_verbrauch_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r public.lager_verbrauch%ROWTYPE;
  v_mid uuid;
  cnt int;
  v_total numeric := 0;
  rec record;
  v_basis_sum_m numeric;
  v_basis_sum_p numeric;
  v_avg numeric;
BEGIN
  SELECT * INTO r FROM public.lager_verbrauch WHERE id = p_verbrauch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERBRAUCH_NICHT_GEFUNDEN';
  END IF;

  UPDATE public.lagerbestand lb
  SET aktuelle_menge = round(coalesce(lb.aktuelle_menge, 0) + r.menge, 3)
  WHERE lb.produkt_id = r.produkt_id;

  IF NOT FOUND THEN
    INSERT INTO public.lagerbestand (produkt_id, aktuelle_menge) VALUES (r.produkt_id, r.menge);
  END IF;

  v_mid := r.mahlzeit_id;

  DELETE FROM public.lager_verbrauch WHERE id = p_verbrauch_id;

  IF v_mid IS NOT NULL THEN
    SELECT count(*)::int INTO cnt FROM public.lager_verbrauch WHERE mahlzeit_id = v_mid;
    IF cnt = 0 THEN
      DELETE FROM public.lager_mahlzeit WHERE id = v_mid;
    ELSE
      FOR rec IN SELECT v.produkt_id, v.menge FROM public.lager_verbrauch v WHERE v.mahlzeit_id = v_mid
      LOOP
        SELECT coalesce(sum(le.gesamtpreis), 0),
               coalesce(
                 sum(
                   CASE
                     WHEN coalesce(le.basis_menge, 0) > 0 THEN le.basis_menge
                     ELSE le.menge
                   END
                 ),
                 0
               )
        INTO v_basis_sum_p, v_basis_sum_m
        FROM public.lager_einkauf le
        WHERE le.produkt_id = rec.produkt_id;

        IF v_basis_sum_m > 0 THEN
          v_avg := v_basis_sum_p / v_basis_sum_m;
        ELSE
          v_avg := NULL;
        END IF;

        v_total := v_total + CASE WHEN v_avg IS NOT NULL THEN round(rec.menge * v_avg, 4) ELSE 0 END;
      END LOOP;

      UPDATE public.lager_mahlzeit
      SET kosten_geschaetzt_eur = round(v_total, 2)
      WHERE id = v_mid;
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.lager_verbrauch_rueckgaengig(uuid) IS
  'Macht eine Ausbuchung rückgängig: Bestand +menge, lager_verbrauch löschen; Mahlzeit-Kosten neu oder Mahlzeit entfernen.';
