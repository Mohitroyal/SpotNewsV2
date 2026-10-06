-- Unique view tracking: one row per user per clipping
CREATE TABLE IF NOT EXISTS public.clipping_views (
    clipping_id UUID NOT NULL REFERENCES public.clippings(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    viewed_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (clipping_id, user_id)  -- composite PK prevents duplicates
);

ALTER TABLE public.clipping_views ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert (upsert) their own view
CREATE POLICY "Allow authenticated insert on clipping_views"
ON public.clipping_views FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Reporter can read views on their own clippings
CREATE POLICY "Allow read on clipping_views"
ON public.clipping_views FOR SELECT
TO authenticated
USING (true);

-- Index for fast count queries
CREATE INDEX IF NOT EXISTS clipping_views_clipping_id_idx ON public.clipping_views(clipping_id);

-- ─── Trigger: auto-sync views_count on clippings ─────────────────────────────
CREATE OR REPLACE FUNCTION sync_clipping_views_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clippings
    SET views_count = COALESCE(views_count, 0) + 1
    WHERE id = NEW.clipping_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clippings
    SET views_count = GREATEST(COALESCE(views_count, 0) - 1, 0)
    WHERE id = OLD.clipping_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_views_count ON public.clipping_views;
CREATE TRIGGER trg_sync_views_count
AFTER INSERT OR DELETE ON public.clipping_views
FOR EACH ROW EXECUTE FUNCTION sync_clipping_views_count();
