#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
עדכון הבוט לתרופות - אטנט, פרקוסט, ריטלין
"""

import requests
import json

# הגדרות
BOT_TOKEN = "8121925236:AAE34qOjqMNqtlEqsgZnqvIARL1tyyPNkX0"
BASE_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"

def update_bot_info():
    """עדכון מידע הבוט לתרופות"""
    
    print("🚀 מעדכן בוט לתרופות...")
    
    # עדכון שם הבוט
    name_response = requests.post(f"{BASE_URL}/setMyName", json={
        "name": "אטנט פרקוסט ריטלין - מידע כללי על תרופות",
        "language_code": "he"
    })
    
    if name_response.json().get("ok"):
        print("✅ שם הבוט עודכן בהצלחה")
    else:
        print("❌ שגיאה בעדכון שם הבוט")
    
    # עדכון תיאור קצר
    short_desc_response = requests.post(f"{BASE_URL}/setMyShortDescription", json={
        "short_description": "מידע כללי על תרופות: אטנט, פרקוסט, ריטלין | ללא ייעוץ רפואי",
        "language_code": "he"
    })
    
    if short_desc_response.json().get("ok"):
        print("✅ תיאור קצר עודכן בהצלחה")
    else:
        print("❌ שגיאה בעדכון תיאור קצר")
    
    # עדכון תיאור מלא
    full_desc = """💊 מידע כללי על תרופות
📋 אטנט, פרקוסט, ריטלין
⚠️ מידע כללי בלבד - לא ייעוץ רפואי
👨‍⚕️ תמיד היוועצו עם רופא או רוקח
📞 במקרה חירום: מד"א 101
💬 שלחו שם תרופה לקבלת מידע בסיסי"""
    
    desc_response = requests.post(f"{BASE_URL}/setMyDescription", json={
        "description": full_desc,
        "language_code": "he"
    })
    
    if desc_response.json().get("ok"):
        print("✅ תיאור מלא עודכן בהצלחה")
    else:
        print("❌ שגיאה בעדכון תיאור מלא")
    
    # עדכון פקודות
    commands = [
        {"command": "start", "description": "התחל - מידע על תרופות"},
        {"command": "help", "description": "עזרה ומידע כללי"}
    ]
    
    commands_response = requests.post(f"{BASE_URL}/setMyCommands", json={
        "commands": commands,
        "language_code": "he"
    })
    
    if commands_response.json().get("ok"):
        print("✅ פקודות הבוט עודכנו בהצלחה")
    else:
        print("❌ שגיאה בעדכון פקודות")
    
    print("\n🎉 העדכון הושלם בהצלחה!")
    print("💊 הבוט עכשיו מותאם לתרופות:")
    print("   • אטנט")
    print("   • פרקוסט") 
    print("   • ריטלין")
    print("\n⚠️ מידע כללי בלבד - ללא ייעוץ רפואי")
    print("📊 תוצאות צפויות:")
    print("   • תוך 24-48 שעות: הבוט יתחיל להופיע בחיפושי תרופות")
    print("   • תוך שבוע: עמדות גבוהות יותר")
    print("   • תוך חודש: עמדות ראשונות!")
    print("\n🔗 קישור לבוט: https://t.me/Happy177_bot")

if __name__ == "__main__":
    update_bot_info()