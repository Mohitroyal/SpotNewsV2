B64_FILE = r'C:\Users\MOHIT\Desktop\newscraft-mobile\backend\app\renderer\templates\hero-image\up_logo_b64.txt'
with open(B64_FILE, 'r', encoding='ascii') as f:
    logo_data = f.read().strip()

LOGO_FILE = r'C:\Users\MOHIT\Desktop\newscraft-mobile\backend\app\renderer\templates\rti_express\logo.svg'

# Use the exact styling required to make the logo look good in the badge (rounded, fit well)
new_content = '<img src="' + logo_data + '" alt="RTI Express Logo" style="height: 120px; width: auto; max-width: 100%; object-fit: contain; margin: 0 auto; display: block; border-radius: 50%;" />'

with open(LOGO_FILE, 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Updated rti_express/logo.svg with new up-logo base64')
