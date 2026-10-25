from django.urls import path
from .views import (
    health_check, health_msg91, admin_stats, admin_auth_users,
    send_notification_view, device_tokens_stats_view, story_share_view,
    send_approval_sms_view
)
from .admin_extras import admin_generations, admin_user_role, admin_user_plan, admin_user_ban, admin_user_delete, admin_logos

from .daily_newspaper_views import (
    get_eligible_clippings,
    preview_daily_newspaper,
    generate_daily_newspaper,
    list_daily_editions,
    serve_edition_pdf
)

from .clipping_views import create_clipping, list_clippings, upload_image
from .reporter_payment_views import (
    get_payment_config,
    create_payment_order,
    verify_payment,
    check_payment_status,
    razorpay_webhook
)

urlpatterns = [
    # Rich Link Preview & Deep Link Share endpoint (Way2News style)
    path('n/<str:clip_id>', story_share_view, name='story_share'),
    path('n/<str:clip_id>/', story_share_view),
    path('story/<str:clip_id>', story_share_view, name='story_share_alt'),
    path('story/<str:clip_id>/', story_share_view),

    path('health', health_check, name='health_check'),
    path('health/msg91', health_msg91, name='health_msg91'),
    path('v1/admin/stats', admin_stats, name='admin_stats'),
    path('v1/admin/auth-users', admin_auth_users, name='admin_auth_users'),
    path('v1/admin/logos', admin_logos, name='admin_logos'),
    path('v1/admin/logos/', admin_logos),
    path('v1/admin/logos/active', admin_logos, name='admin_logos_active'),
    path('v1/admin/logos/active/', admin_logos),
    path('v1/admin/generations', admin_generations, name='admin_generations'),
    path('v1/admin/users/<uuid:user_id>/role', admin_user_role, name='admin_user_role'),
    path('v1/admin/users/<uuid:user_id>/plan', admin_user_plan, name='admin_user_plan'),
    path('v1/admin/users/<uuid:user_id>/ban', admin_user_ban, name='admin_user_ban'),
    path('v1/admin/users/<uuid:user_id>', admin_user_delete, name='admin_user_delete'),
    
    # Reporter Approval & Payment Endpoints
    path('v1/reporter/payment/config', get_payment_config, name='get_payment_config'),
    path('v1/reporter/payment/config/', get_payment_config),
    path('v1/reporter/payment/create-order', create_payment_order, name='create_payment_order'),
    path('v1/reporter/payment/create-order/', create_payment_order),
    path('v1/reporter/payment/verify', verify_payment, name='verify_payment'),
    path('v1/reporter/payment/verify/', verify_payment),
    path('v1/reporter/payment/status', check_payment_status, name='check_payment_status'),
    path('v1/reporter/payment/status/', check_payment_status),
    path('v1/reporter/payment/webhook', razorpay_webhook, name='razorpay_webhook'),
    path('v1/reporter/payment/webhook/', razorpay_webhook),
    path('v1/reporter/send-approval-sms', send_approval_sms_view, name='send_approval_sms'),
    path('v1/reporter/send-approval-sms/', send_approval_sms_view),

    # Daily Newspaper PDF Generator Endpoints
    path('v1/admin/daily-newspaper/clippings', get_eligible_clippings, name='daily_newspaper_clippings'),
    path('v1/admin/daily-newspaper/clippings/', get_eligible_clippings),
    path('v1/admin/daily-newspaper/preview', preview_daily_newspaper, name='daily_newspaper_preview'),
    path('v1/admin/daily-newspaper/preview/', preview_daily_newspaper),
    path('v1/admin/daily-newspaper/generate', generate_daily_newspaper, name='daily_newspaper_generate'),
    path('v1/admin/daily-newspaper/generate/', generate_daily_newspaper),
    path('v1/admin/daily-newspaper/editions', list_daily_editions, name='daily_newspaper_editions'),
    path('v1/admin/daily-newspaper/editions/', list_daily_editions),

    # Dedicated media server endpoint for the generated PDF
    path('editions/<str:filename>', serve_edition_pdf, name='serve_edition_pdf'),
    
    # Fast-API style Individual Clipping Generation Endpoints
    path('v1/generate', create_clipping, name='create_clipping'),
    path('v1/generate/', list_clippings, name='list_clippings'),
    path('v1/uploads/image', upload_image, name='upload_image'),

    # Push Notification Endpoints (FCM HTTP v1)
    path('v1/notifications/send', send_notification_view, name='send_notification'),
    path('v1/notifications/send/', send_notification_view),
    path('v1/notifications/tokens', device_tokens_stats_view, name='device_tokens_stats'),
    path('v1/notifications/tokens/', device_tokens_stats_view),
]

