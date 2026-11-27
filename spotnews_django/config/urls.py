from django.contrib import admin
from django.urls import path, include
from core.views import home_view, assetlinks_view
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

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

    # OpenAPI 3.0, Swagger UI & ReDoc (via drf-spectacular)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Convenience aliases
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui-docs'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema')),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema')),
]
