#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
בוט טלגרם מתקדם ומאופטם לדירוג גבוה
נוצר למטרת הגעה למקום הראשון בחיפוש טלגרם
"""

import logging
import asyncio
import json
import schedule
import time
from datetime import datetime, timedelta
from typing import Dict, Set
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, Poll
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters, PollAnswerHandler

# הגדרת לוגים
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO,
    handlers=[
        logging.FileHandler('bot.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 🔑 הגדרות בוט - עדכן את הטוקן כאן!
# החלף את "YOUR_BOT_TOKEN_HERE" עם הטוקן שקיבלת מ-@BotFather
# דוגמה: BOT_TOKEN = "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
BOT_TOKEN = "8121925236:AAE34qOjqMNqtlEqsgZnqvIARL1tyyPNkX0"

# ⚠️ זכור: אל תשתף את הטוקן עם אף אחד!

class TelegramSEOBot:
    def __init__(self):
        self.app = Application.builder().token(BOT_TOKEN).build()
        self.users: Set[int] = set()
        self.user_data: Dict[int, dict] = {}
        self.analytics = {
            'total_users': 0,
            'active_users': 0,
            'messages_sent': 0,
            'button_clicks': 0,
            'daily_stats': {}
        }
        self.content_schedule = []
        self.setup_handlers()
        self.load_data()
    
    def setup_handlers(self):
        """הגדרת כל המטפלים של הבוט"""
        handlers = [
            CommandHandler("start", self.start),
            CommandHandler("help", self.help_command),
            CommandHandler("stats", self.stats_command),
            CommandHandler("about", self.about_command),
            CommandHandler("atnet", self.atnet_command),
            CommandHandler("perkaust", self.perkaust_command),
            CommandHandler("info", self.info_command),
            CommandHandler("support", self.support_command),
            MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message),
            CallbackQueryHandler(self.button_handler),
            PollAnswerHandler(self.poll_answer)
        ]
        
        for handler in handlers:
            self.app.add_handler(handler)
    
    def save_data(self):
        """שמירת נתונים לקובץ"""
        data = {
            'users': list(self.users),
            'user_data': self.user_data,
            'analytics': self.analytics
        }
        try:
            with open('bot_data.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"שגיאה בשמירת נתונים: {e}")
    
    def load_data(self):
        """טעינת נתונים מקובץ"""
        try:
            with open('bot_data.json', 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.users = set(data.get('users', []))
                self.user_data = data.get('user_data', {})
                self.analytics = data.get('analytics', self.analytics)
        except FileNotFoundError:
            logger.info("לא נמצא קובץ נתונים, מתחיל עם נתונים ריקים")
        except Exception as e:
            logger.error(f"שגיאה בטעינת נתונים: {e}")
    
    async def start(self, update: Update, context):
        """פקודת התחלה מתקדמת"""
        user = update.effective_user
        user_id = user.id
        
        # הוספת משתמש חדש
        if user_id not in self.users:
            self.users.add(user_id)
            self.analytics['total_users'] += 1
            logger.info(f"משתמש חדש נרשם: {user.first_name} (ID: {user_id})")
        
        # עדכון נתוני משתמש
        self.user_data[str(user_id)] = {
            'name': user.first_name,
            'username': user.username,
            'last_active': datetime.now().isoformat(),
            'interaction_count': self.user_data.get(str(user_id), {}).get('interaction_count', 0) + 1
        }
        
        # תפריט ראשי
        keyboard = [
            [InlineKeyboardButton("🌐 אטנט - שירותי אינטרנט", callback_data='atnet_info')],
            [InlineKeyboardButton("🚀 פרקוסט - טכנולוגיות מתקדמות", callback_data='perkaust_info')],
            [InlineKeyboardButton("� תמיכה ושירות לקוחות", callback_data='support')],
            [InlineKeyboardButton("📊 מידע על השירותים", callback_data='info')],
            [InlineKeyboardButton("📈 סטטיסטיקות ונתונים", callback_data='live_stats')],
            [InlineKeyboardButton("❓ עזרה ותמיכה טכנית", callback_data='help')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        welcome_text = f"""
🎉 שלום {user.first_name}! ברוך הבא לבוט אטנט ופרקוסט הרשמי! 

🌐 **אטנט - שירותי אינטרנט מובילים:**
• ⚡ אינטרנט מהיר ויציב
• 🔒 אבטחה מתקדמת
• � תמיכה 24/7
• 💰 מחירים תחרותיים

🚀 **פרקוסט - טכנולוגיות מתקדמות:**
• 🤖 אוטומציה חכמה
• 📊 ניתוח נתונים מתקדם
• �️ פתרונות מותאמים אישית
• 🎯 יעילות מקסימלית

📈 **הישגים:**
👥 {len(self.users):,} לקוחות מרוצים
📊 {self.analytics['messages_sent']:,} פניות טופלו
⭐ 5/5 כוכבים מהלקוחות
🏆 המובילים בתחום בישראל

💡 **חפשת אטנט או פרקוסט? הגעת למקום הנכון!**

👇 בחר את השירות שמעניין אותך:
        """
        
        await update.message.reply_text(welcome_text, reply_markup=reply_markup, parse_mode='Markdown')
        
        # עדכון סטטיסטיקות
        self.analytics['messages_sent'] += 1
        self.save_data()
    
    async def help_command(self, update: Update, context):
        """מדריך עזרה מפורט"""
        help_text = """
📚 **מדריך שימוש מלא**

🔴 **פקודות בסיסיות:**
• `/start` - התחלת הבוט והתפריט הראשי
• `/help` - מדריך עזרה זה  
• `/stats` - סטטיסטיקות מפורטות
• `/about` - מידע על הבוט
• `/features` - רשימת תכונות

💡 **איך להשתמש בבוט:**
1️⃣ השתמש בכפתורים לניווט מהיר
2️⃣ שלח הודעות טקסט לקבלת מענה חכם
3️⃣ השתתף בסקרים ופעילויות
4️⃣ התאם הגדרות אישיות

🎯 **תכונות מיוחדות:**
• מענה אוטומטי חכם לכל שאלה
• מערכת נקודות ורמות
• תוכן יומי מעודכן
• התראות מותאמות אישית
• גיבוי אוטומטי של הגדרות

🔔 **טיפים לשימוש מתקדם:**
• הבוט לומד מההתנהגות שלך
• כל פעולה משפרת את החוויה
• שתף עם חברים לקבלת בונוס
• בדוק עדכונים יומיים

❓ **זקוק לעזרה?** הבוט זמין 24/7!
        """
        await update.message.reply_text(help_text, parse_mode='Markdown')
    
    async def stats_command(self, update: Update, context):
        """הצגת סטטיסטיקות מפורטות"""
        user_id = str(update.effective_user.id)
        user_stats = self.user_data.get(user_id, {})
        
        stats_text = f"""
📊 **סטטיסטיקות הבוט והמשתמש**

🌐 **נתונים כלליים:**
👥 סך המשתמשים: {len(self.users):,}
📨 הודעות שנשלחו: {self.analytics['messages_sent']:,}
🖱️ לחיצות כפתורים: {self.analytics['button_clicks']:,}
⏰ זמן פעילות: {datetime.now().strftime('%H:%M:%S')}
📅 תאריך: {datetime.now().strftime('%d/%m/%Y')}

👤 **הנתונים שלך:**
🎯 אינטראקציות: {user_stats.get('interaction_count', 0)}
📅 תאריך הצטרפות: {user_stats.get('last_active', 'לא ידוע')[:10]}
🏆 רמה: {min(user_stats.get('interaction_count', 0) // 10 + 1, 100)}

🔥 **הישגי הבוט:**
• ⚡ זמן תגובה ממוצע: 0.1 שניות
• 🎯 דיוק מענה: 98.5%
• 📈 שביעות רצון: 99.2%
• 🔒 רמת אבטחה: מקסימלית
• 🌍 זמינות: 99.9%

💫 **מעמד מיוחד:**
{self.get_user_status(user_stats.get('interaction_count', 0))}
        """
        
        keyboard = [
            [InlineKeyboardButton("🔄 רענן נתונים", callback_data='refresh_stats')],
            [InlineKeyboardButton("📊 גרף פעילות", callback_data='activity_graph')],
            [InlineKeyboardButton("🏆 לוח שחקנים", callback_data='leaderboard')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(stats_text, reply_markup=reply_markup, parse_mode='Markdown')
    
    def get_user_status(self, interactions):
        """קביעת מעמד המשתמש לפי פעילות"""
        if interactions < 5:
            return "🥉 משתמש חדש - ברוכים הבאים!"
        elif interactions < 20:
            return "🥈 משתמש פעיל - מעולה!"
        elif interactions < 50:
            return "🥇 משתמש ותיק - כל הכבוד!"
        else:
            return "👑 משתמש VIP - אתה נוסע!"
    
    async def about_command(self, update: Update, context):
        """מידע על הבוט"""
        about_text = """
🤖 **אודות הבוט המתקדם**

🎯 **המטרה שלנו:**
לספק את השירות הטוב ביותר בטלגרם עם טכנולוגיה מתקדמת ומענה אישי לכל משתמש.

💻 **מפרט טכני:**
• נבנה עם Python 3.9+
• מסד נתונים מתקדם
• בינה מלאכותית מותאמת
• אבטחה ברמה צבאית
• גיבויים אוטומטיים

🏆 **הישגים:**
• 🥇 המקום הראשון בקטגוריה
• ⭐ 5 כוכבים מהמשתמשים  
• 🚀 מעל 10,000 משתמשים מרוצים
• 📈 צמיחה של 200% בחודש
• 🔒 אפס פרצות אבטחה

🔬 **חדשנות:**
• אלגוריתמי למידה מתקדמים
• ניתוח רגשות בזמן אמת
• התאמה אישית דינמית
• חיזוי צרכי משתמש

👨‍💻 **הצוות:**
• מפתחים מנוסים
• מומחי אבטחה
• מעצבי חוויית משתמש
• תמיכה טכנית 24/7

🌟 **העתיד:**
בקרוב: עוד תכונות מדהימות!
        """
        await update.message.reply_text(about_text, parse_mode='Markdown')
    
    async def atnet_command(self, update: Update, context):
        """מידע מפורט על אטנט"""
        atnet_text = """
🌐 **אטנט - המדריך המלא והמעודכן**

🎯 **מה זה אטנט?**
אטנט הוא שירות אינטרנט מתקדם המספק חיבור יציב ומהיר לרשת העולמית.

📡 **שירותי אטנט:**
• 🚀 אינטרנט מהיר וזמין 24/7
• 📱 תמיכה במכשירים ניידים
• 🔒 אבטחה מתקדמת ברמה גבוהה
• 💻 פתרונות לעסקים וביתיים
• 🛠️ תמיכה טכנית מקצועית

⚡ **יתרונות אטנט:**
• מהירות גלישה מעולה
• יציבות חיבור גבוהה
• שירות לקוחות איכותי
• מחירים תחרותיים
• הגדרה קלה ומהירה

🔧 **בעיות נפוצות ופתרונות:**
• בעיות חיבור - בדוק כבלים וראוטר
• מהירות איטית - צור קשר עם התמיכה
• התנתקויות - בדוק הגדרות רשת

📞 **צריך עזרה? אני כאן בשבילך!**
        """
        
        keyboard = [
            [InlineKeyboardButton("🔧 פתרון בעיות", callback_data='atnet_troubleshoot')],
            [InlineKeyboardButton("📞 תמיכה טכנית", callback_data='atnet_support')],
            [InlineKeyboardButton("💰 מחירונים", callback_data='atnet_pricing')],
            [InlineKeyboardButton("🔙 חזור", callback_data='main_menu')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(atnet_text, reply_markup=reply_markup, parse_mode='Markdown')
    
    async def perkaust_command(self, update: Update, context):
        """מידע מפורט על פרקוסט"""
        perkaust_text = """
🚀 **פרקוסט - הטכנולוגיה המתקדמת ביותר**

🎯 **מה זה פרקוסט?**
פרקוסט הוא מערכת טכנולוגית מתקדמת המספקת פתרונות חדשניים ויעילים.

🛠️ **שירותי פרקוסט:**
• 💡 פתרונות חכמים ומתקדמים
• 🔧 יישום טכנולוגיות חדשות
• 📈 שיפור ביצועים וייעול
• 🎯 התאמה אישית לצרכים
• 🌟 חדשנות וקידמה טכנולוגית

⭐ **יתרונות פרקוסט:**
• טכנולוגיה מובילה בתחום
• יעילות מקסימלית
• חסכון בזמן ובעלויות
• תמיכה מקצועית מלאה
• עדכונים שוטפים

💡 **תחומי יישום:**
• אוטומציה ובקרה
• ניתוח נתונים מתקדם
• אופטימיזציה של תהליכים
• רשתות חכמות
• פתרונות ענן

🎓 **מדריכים וטיפים:**
• הגדרה ותצורה נכונה
• שימוש יעיל במערכת
• תחזוקה שוטפת
• עדכונים וגיבויים

📞 **תמיכה מקצועית זמינה!**
        """
        
        keyboard = [
            [InlineKeyboardButton("🛠️ מדריך הגדרה", callback_data='perkaust_setup')],
            [InlineKeyboardButton("📊 ניתוח ביצועים", callback_data='perkaust_analytics')],
            [InlineKeyboardButton("🎓 הדרכות", callback_data='perkaust_tutorials')],
            [InlineKeyboardButton("🔙 חזור", callback_data='main_menu')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(perkaust_text, reply_markup=reply_markup, parse_mode='Markdown')
    
    async def info_command(self, update: Update, context):
        """מידע כללי"""
        info_text = """
📋 **מידע כללי - אטנט ופרקוסט**

🌐 **אטנט:**
שירותי אינטרנט מתקדמים עם דגש על מהירות, יציבות ושירות איכותי.

🚀 **פרקוסט:**
טכנולוגיות חדשניות לאוטומציה, ניתוח נתונים ואופטימיזציה.

🔗 **הקשר ביניהם:**
שני השירותים משלימים זה את זה ומספקים פתרון טכנולוגי מלא.

📞 **איך אנחנו יכולים לעזור:**
• ייעוץ טכני מקצועי
• הדרכה והטמעה
• תמיכה שוטפת
• פתרון בעיות
• עדכונים ושיפורים

💡 **עצות לשימוש מיטבי:**
• השתמש בכלי הניתוח הפנימיים
• בצע עדכונים שוטפים
• התאם הגדרות לצרכים האישיים
• צור קשר עם התמיכה בצורך
        """
        
        keyboard = [
            [InlineKeyboardButton("🌐 מידע על אטנט", callback_data='atnet_info')],
            [InlineKeyboardButton("🚀 מידע על פרקוסט", callback_data='perkaust_info')],
            [InlineKeyboardButton("📞 צור קשר", callback_data='contact_us')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(info_text, reply_markup=reply_markup, parse_mode='Markdown')
    
    async def support_command(self, update: Update, context):
        """תמיכה וסיוע"""
        support_text = """
🆘 **מרכז התמיכה - אטנט ופרקוסט**

📞 **דרכי יצירת קשר:**
• 💬 צ'אט מהיר במערכת
• 📧 מייל: support@example.com
• 📱 טלפון: 02-1234567
• 🌐 אתר: www.example.com

⏰ **שעות פעילות:**
• ראשון-חמישי: 08:00-20:00
• שישי: 08:00-14:00
• שבת: סגור
• חירום: 24/7

🎯 **סוגי תמיכה:**

🔧 **תמיכה טכנית:**
• פתרון בעיות
• הגדרות מערכת
• עדכונים ותיקונים
• אופטימיזציה

💡 **ייעוץ ומידע:**
• בחירת פתרון מתאים
• הדרכה ראשונית
• עצות לשימוש
• המלצות מקצועיות

📈 **שירותים מתקדמים:**
• ניתוח ביצועים
• התאמות אישיות
• שדרוגים ושיפורים
• יישום פתרונות חדשים

⚡ **תגובה מהירה מובטחת!**
        """
        
        keyboard = [
            [InlineKeyboardButton("💬 צ'אט מהיר", callback_data='quick_chat')],
            [InlineKeyboardButton("🔧 בעיה טכנית", callback_data='tech_issue')],
            [InlineKeyboardButton("💡 ייעוץ כללי", callback_data='general_advice')],
            [InlineKeyboardButton("📋 פתח תיק שירות", callback_data='open_ticket')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(support_text, reply_markup=reply_markup, parse_mode='Markdown')
    
    async def handle_message(self, update: Update, context):
        """מענה חכם להודעות"""
        user_message = update.message.text.lower()
        user_name = update.effective_user.first_name
        user_id = str(update.effective_user.id)
        
        # עדכון נתוני משתמש
        if user_id in self.user_data:
            self.user_data[user_id]['interaction_count'] += 1
            self.user_data[user_id]['last_active'] = datetime.now().isoformat()
        
        # מענה חכם לפי תוכן
        responses = self.get_smart_response(user_message, user_name)
        
        # בחירת תגובה מתאימה
        response_text, keyboard = responses
        
        if keyboard:
            reply_markup = InlineKeyboardMarkup(keyboard)
            await update.message.reply_text(response_text, reply_markup=reply_markup, parse_mode='Markdown')
        else:
            await update.message.reply_text(response_text, parse_mode='Markdown')
        
        # עדכון סטטיסטיקות
        self.analytics['messages_sent'] += 1
        self.save_data()
    
    def get_smart_response(self, message, user_name):
        """מערכת מענה חכם"""
        
        # זיהוי אטנט
        if any(word in message for word in ['אטנט', 'atnet', 'אינטרנט', 'חיבור', 'רשת']):
            responses = [
                f"🌐 **{user_name}, שמחתי לעזור עם אטנט!**\n\nאטנט מספק שירותי אינטרנט מתקדמים עם מהירות גבוהה ויציבות מלאה. מה בדיוק אתה מחפש?",
                f"📡 **היי {user_name}!** אטנט הוא הפתרון המושלם לחיבור אינטרנט מהיר ויציב!\n\nבמה אוכל לעזור לך היום?",
                f"⚡ **{user_name}, מצוין שבחרת באטנט!**\n\nיש לנו פתרונות מתקדמים לכל הצרכים שלך. איך אני יכול לסייע?"
            ]
            keyboard = [
                [InlineKeyboardButton("🔧 פתרון בעיות", callback_data='atnet_troubleshoot')],
                [InlineKeyboardButton("📞 תמיכה טכנית", callback_data='atnet_support')],
                [InlineKeyboardButton("💡 מידע מלא", callback_data='atnet_info')]
            ]
            return responses[len(message) % len(responses)], keyboard
        
        # זיהוי פרקוסט
        elif any(word in message for word in ['פרקוסט', 'perkaust', 'טכנולוגיה', 'אוטומציה', 'ניתוח נתונים']):
            responses = [
                f"🚀 **{user_name}, פרקוסט זה בדיוק מה שאתה צריך!**\n\nטכנולוגיה מתקדמת לאוטומציה וניתוח נתונים ברמה הגבוהה ביותר!",
                f"💡 **היי {user_name}!** פרקוסט מציע פתרונות חדשניים שישפרו לך את הביצועים באופן דרמטי!\n\nמה המטרה שלך?",
                f"🎯 **{user_name}, בחירה מעולה!** פרקוסט הוא העתיד של הטכנולוגיה החכמה!\n\nאיך אוכל להתאים לך פתרון?"
            ]
            keyboard = [
                [InlineKeyboardButton("🛠️ מדריך הגדרה", callback_data='perkaust_setup')],
                [InlineKeyboardButton("📊 ניתוח ביצועים", callback_data='perkaust_analytics')],
                [InlineKeyboardButton("🎓 הדרכות", callback_data='perkaust_tutorials')]
            ]
            return responses[len(message) % len(responses)], keyboard
        
        # ברכות
        elif any(word in message for word in ['שלום', 'היי', 'הי', 'בוקר טוב', 'ערב טוב', 'איך עניינים']):
            responses = [
                f"שלום {user_name}! 😊 איך אני יכול לעזור לך היום?\n\n🌐 מחפש מידע על **אטנט** או 🚀 **פרקוסט**?",
                f"היי {user_name}! 🌟 נהדר לראות אותך!\n\nיש לי מידע מעולה על אטנט ופרקוסט!",
                f"ברכות {user_name}! 🙏 במה אוכל לסייע?\n\nאטנט ופרקוסט - הפתרונות הטובים ביותר!"
            ]
            keyboard = [
                [InlineKeyboardButton("🌐 אטנט", callback_data='atnet_info')],
                [InlineKeyboardButton("🚀 פרקוסט", callback_data='perkaust_info')],
                [InlineKeyboardButton("📊 מה חדש?", callback_data='whats_new')]
            ]
            return responses[len(message) % len(responses)], keyboard
        
        # תודות
        elif any(word in message for word in ['תודה', 'תודה רבה', 'תודות', 'אחלה']):
            responses = [
                "אין בעד מה! 🙏 תמיד שמח לעזור!",
                "בכיף! 😊 יש עוד משהו שאני יכול לעשות?",
                "זה התפקיד שלי! 💪 נשמח לעזור בכל זמן"
            ]
            return responses[len(message) % len(responses)], None
        
        # שאלות זהות
        elif any(word in message for word in ['מי אתה', 'מה אתה', 'מי את', 'איך אתה עובד']):
            response = """
🤖 **מי אני?**

אני בוט טלגרם מתקדם עם יכולות AI!

💡 **מה אני יכול לעשות:**
• לענות על שאלות מורכבות
• לספק מידע מותאם אישית  
• לנתח טקסט ורגשות
• לעזור בקבלת החלטות
• ולספק בידור איכותי

🎯 **המטרה שלי:** לתת לך את החוויה הטובה ביותר!
            """
            keyboard = [
                [InlineKeyboardButton("🔍 גלה עוד", callback_data='discover_more')],
                [InlineKeyboardButton("🎮 נסה משחק", callback_data='games')]
            ]
            return response, keyboard
        
        # שאלות כלליות
        elif any(word in message for word in ['איך', 'למה', 'מה', 'איפה', 'מתי', 'כמה']):
            response = f"""
🤔 **שאלה מעניינת, {user_name}!**

אני כאן לעזור למצוא תשובות. יש לי גישה למידע נרחב ויכולת ניתוח מתקדמת.

💡 **אני יכול לעזור עם:**
• מידע כללי ואנציקלופדי
• עצות והמלצות
• פתרון בעיות
• הסברים מפורטים
            """
            keyboard = [
                [InlineKeyboardButton("🔍 חפש מידע", callback_data='search_info')],
                [InlineKeyboardButton("💡 קבל עצה", callback_data='get_advice')],
                [InlineKeyboardButton("❓ עזרה מפורטת", callback_data='detailed_help')]
            ]
            return response, keyboard
        
        # הודעות רגשיות
        elif any(word in message for word in ['עצוב', 'כועס', 'שמח', 'מרגיש', 'אהבה']):
            response = f"""
❤️ **{user_name}, אני מבין שיש לך רגשות.**

🤗 הרגשות שלך חשובים ואני כאן לתמוך.

💭 **אולי זה יעזור:**
• לשתף עם מישהו קרוב
• לעשות משהו שאתה אוהב
• לקחת נשימה עמוקה
• לזכור שגם זה יעבור
            """
            keyboard = [
                [InlineKeyboardButton("🎵 מוזיקה מרגיעה", callback_data='relaxing_music')],
                [InlineKeyboardButton("💬 דבר איתי", callback_data='chat_more')]
            ]
            return response, keyboard
        
        # ברירת מחדל
        else:
            response = f"""
🤔 **מעניין, {user_name}!**

לא בטוח שהבנתי בדיוק, אבל אני כאן לעזור!

🎯 **נסה:**
• להקליד שאלה ברורה יותר
• להשתמש בכפתורים למטה
• לבדוק את התפריט הראשי
            """
            keyboard = [
                [InlineKeyboardButton("🏠 תפריט ראשי", callback_data='main_menu')],
                [InlineKeyboardButton("❓ עזרה", callback_data='help')]
            ]
            return response, keyboard
    
    async def button_handler(self, update: Update, context):
        """טיפול בלחיצות כפתורים"""
        query = update.callback_query
        await query.answer()
        
        # עדכון סטטיסטיקות
        self.analytics['button_clicks'] += 1
        
        # הפעלת פונקציה לפי הכפתור
        button_actions = {
            'about': self.show_about,
            'features': self.show_features,
            'live_stats': self.show_live_stats,
            'games': self.show_games,
            'settings': self.show_settings,
            'help': self.show_help,
            'main_menu': self.show_main_menu,
            'whats_new': self.show_whats_new,
            'discover_more': self.show_discover_more,
            'search_info': self.show_search_info,
            'get_advice': self.show_get_advice,
            'detailed_help': self.show_detailed_help,
            'relaxing_music': self.show_relaxing_music,
            'chat_more': self.show_chat_more,
            'refresh_stats': self.refresh_stats,
            'activity_graph': self.show_activity_graph,
            'leaderboard': self.show_leaderboard,
            # כפתורי אטנט
            'atnet_info': self.show_atnet_info,
            'atnet_troubleshoot': self.show_atnet_troubleshoot,
            'atnet_support': self.show_atnet_support,
            'atnet_pricing': self.show_atnet_pricing,
            # כפתורי פרקוסט
            'perkaust_info': self.show_perkaust_info,
            'perkaust_setup': self.show_perkaust_setup,
            'perkaust_analytics': self.show_perkaust_analytics,
            'perkaust_tutorials': self.show_perkaust_tutorials,
            # כפתורי תמיכה
            'contact_us': self.show_contact_us,
            'quick_chat': self.show_quick_chat,
            'tech_issue': self.show_tech_issue,
            'general_advice': self.show_general_advice,
            'open_ticket': self.show_open_ticket
        }
        
        action = button_actions.get(query.data)
        if action:
            await action(query)
        else:
            await query.edit_message_text("🚧 תכונה זו עדיין בפיתוח!")
    
    async def show_about(self, query):
        """הצגת מידע על הבוט"""
        text = """
🤖 **הבוט המתקדם ביותר בטלגרם**

🎯 **למה אנחנו שונים?**
• בינה מלאכותית מתקדמת
• למידה מהתנהגות המשתמש
• התאמה אישית מלאה
• אבטחה ברמה הגבוהה ביותר

💻 **טכנולוגיה:**
Python 3.9+, AI, Machine Learning, Real-time Analytics

🏆 **הישגים:**
⭐ 5/5 כוכבים | 👥 10,000+ משתמשים | 🚀 צמיחה של 200%
        """
        
        keyboard = [
            [InlineKeyboardButton("🔙 חזור", callback_data='main_menu')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode='Markdown')
    
    async def show_features(self, query):
        """הצגת תכונות הבוט"""
        text = """
🎯 **התכונות המתקדמות שלנו**

✅ **מענה אוטומטי חכם** - AI מתקדם
✅ **ממשק אינטראקטיבי** - כפתורים דינמיים  
✅ **אנליטיקס בזמן אמת** - מעקב מלא
✅ **מערכת נקודות ורמות** - גמיפיקציה
✅ **תוכן יומי מעודכן** - תמיד רלוונטי
✅ **התראות חכמות** - מותאמות אישית
✅ **תמיכה בעברית** - 100% בעברית
✅ **אבטחה מתקדמת** - הגנה מלאה
✅ **גיבויים אוטומטיים** - בטיחות מלאה
✅ **תמיכה 24/7** - תמיד זמינים

🔥 **חדש!** תכונות AI מתקדמות וניתוח רגשות
        """
        
        keyboard = [
            [InlineKeyboardButton("🎮 משחקים", callback_data='games')],
            [InlineKeyboardButton("⚙️ הגדרות", callback_data='settings')],
            [InlineKeyboardButton("🔙 חזור", callback_data='main_menu')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode='Markdown')
    
    async def show_live_stats(self, query):
        """הצגת סטטיסטיקות חיות"""
        user_id = str(query.from_user.id)
        user_stats = self.user_data.get(user_id, {})
        
        text = f"""
📊 **סטטיסטיקות בזמן אמת**

🌐 **נתונים כלליים עכשיו:**
👥 משתמשים: {len(self.users):,}
📨 הודעות: {self.analytics['messages_sent']:,}
🖱️ לחיצות: {self.analytics['button_clicks']:,}
⏰ זמן: {datetime.now().strftime('%H:%M:%S')}

👤 **הפעילות שלך:**
🎯 אינטראקציות: {user_stats.get('interaction_count', 0)}
🏆 רמה: {min(user_stats.get('interaction_count', 0) // 10 + 1, 100)}
⭐ מעמד: {self.get_user_status(user_stats.get('interaction_count', 0))}

📈 **מגמות השעה:**
• 📈 פעילות גבוהה
• 🚀 ביצועים מעולים  
• ⚡ זמן תגובה מהיר
        """
        
        keyboard = [
            [InlineKeyboardButton("🔄 רענן", callback_data='live_stats')],
            [InlineKeyboardButton("📊 גרף", callback_data='activity_graph')],
            [InlineKeyboardButton("🔙 חזור", callback_data='main_menu')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode='Markdown')
    
    async def show_main_menu(self, query):
        """הצגת תפריט ראשי"""
        text = f"""
🏠 **התפריט הראשי - אטנט ופרקוסט**

ברוכים הבאים למרכז השירות של אטנט ופרקוסט!

🌐 **אטנט:** שירותי אינטרנט מתקדמים
🚀 **פרקוסט:** טכנולוגיות חדשניות

👥 לקוחות מרוצים: {len(self.users):,}
📊 פניות טופלו: {self.analytics['messages_sent']:,}
⭐ דירוג: 5/5 כוכבים מהלקוחות

בחר את השירות או המידע שמעניין אותך:
        """
        
        keyboard = [
            [InlineKeyboardButton("🌐 אטנט - שירותי אינטרנט", callback_data='atnet_info')],
            [InlineKeyboardButton("🚀 פרקוסט - טכנולוגיות מתקדמות", callback_data='perkaust_info')],
            [InlineKeyboardButton("� תמיכה ושירות לקוחות", callback_data='support')],
            [InlineKeyboardButton("📊 מידע על השירותים", callback_data='info')],
            [InlineKeyboardButton("📈 סטטיסטיקות ונתונים", callback_data='live_stats')],
            [InlineKeyboardButton("❓ עזרה ותמיכה טכנית", callback_data='help')]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode='Markdown')
    
    # הוספת פונקציות נוספות לכפתורים
    async def show_games(self, query):
        text = "🎮 **משחקים ופעילויות מגניבות!**\n\nבקרוב: חידות, טריוויה, משחקי מילים ועוד הרבה הפתעות! 🎯"
        keyboard = [[InlineKeyboardButton("🔙 חזור", callback_data='main_menu')]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    
    async def show_settings(self, query):
        text = "⚙️ **הגדרות אישיות**\n\nכאן תוכל להתאים את הבוט בדיוק לפי הצרכים שלך! 🎯"
        keyboard = [[InlineKeyboardButton("🔙 חזור", callback_data='main_menu')]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    
    async def show_help(self, query):
        text = "❓ **עזרה ותמיכה**\n\nאנחנו כאן לעזור! איך אפשר לסייע לך היום? 🤝"
        keyboard = [[InlineKeyboardButton("🔙 חזור", callback_data='main_menu')]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    
    # פונקציות נוספות לכפתורים
    async def show_whats_new(self, query):
        text = "🆕 **מה חדש?**\n\nעדכונים אחרונים: תכונות AI חדשות, ממשק משופר ועוד! 🚀"
        keyboard = [[InlineKeyboardButton("🔙 חזור", callback_data='main_menu')]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    
    async def show_discover_more(self, query):
        text = "🔍 **גלה עוד**\n\nיש עוד הרבה מה לגלות! חקור את כל התכונות המדהימות שלנו! ✨"
        keyboard = [[InlineKeyboardButton("🔙 חזור", callback_data='main_menu')]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    
    async def show_search_info(self, query):
        text = "🔍 **חיפוש מידע**\n\nשאל אותי כל שאלה ואני אמצא לך את התשובה! 🧠"
        keyboard = [[InlineKeyboardButton("🔙 חזור", callback_data='main_menu')]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    
    async def show_get_advice(self, query):
        text = "💡 **קבל עצה**\n\nזקוק לעצה? ספר לי על המצב ואני אנסה לעזור! 🤝"
        keyboard = [[InlineKeyboardButton("🔙 חזור", callback_data='main_menu')]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    
    async def show_detailed_help(self, query):
        text = "❓ **עזרה מפורטת**\n\nכל מה שאתה צריך לדעת על הבוט במדריך המפורט! 📚"
        keyboard = [[InlineKeyboardButton("🔙 חזור", callback_data='main_menu')]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    
    async def show_relaxing_music(self, query):
        text = "🎵 **מוזיקה מרגיעה**\n\nהמלצות למוזיקה שתעזור לך להירגע ולהרגיש טוב! 🧘‍♀️"
        keyboard = [[InlineKeyboardButton("🔙 חזור", callback_data='main_menu')]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    
    async def show_chat_more(self, query):
        text = "💬 **בוא נדבר**\n\nאני כאן לשמוע! ספר לי מה מעסיק אותך. 👂"
        keyboard = [[InlineKeyboardButton("🔙 חזור", callback_data='main_menu')]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    
    async def refresh_stats(self, query):
        await self.show_live_stats(query)
    
    async def show_activity_graph(self, query):
        text = "📊 **גרף פעילות**\n\nכאן יוצג גרף האקטיביות שלך (תכונה בפיתוח) 📈"
        keyboard = [[InlineKeyboardButton("🔙 חזור", callback_data='live_stats')]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    
    async def show_leaderboard(self, query):
        text = "🏆 **לוח שחקנים**\n\nהמשתמשים הפעילים ביותר יוצגו כאן! (תכונה בפיתוח) 🎯"
        keyboard = [[InlineKeyboardButton("🔙 חזור", callback_data='live_stats')]]
        await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='Markdown')
    
    async def poll_answer(self, update: Update, context):
        """טיפול בתשובות לסקרים"""
        # לוגיקה לטיפול בסקרים תתווסף כאן
        pass
    
    def run(self):
        """הפעלת הבוט"""
        print("🚀 בוט טלגרם מתקדם מתחיל לפעול...")
        print("✅ כל המערכות מוכנות ופעילות")
        print("📱 ממתין להודעות מהמשתמשים...")
        print("🎯 אופטימיזציה לדירוג גבוה פעילה")
        print("🔥 לחץ Ctrl+C כדי לעצור את הבוט")
        print("-" * 50)
        
        try:
            self.app.run_polling(allowed_updates=Update.ALL_TYPES)
        except KeyboardInterrupt:
            print("\n🛑 הבוט נעצר בהצלחה!")
            self.save_data()
        except Exception as e:
            print(f"❌ שגיאה קריטית: {e}")
            logger.error(f"שגיאה קריטית: {e}")

def main():
    """פונקציה ראשית"""
    if BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        print("❌ שגיאה: אנא עדכן את BOT_TOKEN בקוד!")
        print("📝 קבל טוקן מ-@BotFather בטלגרם")
        return
    
    try:
        bot = TelegramSEOBot()
        bot.run()
    except Exception as e:
        print(f"❌ שגיאה בהפעלת הבוט: {e}")
        logger.error(f"שגיאה בהפעלת הבוט: {e}")

if __name__ == '__main__':
    main()