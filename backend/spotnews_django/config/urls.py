from django.contrib import admin
from django.urls import path, include
from core.views import home_view, assetlinks_view

urlpatterns = [
    path('', home_view, name='home'),
    path('.well-known/assetlinks.json', assetlinks_view, name='assetlinks'),
    path('.well-known/assetlinks.json/', assetlinks_view),
    path('admin/', admin.site.urls),
    path('auth/', include('accounts.urls')),
    path('dashboard/', include('dashboard.urls')),
    path('api/auth/', include('otp.urls')),
    path('api/v1/auth/', include('otp.urls')),
    path('api/', include('core.urls')),
    path('', include('core.urls')),
]
