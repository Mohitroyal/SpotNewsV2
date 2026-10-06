CREATE TABLE IF NOT EXISTS public.profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text UNIQUE NOT NULL,
  full_name       text,
  role            text NOT NULL DEFAULT 'user'
                    CHECK (role IN ('admin', 'reporter', 'user')),
  plan            text NOT NULL DEFAULT 'free'
                    CHECK (plan IN ('free', 'pro', 'enterprise')),
  avatar_url      text,
  last_sign_in_at timestamptz,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users read own profile') THEN
    CREATE POLICY "Users read own profile" ON public.profiles
      FOR SELECT TO authenticated USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users update own profile') THEN
    CREATE POLICY "Users update own profile" ON public.profiles
      FOR UPDATE TO authenticated USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Admin read all profiles') THEN
    CREATE POLICY "Admin read all profiles" ON public.profiles
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, plan)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    CASE
      WHEN new.email = 'mohithroyal16450@gmail.com' THEN 'admin'
      ELSE 'user'
    END,
    'free'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

INSERT INTO public.profiles (id, email, full_name, role, plan)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', ''), 'admin', 'free'
FROM auth.users
WHERE email = 'mohithroyal16450@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

CREATE TABLE IF NOT EXISTS public.publication_logos (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name             text NOT NULL,
  logo_url         text NOT NULL,
  publication_code text UNIQUE NOT NULL,
  is_active        boolean DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.publication_logos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='publication_logos' AND policyname='Authenticated read logos') THEN
    CREATE POLICY "Authenticated read logos" ON public.publication_logos
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='publication_logos' AND policyname='Admin insert logos') THEN
    CREATE POLICY "Admin insert logos" ON public.publication_logos
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='publication_logos' AND policyname='Admin update logos') THEN
    CREATE POLICY "Admin update logos" ON public.publication_logos
      FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='publication_logos' AND policyname='Admin delete logos') THEN
    CREATE POLICY "Admin delete logos" ON public.publication_logos
      FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_activity (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  user_name  text,
  action     text NOT NULL CHECK (action IN ('login', 'generate', 'export')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_activity' AND policyname='Users insert own activity') THEN
    CREATE POLICY "Users insert own activity" ON public.user_activity
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_activity' AND policyname='Read all activity') THEN
    CREATE POLICY "Read all activity" ON public.user_activity
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
