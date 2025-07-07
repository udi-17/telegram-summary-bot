#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
עדכון אוטומטי של טוקן הבוט
"""

import re
import sys
import requests
import json

def validate_token(token):
    """בדיקה שהטוקן תקין"""
    try:
        response = requests.get(f"https://api.telegram.org/bot{token}/getMe")
        result = response.json()
        return result.get("ok", False), result.get("result", {})
    except Exception as e:
        return False, str(e)

def update_token_in_file(new_token, filename="index.js"):
    """עדכון הטוקן בקובץ"""
    try:
        with open(filename, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # חיפוש הטוקן הישן ועדכון לטוקן חדש
        pattern = r"const token = process\.env\.TELEGRAM_BOT_TOKEN \|\| '[^']*';"
        replacement = f"const token = process.env.TELEGRAM_BOT_TOKEN || '{new_token}';"
        
        updated_content = re.sub(pattern, replacement, content)
        
        if updated_content != content:
            with open(filename, 'w', encoding='utf-8') as file:
                file.write(updated_content)
            return True
        else:
            return False
    except Exception as e:
        print(f"שגיאה בעדכון הקובץ: {e}")
        return False

def main():
    if len(sys.argv) != 2:
        print("שימוש: python update_bot_token.py <NEW_TOKEN>")
        sys.exit(1)
    
    new_token = sys.argv[1]
    
    print("🔍 בודק תקינות הטוקן...")
    is_valid, bot_info = validate_token(new_token)
    
    if not is_valid:
        print(f"❌ טוקן לא תקין: {bot_info}")
        sys.exit(1)
    
    print(f"✅ טוקן תקין!")
    print(f"🤖 שם הבוט: {bot_info.get('first_name', 'N/A')}")
    print(f"📋 שם משתמש: @{bot_info.get('username', 'N/A')}")
    
    print("📝 מעדכן טוקן בקובץ...")
    if update_token_in_file(new_token):
        print("✅ הטוקן עודכן בהצלחה!")
        print("🚀 עכשיו אפשר להפעיל את הבוט:")
        print("   npm start")
    else:
        print("❌ שגיאה בעדכון הטוקן")

if __name__ == "__main__":
    main()