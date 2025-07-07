#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
בוט פשוט לחיפוש אטנט, פרקוסט, ריטלין
ללא כפתורים - רק צ'אט פשוט
"""

import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import json
import datetime
import os

# הגדרת הלוגים
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# טוקן הבוט
BOT_TOKEN = "8121925236:AAE34qOjqMNqtlEqsgZnqvIARL1tyyPNkX0"

# קובץ נתונים פשוט
DATA_FILE = "simple_bot_data.json"

def load_data():
    """טעינת נתונים מהקובץ"""
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"שגיאה בטעינת נתונים: {e}")
    return {"users": [], "messages": []}

def save_data(data):
    """שמירת נתונים לקובץ"""
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"שגיאה בשמירת נתונים: {e}")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """פונקציית התחלה"""
    user = update.effective_user
    chat_id = update.effective_chat.id
    
    # שמירת המשתמש
    data = load_data()
    if chat_id not in data["users"]:
        data["users"].append(chat_id)
        save_data(data)
    
    welcome_message = """🔥 ברוכים הבאים!

🌟 **אטנט** - פתרונות אינטרנט מתקדמים
⚡ **פרקוסט** - שירותי טכנולוגיה חדשניים  
💊 **ריטלין** - מידע ושירותים מקצועיים

💬 איך אני יכול לעזור לך היום?
שלח לי הודעה ואני אענה לך!

📞 לשירות אישי: צור קשר ישירות בצ'אט"""
    
    await update.message.reply_text(welcome_message)
    
    # לוג המשתמש
    logger.info(f"משתמש חדש התחיל: {user.first_name} ({chat_id})")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """טיפול בהודעות"""
    user = update.effective_user
    chat_id = update.effective_chat.id
    message_text = update.message.text.lower()
    
    # שמירת ההודעה
    data = load_data()
    data["messages"].append({
        "user_id": chat_id,
        "message": update.message.text,
        "timestamp": datetime.datetime.now().isoformat()
    })
    save_data(data)
    
    # מענה לפי תוכן ההודעה
    if any(keyword in message_text for keyword in ["אטנט", "atnet", "אינטרנט", "internet"]):
        response = """🌐 **אטנט - שירותי אינטרנט מתקדמים**

✅ אינטרנט מהיר ויציב
✅ פתרונות רשת מתקדמים
✅ תמיכה טכנית 24/7
✅ התקנה מקצועית

📞 לפרטים נוספים - צור קשר בצ'אט!"""
        
    elif any(keyword in message_text for keyword in ["פרקוסט", "perkaust", "טכנולוגיה", "technology"]):
        response = """🚀 **פרקוסט - שירותי טכנולוגיה חדשניים**

⚡ פתרונות טכנולוגיים חדשניים
⚡ מערכות חכמות ומתקדמות
⚡ ייעוץ טכנולוגי מקצועי
⚡ פיתוח והטמעה

📞 לפרטים נוספים - צור קשר בצ'אט!"""
        
    elif any(keyword in message_text for keyword in ["ריטלין", "ritalin", "מרכז", "שירותים"]):
        response = """💊 **ריטלין - שירותים מקצועיים**

🎯 שירותים מותאמים אישית
🎯 ייעוץ מקצועי
🎯 פתרונות איכותיים
🎯 שירות אמין ומהיר

📞 לפרטים נוספים - צור קשר בצ'אט!"""
        
    elif any(keyword in message_text for keyword in ["מחיר", "עלות", "כמה", "price"]):
        response = """💰 **מחירים ותעריפים**

🔥 מחירים מיוחדים ומתחרים!
🔥 הצעות מותאמות אישית
🔥 תשלומים נוחים
🔥 שירות ללא התחייבות

📞 לקבלת הצעת מחיר - צור קשר בצ'אט!"""
        
    elif any(keyword in message_text for keyword in ["איך", "מה", "למה", "how", "what"]):
        response = """❓ **שאלות ותשובות**

אני כאן כדי לעזור לך!

🌟 לשירותי **אטנט** - אינטרנט ורשתות
🚀 לשירותי **פרקוסט** - טכנולוגיה חדשנית  
💊 לשירותי **ריטלין** - פתרונות מקצועיים

📞 שאל אותי הכל - אני אענה לך!"""
        
    else:
        response = """👋 שלום! תודה על הפנייה!

🔥 **אטנט** - פתרונות אינטרנט מתקדמים
🚀 **פרקוסט** - שירותי טכנולוגיה חדשניים
💊 **ריטלין** - שירותים מקצועיים

איך אני יכול לעזור לך?
💬 שלח לי פרטים ואני אחזור אליך!

📞 לשירות מיידי - המשך בצ'אט!"""
    
    await update.message.reply_text(response)
    
    # לוג ההודעה
    logger.info(f"הודעה מ-{user.first_name}: {update.message.text}")

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """פונקציית עזרה"""
    help_text = """🆘 **עזרה**

🔥 **אטנט** - שירותי אינטרנט מתקדמים
🚀 **פרקוסט** - שירותי טכנולוגיה חדשניים
💊 **ריטלין** - שירותים מקצועיים

📞 לשירות: שלח לי הודעה ואני אענה!
⚡ מענה מהיר ומקצועי 24/7"""
    
    await update.message.reply_text(help_text)

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """טיפול בשגיאות"""
    logger.error(f"שגיאה: {context.error}")

def main() -> None:
    """הפעלת הבוט"""
    print("🚀 מתחיל בוט חיפוש אטנט/פרקוסט/ריטלין...")
    
    # יצירת האפליקציה
    application = Application.builder().token(BOT_TOKEN).build()
    
    # הוספת handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    # הוספת error handler
    application.add_error_handler(error_handler)
    
    # הפעלת הבוט
    print("✅ הבוט פועל ומחכה לחיפושים...")
    print("🔍 מותאם לחיפושים: אטנט, פרקוסט, ריטלין")
    print("💬 ללא כפתורים - רק צ'אט פשוט")
    
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()