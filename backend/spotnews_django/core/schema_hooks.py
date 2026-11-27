import json
import os
import re
from pathlib import Path

def make_operation_id(method, path):
    clean = re.sub(r'[^a-zA-Z0-9_]', '_', path.strip('/'))
    # Deduplicate consecutive underscores
    clean = re.sub(r'_+', '_', clean)
    return f"{method.lower()}_{clean}"

def spotnews_schema_postprocessing_hook(result, generator, request=None, public=False):
    """
    drf-spectacular postprocessing hook to enrich the OpenAPI schema
    with complete specifications for all SpotNews backend endpoints across
    accounts, otp, dashboard, and core apps.
    """
    # 1. Define Security Schemes
    if "components" not in result:
        result["components"] = {}
    if "securitySchemes" not in result["components"]:
        result["components"]["securitySchemes"] = {}

    result["components"]["securitySchemes"]["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Provide user session or JWT token in header: Authorization: Bearer <token>"
    }
    result["components"]["securitySchemes"]["SessionAuth"] = {
        "type": "apiKey",
        "in": "cookie",
        "name": "sessionid",
        "description": "Standard Django session cookie authentication"
    }

    # 2. Add Tags
    tags = [
        {"name": "Authentication & OTP", "description": "Phone OTP login, verification, token session, and MSG91 webhooks"},
        {"name": "Accounts & Web Auth", "description": "Django web session authentication for admin and dashboard"},
        {"name": "Clippings & Generation", "description": "Fast-API style Individual Clipping generation, image upload, and status check"},
        {"name": "Social & Engagement", "description": "Clipping shares, comments, reporter follower tracking, stats, and Way2News rich previews"},
        {"name": "Daily Newspaper (EPaper)", "description": "Broadsheet RTI Express multi-page PDF generator, previews, and edition downloads"},
        {"name": "Reporter Payments & Verification", "description": "Razorpay order creation, payment verification, reporter approval SMS, and status"},
        {"name": "Admin Operations", "description": "Admin dashboard statistics, user management (role, plan, ban, delete), logos, and generation history"},
        {"name": "Push Notifications", "description": "FCM HTTP v1 broadcast, event processing, and device token management"},
        {"name": "Dashboard Web Views", "description": "HTML dashboard panels for clipping moderation and user management"},
        {"name": "Health & System", "description": "System health checks, MSG91 status, and Android App Links assetlinks.json"}
    ]
    if "tags" not in result or not result["tags"]:
        result["tags"] = tags
    else:
        existing_tags = {t["name"] for t in result["tags"]}
        for t in tags:
            if t["name"] not in existing_tags:
                result["tags"].append(t)

    # 3. Read or assemble the full paths specification
    schema_file = Path(__file__).resolve().parent.parent / "openapi.json"
    if schema_file.exists():
        try:
            with open(schema_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                custom_paths = data.get("paths", {})
                for path, path_item in custom_paths.items():
                    if path not in result["paths"]:
                        result["paths"][path] = path_item
                    else:
                        for method, op in path_item.items():
                            if method not in result["paths"][path]:
                                result["paths"][path][method] = op
        except Exception as e:
            print(f"[drf-spectacular hook] Error loading openapi.json: {e}")

    # Add accounts & dashboard endpoints explicitly if missing
    additional_paths = {
        "/auth/login/": {
            "get": {
                "tags": ["Accounts & Web Auth"],
                "summary": "Render Web Login Page",
                "responses": {"200": {"description": "HTML login page"}}
            },
            "post": {
                "tags": ["Accounts & Web Auth"],
                "summary": "Authenticate User via Username/Password",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/x-www-form-urlencoded": {
                            "schema": {
                                "type": "object",
                                "required": ["username", "password"],
                                "properties": {
                                    "username": {"type": "string"},
                                    "password": {"type": "string", "format": "password"}
                                }
                            }
                        }
                    }
                },
                "responses": {
                    "302": {"description": "Redirect on successful login"},
                    "200": {"description": "Re-rendered form on error"}
                }
            }
        },
        "/auth/logout/": {
            "get": {
                "tags": ["Accounts & Web Auth"],
                "summary": "Web Session Logout",
                "responses": {"302": {"description": "Redirect to login page"}}
            }
        },
        "/dashboard/": {
            "get": {
                "tags": ["Dashboard Web Views"],
                "summary": "Admin Dashboard Main Panel",
                "security": [{"SessionAuth": []}],
                "responses": {"200": {"description": "HTML dashboard view"}}
            }
        },
        "/dashboard/clippings/": {
            "get": {
                "tags": ["Dashboard Web Views"],
                "summary": "Clipping Moderation Table",
                "security": [{"SessionAuth": []}],
                "responses": {"200": {"description": "HTML clippings table view"}}
            }
        },
        "/dashboard/users/": {
            "get": {
                "tags": ["Dashboard Web Views"],
                "summary": "User Management Table",
                "security": [{"SessionAuth": []}],
                "responses": {"200": {"description": "HTML user management table view"}}
            }
        }
    }

    for path, path_item in additional_paths.items():
        if path not in result["paths"]:
            result["paths"][path] = path_item

    # 4. Ensure EVERY operation has an operationId (required by drf-spectacular plumbing)
    for path, path_item in result["paths"].items():
        if isinstance(path_item, dict):
            for method, operation in path_item.items():
                if method.lower() in ["get", "post", "put", "patch", "delete", "options", "head", "trace"]:
                    if isinstance(operation, dict) and "operationId" not in operation:
                        operation["operationId"] = make_operation_id(method, path)

    return result
