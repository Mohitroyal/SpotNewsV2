from django.contrib import admin
from django.urls import path, include
from core.views import home_view
from core.clipping_views import create_clipping, upload_image

urlpatterns = [
    path('', home_view, name='home'),
    path('admin/', admin.site.urls),
    path('auth/', include('accounts.urls')),
    path('dashboard/', include('dashboard.urls')),
    path('api/auth/', include('otp.urls')),
    path('api/', include('core.urls')),
    
    # Backward compatibility for existing mobile APKs
    path('v1/generate', create_clipping),
    path('v1/uploads/image', upload_image),
    path('uploads/image', upload_image),
]
