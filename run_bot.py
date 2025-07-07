#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
מפעיל מהיר לבוט טלגרם
"""

import os
import sys

def check_requirements():
    """בדיקת דרישות מערכת"""
    try:
        import telegram
        print("✅ telegram-bot library זמינה")
    except ImportError:
        print("❌ שגיאה: telegram-bot library לא מותקנת")
        print("📝 הפעל: pip install python-telegram-bot")
        return False
    
    try:
        import schedule
        print("✅ schedule library זמינה")
    except ImportError:
        print("❌ שגיאה: schedule library לא מותקנת")
        print("📝 הפעל: pip install schedule")
        return False
    
    return True

def main():
    """פונקציה ראשית"""
    print("🚀 מפעיל בוט טלגרם מתקדם...")
    print("=" * 50)
    
    # בדיקת דרישות
    if not check_requirements():
        print("\n❌ לא ניתן להפעיל את הבוט בלי הספריות הנדרשות")
        return
    
    # בדיקת קובץ הבוט
    if not os.path.exists('telegram_bot.py'):
        print("❌ שגיאה: קובץ telegram_bot.py לא נמצא")
        return
    
    print("✅ כל הבדיקות עברו בהצלחה")
    print("🔄 מפעיל את הבוט...")
    print("-" * 50)
    
    # הפעלת הבוט
    try:
        from telegram_bot import main as bot_main
        bot_main()
    except Exception as e:
        print(f"❌ שגיאה בהפעלת הבוט: {e}")

if __name__ == '__main__':
    main()