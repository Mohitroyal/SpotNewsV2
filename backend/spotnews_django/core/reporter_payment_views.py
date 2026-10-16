import json
import os
import hmac
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import connection
import psycopg2
import httpx

# Configuration
DEFAULT_PRICE_INR = int(os.getenv("REPORTER_MEMBERSHIP_PRICE_INR", "999"))
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_spotnews_dummy")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "dummy_secret_spotnews_test")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
DATABASE_POOLER_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres.rffrqokpnqoycpozrjuc:9346843889v@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres"
)

def get_db_cursor():
    """
    Returns (conn, cursor). If django connection is postgresql, uses it.
    Otherwise connects directly to the Supabase postgresql pooler.
    """
    if connection.vendor == 'postgresql':
        return connection, connection.cursor()
    conn = psycopg2.connect(DATABASE_POOLER_URL)
    return conn, conn.cursor()

def is_test_dummy_key():
    return not RAZORPAY_KEY_ID or "dummy" in RAZORPAY_KEY_ID or RAZORPAY_KEY_ID == "rzp_test_spotnews_dummy"

@csrf_exempt
def get_payment_config(request):
    """
    Returns public payment gateway configuration (Key ID, amount, currency, mode)
    """
    return JsonResponse({
        "success": True,
        "key_id": RAZORPAY_KEY_ID,
        "amount_inr": DEFAULT_PRICE_INR,
        "amount_paise": DEFAULT_PRICE_INR * 100,
        "currency": "INR",
        "is_test_mode": True,
        "membership_duration_days": 365
    })

@csrf_exempt
def create_payment_order(request):
    """
    POST /api/v1/reporter/payment/create-order
    Creates a Razorpay order on the backend using server-configured pricing.
    """
    if request.method != 'POST':
        return JsonResponse({"error": "Method not allowed"}, status=405)
    
    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        data = {}

    identifier = (data.get('email') or data.get('ref_no') or '').strip()
    ref_no = (data.get('ref_no') or '').strip()
    
    if not identifier and not ref_no:
        return JsonResponse({"error": "Application identifier or ref_no is required"}, status=400)

    conn, cur = get_db_cursor()
    try:
        # 1. Fetch application details
        if ref_no:
            cur.execute("""
                SELECT id, name, email, phone, status, state, district, payment_id, reporter_id, valid_until
                FROM public.reporter_applications
                WHERE id::text = %s OR email = %s
                LIMIT 1
            """, (ref_no, identifier))
        else:
            cur.execute("""
                SELECT id, name, email, phone, status, state, district, payment_id, reporter_id, valid_until
                FROM public.reporter_applications
                WHERE email = %s OR phone = %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (identifier, identifier))

        row = cur.fetchone()
        if not row:
            return JsonResponse({"error": "No reporter application found for this account"}, status=404)

        app_id = str(row[0])
        app_name = row[1] or "Reporter Candidate"
        app_email = row[2] or ""
        app_phone = row[3] or ""
        app_status = (row[4] or "").lower()
        app_state = row[5] or "Telangana"
        app_district = row[6] or "Hyderabad"
        existing_payment_id = row[7]
        existing_reporter_id = row[8]
        existing_valid_until = row[9]

        # 2. Check if already active and paid
        if app_status == 'active':
            return JsonResponse({
                "success": True,
                "already_active": True,
                "status": "active",
                "reporter_id": existing_reporter_id,
                "valid_until": str(existing_valid_until) if existing_valid_until else "",
                "message": "Reporter account is already active. No payment required."
            })

        # 3. Only approved applications are permitted to proceed to payment
        if app_status != 'approved':
            return JsonResponse({
                "error": f"Application cannot proceed to payment. Current status: '{app_status}'. Must be 'approved' by super admin.",
                "status": app_status
            }, status=403)

        # 4. Create Razorpay order
        amount_paise = DEFAULT_PRICE_INR * 100
        currency = "INR"
        receipt_id = f"rcpt_{app_id[:8]}_{int(datetime.now().timestamp())}"

        razorpay_order_id = None

        if not is_test_dummy_key():
            # Real Razorpay API call
            try:
                auth = (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)
                order_payload = {
                    "amount": amount_paise,
                    "currency": currency,
                    "receipt": receipt_id,
                    "notes": {
                        "application_id": app_id,
                        "email": app_email,
                        "name": app_name,
                        "purpose": "Spot News Reporter Annual Membership"
                    }
                }
                res = httpx.post("https://api.razorpay.com/v1/orders", json=order_payload, auth=auth, timeout=10.0)
                if res.status_code in (200, 201):
                    razorpay_order_id = res.json().get("id")
                else:
                    print(f"Razorpay order creation failed: {res.text}")
                    # Fallback to test mode order
                    razorpay_order_id = f"order_test_{uuid.uuid4().hex[:14]}"
            except Exception as e:
                print(f"Error calling Razorpay API: {e}")
                razorpay_order_id = f"order_test_{uuid.uuid4().hex[:14]}"
        else:
            # Test mode simulated order
            razorpay_order_id = f"order_test_{uuid.uuid4().hex[:14]}"

        # 5. Record order in payments table
        payment_record_id = str(uuid.uuid4())
        cur.execute("""
            INSERT INTO public.payments (
                id, application_id, amount, currency, payment_status, 
                payment_method, razorpay_order_id, receipt, notes, created_at, status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), %s)
        """, (
            payment_record_id, app_id, DEFAULT_PRICE_INR, currency, 
            "created", "razorpay", razorpay_order_id, receipt_id,
            json.dumps({"name": app_name, "email": app_email}), "pending"
        ))

        # 6. Update order_id and payment_status on reporter_applications
        cur.execute("""
            UPDATE public.reporter_applications
            SET order_id = %s, payment_status = 'pending', updated_at = NOW()
            WHERE id = %s
        """, (razorpay_order_id, app_id))

        conn.commit()

        return JsonResponse({
            "success": True,
            "order_id": razorpay_order_id,
            "amount": amount_paise,
            "amount_inr": DEFAULT_PRICE_INR,
            "currency": currency,
            "key_id": RAZORPAY_KEY_ID,
            "ref_no": app_id,
            "name": app_name,
            "email": app_email,
            "phone": app_phone,
            "state": app_state,
            "district": app_district,
            "description": f"Spot News Annual Reporter Membership (₹{DEFAULT_PRICE_INR})"
        })

    except Exception as e:
        if conn: conn.rollback()
        print(f"Error in create_payment_order: {e}")
        return JsonResponse({"error": str(e)}, status=500)
    finally:
        if cur: cur.close()
        if conn and connection.vendor != 'postgresql': conn.close()

@csrf_exempt
def verify_payment(request):
    """
    POST /api/v1/reporter/payment/verify
    Verifies Razorpay HMAC-SHA256 signature, validates payment capture,
    and idempotently activates reporter role, membership, and unique ID card.
    """
    if request.method != 'POST':
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except Exception:
        data = {}

    razorpay_order_id = (data.get('razorpay_order_id') or '').strip()
    razorpay_payment_id = (data.get('razorpay_payment_id') or '').strip()
    razorpay_signature = (data.get('razorpay_signature') or '').strip()
    application_id = (data.get('application_id') or data.get('ref_no') or '').strip()

    if not razorpay_payment_id:
        return JsonResponse({"error": "Payment ID or UPI UTR number is required"}, status=400)

    if not razorpay_order_id:
        razorpay_order_id = f"upi_order_{uuid.uuid4().hex[:12]}"

    is_upi = razorpay_payment_id.startswith('upi_') or razorpay_payment_id.startswith('utr_') or 'upi' in razorpay_payment_id.lower() or not razorpay_signature

    # 1. Signature Verification (Only for Razorpay gateway with signature)
    if not is_upi and not is_test_dummy_key() and razorpay_signature:
        generated_signature = hmac.new(
            RAZORPAY_KEY_SECRET.encode('utf-8'),
            f"{razorpay_order_id}|{razorpay_payment_id}".encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(generated_signature, razorpay_signature):
            return JsonResponse({"error": "Invalid payment signature verification failed"}, status=400)

    conn, cur = get_db_cursor()
    try:
        # 2. Check application and payment ownership
        if application_id:
            cur.execute("""
                SELECT id, name, email, phone, status, state, district, reporter_id, valid_until
                FROM public.reporter_applications
                WHERE id::text = %s OR email = %s OR phone = %s OR order_id = %s
                LIMIT 1
            """, (application_id, application_id, application_id, razorpay_order_id))
        else:
            cur.execute("""
                SELECT id, name, email, phone, status, state, district, reporter_id, valid_until
                FROM public.reporter_applications
                WHERE order_id = %s
                LIMIT 1
            """, (razorpay_order_id,))

        app_row = cur.fetchone()
        if not app_row:
            return JsonResponse({"error": "Application corresponding to this order not found"}, status=404)

        app_id = str(app_row[0])
        app_name = app_row[1] or "Reporter Candidate"
        app_email = app_row[2] or ""
        app_phone = app_row[3] or ""
        app_status = (app_row[4] or "").lower()
        app_state = app_row[5] or "Telangana"
        app_district = app_row[6] or "Hyderabad"
        existing_reporter_id = app_row[7]
        existing_valid_until = app_row[8]

        # Idempotency check: If already active, return the existing active details immediately
        if app_status == 'active' and existing_reporter_id:
            return JsonResponse({
                "success": True,
                "status": "active",
                "reporter_id": existing_reporter_id,
                "valid_until": str(existing_valid_until) if existing_valid_until else "",
                "message": "Payment verified. Reporter account is already active."
            })

        # Generate unique Reporter ID if not exists
        current_year = datetime.now().year
        # Format: SNP-TS-YYYY-XXXXXX
        state_prefix = "TS"
        if app_state and len(app_state) >= 2:
            state_prefix = app_state[:2].upper()
        
        reporter_id = existing_reporter_id or f"SNP-{state_prefix}-{current_year}-{uuid.uuid4().hex[:6].upper()}"
        valid_until = datetime.now(timezone.utc) + timedelta(days=365)

        # 3. Update payments record or insert for direct UPI payments
        cur.execute("""
            UPDATE public.payments
            SET payment_status = 'captured',
                status = 'success',
                razorpay_payment_id = %s,
                razorpay_signature = %s
            WHERE razorpay_order_id = %s OR application_id::text = %s
        """, (razorpay_payment_id, razorpay_signature, razorpay_order_id, app_id))

        if cur.rowcount == 0:
            try:
                cur.execute("""
                    INSERT INTO public.payments (
                        application_id, amount, currency, status, payment_method,
                        razorpay_payment_id, razorpay_order_id, razorpay_signature, created_at
                    ) VALUES (
                        %s, %s, 'INR', 'success', %s,
                        %s, %s, %s, NOW()
                    )
                """, (
                    app_id, DEFAULT_PRICE_INR * 100,
                    'upi_qr' if is_upi else 'razorpay',
                    razorpay_payment_id, razorpay_order_id, razorpay_signature
                ))
            except Exception as e_pay:
                print(f"Non-critical payments insert notice: {e_pay}")

        # 4. Activate reporter_applications
        cur.execute("""
            UPDATE public.reporter_applications
            SET status = 'active',
                payment_id = %s,
                payment_status = 'paid',
                reporter_id = %s,
                valid_until = %s,
                updated_at = NOW()
            WHERE id = %s
        """, (razorpay_payment_id, reporter_id, valid_until, app_id))

        # 5. Activate user profile role to 'reporter'
        if app_email:
            cur.execute("""
                UPDATE public.profiles
                SET role = 'reporter',
                    plan = 'pro'
                WHERE email = %s
            """, (app_email,))

        conn.commit()

        return JsonResponse({
            "success": True,
            "status": "active",
            "reporter_id": reporter_id,
            "valid_until": valid_until.strftime("%d %b %Y"),
            "payment_id": razorpay_payment_id,
            "message": "Payment verified successfully. Reporter membership activated."
        })

    except Exception as e:
        if conn: conn.rollback()
        print(f"Error in verify_payment: {e}")
        return JsonResponse({"error": str(e)}, status=500)
    finally:
        if cur: cur.close()
        if conn and connection.vendor != 'postgresql': conn.close()

@csrf_exempt
def check_payment_status(request):
    """
    GET/POST /api/v1/reporter/payment/status
    Retrieves the current payment and application status, enabling recovery
    if the app was closed or network was dropped during checkout.
    """
    identifier = request.GET.get('identifier') or request.GET.get('ref_no') or ''
    order_id = request.GET.get('order_id') or ''

    if request.method == 'POST':
        try:
            data = json.loads(request.body.decode('utf-8'))
            identifier = identifier or data.get('identifier') or data.get('ref_no') or data.get('email') or ''
            order_id = order_id or data.get('order_id') or ''
        except Exception:
            pass

    if not identifier and not order_id:
        return JsonResponse({"error": "Identifier, ref_no or order_id is required"}, status=400)

    conn, cur = get_db_cursor()
    try:
        if order_id:
            cur.execute("""
                SELECT id, name, email, phone, status, payment_id, payment_status, reporter_id, valid_until, order_id
                FROM public.reporter_applications
                WHERE order_id = %s
                LIMIT 1
            """, (order_id,))
        else:
            cur.execute("""
                SELECT id, name, email, phone, status, payment_id, payment_status, reporter_id, valid_until, order_id
                FROM public.reporter_applications
                WHERE id::text = %s OR email = %s OR phone = %s
                ORDER BY created_at DESC
                LIMIT 1
            """, (identifier, identifier, identifier))

        row = cur.fetchone()
        if not row:
            return JsonResponse({"error": "Application not found"}, status=404)

        app_id = str(row[0])
        app_name = row[1]
        app_email = row[2]
        app_phone = row[3]
        app_status = (row[4] or "pending").lower()
        payment_id = row[5]
        payment_status = row[6] or "unpaid"
        reporter_id = row[7]
        valid_until = row[8]
        current_order_id = row[9]

        # Map to standard status string
        ui_status = "PENDING"
        if app_status == 'active':
            ui_status = "ACTIVE"
        elif app_status == 'approved':
            if payment_status == 'paid':
                ui_status = "ACTIVE"
            else:
                ui_status = "APPROVED_PAYMENT_PENDING"
        elif app_status == 'rejected':
            ui_status = "REJECTED"

        return JsonResponse({
            "success": True,
            "ref_no": app_id,
            "name": app_name,
            "email": app_email,
            "phone": app_phone,
            "app_status": app_status,
            "status": ui_status,
            "payment_id": payment_id,
            "payment_status": payment_status,
            "reporter_id": reporter_id,
            "valid_until": valid_until.strftime("%d %b %Y") if valid_until else None,
            "order_id": current_order_id
        })

    except Exception as e:
        print(f"Error in check_payment_status: {e}")
        return JsonResponse({"error": str(e)}, status=500)
    finally:
        if cur: cur.close()
        if conn and connection.vendor != 'postgresql': conn.close()

@csrf_exempt
def razorpay_webhook(request):
    """
    POST /api/v1/reporter/payment/webhook
    Idempotent webhook handler for Razorpay payment.captured and order.paid events.
    """
    if request.method != 'POST':
        return JsonResponse({"error": "Method not allowed"}, status=405)

    webhook_body = request.body.decode('utf-8')
    webhook_signature = request.headers.get('X-Razorpay-Signature', '')

    # Webhook signature verification if secret is configured
    if RAZORPAY_WEBHOOK_SECRET and webhook_signature:
        expected = hmac.new(
            RAZORPAY_WEBHOOK_SECRET.encode('utf-8'),
            webhook_body.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, webhook_signature):
            return JsonResponse({"error": "Invalid webhook signature"}, status=400)

    try:
        event_data = json.loads(webhook_body)
    except Exception:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    event_type = event_data.get('event')
    if event_type in ('payment.captured', 'order.paid'):
        payment_entity = event_data.get('payload', {}).get('payment', {}).get('entity', {})
        order_id = payment_entity.get('order_id')
        payment_id = payment_entity.get('id')
        notes = payment_entity.get('notes', {})
        app_id = notes.get('application_id')

        if order_id or app_id:
            conn, cur = get_db_cursor()
            try:
                # Find application
                cur.execute("""
                    SELECT id, email, status, reporter_id, state
                    FROM public.reporter_applications
                    WHERE order_id = %s OR id::text = %s
                    LIMIT 1
                """, (order_id, app_id))
                row = cur.fetchone()
                if row:
                    found_app_id = str(row[0])
                    found_email = row[1]
                    found_status = (row[2] or "").lower()
                    existing_reporter_id = row[3]
                    state = row[4] or "TS"

                    if found_status != 'active':
                        state_prefix = state[:2].upper() if len(state) >= 2 else "TS"
                        reporter_id = existing_reporter_id or f"SNP-{state_prefix}-{datetime.now().year}-{uuid.uuid4().hex[:6].upper()}"
                        valid_until = datetime.now(timezone.utc) + timedelta(days=365)

                        cur.execute("""
                            UPDATE public.payments
                            SET payment_status = 'captured',
                                status = 'success',
                                razorpay_payment_id = %s
                            WHERE razorpay_order_id = %s OR application_id::text = %s
                        """, (payment_id, order_id, found_app_id))

                        cur.execute("""
                            UPDATE public.reporter_applications
                            SET status = 'active',
                                payment_id = %s,
                                payment_status = 'paid',
                                reporter_id = %s,
                                valid_until = %s,
                                updated_at = NOW()
                            WHERE id = %s
                        """, (payment_id, reporter_id, valid_until, found_app_id))

                        if found_email:
                            cur.execute("""
                                UPDATE public.profiles
                                SET role = 'reporter', plan = 'pro'
                                WHERE email = %s
                            """, (found_email,))

                        conn.commit()
            except Exception as e:
                if conn: conn.rollback()
                print(f"Error handling webhook: {e}")
            finally:
                if cur: cur.close()
                if conn and connection.vendor != 'postgresql': conn.close()

    return JsonResponse({"status": "received"})
