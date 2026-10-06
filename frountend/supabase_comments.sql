-- Drop existing policies if they exist (safe re-run)
DROP POLICY IF EXISTS "Allow public read on lipping_comments" ON public.lipping_comments;
DROP POLICY IF EXISTS "Allow authenticated insert on lipping_comments" ON public.lipping_comments;

-- Create comments table for clippings
CREATE TABLE IF NOT EXISTS public.lipping_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clipping_id UUID NOT NULL REFERENCES public.clippings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL DEFAULT 'Anonymous',
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.lipping_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments
CREATE POLICY "Allow public read on lipping_comments"
ON public.lipping_comments FOR SELECT
TO public
USING (true);

-- Authenticated users can insert comments
CREATE POLICY "Allow authenticated insert on lipping_comments"
ON public.lipping_comments FOR INSERT
TO authenticated
WITH CHECK (true);

-- Index for fast lookups by clipping
CREATE INDEX IF NOT EXISTS lipping_comments_clipping_id_idx ON public.lipping_comments(clipping_id);

-- ─── Trigger: auto-sync comments_count on clippings ──────────────────────────
CREATE OR REPLACE FUNCTION sync_clipping_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clippings
    SET comments_count = COALESCE(comments_count, 0) + 1
    WHERE id = NEW.clipping_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clippings
    SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0)
    WHERE id = OLD.clipping_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_comments_count ON public.lipping_comments;
CREATE TRIGGER trg_sync_comments_count
AFTER INSERT OR DELETE ON public.lipping_comments
FOR EACH ROW EXECUTE FUNCTION sync_clipping_comments_count();
