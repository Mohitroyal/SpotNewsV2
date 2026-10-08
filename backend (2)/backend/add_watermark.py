"""
Adds the up-logo.jpeg as a top-right watermark on the hero image in both templates.
Only touches the image-overlay div to insert one new watermark div.
"""
import re

B64_FILE = r'C:\Users\MOHIT\Desktop\newscraft-mobile\backend\app\renderer\templates\hero-image\up_logo_b64.txt'
with open(B64_FILE, 'r', encoding='ascii') as f:
    logo_data = f.read().strip()

# The watermark HTML to insert — positioned top-right inside image-overlay
WATERMARK_HTML = f'''
                <!-- Top Right: RTI Spot News Watermark Logo -->
                <div style="position:absolute; top:10px; right:10px; z-index:10; width:80px; height:80px; border-radius:50%; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.45);">
                    <img src="{logo_data}" alt="RTI Spot News" style="width:100%; height:100%; object-fit:cover; display:block;" />
                </div>'''

# The line after which we insert — the image-overlay opening div
INSERT_AFTER = '<div class="image-overlay">'

TEMPLATES = [
    r'C:\Users\MOHIT\Desktop\newscraft-mobile\backend\app\renderer\templates\hero-image\template.html',
    r'C:\Users\MOHIT\Desktop\newscraft-mobile\backend\app\renderer\templates\pattern_b\template.html',
]

for path in TEMPLATES:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'RTI Spot News Watermark Logo' in content:
        print(f"Already patched: {path}")
        continue

    if INSERT_AFTER not in content:
        print(f"WARN: target div not found in {path}")
        continue

    # Insert watermark right after the image-overlay opening tag
    patched = content.replace(INSERT_AFTER, INSERT_AFTER + WATERMARK_HTML, 1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(patched)

    print(f"Patched: {path}")

print("Done.")
