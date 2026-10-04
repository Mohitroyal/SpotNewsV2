import requests
import json
try:
    # Just try a GET request without JWT. It should return 401 Unauthorized if it's there,
    # or 404 if the route is wrong, or 500 if the server is crashing.
    res = requests.get('https://spotnewsv2.onrender.com/api/v1/admin/stats')
    print('Status:', res.status_code)
    try:
        print('JSON:', res.json())
    except:
        print('Text:', res.text)
except Exception as e:
    print('Error:', e)
