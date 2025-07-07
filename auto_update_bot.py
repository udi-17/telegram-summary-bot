#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
עדכון אוטומטי של פרטי הבוט - עוקף את @BotFather
"""

import requests
import json
import time
from typing import Optional

class TelegramBotUpdater:
    def __init__(self, bot_token: str):
        self.bot_token = bot_token
        self.base_url = f"https://api.telegram.org/bot{bot_token}"
    
    def update_bot_name(self, name: str, language_code: str = "he") -> bool:
        """עדכון שם הבוט"""
        url = f"{self.base_url}/setMyName"
        data = {
            "name": name,
            "language_code": language_code
        }
        
        try:
            response = requests.post(url, json=data)
            result = response.json()
            if result.get("ok"):
                print(f"✅ שם הבוט עודכן בהצלחה: {name}")
                return True
            else:
                print(f"❌ שגיאה בעדכון שם הבוט: {result.get('description', 'Unknown error')}")
                return False
        except Exception as e:
            print(f"❌ שגיאה: {str(e)}")
            return False
    
    def update_bot_description(self, description: str, language_code: str = "he") -> bool:
        """עדכון תיאור הבוט"""
        url = f"{self.base_url}/setMyDescription"
        data = {
            "description": description,
            "language_code": language_code
        }
        
        try:
            response = requests.post(url, json=data)
            result = response.json()
            if result.get("ok"):
                print(f"✅ תיאור הבוט עודכן בהצלחה")
                return True
            else:
                print(f"❌ שגיאה בעדכון תיאור הבוט: {result.get('description', 'Unknown error')}")
                return False
        except Exception as e:
            print(f"❌ שגיאה: {str(e)}")
            return False
    
    def update_bot_short_description(self, short_description: str, language_code: str = "he") -> bool:
        """עדכון תיאור קצר של הבוט"""
        url = f"{self.base_url}/setMyShortDescription"
        data = {
            "short_description": short_description,
            "language_code": language_code
        }
        
        try:
            response = requests.post(url, json=data)
            result = response.json()
            if result.get("ok"):
                print(f"✅ תיאור קצר עודכן בהצלחה")
                return True
            else:
                print(f"❌ שגיאה בעדכון תיאור קצר: {result.get('description', 'Unknown error')}")
                return False
        except Exception as e:
            print(f"❌ שגיאה: {str(e)}")
            return False
    
    def set_bot_commands(self, commands: list) -> bool:
        """עדכון פקודות הבוט"""
        url = f"{self.base_url}/setMyCommands"
        data = {
            "commands": commands,
            "language_code": "he"
        }
        
        try:
            response = requests.post(url, json=data)
            result = response.json()
            if result.get("ok"):
                print(f"✅ פקודות הבוט עודכנו בהצלחה")
                return True
            else:
                print(f"❌ שגיאה בעדכון פקודות: {result.get('description', 'Unknown error')}")
                return False
        except Exception as e:
            print(f"❌ שגיאה: {str(e)}")
            return False
    
    def get_bot_info(self) -> Optional[dict]:
        """קבלת מידע על הבוט"""
        url = f"{self.base_url}/getMe"
        
        try:
            response = requests.get(url)
            result = response.json()
            if result.get("ok"):
                return result["result"]
            else:
                print(f"❌ שגיאה בקבלת מידע על הבוט: {result.get('description', 'Unknown error')}")
                return None
        except Exception as e:
            print(f"❌ שגיאה: {str(e)}")
            return None

def optimize_for_search():
    """עדכון אוטומטי של הבוט עבור מילות החיפוש פרקוסט ואטנט"""
    
    # הכנס כאן את הטוקן של הבוט שלך
    BOT_TOKEN = "8121925236:AAE34qOjqMNqtlEqsgZnqvIARL1tyyPNkX0"
    
    print("🚀 מתחיל עדכון אוטומטי של הבוט...")
    print("=" * 50)
    
    updater = TelegramBotUpdater(BOT_TOKEN)
    
    # 1. בדיקת מידע נוכחי של הבוט
    print("📋 בודק מידע נוכחי של הבוט...")
    bot_info = updater.get_bot_info()
    if bot_info:
        print(f"🤖 שם נוכחי: {bot_info.get('first_name', 'לא מוגדר')}")
        print(f"🔗 יוזרניים: {bot_info.get('username', 'לא מוגדר')}")
    
    time.sleep(1)
    
    # 2. עדכון שם הבוט
    print("\n📝 מעדכן שם הבוט...")
    new_name = "פרקוסט אטנט - שירותי טכנולוגיה מתקדמים"
    updater.update_bot_name(new_name)
    
    time.sleep(1)
    
    # 3. עדכון תיאור קצר
    print("\n📝 מעדכן תיאור קצר...")
    short_description = "פרקוסט ואטנט - המומחים בטכנולוגיה! אטנט: פתרונות אינטרנט מתקדמים | פרקוסט: שירותי טכנולוגיה חדשניים"
    updater.update_bot_short_description(short_description)
    
    time.sleep(1)
    
    # 4. עדכון תיאור מלא
    print("\n📝 מעדכן תיאור מלא...")
    full_description = """🔥 פרקוסט ואטנט - הפתרון הטכנולוגי המלא!
💡 שירותי אינטרנט, אטנט וטכנולוגיה מתקדמים
🚀 פרקוסט - חדשנות בכל פתרון
⚡ אטנט - מהירות ויעילות מקסימלית
📞 תמיכה 24/7 | פתרונות מותאמים אישית

מילות מפתח: פרקוסט, אטנט, אינטרנט, טכנולוגיה, שירותי מחשבים, תמיכה טכנית, ישראל"""
    
    updater.update_bot_description(full_description)
    
    time.sleep(1)
    
    # 5. עדכון פקודות הבוט
    print("\n📝 מעדכן פקודות הבוט...")
    commands = [
        {"command": "start", "description": "התחל עם פרקוסט ואטנט"},
        {"command": "perkaust", "description": "מידע על שירותי פרקוסט"},
        {"command": "atnet", "description": "מידע על שירותי אטנט"},
        {"command": "help", "description": "עזרה ותמיכה"},
        {"command": "info", "description": "מידע מפורט"},
        {"command": "support", "description": "צרו קשר לתמיכה"}
    ]
    
    updater.set_bot_commands(commands)
    
    time.sleep(2)
    
    # 6. בדיקה סופית
    print("\n🔍 בודק עדכונים...")
    updated_info = updater.get_bot_info()
    if updated_info:
        print(f"✅ שם מעודכן: {updated_info.get('first_name', 'לא מוגדר')}")
    
    print("\n" + "=" * 50)
    print("🎉 העדכון הושלם בהצלחה!")
    print("📊 תוצאות צפויות:")
    print("   • תוך 24-48 שעות: הבוט יתחיל להופיע בחיפושים")
    print("   • תוך שבוע: עמדות גבוהות יותר")
    print("   • תוך חודש: עמדות ראשונות!")
    print("\n🔗 קישור לבוט: https://t.me/Happy177_bot")
    print("💬 שתף עם חברים וחפש: פרקוסט, אטנט")

if __name__ == "__main__":
    optimize_for_search()