import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes
import logging
from dotenv import load_dotenv

# טעינת משתנים סביבתיים
load_dotenv()

# הגדרת לוגינג
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO
)
logger = logging.getLogger(__name__)

# הגדרות הבוט מקובץ .env
BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
TARGET_USER = os.getenv("TARGET_USER", "@username")
IMAGE_PATH = os.getenv("IMAGE_PATH", "welcome.jpg")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """פונקציה שמטפלת בפקודת /start עם אפשרויות מתקדמות"""
    
    # בדיקה אם המשתמש כבר השתמש בבוט בעבר
    user_id = update.effective_user.id
    user_data = context.user_data
    
    if 'visited' in user_data:
        greeting = "שמח לראות אותך שוב! 👋"
    else:
        greeting = "ברוך הבא לראשונה! 🎉"
        user_data['visited'] = True
    
    # יצירת כפתורים מרובים
    keyboard = [
        [InlineKeyboardButton("💬 התחל שיחה", url=f"https://t.me/{TARGET_USER.replace('@', '')}")],
        [
            InlineKeyboardButton("ℹ️ מידע נוסף", callback_data='info'),
            InlineKeyboardButton("📞 תמיכה", callback_data='support')
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    # הודעת ברוכים הבאים מותאמת אישית
    welcome_message = f"""
{greeting}

🤖 **ברוכים הבאים לבוט שלנו!**

אני כאן כדי לעזור לך להתחבר עם {TARGET_USER}.

✨ **מה אתה יכול לעשות:**
• לחץ על "התחל שיחה" כדי ליצור קשר
• לחץ על "מידע נוסף" לפרטים נוספים
• לחץ על "תמיכה" לקבלת עזרה

בחר אחת מהאפשרויות למטה:
"""
    
    # שליחת תמונה עם הודעה וכפתורים
    try:
        if os.path.exists(IMAGE_PATH):
            with open(IMAGE_PATH, 'rb') as photo:
                await update.message.reply_photo(
                    photo=photo,
                    caption=welcome_message,
                    parse_mode='Markdown',
                    reply_markup=reply_markup
                )
        else:
            # אם אין תמונה, שלח רק הודעה
            await update.message.reply_text(
                welcome_message,
                parse_mode='Markdown',
                reply_markup=reply_markup
            )
    except Exception as e:
        logger.error(f"שגיאה בשליחת הודעת הפתיחה: {e}")
        await update.message.reply_text(
            "מצטערים, אירעה שגיאה. אנא נסה שוב מאוחר יותר.",
            parse_mode='Markdown'
        )
    
    # לוג מפורט על המשתמש
    user = update.effective_user
    logger.info(
        f"משתמש {'חוזר' if 'visited' in user_data else 'חדש'}: "
        f"{user.first_name} {user.last_name or ''} "
        f"(ID: {user.id}, Username: @{user.username or 'ללא'})"
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """פונקציה שמטפלת בפקודת /help"""
    help_text = """
📋 **מדריך שימוש בבוט:**

**פקודות זמינות:**
• /start - הצגת מסך הפתיחה
• /help - הצגת עזרה זו
• /about - מידע על הבוט
• /contact - פרטי יצירת קשר

**איך להשתמש בבוט:**
1. הקלד /start להתחלה
2. לחץ על הכפתור "התחל שיחה"
3. תועבר אוטומטית לצ'אט עם המשתמש

💡 **טיפ:** שמור את הבוט כדי לגשת אליו בקלות בעתיד!

לעזרה נוספת, פנה לתמיכה דרך הכפתורים במסך הראשי.
"""
    await update.message.reply_text(help_text, parse_mode='Markdown')

async def about_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """פונקציה שמציגה מידע על הבוט"""
    about_text = f"""
🤖 **אודות הבוט**

בוט זה נוצר כדי להקל על יצירת קשר עם {TARGET_USER}.

**תכונות:**
• מסך פתיחה מעוצב
• הפניה ישירה למשתמש
• ממשק פשוט וידידותי
• תמיכה בעברית

**גרסה:** 1.0.0
**עדכון אחרון:** היום

נוצר עם ❤️ באמצעות Python ו-python-telegram-bot
"""
    await update.message.reply_text(about_text, parse_mode='Markdown')

async def contact_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """פונקציה שמציגה פרטי יצירת קשר"""
    contact_text = f"""
📞 **יצירת קשר**

לשאלות ובעיות, ניתן לפנות ב:

• **טלגרם:** {TARGET_USER}
• **זמני פעילות:** 24/7

אנחנו כאן כדי לעזור! 😊
"""
    keyboard = [[InlineKeyboardButton("📨 שלח הודעה", url=f"https://t.me/{TARGET_USER.replace('@', '')}")]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        contact_text, 
        parse_mode='Markdown',
        reply_markup=reply_markup
    )

def main() -> None:
    """פונקציה ראשית להפעלת הבוט"""
    
    # בדיקה שהטוקן הוגדר
    if BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        logger.error("לא הוגדר טוקן לבוט! הגדר את BOT_TOKEN בקובץ .env")
        return
    
    # יצירת האפליקציה
    application = Application.builder().token(BOT_TOKEN).build()
    
    # הוספת הפקודות
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("about", about_command))
    application.add_handler(CommandHandler("contact", contact_command))
    
    # הפעלת הבוט
    logger.info("הבוט מתחיל לרוץ...")
    logger.info(f"מפנה למשתמש: {TARGET_USER}")
    logger.info(f"תמונת פתיחה: {IMAGE_PATH}")
    
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()