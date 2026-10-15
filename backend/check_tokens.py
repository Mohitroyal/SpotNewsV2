import psycopg2

try:
    conn = psycopg2.connect("postgresql://postgres.rffrqokpnqoycpozrjuc:9346843889v@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres")
    cur = conn.cursor()
    cur.execute("SELECT to_regclass('public.device_tokens');")
    res = cur.fetchone()[0]
    print("device_tokens table status:", res)
    
    if not res:
        print("Creating device_tokens table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS public.device_tokens (
                token TEXT PRIMARY KEY,
                user_id UUID,
                district_id INT,
                platform TEXT DEFAULT 'android',
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies WHERE tablename = 'device_tokens' AND policyname = 'Allow all for device_tokens'
                ) THEN
                    CREATE POLICY "Allow all for device_tokens" ON public.device_tokens
                    FOR ALL USING (true) WITH CHECK (true);
                END IF;
            END
            $$;
        """)
        conn.commit()
        print("device_tokens table created successfully!")
    else:
        cur.execute("SELECT COUNT(*) FROM public.device_tokens;")
        cnt = cur.fetchone()[0]
        print("Existing device tokens count:", cnt)
    conn.close()
except Exception as e:
    print("Database error:", e)
