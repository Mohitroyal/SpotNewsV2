import psycopg2
import sys

try:
    conn = psycopg2.connect("postgresql://postgres.rffrqokpnqoycpozrjuc:9346843889v@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres")
    cur = conn.cursor()
    with open('update_schema.sql', 'r') as f:
        sql = f.read()
    cur.execute(sql)
    conn.commit()
    print("Schema updated successfully!")
    conn.close()
except Exception as e:
    print('Error:', e)
    sys.exit(1)
