// בדיקת מערכת שליחה לאנשי קשר מתוך המאגר הקיים
const sqlite3 = require('sqlite3').verbose();

console.log('🧪 בדיקת מערכת שליחה לאנשי קשר');
console.log('='.repeat(60));

// חיבור למסד הנתונים
const db = new sqlite3.Database('./data.db');

// הוספת אנשי קשר לדוגמה
function addSampleContacts() {
    return new Promise((resolve, reject) => {
        const sampleContacts = [
            { name: 'דני שליח', chat_id: 123456789 },
            { name: 'שרה מנהלת', chat_id: 987654321 },
            { name: 'יוסי נהג', chat_id: null }, // ללא chat_id - לא פתח שיחה עם הבוט
        ];
        
        let completed = 0;
        sampleContacts.forEach(contact => {
            db.run(`INSERT OR IGNORE INTO contacts (name, chat_id) VALUES (?, ?)`, 
                [contact.name, contact.chat_id], 
                function(err) {
                    if (err) {
                        console.error(`שגיאה בהוספת ${contact.name}:`, err.message);
                    } else {
                        console.log(`✅ איש קשר נוסף: ${contact.name} ${contact.chat_id ? '(פעיל)' : '(לא פעיל)'}`);
                    }
                    completed++;
                    if (completed === sampleContacts.length) {
                        resolve();
                    }
                });
        });
    });
}

// בדיקת אנשי קשר במערכת
function checkContacts() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM contacts ORDER BY name`, (err, contacts) => {
            if (err) {
                console.error('שגיאה בשליפת אנשי קשר:', err.message);
                reject(err);
            } else {
                console.log('\n📋 רשימת אנשי קשר במערכת:');
                if (contacts.length === 0) {
                    console.log('❌ אין אנשי קשר במערכת');
                } else {
                    contacts.forEach((contact, index) => {
                        const status = contact.chat_id ? '🟢 פעיל' : '🔴 לא פעיל';
                        console.log(`${index + 1}. 👤 ${contact.name} ${status} ${contact.chat_id ? `(ID: ${contact.chat_id})` : ''}`);
                    });
                }
                resolve(contacts);
            }
        });
    });
}

// הדגמת תהליך השליחה המעודכן
function demonstrateUpdatedProcess() {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 תהליך שליחה מעודכן - שימוש באנשי קשר קיימים');
    console.log('='.repeat(60));
    
    const steps = [
        '1️⃣ המשתמש מפעיל "חילוץ חכם"',
        '2️⃣ המשתמש מעתיק הודעה מלקוח',
        '3️⃣ המערכת מחלצת נתונים אוטומטית',
        '4️⃣ המשתמש בוחר "✅ כן, שמור"',
        '5️⃣ השליחות נשמרת במסד הנתונים',
        '6️⃣ המערכת מציגה: "📨 רוצה לשלוח לאיש קשר?"',
        '7️⃣ המשתמש לוחץ "📨 שלח לאיש קשר"',
        '8️⃣ המערכת מציגה רשימת אנשי קשר מהמאגר הקיים',
        '9️⃣ המשתמש בוחר איש קשר מהרשימה',
        '🔟 המערכת בודקת אם לאיש הקשר יש chat_id',
        '1️⃣1️⃣ אם כן - שולחת הודעה, אם לא - מציגה הודעת שגיאה',
        '1️⃣2️⃣ המשתמש מקבל אישור או אפשרות לנסות איש קשר אחר'
    ];
    
    steps.forEach(step => {
        console.log(`   ${step}`);
    });
}

// הדגמת סטטוסים שונים של אנשי קשר
function demonstrateContactStatuses() {
    console.log('\n📊 סטטוסים אפשריים של אנשי קשר:');
    console.log('-'.repeat(50));
    
    console.log('🟢 **איש קשר פעיל** (יש chat_id):');
    console.log('   • פתח שיחה עם הבוט');
    console.log('   • יכול לקבל הודעות');
    console.log('   • השליחה תעבור בהצלחה');
    
    console.log('\n🔴 **איש קשר לא פעיל** (אין chat_id):');
    console.log('   • לא פתח שיחה עם הבוט');
    console.log('   • לא יכול לקבל הודעות');
    console.log('   • המערכת תציג הודעת שגיאה');
    console.log('   • יינתן אפשרות לבחור איש קשר אחר');
}

// יתרונות המערכת החדשה
function showNewSystemBenefits() {
    console.log('\n💡 יתרונות המערכת החדשה:');
    console.log('✅ **שימוש במאגר קיים** - לא צריך ליצור רשימת שליחים נפרדת');
    console.log('✅ **פשטות** - כל איש קשר יכול להיות שליח פוטנציאלי');
    console.log('✅ **גמישות** - קל להוסיף אנשי קשר חדשים');
    console.log('✅ **אוטומציה** - עדכון אוטומטי של chat_id כשמישהו פותח שיחה');
    console.log('✅ **בקרה** - בדיקה אם איש הקשר יכול לקבל הודעות');
    console.log('✅ **חיסכון** - אין צורך בטבלה נפרדת לשליחים');
}

// דוגמה להודעה שאיש קשר יקבל
function showDeliveryMessage() {
    console.log('\n📨 דוגמה להודעה שאיש הקשר יקבל:');
    console.log('-'.repeat(40));
    
    const sampleMessage = `📦 שליחות חדשה - #456

👤 נמען: רונן כהן
🛍️ מוצר: שולחן
💰 סכום: 500₪
🏠 כתובת: תל אביב רחוב דיזנגוף 125
📞 טלפון: 050-1234567
📅 תאריך: יום שני, 23 בדצמבר 2024
🕐 שעה: 15:45:30

📨 נשלח אליך מהמערכת החכמה`;
    
    console.log(sampleMessage);
    console.log('-'.repeat(40));
}

// הדגמת תרחיש שגיאה
function demonstrateErrorScenario() {
    console.log('\n❌ תרחיש שגיאה - איש קשר לא פעיל:');
    console.log('-'.repeat(50));
    
    console.log('1. המשתמש בוחר "יוסי נהג" מהרשימה');
    console.log('2. המערכת מגלה שאין לו chat_id');
    console.log('3. הודעת שגיאה:');
    console.log('   "❌ לא ניתן לשלוח ל-יוסי נהג.');
    console.log('   איש הקשר לא פתח שיחה עם הבוט.');
    console.log('   כדי לקבל הודעות, יוסי נהג צריך לשלוח /start לבוט."');
    console.log('4. אפשרויות: "🔄 נסה איש קשר אחר" או "✅ סיום"');
}

// הרצת כל הבדיקות
async function runTests() {
    try {
        await addSampleContacts();
        await checkContacts();
        demonstrateUpdatedProcess();
        demonstrateContactStatuses();
        showNewSystemBenefits();
        showDeliveryMessage();
        demonstrateErrorScenario();
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 מערכת שליחה לאנשי קשר מוכנה!');
        console.log('='.repeat(60));
        console.log('📱 איך להשתמש:');
        console.log('1. הפעל "🤖 חילוץ חכם"');
        console.log('2. שלח הודעה מלקוח');
        console.log('3. אשר שמירה');
        console.log('4. לחץ "📨 שלח לאיש קשר"');
        console.log('5. בחר איש קשר מהמאגר הקיים');
        console.log('6. איש הקשר יקבל את כל הפרטים (אם הוא פעיל)!');
        
        console.log('\n🔧 הגדרה:');
        console.log('• אנשי קשר שרוצים לקבל הודעות צריכים לשלוח /start לבוט');
        console.log('• המערכת תעדכן אוטומטית את ה-chat_id שלהם');
        console.log('• לאחר מכן הם יוכלו לקבל הודעות שליחות');
        
    } catch (error) {
        console.error('שגיאה בבדיקות:', error.message);
    } finally {
        db.close();
    }
}

// הפעלת הבדיקות
runTests();