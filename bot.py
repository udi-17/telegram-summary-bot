import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes
import logging

# הגדרת לוגינג
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO
)
logger = logging.getLogger(__name__)

# הגדרות הבוט
BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"  # החלף בטוקן של הבוט שלך
TARGET_USER = "@username"  # החלף בשם המשתמש שאליו תרצה להפנות
IMAGE_PATH = "welcome.jpg"  # נתיב לתמונת הפתיחה

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """פונקציה שמטפלת בפקודת /start"""
    
    # יצירת כפתור שמפנה למשתמש אחר
    keyboard = [
        [InlineKeyboardButton("💬 לחץ כאן לשיחה", url=f"https://t.me/{TARGET_USER.replace('@', '')}")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    # הודעת ברוכים הבאים
    welcome_message = """
🎉 **ברוכים הבאים לבוט שלנו!**

זהו בוט דוגמה עם מסך פתיחה מעוצב.

לחץ על הכפתור למטה כדי להתחיל שיחה:
"""
    
    # שליחת תמונה עם הודעה וכפתור
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
    
    # לוג על משתמש חדש
    user = update.effective_user
    logger.info(f"משתמש חדש התחיל את הבוט: {user.first_name} (ID: {user.id})")

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """פונקציה שמטפלת בפקודת /help"""
    help_text = """
📋 **רשימת פקודות:**

/start - הצגת מסך הפתיחה
/help - הצגת עזרה זו

לתמיכה נוספת, לחץ על הכפתור במסך הפתיחה.
"""
    await update.message.reply_text(help_text, parse_mode='Markdown')

def main() -> None:
    """פונקציה ראשית להפעלת הבוט"""
    
    # יצירת האפליקציה
    application = Application.builder().token(BOT_TOKEN).build()
    
    # הוספת הפקודות
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    
    # הפעלת הבוט
    logger.info("הבוט מתחיל לרוץ...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()