import os
import sys
import django
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Setup Django environment
sys.path.insert(0, r"C:\Users\MOHIT\Desktop\Spotnewsv2\Spotnewsv2\spotnews_django")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.test import RequestFactory
from core.reporter_payment_views import (
    get_payment_config,
    create_payment_order,
    verify_payment,
    check_payment_status,
    razorpay_webhook,
    get_db_cursor
)

factory = RequestFactory()

print("=== 1. TEST PAYMENT CONFIG ENDPOINT ===")
req = factory.get("/api/v1/reporter/payment/config")
resp = get_payment_config(req)
print("Config response status:", resp.status_code)
print("Config response:", resp.content.decode("utf-8"))
assert resp.status_code == 200

print("\n=== 2. SEED TEST APPLICATION IN APPROVED STATUS ===")
conn, cur = get_db_cursor()
test_app_id = "a1111111-2222-3333-4444-555555555555"
test_email = "dineshpanda545@gmail.com"

# Clean up any existing test row
cur.execute("DELETE FROM public.reporter_applications WHERE id = %s", (test_app_id,))
cur.execute("DELETE FROM public.payments WHERE application_id = %s", (test_app_id,))

# Insert application with status = 'approved' (payment pending)
cur.execute("""
    INSERT INTO public.reporter_applications (
        id, name, email, phone, aadhar_card, press_id, state, district, status, payment_status, created_at, updated_at
    ) VALUES (
        %s, 'Dinesh Panda', %s, '9876543210', '1234-5678-9012', 'PRESS-TEST-001', 'Telangana', 'Hyderabad',
        'approved', 'unpaid', NOW(), NOW()
    )
""", (test_app_id, test_email))

# Reset profile role to 'user'
cur.execute("UPDATE public.profiles SET role = 'user', plan = 'free' WHERE email = %s", (test_email,))

conn.commit()
print("Seeded test candidate with status='approved', profiles.role='user'")

print("\n=== 3. TEST CREATE PAYMENT ORDER ===")
create_body = json.dumps({"ref_no": test_app_id, "email": test_email}).encode("utf-8")
req = factory.post("/api/v1/reporter/payment/create-order", data=create_body, content_type="application/json")
resp = create_payment_order(req)
print("Create order response status:", resp.status_code)
order_data = json.loads(resp.content.decode("utf-8"))
print("Create order data:", order_data)
assert resp.status_code == 200
assert order_data.get("success") is True
order_id = order_data["order_id"]
amount = order_data["amount"]
print("Created Order ID:", order_id, "Amount (paise):", amount)

print("\n=== 4. TEST CHECK PAYMENT STATUS (PENDING) ===")
req = factory.get(f"/api/v1/reporter/payment/status?ref_no={test_app_id}")
resp = check_payment_status(req)
status_data = json.loads(resp.content.decode("utf-8"))
print("Status data:", status_data)
assert status_data.get("payment_status") == "pending"

print("\n=== 5. TEST VERIFY PAYMENT (ACTIVATION & UNIQUE ID CARD) ===")
test_payment_id = "pay_test_v2_987654"
verify_body = json.dumps({
    "razorpay_order_id": order_id,
    "razorpay_payment_id": test_payment_id,
    "razorpay_signature": "sig_test_valid",
    "application_id": test_app_id
}).encode("utf-8")
req = factory.post("/api/v1/reporter/payment/verify", data=verify_body, content_type="application/json")
resp = verify_payment(req)
print("Verify payment status code:", resp.status_code)
verify_data = json.loads(resp.content.decode("utf-8"))
print("Verify response data:", verify_data)
assert resp.status_code == 200
assert verify_data.get("success") is True
assert verify_data.get("status") == "active"
reporter_id = verify_data["reporter_id"]
print("Generated Unique Reporter ID:", reporter_id)

print("\n=== 6. VERIFY DATABASE STATE AFTER ACTIVATION ===")
cur.execute("SELECT status, payment_status, reporter_id, valid_until FROM public.reporter_applications WHERE id = %s", (test_app_id,))
app_state = cur.fetchone()
print("Application in DB:", app_state)
assert app_state[0] == "active"
assert app_state[1] == "paid"
assert app_state[2] == reporter_id

cur.execute("SELECT role, plan FROM public.profiles WHERE email = %s", (test_email,))
profile_state = cur.fetchone()
print("Profile role in DB:", profile_state)
assert profile_state[0] == "reporter"
assert profile_state[1] in ("pro", "reporter")

print("\n=== 7. TEST IDEMPOTENCY (DUPLICATE VERIFY CALL) ===")
req = factory.post("/api/v1/reporter/payment/verify", data=verify_body, content_type="application/json")
resp = verify_payment(req)
dup_verify_data = json.loads(resp.content.decode("utf-8"))
print("Duplicate verify response:", dup_verify_data)
assert dup_verify_data.get("reporter_id") == reporter_id
print("Idempotency passed: no duplicate card or error created!")

print("\n=== 8. TEST ATTEMPTING CREATE ORDER ON ALREADY ACTIVE REPORTER ===")
req = factory.post("/api/v1/reporter/payment/create-order", data=create_body, content_type="application/json")
resp = create_payment_order(req)
already_active_data = json.loads(resp.content.decode("utf-8"))
print("Already active response:", already_active_data)
assert already_active_data.get("already_active") is True

# Clean up test rows
cur.execute("DELETE FROM public.reporter_applications WHERE id = %s", (test_app_id,))
cur.execute("DELETE FROM public.payments WHERE application_id = %s", (test_app_id,))
cur.execute("UPDATE public.profiles SET role = 'user', plan = 'free' WHERE email = %s", (test_email,))
conn.commit()
conn.close()

print("\nALL BACKEND PAYMENT FLOW TESTS PASSED SUCCESSFULLY!")
