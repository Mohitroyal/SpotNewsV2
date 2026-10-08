"""
Modify the article-body in templates to combine all sections into a single paragraph.
"""

TEMPLATES = [
    r'C:\Users\MOHIT\Desktop\newscraft-mobile\backend\app\renderer\templates\hero-image\template.html',
    r'C:\Users\MOHIT\Desktop\newscraft-mobile\backend\app\renderer\templates\pattern_b\template.html',
]

OLD_BODY = '''            <div class="article-body">
                {% if sections and sections|length > 0 %}
                    {% for sec in sections %}
                        <p>{{ sec }}</p>
                    {% endfor %}
                {% else %}
                    <p>{{ article_text if article_text else (raw_content if raw_content else '') }}</p>
                {% endif %}
            </div>'''

NEW_BODY = '''            <div class="article-body">
                <p>
                {% if sections and sections|length > 0 %}
                    {{ sections | join('') }}
                {% else %}
                    {{ article_text if article_text else (raw_content if raw_content else '') }}
                {% endif %}
                </p>
            </div>'''

for path in TEMPLATES:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if OLD_BODY in content:
        content = content.replace(OLD_BODY, NEW_BODY)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Patched: {path}')
    else:
        print(f'Not found in: {path}')
