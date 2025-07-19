# בוט טלגרם עם מסך פתיחה

בוט טלגרם פשוט עם מסך פתיחה שכולל תמונה וכפתור שמפנה למשתמש אחר.

## תכונות

- 🎨 מסך פתיחה מעוצב עם תמונה
- 🔘 כפתור שמפנה ישירות למשתמש אחר
- 📝 תמיכה מלאה בעברית
- 🔧 הגדרות פשוטות דרך משתנים סביבתיים
- 📊 לוגים מפורטים

## התקנה

### 1. שכפול הפרויקט
```bash
git clone <repository-url>
cd telegram-bot
```

### 2. התקנת תלויות
```bash
pip install -r requirements.txt
```

### 3. הגדרת הבוט

#### יצירת בוט חדש בטלגרם:
1. פתח שיחה עם [@BotFather](https://t.me/botfather)
2. שלח את הפקודה `/newbot`
3. בחר שם לבוט שלך
4. בחר username לבוט (חייב להסתיים ב-bot)
5. שמור את הטוקן שתקבל

#### הגדרת משתנים סביבתיים:
1. צור קובץ `.env` על בסיס `.env.example`:
```bash
cp .env.example .env
```

2. ערוך את קובץ `.env` והכנס את הפרטים שלך:
```env
BOT_TOKEN=הטוקן_שקיבלת_מ_BotFather
TARGET_USER=@username_של_המשתמש_להפניה
IMAGE_PATH=welcome.jpg
```

### 4. הוספת תמונת פתיחה
הוסף קובץ תמונה בשם `welcome.jpg` לתיקיית הפרויקט (או שנה את הנתיב ב-.env)

## הפעלה

### גרסה בסיסית:
```bash
python bot.py
```

### גרסה עם משתנים סביבתיים:
```bash
python bot_with_env.py
```

## שימוש

### פקודות הבוט:
- `/start` - הצגת מסך הפתיחה עם התמונה והכפתור
- `/help` - הצגת מדריך שימוש
- `/about` - מידע על הבוט
- `/contact` - פרטי יצירת קשר

## מבנה הפרויקט

```
telegram-bot/
├── bot.py              # גרסה בסיסית של הבוט
├── bot_with_env.py     # גרסה מתקדמת עם משתנים סביבתיים
├── requirements.txt    # רשימת תלויות
├── .env.example       # דוגמה למשתנים סביבתיים
├── .env              # משתנים סביבתיים (לא נכלל ב-git)
├── welcome.jpg       # תמונת הפתיחה
└── README.md         # קובץ זה
```

## התאמה אישית

### שינוי הודעת הפתיחה:
ערוך את המשתנה `welcome_message` בפונקציה `start()`:
```python
welcome_message = """
🎉 **ברוכים הבאים!**

הטקסט שלך כאן...
"""
```

### הוספת כפתורים נוספים:
```python
keyboard = [
    [InlineKeyboardButton("כפתור 1", url="https://example.com")],
    [InlineKeyboardButton("כפתור 2", callback_data="action2")]
]
```

### שינוי התמונה:
1. הוסף תמונה חדשה לתיקייה
2. עדכן את `IMAGE_PATH` בקובץ `.env`

## בעיות נפוצות

### הבוט לא מגיב:
- וודא שהטוקן נכון
- בדוק שהבוט רץ (אמור להופיע "הבוט מתחיל לרוץ..." בקונסול)
- וודא שאין בוט אחר שרץ עם אותו טוקן

### התמונה לא נשלחת:
- בדוק שהקובץ קיים בנתיב הנכון
- וודא שהקובץ הוא תמונה תקינה (jpg, png וכו')
- בדוק את גודל הקובץ (מקסימום 10MB)

### שגיאות בעברית:
- וודא שהקובץ נשמר ב-UTF-8
- השתמש ב-parse_mode='Markdown' לעיצוב טקסט

## רישיון

פרויקט זה נוצר למטרות לימוד וניתן לשימוש חופשי.

## תמיכה

לשאלות ובעיות, צור קשר דרך הבוט או פתח issue ב-GitHub.