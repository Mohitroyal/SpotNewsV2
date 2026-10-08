"""
Fix watermark position: move from inside image-overlay (bottom strip)
to directly inside hero-image-wrapper so top:10px; right:10px is truly top-right of the photo.
"""

B64_FILE = r'C:\Users\MOHIT\Desktop\newscraft-mobile\backend\app\renderer\templates\hero-image\up_logo_b64.txt'
with open(B64_FILE, 'r', encoding='ascii') as f:
    logo_data = f.read().strip()

WATERMARK_HTML = (
    '\n                <!-- Top Right: RTI Spot News Watermark Logo -->\n'
    '                <div style="position:absolute; top:10px; right:10px; z-index:10;'
    ' width:80px; height:80px; border-radius:50%; overflow:hidden;'
    ' box-shadow:0 2px 8px rgba(0,0,0,0.45);">\n'
    '                    <img src="' + logo_data + '" alt="RTI Spot News"'
    ' style="width:100%; height:100%; object-fit:cover; display:block;" />\n'
    '                </div>'
)

INSERT_BEFORE = '<div class="image-overlay">'

TEMPLATES = [
    r'C:\Users\MOHIT\Desktop\newscraft-mobile\backend\app\renderer\templates\hero-image\template.html',
    r'C:\Users\MOHIT\Desktop\newscraft-mobile\backend\app\renderer\templates\pattern_b\template.html',
]

for path in TEMPLATES:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Step 1: Remove any existing watermark div (old or misplaced)
    marker = '<!-- Top Right: RTI Spot News Watermark Logo -->'
    while marker in content:
        old_start = content.find(marker)
        # Find the closing </div> for the watermark block
        old_end = content.find('</div>', old_start) + len('</div>')
        content = content[:old_start].rstrip('\n') + '\n' + content[old_end:]
        print(f'  Removed old watermark from: {path}')

    # Step 2: Insert watermark DIRECTLY BEFORE image-overlay div
    # (which is inside hero-image-wrapper that has position:relative)
    if INSERT_BEFORE not in content:
        print(f'  WARN: target marker not found in {path}')
        continue

    content = content.replace(INSERT_BEFORE, WATERMARK_HTML + '\n            ' + INSERT_BEFORE, 1)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f'  Patched TOP-RIGHT: {path}')

print('Done.')
