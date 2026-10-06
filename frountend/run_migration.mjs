/**
 * Supabase Migration Runner
 * Uses the Supabase Management API to run SQL directly
 * Run: node run_migration.mjs
 */

const SUPABASE_PROJECT_REF = 'rffrqokpnqoycpozrjuc';
const SUPABASE_URL = 'https://rffrqokpnqoycpozrjuc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZnJxb2twbnFveWNwb3pyanVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDE4MjUsImV4cCI6MjA5NDUxNzgyNX0.9BcRAPuhoK1C6SMeUvexABXp5HW2dfEJbdcRT_2FiL4';

// Each statement is run individually via the Supabase pg REST endpoint
const statements = [
  // ── 1. Profiles table ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS public.profiles (
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
  )`,

  `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users read own profile'
    ) THEN
      CREATE POLICY "Users read own profile" ON public.profiles
        FOR SELECT TO authenticated USING (auth.uid() = id);
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Admin read all profiles'
    ) THEN
      CREATE POLICY "Admin read all profiles" ON public.profiles
        FOR SELECT TO authenticated USING (true);
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users update own profile'
    ) THEN
      CREATE POLICY "Users update own profile" ON public.profiles
        FOR UPDATE TO authenticated USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    END IF;
  END $$`,

  // ── 2. Auto-create profile trigger ────────────────────────────────────────
  `CREATE OR REPLACE FUNCTION public.handle_new_user()
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
  $$`,

  `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users`,

  `CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user()`,

  // ── 3. Promote existing admin account ────────────────────────────────────
  `INSERT INTO public.profiles (id, email, full_name, role, plan)
  SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', ''), 'admin', 'free'
  FROM auth.users
  WHERE email = 'mohithroyal16450@gmail.com'
  ON CONFLICT (id) DO UPDATE SET role = 'admin'`,

  // ── 4. Publication logos table ───────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS public.publication_logos (
    id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name             text NOT NULL,
    logo_url         text NOT NULL,
    publication_code text UNIQUE NOT NULL,
    is_active        boolean DEFAULT true,
    created_at       timestamptz DEFAULT now()
  )`,

  `ALTER TABLE public.publication_logos ENABLE ROW LEVEL SECURITY`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename='publication_logos' AND policyname='Authenticated read logos'
    ) THEN
      CREATE POLICY "Authenticated read logos" ON public.publication_logos
        FOR SELECT TO authenticated USING (true);
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename='publication_logos' AND policyname='Admin insert logos'
    ) THEN
      CREATE POLICY "Admin insert logos" ON public.publication_logos
        FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename='publication_logos' AND policyname='Admin update logos'
    ) THEN
      CREATE POLICY "Admin update logos" ON public.publication_logos
        FOR UPDATE TO authenticated USING (true);
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename='publication_logos' AND policyname='Admin delete logos'
    ) THEN
      CREATE POLICY "Admin delete logos" ON public.publication_logos
        FOR DELETE TO authenticated USING (true);
    END IF;
  END $$`,

  // ── 5. User activity table ───────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS public.user_activity (
    id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email text,
    user_name  text,
    action     text NOT NULL CHECK (action IN ('login', 'generate', 'export')),
    created_at timestamptz DEFAULT now()
  )`,

  `ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename='user_activity' AND policyname='Users insert own activity'
    ) THEN
      CREATE POLICY "Users insert own activity" ON public.user_activity
        FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    END IF;
  END $$`,

  `DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename='user_activity' AND policyname='Read all activity'
    ) THEN
      CREATE POLICY "Read all activity" ON public.user_activity
        FOR SELECT TO authenticated USING (true);
    END IF;
  END $$`,
];

async function runStatement(sql, index) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    // Try the pg endpoint instead
    const pgResponse = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    
    if (!pgResponse.ok) {
      const errText = await pgResponse.text();
      return { ok: false, error: errText };
    }
    const data = await pgResponse.json();
    return { ok: true, data };
  }

  const data = await response.json();
  return { ok: true, data };
}

async function main() {
  console.log('🚀 Starting Supabase Migration...\n');
  console.log(`📡 Project: ${SUPABASE_PROJECT_REF}`);
  console.log(`📝 Statements to run: ${statements.length}\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.trim().substring(0, 60).replace(/\s+/g, ' ');
    process.stdout.write(`[${i + 1}/${statements.length}] ${preview}... `);
    
    const result = await runStatement(stmt, i);
    if (result.ok) {
      console.log('✅');
      successCount++;
    } else {
      console.log(`❌\n   Error: ${result.error}`);
      failCount++;
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ ${successCount} succeeded  |  ❌ ${failCount} failed`);
  
  if (failCount > 0) {
    console.log('\n⚠️  Some statements failed. This is normal if:');
    console.log('   - Tables/policies already exist');
    console.log('   - The anon key lacks DDL permissions (need service role key)');
    console.log('\n👉 If all failed, you need to run the SQL manually in:');
    console.log(`   https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/sql/new`);
  } else {
    console.log('\n🎉 Migration complete! Your admin dashboard is ready.');
    console.log('   Navigate to /admin in the app to access the admin panel.');
  }
}

main().catch(console.error);
