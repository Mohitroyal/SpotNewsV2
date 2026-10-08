-- Run this in your Supabase SQL Editor to create the bucket and allow public access

-- 1. Create the bucket and make it public
INSERT INTO storage.buckets (id, name, public)
VALUES ('newscraft-clippings', 'newscraft-clippings', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow anyone to view media in this bucket
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'newscraft-clippings');

-- 3. Allow any user (authenticated or anonymous) to upload media
CREATE POLICY "Anyone can upload media"
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'newscraft-clippings');
