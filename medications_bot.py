#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
בוט מידע כללי על תרופות - אטנט, פרקוסט, ריטלין
ללא ייעוץ רפואי - רק מידע כללי והפניה לרופא
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

# קובץ נתונים
DATA_FILE = "medications_bot_data.json"

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
    
    welcome_message = """💊 ברוכים הבאים למידע כללי על תרופות

📋 מידע כללי זמין על:
• **אטנט** 
• **פרקוסט**
• **ריטלין**

⚠️ **הערה חשובה:**
המידע כאן הוא כללי בלבד ולא מחליף ייעוץ רפואי מקצועי.
תמיד היוועצו עם רופא או רוקח לפני נטילת תרופות.

💬 שלחו שם תרופה לקבלת מידע כללי"""
    
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
    if any(keyword in message_text for keyword in ["אטנט", "etnet"]):
        response = """💊 **אטנט - מידע כללי**

📋 **מידע בסיסי:**
אטנט הוא שם מסחרי לתרופה המכילה חומר פעיל מסוים.

⚠️ **הערות חשובות:**
• התרופה דורשת מרשם רופא
• יש לקרוא את עלון התרופה בקפידה
• יש להקפיד על המינון שנקבע על ידי הרופא
• יש לדווח לרופא על תופעות לוואי

👨‍⚕️ **לקבלת מידע מקצועי:**
• היוועצו עם הרופא המטפל
• פנו לרוקח לשאלות על השימוש
• קראו את העלון המצורף לתרופה

📞 **במקרה חירום או תופעות חמורות - פנו מיד לרופא או לחדר מיון**"""
        
    elif any(keyword in message_text for keyword in ["פרקוסט", "perkaust"]):
        response = """💊 **פרקוסט - מידע כללי**

📋 **מידע בסיסי:**
פרקוסט הוא שם מסחרי לתרופה המכילה חומר פעיל מסוים.

⚠️ **הערות חשובות:**
• התרופה דורשת מרשם רופא
• יש לקרוא את עלון התרופה בקפידה
• יש להקפיד על המינון שנקבע על ידי הרופא
• יש לדווח לרופא על תופעות לוואי

👨‍⚕️ **לקבלת מידע מקצועי:**
• היוועצו עם הרופא המטפל
• פנו לרוקח לשאלות על השימוש
• קראו את העלון המצורף לתרופה

📞 **במקרה חירום או תופעות חמורות - פנו מיד לרופא או לחדר מיון**"""
        
    elif any(keyword in message_text for keyword in ["ריטלין", "ritalin"]):
        response = """💊 **ריטלין - מידע כללי**

📋 **מידע בסיסי:**
ריטלין הוא שם מסחרי לתרופה המכילה חומר פעיל מתילפנידט.
התרופה משמשת לטיפול בהפרעות קשב וריכוז (ADHD).

⚠️ **הערות חשובות:**
• התרופה דורשת מרשם רופא והדוק
• יש לקרוא את עלון התרופה בקפידה
• יש להקפיד על המינון שנקבע על ידי הרופא
• יש לדווח לרופא על תופעות לוואי
• התרופה דורשת מעקב רפואי שוטף

👨‍⚕️ **לקבלת מידע מקצועי:**
• היוועצו עם הרופא המטפל
• פנו לרוקח לשאלות על השימוש
• קראו את העלון המצורף לתרופה

📞 **במקרה חירום או תופעות חמורות - פנו מיד לרופא או לחדר מיון**"""
        
    elif any(keyword in message_text for keyword in ["תופעות", "לוואי", "side effects"]):
        response = """⚠️ **תופעות לוואי - מידע כללי**

📋 **עקרונות חשובים:**
• כל תרופה עלולה לגרום לתופעות לוואי
• התופעות משתנות בין אנשים
• יש לקרוא את עלון התרופה לפירוט מלא

🚨 **מתי לפנות לרופא:**
• תופעות חמורות או מטרידות
• תופעות שלא מוזכרות בעלון
• החמרה של תופעות קיימות
• חשד לאלרגיה לתרופה

👨‍⚕️ **חשוב לזכור:**
• אל תפסיקו תרופה בלי היוועצות עם רופא
• דווחו לרופא על כל תופעה חדשה
• שמרו רשימה של התופעות שחווים

📞 **במקרה חירום - פנו מיד לחדר מיון**"""
        
    elif any(keyword in message_text for keyword in ["מינון", "dosage", "כמה", "מתי"]):
        response = """💊 **מידע על מינון**

⚠️ **עקרון יסוד:**
המינון נקבע אך ורק על ידי הרופא המטפל!

📋 **כללים חשובים:**
• אל תשנו מינון ללא היוועצות עם רופא
• אל תקחו תרופה של מישהו אחר
• הקפידו על זמני הנטילה שנקבעו
• אל תכפילו מינון אם שכחתם

👨‍⚕️ **לשאלות על מינון:**
• פנו לרופא המטפל
• התייעצו עם רוקח
• קראו את עלון התרופה

📞 **חירום או חשד למנת יתר - פנו מיד לחדר מיון**"""
        
    else:
        response = """💊 **מידע כללי על תרופות**

📋 **תרופות זמינות במערכת:**
• אטנט
• פרקוסט  
• ריטלין

⚠️ **הערה חשובה:**
המידע כאן הוא כללי בלבד ולא מחליף ייעוץ רפואי מקצועי.

💬 **איך לקבל מידע:**
שלחו שם התרופה לקבלת מידע כללי

👨‍⚕️ **לייעוץ מקצועי:**
• היוועצו עם רופא
• פנו לרוקח
• קראו עלוני תרופות

📞 **במקרה חירום - מיד לחדר מיון או מד"א 101**"""
    
    await update.message.reply_text(response)
    
    # לוג ההודעה
    logger.info(f"הודעה מ-{user.first_name}: {update.message.text}")

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """פונקציית עזרה"""
    help_text = """🆘 **עזרה**

💊 **מידע זמין על:**
• אטנט
• פרקוסט
• ריטלין

📝 **איך זה עובד:**
שלחו שם תרופה וקבלו מידע כללי

⚠️ **זכרו:**
המידע כאן כללי בלבד - תמיד היוועצו עם רופא!

📞 **חירום רפואי: מד"א 101**"""
    
    await update.message.reply_text(help_text)

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """טיפול בשגיאות"""
    logger.error(f"שגיאה: {context.error}")

def main() -> None:
    """הפעלת הבוט"""
    print("🚀 מתחיל בוט מידע על תרופות...")
    
    # יצירת האפליקציה
    application = Application.builder().token(BOT_TOKEN).build()
    
    # הוספת handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    # הוספת error handler
    application.add_error_handler(error_handler)
    
    # הפעלת הבוט
    print("✅ בוט תרופות פועל ומחכה לשאלות...")
    print("💊 מידע זמין על: אטנט, פרקוסט, ריטלין")
    print("⚠️ מידע כללי בלבד - לא ייעוץ רפואי")
    
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()