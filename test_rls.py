import psycopg2
try:
    conn = psycopg2.connect("postgresql://postgres.rffrqokpnqoycpozrjuc:9346843889v@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres")
    cur = conn.cursor()
    cur.execute("SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('profiles', 'clippings', 'users');")
    for row in cur.fetchall():
        print(row)
    conn.close()
except Exception as e:
    print('Error:', e)
