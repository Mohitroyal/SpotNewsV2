-- Create the reporter_applications table
CREATE TABLE IF NOT EXISTS public.reporter_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    aadhar_card TEXT NOT NULL,
    press_id TEXT NOT NULL,
    state TEXT,
    district TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure state and district columns exist if table was already created earlier
ALTER TABLE public.reporter_applications ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.reporter_applications ADD COLUMN IF NOT EXISTS district TEXT;

-- Set up Row Level Security (RLS)
ALTER TABLE public.reporter_applications ENABLE ROW LEVEL SECURITY;

-- Allow public to insert applications (when submitting the form from login/signup)
DROP POLICY IF EXISTS "Allow public inserts to reporter_applications" ON public.reporter_applications;
CREATE POLICY "Allow public inserts to reporter_applications"
ON public.reporter_applications FOR INSERT
TO public
WITH CHECK (true);

-- Allow authenticated users to view their own application based on email
DROP POLICY IF EXISTS "Allow users to view own application" ON public.reporter_applications;
CREATE POLICY "Allow users to view own application"
ON public.reporter_applications FOR SELECT
TO authenticated
USING (email = auth.jwt() ->> 'email');

-- Allow superadmin / admin full access to view, approve, reject and manage applications
DROP POLICY IF EXISTS "Allow admins full access to reporter_applications" ON public.reporter_applications;
DROP POLICY IF EXISTS "Allow superadmin full access to reporter_applications" ON public.reporter_applications;

CREATE POLICY "Allow superadmin full access to reporter_applications"
ON public.reporter_applications FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND (
      profiles.role IN ('superadmin', 'admin')
      OR profiles.email IN ('mohithroyal16450@gmail.com', 'baba.journilist@gmail.com')
    )
  )
);
