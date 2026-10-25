import subprocess, sys

# Get the original logo content from the correct commit
result = subprocess.run(
    ['git', 'show', '322a80ec:backend/app/renderer/templates/rti_express/logo.svg'],
    cwd=r'C:\Users\MOHIT\Desktop\newscraft-mobile\backend',
    capture_output=True
)

if result.returncode != 0:
    print("Error:", result.stderr.decode())
    sys.exit(1)

content = result.stdout.decode('utf-8')
print(f"Got content: {len(content)} chars, starts with: {content[:60]}")

with open(r'C:\Users\MOHIT\Desktop\newscraft-mobile\backend\app\renderer\templates\rti_express\logo.svg', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done - original RTI Express logo restored")
