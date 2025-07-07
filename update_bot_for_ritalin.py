#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
עדכון הבוט להוספת מילת חיפוש ריטלין
"""

import requests
import json

# הגדרות
BOT_TOKEN = "8121925236:AAE34qOjqMNqtlEqsgZnqvIARL1tyyPNkX0"
BASE_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"

def update_bot_info():
    """עדכון מידע הבוט להוספת ריטלין"""
    
    # עדכון שם הבוט
    name_response = requests.post(f"{BASE_URL}/setMyName", json={
        "name": "פרקוסט אטנט ריטלין - שירותי טכנולוגיה מתקדמים",
        "language_code": "he"
    })
    
    if name_response.json().get("ok"):
        print("✅ שם הבוט עודכן בהצלחה עם ריטלין")
    else:
        print("❌ שגיאה בעדכון שם הבוט")
    
    # עדכון תיאור קצר
    short_desc_response = requests.post(f"{BASE_URL}/setMyShortDescription", json={
        "short_description": "פרקוסט, אטנט, ריטלין - שירותי טכנולוגיה מתקדמים ומידע מקצועי",
        "language_code": "he"
    })
    
    if short_desc_response.json().get("ok"):
        print("✅ תיאור קצר עודכן בהצלחה עם ריטלין")
    else:
        print("❌ שגיאה בעדכון תיאור קצר")
    
    # עדכון תיאור מלא
    full_desc = """🔥 פרקוסט אטנט ריטלין - הפתרון הטכנולוגי המלא!
💡 שירותי אינטרנט, אטנט וטכנולוגיה מתקדמים
🚀 פרקוסט - חדשנות בכל פתרון
⚡ אטנט - מהירות ויעילות מקסימלית
💊 ריטלין - מידע ושירותים מקצועיים
📞 תמיכה 24/7 | פתרונות מותאמים אישית
💬 צ'אט ישיר לשירות מהיר ויעיל"""
    
    desc_response = requests.post(f"{BASE_URL}/setMyDescription", json={
        "description": full_desc,
        "language_code": "he"
    })
    
    if desc_response.json().get("ok"):
        print("✅ תיאור מלא עודכן בהצלחה עם ריטלין")
    else:
        print("❌ שגיאה בעדכון תיאור מלא")
    
    # עדכון פקודות
    commands = [
        {"command": "start", "description": "התחל עם פרקוסט אטנט ריטלין"},
        {"command": "perkaust", "description": "מידע על שירותי פרקוסט"},
        {"command": "atnet", "description": "מידע על שירותי אטנט"},
        {"command": "ritalin", "description": "מידע על שירותי ריטלין"},
        {"command": "help", "description": "עזרה ותמיכה"},
        {"command": "info", "description": "מידע מפורט על כל השירותים"}
    ]
    
    commands_response = requests.post(f"{BASE_URL}/setMyCommands", json={
        "commands": commands,
        "language_code": "he"
    })
    
    if commands_response.json().get("ok"):
        print("✅ פקודות הבוט עודכנו בהצלחה עם ריטלין")
    else:
        print("❌ שגיאה בעדכון פקודות")
    
    print("\n🎉 העדכון הושלם בהצלחה!")
    print("🔍 הבוט עכשיו מותאם לחיפושים של:")
    print("   • פרקוסט")
    print("   • אטנט")
    print("   • ריטלין")
    print("\n📊 תוצאות צפויות:")
    print("   • תוך 24-48 שעות: הבוט יתחיל להופיע בחיפושים")
    print("   • תוך שבוע: עמדות גבוהות יותר")
    print("   • תוך חודש: עמדות ראשונות!")
    print("\n🔗 קישור לבוט: https://t.me/Happy177_bot")

if __name__ == "__main__":
    print("🚀 מעדכן בוט לחיפוש ריטלין...")
    update_bot_info()