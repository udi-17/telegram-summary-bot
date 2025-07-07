const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();

// --- הגדרות ראשוניות ---
const token = '7688500141:AAHqfWSYxf-z2pWULlWf1e4vHtsxN_au7do';

console.log('🚀 בוט משלוחים טוניס פיצה מתחיל...');
console.log('📱 מתחבר לטלגרם...');

const bot = new TelegramBot(token, { polling: true });

console.log('✅ התחברות לטלגרם הצליחה!');

// --- הגדרת מסד הנתונים ---
const db = new sqlite3.Database('./data.db', (err) => {
  if (err) {
    console.error('❌ שגיאה במסד נתונים:', err.message);
  } else {
    console.log('✅ התחברות למסד נתונים הצליחה!');
    initDatabase();
  }
});

// יצירת טבלאות
const initDatabase = () => {
    console.log('📊 יוצר טבלאות...');
    
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient TEXT NOT NULL,
        item TEXT NOT NULL,
        amount REAL NOT NULL,
        address TEXT,
        phone TEXT,
        timestamp TEXT NOT NULL
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    )`);
    
    console.log('✅ טבלאות מוכנות!');
};

// --- תפריט ראשי ---
const mainMenu = {
    reply_markup: {
        keyboard: [
            [{ text: 'שליחות חדשה' }, { text: 'סיכום יומי' }],
            [{ text: 'הוסף איש קשר' }, { text: 'רשימת קשרים' }],
            [{ text: 'עזרה' }]
        ],
        resize_keyboard: true
    }
};

// --- טיפול בהודעות ---
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    console.log(`📨 הודעה מ-${msg.from.first_name}: ${text}`);
    
    if (text === '/start' || text === 'התחלה') {
        bot.sendMessage(chatId, 
            `🍕 ברוך הבא לבוט משלוחים של טוניס פיצה! 🍕\n\n` +
            `👋 שלום ${msg.from.first_name}!\n\n` +
            `🚀 הבוט מוכן לעבודה! בחר מהתפריט:`,
            mainMenu
        );
    }
    
    else if (text === 'שליחות חדשה') {
        bot.sendMessage(chatId, 
            `📝 שליחות חדשה\n\n` +
            `שלח לי את הפרטים בפורמט:\n` +
            `נמען פריט סכום כתובת טלפון\n\n` +
            `דוגמה:\n` +
            `יוסי פיצה 50 תל אביב 050-1234567`
        );
    }
    
    else if (text === 'סיכום יומי') {
        generateDailySummary(chatId);
    }
    
    else if (text === 'הוסף איש קשר') {
        bot.sendMessage(chatId, 'שלח לי שם של איש קשר חדש:');
    }
    
    else if (text === 'רשימת קשרים') {
        showContacts(chatId);
    }
    
    else if (text === 'עזרה') {
        bot.sendMessage(chatId, 
            `🆘 עזרה - מדריך השימוש\n\n` +
            `🔹 שליחות חדשה - רישום משלוח\n` +
            `🔹 סיכום יומי - דוח של היום\n` +
            `🔹 הוסף איש קשר - לקוח חדש\n` +
            `🔹 רשימת קשרים - כל הלקוחות\n\n` +
            `💡 פורמט רישום משלוח:\n` +
            `נמען פריט סכום כתובת טלפון`
        );
    }
    
    // אם זה לא פקודה - נסה לזהות שליחות
    else if (text && !text.startsWith('/')) {
        handleDeliveryEntry(chatId, text);
    }
});

// רישום שליחות
const handleDeliveryEntry = (chatId, text) => {
    const parts = text.split(' ');
    
    if (parts.length >= 3) {
        const recipient = parts[0];
        const item = parts[1];
        const amount = parseFloat(parts[2]);
        const address = parts[3] || 'לא צוין';
        const phone = parts[4] || 'לא צוין';
        const timestamp = new Date().toISOString();
        
        if (isNaN(amount)) {
            bot.sendMessage(chatId, '❌ הסכום חייב להיות מספר');
            return;
        }
        
        db.run(`INSERT INTO transactions (recipient, item, amount, address, phone, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
            [recipient, item, amount, address, phone, timestamp],
            function(err) {
                if (err) {
                    bot.sendMessage(chatId, '❌ שגיאה בשמירה: ' + err.message);
                } else {
                    const israelTime = new Date().toLocaleString('he-IL', {
                        timeZone: 'Asia/Jerusalem'
                    });
                    
                    bot.sendMessage(chatId,
                        `✅ שליחות נרשמה בהצלחה!\n\n` +
                        `📝 מספר: #${this.lastID}\n` +
                        `👤 נמען: ${recipient}\n` +
                        `🛍️ פריט: ${item}\n` +
                        `💰 סכום: ${amount}₪\n` +
                        `🏠 כתובת: ${address}\n` +
                        `📞 טלפון: ${phone}\n` +
                        `🕐 זמן: ${israelTime}`,
                        mainMenu
                    );
                    
                    // הוסף ללקוחות אם לא קיים
                    db.run(`INSERT OR IGNORE INTO contacts (name) VALUES (?)`, [recipient]);
                }
            }
        );
    } else {
        bot.sendMessage(chatId, 
            `❌ פורמט שגוי\n\n` +
            `שלח: נמען פריט סכום כתובת טלפון\n` +
            `דוגמה: יוסי פיצה 50 תל_אביב 050-1234567`
        );
    }
};

// סיכום יומי
const generateDailySummary = (chatId) => {
    const today = new Date().toISOString().split('T')[0];
    
    db.all(`SELECT * FROM transactions WHERE DATE(timestamp) = ?`, [today], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, '❌ שגיאה בקריאת נתונים');
            return;
        }
        
        if (rows.length === 0) {
            bot.sendMessage(chatId, '📊 אין שליחויות היום');
            return;
        }
        
        let summary = `📊 סיכום יומי - ${new Date().toLocaleDateString('he-IL')}\n\n`;
        let total = 0;
        
        rows.forEach((row, index) => {
            summary += `${index + 1}. ${row.recipient} - ${row.item} - ${row.amount}₪\n`;
            total += row.amount;
        });
        
        summary += `\n💰 סה"כ: ${total}₪\n`;
        summary += `📦 כמות משלוחים: ${rows.length}`;
        
        bot.sendMessage(chatId, summary);
    });
};

// הצגת קשרים
const showContacts = (chatId) => {
    db.all(`SELECT name FROM contacts ORDER BY name`, (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, '❌ שגיאה בקריאת קשרים');
            return;
        }
        
        if (rows.length === 0) {
            bot.sendMessage(chatId, '📋 אין קשרים שמורים');
            return;
        }
        
        let contacts = '📋 רשימת קשרים:\n\n';
        rows.forEach((row, index) => {
            contacts += `${index + 1}. ${row.name}\n`;
        });
        
        bot.sendMessage(chatId, contacts);
    });
};

// טיפול בשגיאות
bot.on('polling_error', (error) => {
    console.log('⚠️ שגיאת polling:', error.code);
});

bot.on('error', (error) => {
    console.log('❌ שגיאה כללית:', error.message);
});

console.log('🎉 בוט טוניס פיצה מוכן לעבודה!');
console.log('📱 חפש בטלגרם: @Udi177_bot');
console.log('💬 שלח "התחלה" כדי להתחיל');