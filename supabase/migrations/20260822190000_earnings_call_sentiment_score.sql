-- Sentiment-Score (−100…+100) für Earnings-Call-KI-Zusammenfassungen
ALTER TABLE public.portfolio_earnings_call_ki
  ADD COLUMN IF NOT EXISTS sentiment_score smallint;

COMMENT ON COLUMN public.portfolio_earnings_call_ki.sentiment_score IS
  'Management-Optimismus −100 (Krise) … +100 (sehr optimistisch)';
