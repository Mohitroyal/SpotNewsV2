import psycopg2
try:
    conn = psycopg2.connect("postgresql://postgres.rffrqokpnqoycpozrjuc:9346843889v@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres")
    cur = conn.cursor()
    
    cur.execute("SELECT COUNT(*) FROM clippings")
    total = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM clippings WHERE DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')")
    today_gens = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(DISTINCT user_id) FROM clippings WHERE DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') = DATE(CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')")
    active_reporters = cur.fetchone()[0]
    
    print('Total:', total)
    print('Today Gens (IST):', today_gens)
    print('Active Reporters (IST):', active_reporters)
    conn.close()
except Exception as e:
    print('Error:', e)
