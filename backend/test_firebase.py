import os
import firebase_admin
from firebase_admin import credentials, messaging

cred_path = "C:/Users/MOHIT/Desktop/Spotnewsv2/Spotnewsv2/backend/spotnews_django/firebase_service_account.json"
cred = credentials.Certificate(cred_path)
app = firebase_admin.initialize_app(cred)
print("Firebase app initialized successfully:", app.name)
