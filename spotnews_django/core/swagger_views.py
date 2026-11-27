import json
from pathlib import Path
from django.http import HttpResponse, JsonResponse
from django.conf import settings
from django.views.decorators.clickjacking import xframe_options_exempt

@xframe_options_exempt
def swagger_ui_page(request):
    template_path = settings.BASE_DIR / 'templates' / 'swagger_ui.html'
    if template_path.exists():
        with open(template_path, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='text/html')
    return HttpResponse("<h1>Swagger UI Template Not Found</h1>", status=404)

@xframe_options_exempt
def redoc_ui_page(request):
    template_path = settings.BASE_DIR / 'templates' / 'redoc.html'
    if template_path.exists():
        with open(template_path, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='text/html')
    return HttpResponse("<h1>Redoc Template Not Found</h1>", status=404)

def openapi_schema_endpoint(request):
    schema_path = settings.BASE_DIR / 'openapi.json'
    if schema_path.exists():
        with open(schema_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return JsonResponse(data, safe=False)
    return JsonResponse({"error": "OpenAPI schema not found"}, status=404)
