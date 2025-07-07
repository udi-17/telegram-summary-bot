# 🔑 מדריך החלפת טוקן הבוט

## שלב 1: קבלת טוקן מ-@BotFather

### 📱 פתח את הטלגרם וחפש את `@BotFather`

### 💬 שלח את הפקודות הבאות:
```
/newbot
```

### 📝 מלא את הפרטים:
1. **שם הבוט**: לדוגמה "הבוט המדהים שלי"
2. **שם משתמש**: חייב להסתיים ב-`bot` (לדוגמה: `amazing_bot`)

### 🎉 תקבל הודעה עם הטוקן:
```
Use this token to access the HTTP API:
1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

For a description of the Bot API, see this page:
https://core.telegram.org/bots/api
```

---

## שלב 2: החלפת הטוקן בקוד

### 📄 פתח את הקובץ `telegram_bot.py`

### 🔍 מצא את השורה הזו (שורה 28):
```python
BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"
```

### ✏️ החלף אותה עם הטוקן שלך:
```python
BOT_TOKEN = "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
```

### דוגמה מלאה:
```python
# 🔑 הגדרות בוט - עדכן את הטוקן כאן!
# החלף את "YOUR_BOT_TOKEN_HERE" עם הטוקן שקיבלת מ-@BotFather
# דוגמה: BOT_TOKEN = "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
BOT_TOKEN = "5678901234:XYZabcDEFghiJKLmnoPQRstUVW"

# ⚠️ זכור: אל תשתף את הטוקן עם אף אחד!
```

---

## שלב 3: שמירה והפעלה

### 💾 שמור את הקובץ
- לחץ `Ctrl+S` (Windows/Linux) או `Cmd+S` (Mac)

### 🚀 הפעל את הבוט:
```bash
python telegram_bot.py
```

### ✅ אישור שהבוט עובד:
אם הכל בסדר, תראה הודעה:
```
INFO - Bot started successfully! Username: @your_bot_name
```

---

## ⚠️ אזהרות אבטחה

### 🔒 אל תשתף את הטוקן:
- אל תפרסם אותו ברשתות חברתיות
- אל תשלח אותו בצ'אט
- אל תשמור אותו בקובץ פומבי

### 🔄 איפוס טוקן:
אם הטוקן נחשף, אפשר לאפס אותו:
1. חזור ל-@BotFather
2. שלח `/mybots`
3. בחר את הבוט שלך
4. לחץ על "API Token"
5. בחר "Revoke current token"

---

## 🔧 פתרון בעיות

### הודעת שגיאה: "401 Unauthorized"
- בדוק שהטוקן נוסח נכון
- וודא שאין רווחים בתחילת או סוף הטוקן

### הודעת שגיאה: "400 Bad Request"
- בדוק שהטוקן שלם (לא חסר חלק)
- וודא שהטוקן בפורמט הנכון

### הבוט לא מגיב:
- בדוק שהבוט רץ (`python telegram_bot.py`)
- וודא שהטוקן פעיל
- נסה להפעיל מחדש

---

## 📞 זקוק לעזרה?

1. **בדוק את הלוג**: יש קובץ `bot.log` שמראה שגיאות
2. **נסה מחדש**: הפעל מחדש את הבוט
3. **טוקן חדש**: צור בוט חדש אם הבעיה נמשכת

---

## 🎯 סיכום

✅ קבלת טוקן מ-@BotFather  
✅ החלפת הטוקן בקובץ `telegram_bot.py`  
✅ שמירת הקובץ  
✅ הפעלת הבוט  
✅ בדיקה שהבוט עובד  

**מזל טוב! הבוט שלך מוכן לפעולה! 🎉**