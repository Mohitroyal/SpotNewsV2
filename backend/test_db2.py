import psycopg2
try:
    conn = psycopg2.connect("postgresql://postgres.rffrqokpnqoycpozrjuc:9346843889v@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres")
    cur = conn.cursor()
    cur.execute("SELECT id FROM auth.users WHERE email = 'mohithroyal16450@gmail.com'")
    uid = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM clippings WHERE user_id = %s", (uid,))
    print('Admin clippings:', cur.fetchone()[0])
    
    # Check if there are 1200 clippings anywhere?
    cur.execute("SELECT COUNT(*) FROM profiles WHERE role = 'reporter'")
    print('Reporters:', cur.fetchone()[0])
    conn.close()
except Exception as e:
    print('Error:', e)
