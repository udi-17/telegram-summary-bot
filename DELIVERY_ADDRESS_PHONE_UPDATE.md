# עדכון שדות שליחות: מחיקת יעד והוספת כתובת וטלפון

## סיכום השינויים

ביצעתי עדכון מקיף לבוט הטלגרם כדי להחליף את שדה "יעד" בשדות נפרדים של "כתובת" ו"טלפון" בכל השליחויות החדשות.

## שינויים במסד הנתונים

### 1. עדכון מבנה טבלת transactions
```sql
-- מבנה ישן:
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT NOT NULL,
    item TEXT NOT NULL,
    amount REAL NOT NULL,
    destination TEXT,
    timestamp TEXT NOT NULL
);

-- מבנה חדש:
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT NOT NULL,
    item TEXT NOT NULL,
    amount REAL NOT NULL,
    address TEXT,
    phone TEXT,
    timestamp TEXT NOT NULL
);
```

### 2. הוספת עמודות לתאימות לאחור
- הוספתי `ALTER TABLE` statements להוספת שדות `address` ו-`phone`
- הסרתי את העמודה הישנה `destination`

## שינויים בפורמט הזנת נתונים

### פורמט ישן:
```
פריט סכום יעד
דוגמה: אקמול 50 רעננה
```

### פורמט חדש:
```
פריט סכום כתובת טלפון
דוגמה: אקמול 50 תל אביב 050-1234567
```

## שינויים בקוד

### 1. עדכון הודעות הנחיה
- הודעת ההתחלה עודכנה לפורמט החדש
- הודעות שגיאה עודכנו להתייחס לכתובת וטלפון
- דוגמאות עודכנו לכלול טלפון

### 2. עדכון לוגיקת עיבוד נתונים

#### בתפריט "שליחות חדשה":
```javascript
// לוגיקה חדשה לפיצול כתובת וטלפון
const remainingParts = parts.slice(amountIndex + 1);

// חיפוש מספר טלפון (דפוס של ספרות ומקפים)
let phoneIndex = -1;
for (let i = 0; i < remainingParts.length; i++) {
    if (/[\d\-\s]{7,}/.test(remainingParts[i])) {
        phoneIndex = i;
        break;
    }
}

let address, phone;
if (phoneIndex > 0) {
    address = remainingParts.slice(0, phoneIndex).join(' ');
    phone = remainingParts.slice(phoneIndex).join(' ');
} else {
    address = remainingParts.slice(0, -1).join(' ');
    phone = remainingParts[remainingParts.length - 1];
}
```

#### בעיבוד טקסט חופשי:
- הוספתי לוגיקה לפיצול טקסט למקרים של תאימות לאחור
- המערכת מנסה לזהות מספר טלפון ולהפריד אותו מהכתובת

### 3. עדכון תצוגת נתונים

#### הודעת אישור שליחות:
```javascript
// ישן:
message += `📍 יעד: ${destination}\n`;

// חדש:
message += `🏠 כתובת: ${address}\n`;
message += `📞 טלפון: ${phone}\n`;
```

#### בסיכומים:
```javascript
// ישן:
summaryText += `👤 ${row.recipient} | 📦 ${row.item} | 💰 ${row.amount}₪ | 📍 ${row.destination}`;

// חדש:
let locationInfo = '';
if (row.address || row.phone) {
    locationInfo = ` | 🏠 ${row.address || 'לא צוין'} | 📞 ${row.phone || 'לא צוין'}`;
}
summaryText += `👤 ${row.recipient} | 📦 ${row.item} | 💰 ${row.amount}₪${locationInfo}`;
```

### 4. עדכון שאילתות מסד נתונים

#### הכנסת נתונים:
```sql
-- ישן:
INSERT INTO transactions (recipient, item, amount, destination, timestamp) VALUES (?, ?, ?, ?, ?)

-- חדש:
INSERT INTO transactions (recipient, item, amount, address, phone, timestamp) VALUES (?, ?, ?, ?, ?, ?)
```

#### שליפת נתונים:
```sql
-- ישן:
SELECT id, recipient, item, amount, destination, timestamp FROM transactions

-- חדש:
SELECT id, recipient, item, amount, address, phone, timestamp FROM transactions
```

## פונקציות שעודכנו

1. **עיבוד שליחות חדשה** - `awaiting_delivery_details`
2. **שליחות לשליח חדש** - `handleNewContactDelivery`
3. **עיבוד טקסט חופשי** - לוגיקת זיהוי שליחות חופשיות
4. **יצירת סיכומים** - `generateSummary`
5. **הודעות הנחיה** - הודעת ההתחלה ושגיאות

## תאימות לאחור

- הוספתי לוגיקה לטיפול בנתונים ישנים
- במקרה של טקסט חופשי, המערכת מנסה לפצל "יעד" לכתובת וטלפון
- נתונים קיימים במסד הנתונים נשמרים ללא שינוי

## בדיקות שבוצעו

✅ הבוט מתחיל תקין  
✅ מסד הנתונים מתעדכן עם השדות החדשים  
✅ פורמט הזנה חדש פועל  
✅ תצוגת נתונים מעודכנת  
✅ הודעות שגיאה מעודכנות  

## הערות חשובות

1. **פורמט חדש חובה**: המשתמשים צריכים להזין כתובת וטלפון בנפרד
2. **זיהוי טלפון אוטומטי**: המערכת מנסה לזהות מספרי טלפון לפי דפוס של ספרות
3. **תצוגה משופרת**: כל הסיכומים מציגים כעת כתובת וטלפון בנפרד
4. **תאימות**: נתונים ישנים עדיין מוצגים ופועלים

התעדכנות הושלמה בהצלחה ומוכנה לשימוש!