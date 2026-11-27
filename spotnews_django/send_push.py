import os
import sys
import django

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from core.services.notification_service import send_topic_notification

def main():
    print("=" * 60)
    print(" Spot News 24x7 - Push Notification Tester")
    print("=" * 60)
    
    title = input("Enter notification title [Default: Spot News 24x7]: ").strip()
    if not title:
        title = "Spot News 24x7"
        
    body = input("Enter message body [Default: బ్రేకింగ్ వార్తలు: పుష్ నోటిఫికేషన్ పరీక్ష విజయవంతమైంది!]: ").strip()
    if not body:
        body = "బ్రేకింగ్ వార్తలు: పుష్ నోటిఫికేషన్ పరీక్ష విజయవంతమైంది! (Breaking News: Test notification successful!)"
        
    print(f"\nSending push notification to topic 'all'...")
    res = send_topic_notification(
        title=title,
        body=body,
        topic="all",
        url="/"
    )
    
    if res.get("success"):
        print("\nSUCCESS! Notification sent through Firebase FCM!")
        print(f"Message ID: {res.get('message_id')}")
        print("Check your Android phone now - the notification should appear!")
    else:
        print("\nFAILED to send notification:")
        print(res.get("error"))
    print("=" * 60)

if __name__ == "__main__":
    main()
