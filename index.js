const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const chrono = require('chrono-node');

// --- הגדרות ראשוניות ---
const token = process.env.TELEGRAM_BOT_TOKEN || '7268100196:AAFYa_ejke6SRkhLRlF-HodxIyLW5xrk02E';
const bot = new TelegramBot(token, { polling: true });

// --- הגדרת מסד הנתונים ---
const db = new sqlite3.Database('./data.db', (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
  console.log('Connected to the SQLite database.');

  // Initialize database schema and start services
  initializeDatabaseAndStartServices();
});

// יצירת טבלאות והפעלת שירותים
const initializeDatabaseAndStartServices = () => {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipient TEXT NOT NULL,
            item TEXT NOT NULL,
            amount REAL NOT NULL,
            destination TEXT,
            timestamp TEXT NOT NULL
        )`, (err) => {
            if (err) {
                console.error('Error creating transactions table:', err.message);
            }
        });
        
        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )`, (err) => {
            if (err) {
                console.error('Error creating contacts table:', err.message);
            }
        });
        
        db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
            chat_id INTEGER PRIMARY KEY,
            type TEXT NOT NULL
        )`, (err) => {
            if (err) {
                console.error('Error creating subscriptions table:', err.message);
            }
        });
        
        db.run(`CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_name TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            location TEXT,
            last_updated TEXT NOT NULL,
            created_at TEXT NOT NULL
        )`, (err) => {
            if (err) {
                console.error('Error creating inventory table:', err.message);
            } else {
                // הוספת עמודת location לטבלה קיימת אם צריך
                db.run(`ALTER TABLE inventory ADD COLUMN location TEXT`, (alterErr) => {
                    if (alterErr && !alterErr.message.includes('duplicate column')) {
                        console.error('Error adding location column:', alterErr.message);
                    }
                });
            }
        });

        // יצירת טבלת לקוחות
        db.run(`CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            phone TEXT,
            email TEXT,
            address TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            last_updated TEXT NOT NULL
        )`, (err) => {
            if (err) {
                console.error('Error creating customers table:', err.message);
            } else {
                console.log('Customers table ready.');
            }
        });

        // Add destination column for backwards compatibility - safe to run multiple times
        db.run('ALTER TABLE transactions ADD COLUMN destination TEXT', (err) => {
            if (err && err.message.includes('duplicate column name')) {
                // This is expected, ignore it.
            } else if (err) {
                console.error("Error altering table:", err.message);
            }
        });

        // הפעל את המשימות המתוזמנות רק לאחר שהטבלה נוצרה בוודאות
        scheduleTasks();

        console.log('Database tables are ready.');
    });
};

console.log('Bot has been started...');

// --- מעקב אחר מצב המשתמש ---
const userState = {};

// פונקציה לניקוי מצבי משתמש ישנים (למניעת דליפת זיכרון)
const cleanupUserStates = () => {
    const now = Date.now();
    Object.keys(userState).forEach(chatId => {
        const state = userState[chatId];
        if (state.timestamp && (now - state.timestamp) > 30 * 60 * 1000) { // 30 דקות
            delete userState[chatId];
        }
    });
};

// ניקוי מצבי משתמש כל 10 דקות
setInterval(cleanupUserStates, 10 * 60 * 1000);

// --- הגדרת מקלדת ראשית ---
const mainMenuKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: 'שליחות חדשה' }, { text: 'יומי' }],
            [{ text: 'שבועי' }, { text: 'חודשי' }],
            [{ text: 'אנשי קשר' }, { text: 'לקוחות' }],
            [{ text: 'ניהול מלאי' }, { text: 'התחלה' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};

// --- תפריטי משנה לסיכומים ---
const dailyMenuKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: 'היום' }, { text: 'אתמול' }],
            [{ text: 'שלשום' }],
            [{ text: 'בחירת תאריך...' }],
            [{ text: 'חזור' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    }
};

const weeklyMenuKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '7 הימים האחרונים' }],
            [{ text: 'השבוע הנוכחי' }, { text: 'השבוע שעבר' }],
            [{ text: 'חזור' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    }
};

const monthlyMenuKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: 'החודש הנוכחי' }, { text: 'החודש שעבר' }],
            [{ text: 'חזור' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    }
};

const hebrewMonths = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

// --- תפריט ניהול מלאי ---
const inventoryMenuKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: 'הוסף פריט למלאי' }, { text: 'הצג מלאי' }],
            [{ text: 'עדכן כמות' }, { text: 'מחק פריט' }],
            [{ text: 'חפש במלאי' }, { text: 'דו״ח מלאי' }],
            [{ text: 'חזור' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    }
};

// --- תפריט ניהול אנשי קשר ---
const contactsMenuKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: 'הוסף איש קשר חדש' }, { text: 'הצג אנשי קשר' }],
            [{ text: 'חפש איש קשר' }, { text: 'מחק איש קשר' }],
            [{ text: 'ייבא אנשי קשר' }, { text: 'ייצא אנשי קשר' }],
            [{ text: 'שליחות לאיש קשר חדש' }],
            [{ text: 'חזור' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    }
};

// --- תפריט ניהול לקוחות ---
const customersMenuKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: 'הוסף לקוח חדש' }, { text: 'חפש לקוח' }],
            [{ text: 'מחק לקוח' }, { text: 'עדכן פרטי לקוח' }],
            [{ text: 'שליחות ללקוח' }],
            [{ text: 'חזור' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    }
};

// --- טיפול בכפתורים (Callback Queries) ---
bot.on('callback_query', (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    // Answer callback query to stop loading spinner
    bot.answerCallbackQuery(callbackQuery.id).catch(err => {
        console.error('Error answering callback query:', err.message);
    });

    if (data === 'cancel_action') {
        bot.editMessageText("הפעולה בוטלה.", { chat_id: chatId, message_id: msg.message_id })
            .catch(err => console.error('Error editing message:', err.message));
        return;
    }

    if (data.startsWith('delete_contact:')) {
        const contactName = data.substring('delete_contact:'.length);

        db.run(`DELETE FROM contacts WHERE name = ?`, [contactName], function(err) {
            if (err) {
                bot.editMessageText("אירעה שגיאה במחיקת איש הקשר.", { chat_id: chatId, message_id: msg.message_id })
                    .catch(e => console.error('Error editing message:', e.message));
                console.error('Database error:', err.message);
                return;
            }
            const message = this.changes > 0 ? 
                `'${contactName}' נמחק בהצלחה מספר הכתובות.` :
                `'${contactName}' לא נמצא למחיקה.`;
            
            bot.editMessageText(message, { chat_id: chatId, message_id: msg.message_id })
                .catch(e => console.error('Error editing message:', e.message));
        });
        return;
    }

    if (data.startsWith('delete_inventory:')) {
        const itemName = data.substring('delete_inventory:'.length);

        db.run(`DELETE FROM inventory WHERE item_name = ?`, [itemName], function(err) {
            if (err) {
                bot.editMessageText("אירעה שגיאה במחיקת הפריט מהמלאי.", { chat_id: chatId, message_id: msg.message_id })
                    .catch(e => console.error('Error editing message:', e.message));
                console.error('Database error:', err.message);
                return;
            }
            const message = this.changes > 0 ? 
                `הפריט '${itemName}' נמחק בהצלחה מהמלאי.` :
                `הפריט '${itemName}' לא נמצא במלאי.`;
            
            bot.editMessageText(message, { chat_id: chatId, message_id: msg.message_id })
                .catch(e => console.error('Error editing message:', e.message));
        });
        return;
    }
    
    if (data.startsWith('new_delivery_recipient:')) {
        const recipientName = data.substring('new_delivery_recipient:'.length);
        bot.editMessageText(`נבחר: ${recipientName}.`, { chat_id: chatId, message_id: msg.message_id })
            .catch(err => console.error('Error editing message:', err.message));
        bot.sendMessage(chatId, "עכשיו שלח את פרטי השליחות, בפורמט: \nפריט סכום יעד")
            .catch(err => console.error('Error sending message:', err.message));
        
        userState[chatId] = {
            action: 'awaiting_delivery_details',
            recipient: recipientName,
            timestamp: Date.now()
        };
        return;
    }

    if (data.startsWith('customer_delivery:')) {
        const customerName = data.substring('customer_delivery:'.length);
        bot.editMessageText(`נבחר לקוח: ${customerName}.`, { chat_id: chatId, message_id: msg.message_id })
            .catch(err => console.error('Error editing message:', err.message));
        bot.sendMessage(chatId, "עכשיו שלח את פרטי השליחות, בפורמט: \nפריט סכום יעד")
            .catch(err => console.error('Error sending message:', err.message));
        
        userState[chatId] = {
            action: 'awaiting_delivery_details',
            recipient: customerName,
            timestamp: Date.now()
        };
        return;
    }

    if (data.startsWith('delete_customer:')) {
        const customerName = data.substring('delete_customer:'.length);

        db.run(`DELETE FROM customers WHERE name = ?`, [customerName], function(err) {
            if (err) {
                bot.editMessageText("אירעה שגיאה במחיקת הלקוח.", { chat_id: chatId, message_id: msg.message_id })
                    .catch(e => console.error('Error editing message:', e.message));
                console.error('Database error:', err.message);
                return;
            }
            const message = this.changes > 0 ? 
                `הלקוח '${customerName}' נמחק בהצלחה.` :
                `הלקוח '${customerName}' לא נמצא למחיקה.`;
            
            bot.editMessageText(message, { chat_id: chatId, message_id: msg.message_id })
                .catch(e => console.error('Error editing message:', e.message));
        });
        return;
    }
});

// --- טיפול בשגיאות בוט ---
bot.on('polling_error', (error) => {
    console.error(`Polling error: ${error.code} - ${error.message}`);
    if (error.code === 'EFATAL') {
        console.log('Fatal error detected, attempting to restart...');
        // כאן אפשר להוסיף לוגיקה של restart
    }
});

// טיפול בשגיאות לא מטופלות
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // נתן זמן לסיום פעולות לפני יציאה
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

// --- פונקציות עזר ---
const isValidNumber = (str) => {
    const num = parseFloat(str);
    return !isNaN(num) && isFinite(num) && num > 0;
};

const sanitizeInput = (input) => {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[\u200B-\u200F\uFEFF\u202A-\u202E]/g, '');
};

// פונקציה לפורמט זמן ישראלי
const formatIsraeliDateTime = (date, options = {}) => {
    const israelTime = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}));
    
    const defaultDateOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    
    const defaultTimeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    
    const dateOptions = options.dateFormat || defaultDateOptions;
    const timeOptions = options.timeFormat || defaultTimeOptions;
    
    return {
        date: israelTime.toLocaleDateString('he-IL', dateOptions),
        time: israelTime.toLocaleTimeString('he-IL', timeOptions),
        full: `${israelTime.toLocaleDateString('he-IL', dateOptions)} ${israelTime.toLocaleTimeString('he-IL', timeOptions)}`
    };
};

// --- מאזין הודעות ונתב פקודות ראשי ---
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  // בדיקה קריטית: ודא שההודעה היא טקסט לפני שממשיכים
  if (!msg.text) {
    console.log(`Received non-text message from chat ID ${chatId}. Ignoring.`);
    return;
  }
  
  // ניקוי תווים בלתי נראים (בעיקר מהקלדה קולית) לפני עיבוד
  const text = sanitizeInput(msg.text);
  
  if (!text) {
    console.log(`Received empty message from chat ID ${chatId}. Ignoring.`);
    return;
  }
  
  console.log(`Received message from chat ID ${chatId}: "${text}"`);
  
  // --- טיפול במצב המשתמש (לשליחות חדשה) ---
  const state = userState[chatId];
  if (state && state.action === 'awaiting_delivery_details') {
    const parts = text.split(/\s+/);
    let amountIndex = -1;
    // Find the first valid number to be the amount
    for (let i = 0; i < parts.length; i++) {
        if (isValidNumber(parts[i])) {
            amountIndex = i;
            break;
        }
    }

    // We need at least an item before the amount and a destination after
    if (amountIndex > 0 && amountIndex < parts.length - 1) {
        const item = parts.slice(0, amountIndex).join(' ');
        const amount = parseFloat(parts[amountIndex]);
        const destination = parts.slice(amountIndex + 1).join(' ');
        
        const recipient = state.recipient;
        const timestamp = new Date(); // Use current time for this flow

        db.run(`INSERT INTO transactions (recipient, item, amount, destination, timestamp) VALUES (?, ?, ?, ?, ?)`, 
            [recipient, item, amount, destination, timestamp.toISOString()], function(err) {
            if (err) {
                bot.sendMessage(chatId, "אירעה שגיאה בשמירת הנתונים.", mainMenuKeyboard)
                    .catch(e => console.error('Error sending message:', e.message));
                delete userState[chatId];
                return console.error('Database error:', err.message);
            }
            // המרה לזמן ישראלי
            const israelTime = new Date(timestamp.toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}));
            const dateStr = israelTime.toLocaleDateString('he-IL', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const timeStr = israelTime.toLocaleTimeString('he-IL', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            let message = `✅ שליחות נרשמה בהצלחה!\n\n`;
            message += `📝 מספר רישום: #${this.lastID}\n`;
            message += `👤 נמען: ${recipient}\n`;
            message += `📦 פריט: ${item}\n`;
            message += `💰 סכום: ${amount}₪\n`;
            message += `📍 יעד: ${destination}\n`;
            message += `📅 תאריך: ${dateStr}\n`;
            message += `🕐 שעה: ${timeStr}`;
            
            bot.sendMessage(chatId, message, mainMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            delete userState[chatId];
        });
    } else {
        bot.sendMessage(chatId, "הפורמט לא נכון. אנא שלח בפורמט: פריט סכום יעד (לדוגמה: אקמול 50 רעננה)", mainMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
    }
    return;
  }

  // --- טיפול במצב המשתמש (לניהול מלאי) ---
  if (state && state.action === 'awaiting_inventory_item') {
    handleInventoryItemAddition(chatId, text);
    return;
  }

  if (state && state.action === 'awaiting_quantity_update') {
    handleQuantityUpdate(chatId, text);
    return;
  }

  if (state && state.action === 'awaiting_search_query') {
    handleInventorySearch(chatId, text);
    return;
  }

  // --- טיפול במצב המשתמש (לניהול אנשי קשר) ---
  if (state && state.action === 'awaiting_new_contact') {
    handleNewContactAddition(chatId, text);
    return;
  }

  if (state && state.action === 'awaiting_contact_search') {
    handleContactSearch(chatId, text);
    return;
  }

  if (state && state.action === 'awaiting_contacts_import') {
    handleContactsImport(chatId, text);
    return;
  }

  if (state && state.action === 'awaiting_new_contact_delivery') {
    handleNewContactDelivery(chatId, text);
    return;
  }

  // --- טיפול במצב המשתמש (לניהול לקוחות) ---
  if (state && state.action === 'awaiting_new_customer') {
    handleNewCustomerAddition(chatId, text);
    return;
  }

  if (state && state.action === 'awaiting_customer_search') {
    handleCustomerSearch(chatId, text);
    return;
  }

  if (state && state.action === 'awaiting_customer_update') {
    handleCustomerUpdate(chatId, text);
    return;
  }
  
  // --- נתב פקודות ראשי ---
  let command = text.toLowerCase().trim();

  // נטפל בכפתור "חזור" על ידי המרתו לפקודת "התחלה"
  if (command === 'חזור') {
      command = 'התחלה';
  }

  if (command === 'התחלה') {
    console.log(`Executing 'התחלה' for chat ID: ${chatId}`);
    const response = "ברוך הבא לבוט הסיכומים וניהול המלאי! \n\n" +
      "כדי לתעד שליחה, פשוט כתוב:\n" +
      "שם הנמען שם הפריט סכום יעד [תאריך/שעה]\n" +
      "התאריך והיעד אופציונליים.\n\n" +
      "דוגמאות:\n" +
      "ישראל ישראלי שולחן 500 תל אביב\n" +
      "משה כהן כיסא 120 חיפה אתמול ב-19:30\n" +
      "דנה לוי מנורה 250 ראשון לציון 25/07/2024\n\n" +
      "הפקודות הזמינות:\n" +
      "יומי - סיכום להיום\n" +
      "יומי [שם] - סיכום יומי לאדם ספציפי\n" +
      "שבועי - סיכום ל-7 הימים האחרונים\n" +
      "שבועי [שם] - סיכום שבועי לאדם\n" +
      "חודשי - סיכום לחודש הנוכחי\n" +
      "חודשי [שם] - סיכום חודשי לאדם\n" +
      "מצא [שם] - כל הרשומות עבור אדם\n" +
      "סיכום [תאריך] [שם] - סיכום ליום ספציפי (אפשר גם בלי שם)\n\n" +
      "ניהול אנשי קשר:\n" +
      "אנשי קשר\nהוסף איש קשר [שם]\nמחק איש קשר\nשליחות חדשה\n\n" +
      "ניהול מלאי:\n" +
      "ניהול מלאי - תפריט ניהול המלאי\n" +
      "הוסף פריט למלאי\nהצג מלאי\nעדכן כמות\nחפש במלאי\nדו״ח מלאי\n\n" +
      "סיכומים אוטומטיים:\n" +
      "הרשמה\nביטול הרשמה";
    bot.sendMessage(chatId, response, mainMenuKeyboard)
        .catch(err => console.error('Error sending message:', err.message));

  // --- ניתוב לתפריטי משנה ---
  } else if (command === 'יומי') {
    const parts = text.split(/\s+/);
    if (parts.length > 1) {
        const recipientName = parts.slice(1).join(' ');
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        generateSummary(chatId, 'יומי', startOfDay, endOfDay, recipientName);
    } else {
        bot.sendMessage(chatId, "בחר סיכום יומי:", dailyMenuKeyboard)
            .catch(err => console.error('Error sending message:', err.message));
    }
  } else if (command === 'שבועי') {
    const parts = text.split(/\s+/);
    if (parts.length > 1) {
        const recipientName = parts.slice(1).join(' ');
        const today = new Date();
        const endOfPeriod = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        const startOfPeriod = new Date(today);
        startOfPeriod.setDate(today.getDate() - 6);
        startOfPeriod.setHours(0, 0, 0, 0);
        generateSummary(chatId, 'שבועי', startOfPeriod, endOfPeriod, recipientName);
    } else {
        const weekButtons = [];
        for (let i = 0; i < 4; i++) {
            const today = new Date();
            const startOfThisWeek = new Date(today.setDate(today.getDate() - today.getDay()));
            const startOfTargetWeek = new Date(startOfThisWeek.setDate(startOfThisWeek.getDate() - (i * 7)));
            const endOfTargetWeek = new Date(startOfTargetWeek);
            endOfTargetWeek.setDate(startOfTargetWeek.getDate() + 6);
            
            const startStr = `${startOfTargetWeek.getDate().toString().padStart(2, '0')}/${(startOfTargetWeek.getMonth() + 1).toString().padStart(2, '0')}`;
            const endStr = `${endOfTargetWeek.getDate().toString().padStart(2, '0')}/${(endOfTargetWeek.getMonth() + 1).toString().padStart(2, '0')}`;
            weekButtons.push([{ text: `שבוע ${startStr} - ${endStr}` }]);
        }
        weekButtons.push([{ text: 'חזור' }]);
        const weeklySelectionKeyboard = { reply_markup: { keyboard: weekButtons, resize_keyboard: true, one_time_keyboard: true } };
        bot.sendMessage(chatId, "בחר סיכום שבועי:", weeklySelectionKeyboard)
            .catch(err => console.error('Error sending message:', err.message));
    }
  } else if (command === 'חודשי') {
     const parts = text.split(/\s+/);
     if (parts.length > 1) {
        const recipientName = parts.slice(1).join(' ');
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
        generateSummary(chatId, 'חודשי', startOfMonth, endOfMonth, recipientName);
     } else {
        const monthButtons = [];
        for (let i = 0; i < 6; i++) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthName = hebrewMonths[d.getMonth()];
            const year = d.getFullYear();
            monthButtons.push([{ text: `${monthName} ${year}` }]);
        }
        monthButtons.push([{ text: 'חזור' }]);
        const monthlySelectionKeyboard = { reply_markup: { keyboard: monthButtons, resize_keyboard: true, one_time_keyboard: true } };
        bot.sendMessage(chatId, "בחר חודש לסיכום:", monthlySelectionKeyboard)
            .catch(err => console.error('Error sending message:', err.message));
     }
  } else if (command === 'היום') {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    generateSummary(chatId, 'היום', startOfDay, endOfDay);
  } else if (command === 'אתמול') {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
    const endOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
    generateSummary(chatId, 'אתמול', startOfDay, endOfDay);
  } else if (command === 'שלשום') {
    const today = new Date();
    const dayBefore = new Date(today);
    dayBefore.setDate(today.getDate() - 2);
    const startOfDay = new Date(dayBefore.getFullYear(), dayBefore.getMonth(), dayBefore.getDate(), 0, 0, 0);
    const endOfDay = new Date(dayBefore.getFullYear(), dayBefore.getMonth(), dayBefore.getDate(), 23, 59, 59);
    generateSummary(chatId, 'שלשום', startOfDay, endOfDay);
  } else if (command === 'בחירת תאריך...') {
    bot.sendMessage(chatId, "כדי לקבל סיכום לתאריך מסוים, כתוב את הפקודה:\n`סיכום [התאריך]`\n\nלדוגמה: `סיכום אתמול בערב` או `סיכום 25/08/2024 יוסי`", { ...mainMenuKeyboard, parse_mode: 'Markdown' })
        .catch(err => console.error('Error sending message:', err.message));
  
  } else if (command === '7 הימים האחרונים') {
    const today = new Date();
    const endOfPeriod = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    const startOfPeriod = new Date(today);
    startOfPeriod.setDate(today.getDate() - 6);
    startOfPeriod.setHours(0, 0, 0, 0);
    generateSummary(chatId, '7 הימים האחרונים', startOfPeriod, endOfPeriod);
  } else if (command === 'השבוע הנוכחי') {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    generateSummary(chatId, 'השבוע הנוכחי', startOfWeek, endOfWeek);
  } else if (command === 'השבוע שעבר') {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfLastWeek = new Date(today);
    startOfLastWeek.setDate(today.getDate() - dayOfWeek - 7);
    startOfLastWeek.setHours(0, 0, 0, 0);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
    endOfLastWeek.setHours(23, 59, 59, 999);
    generateSummary(chatId, 'השבוע שעבר', startOfLastWeek, endOfLastWeek);
  
  } else if (command === 'החודש הנוכחי') {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    generateSummary(chatId, 'החודש הנוכחי', startOfMonth, endOfMonth);
  } else if (command === 'החודש שעבר') {
    const today = new Date();
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1, 0, 0, 0);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
    generateSummary(chatId, 'החודש שעבר', startOfLastMonth, endOfLastMonth);

  } else if (command.startsWith('יומי ')) {
      const recipientName = command.substring('יומי '.length);
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      generateSummary(chatId, 'יומי', startOfDay, endOfDay, recipientName);
  } else if (command.startsWith('שבועי ')) {
      const recipientName = command.substring('שבועי '.length);
      const today = new Date();
      const endOfPeriod = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      const startOfPeriod = new Date(today);
      startOfPeriod.setDate(today.getDate() - 6);
      startOfPeriod.setHours(0, 0, 0, 0);
      generateSummary(chatId, 'שבועי', startOfPeriod, endOfPeriod, recipientName);
  } else if (command.startsWith('חודשי ')) {
      const recipientName = command.substring('חודשי '.length);
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
      generateSummary(chatId, 'חודשי', startOfMonth, endOfMonth, recipientName);
  } else if (command.startsWith('סיכום ')) {
    const content = command.substring('סיכום '.length).trim();
    
    if (!content) {
        bot.sendMessage(chatId, "לא צוין תאריך. נסה: 'סיכום אתמול' או 'סיכום 25/07/2024'")
            .catch(err => console.error('Error sending message:', err.message));
        return;
    }
    
    const parsedResult = chrono.parse(content, new Date(), { forwardDate: false });

    if (!parsedResult || parsedResult.length === 0) {
        bot.sendMessage(chatId, "לא הצלחתי להבין את התאריך מהפקודה. נסה פורמט אחר, למשל 'סיכום אתמול' או 'סיכום 25/07/2024'.")
            .catch(err => console.error('Error sending message:', err.message));
        return;
    }

    const parsedDate = parsedResult[0].start.date();
    const dateText = parsedResult[0].text;
    
    const recipientName = content.replace(dateText, '').trim();

    const startOfDay = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 0, 0, 0);
    const endOfDay = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 23, 59, 59);

    const dateForTitle = `${startOfDay.getDate().toString().padStart(2, '0')}/${(startOfDay.getMonth() + 1).toString().padStart(2, '0')}/${startOfDay.getFullYear()}`;

    generateSummary(chatId, `לתאריך ${dateForTitle}`, startOfDay, endOfDay, recipientName);

  } else if (command.startsWith('מצא ')) {
    const recipientName = command.substring('מצא '.length).trim();
    if (!recipientName) {
        bot.sendMessage(chatId, "יש לציין שם לחיפוש. למשל: מצא ישראל ישראלי")
            .catch(err => console.error('Error sending message:', err.message));
        return;
    }
    console.log(`Executing 'מצא' for '${recipientName}' from chat ID: ${chatId}`);
    
    const farPast = new Date(0); 
    const now = new Date();
    
    generateSummary(chatId, `כללי`, farPast, now, recipientName);

  } else if (command === 'אנשי קשר') {
    console.log(`Executing 'אנשי קשר' for chat ID: ${chatId}`);
    bot.sendMessage(chatId, "בחר פעולה לניהול אנשי הקשר:", contactsMenuKeyboard)
        .catch(err => console.error('Error sending message:', err.message));

  } else if (command === 'לקוחות') {
    console.log(`Executing 'לקוחות' for chat ID: ${chatId}`);
    bot.sendMessage(chatId, "בחר פעולה לניהול הלקוחות:", customersMenuKeyboard)
        .catch(err => console.error('Error sending message:', err.message));

  } else if (command === 'הוסף איש קשר חדש') {
    console.log(`Executing 'הוסף איש קשר חדש' for chat ID: ${chatId}`);
    bot.sendMessage(chatId, "שלח שם איש הקשר החדש:\n\nדוגמה: ישראל ישראלי")
        .catch(err => console.error('Error sending message:', err.message));
    
    userState[chatId] = {
        action: 'awaiting_new_contact',
        timestamp: Date.now()
    };

  } else if (command === 'הצג אנשי קשר') {
    console.log(`Executing 'הצג אנשי קשר' for chat ID: ${chatId}`);
    displayAllContacts(chatId);

  } else if (command === 'חפש איש קשר') {
    console.log(`Executing 'חפש איש קשר' for chat ID: ${chatId}`);
    bot.sendMessage(chatId, "שלח שם או חלק משם איש הקשר לחיפוש:")
        .catch(err => console.error('Error sending message:', err.message));
    
    userState[chatId] = {
        action: 'awaiting_contact_search',
        timestamp: Date.now()
    };

  } else if (command === 'ייבא אנשי קשר') {
    console.log(`Executing 'ייבא אנשי קשר' for chat ID: ${chatId}`);
    bot.sendMessage(chatId, "שלח רשימת אנשי קשר (שם אחד בכל שורה):\n\nדוגמה:\nישראל ישראלי\nמשה כהן\nדנה לוי")
        .catch(err => console.error('Error sending message:', err.message));
    
    userState[chatId] = {
        action: 'awaiting_contacts_import',
        timestamp: Date.now()
    };

  } else if (command === 'ייצא אנשי קשר') {
    console.log(`Executing 'ייצא אנשי קשר' for chat ID: ${chatId}`);
    exportContacts(chatId);

  } else if (command === 'מחק איש קשר') {
    console.log(`Executing 'מחק איש קשר' for chat ID: ${chatId}`);
    showContactsForDeletion(chatId);

  } else if (command === 'שליחות לאיש קשר חדש') {
    console.log(`Executing 'שליחות לאיש קשר חדש' for chat ID: ${chatId}`);
    bot.sendMessage(chatId, "שלח את שם איש הקשר החדש ופרטי השליחות בפורמט:\n\nשם איש הקשר פריט סכום יעד\n\nדוגמה: דוד כהן שולחן 500 תל אביב")
        .catch(err => console.error('Error sending message:', err.message));
    
    userState[chatId] = {
        action: 'awaiting_new_contact_delivery',
        timestamp: Date.now()
    };

  } else if (command.startsWith('הוסף איש קשר ')) {
    const name = command.substring('הוסף איש קשר '.length).trim();
    if (!name) {
        bot.sendMessage(chatId, "לא ציינת שם. נסה: הוסף איש קשר ישראל ישראלי", mainMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        return;
    }
    
    // וולידציה של השם
    if (name.length < 2) {
        bot.sendMessage(chatId, "השם קצר מדי. אנא הכנס שם תקין.", mainMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        return;
    }
    
    if (name.length > 100) {
        bot.sendMessage(chatId, "השם ארוך מדי. אנא הכנס שם קצר יותר.", mainMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        return;
    }
    
    console.log(`Executing 'הוסף איש קשר' for '${name}' from chat ID: ${chatId}`);
    db.run(`INSERT INTO contacts (name) VALUES (?)`, [name], function(err) {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
                bot.sendMessage(chatId, `איש הקשר '${name}' כבר קיים.`, mainMenuKeyboard)
                    .catch(e => console.error('Error sending message:', e.message));
            } else {
                bot.sendMessage(chatId, "אירעה שגיאה בהוספת איש הקשר.", mainMenuKeyboard)
                    .catch(e => console.error('Error sending message:', e.message));
                console.error('Database error:', err.message);
            }
            return;
        }
        bot.sendMessage(chatId, `איש הקשר '${name}' נוסף בהצלחה.`, mainMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
    });

  } else if (command === 'ניהול מלאי') {
    console.log(`Executing 'ניהול מלאי' for chat ID: ${chatId}`);
    bot.sendMessage(chatId, "בחר פעולה לניהול המלאי:", inventoryMenuKeyboard)
        .catch(err => console.error('Error sending message:', err.message));

  } else if (command === 'הוסף פריט למלאי') {
    console.log(`Executing 'הוסף פריט למלאי' for chat ID: ${chatId}`);
    bot.sendMessage(chatId, "שלח פרטי הפריט בפורמט:\nשם הפריט כמות [מיקום]\n\nדוגמה: שולחן 5 ישראל ישראלי\nאו: כיסא 10 מחסן ראשי")
        .catch(err => console.error('Error sending message:', err.message));
    
    userState[chatId] = {
        action: 'awaiting_inventory_item',
        timestamp: Date.now()
    };

  } else if (command === 'הצג מלאי') {
    console.log(`Executing 'הצג מלאי' for chat ID: ${chatId}`);
    displayInventory(chatId);

  } else if (command === 'עדכן כמות') {
    console.log(`Executing 'עדכן כמות' for chat ID: ${chatId}`);
    bot.sendMessage(chatId, "שלח שם הפריט והכמות החדשה:\nשם הפריט כמות חדשה\n\nדוגמה: שולחן 10")
        .catch(err => console.error('Error sending message:', err.message));
    
    userState[chatId] = {
        action: 'awaiting_quantity_update',
        timestamp: Date.now()
    };

  } else if (command === 'מחק פריט') {
    console.log(`Executing 'מחק פריט' for chat ID: ${chatId}`);
    showInventoryForDeletion(chatId);

  } else if (command === 'חפש במלאי') {
    console.log(`Executing 'חפש במלאי' for chat ID: ${chatId}`);
    bot.sendMessage(chatId, "שלח שם הפריט או חלק משמו לחיפוש:")
        .catch(err => console.error('Error sending message:', err.message));
    
    userState[chatId] = {
        action: 'awaiting_search_query',
        timestamp: Date.now()
    };

  } else if (command === 'דו״ח מלאי') {
    console.log(`Executing 'דו״ח מלאי' for chat ID: ${chatId}`);
    generateInventoryReport(chatId);

  // --- פקודות ניהול לקוחות ---
  } else if (command === 'הוסף לקוח חדש') {
    console.log(`Executing 'הוסף לקוח חדש' for chat ID: ${chatId}`);
    bot.sendMessage(chatId, "שלח פרטי הלקוח החדש בפורמט:\nשם [טלפון] [אימייל] [כתובת] [הערות]\n\nדוגמה: ישראל ישראלי 050-1234567 israel@email.com תל אביב לקוח VIP")
        .catch(err => console.error('Error sending message:', err.message));
    
    userState[chatId] = {
        action: 'awaiting_new_customer',
        timestamp: Date.now()
    };

  } else if (command === 'חפש לקוח') {
    console.log(`Executing 'חפש לקוח' for chat ID: ${chatId}`);
    bot.sendMessage(chatId, "שלח שם או חלק משם הלקוח לחיפוש:")
        .catch(err => console.error('Error sending message:', err.message));
    
    userState[chatId] = {
        action: 'awaiting_customer_search',
        timestamp: Date.now()
    };

  } else if (command === 'מחק לקוח') {
    console.log(`Executing 'מחק לקוח' for chat ID: ${chatId}`);
    showCustomersForDeletion(chatId);

  } else if (command === 'עדכן פרטי לקוח') {
    console.log(`Executing 'עדכן פרטי לקוח' for chat ID: ${chatId}`);
    bot.sendMessage(chatId, "שלח שם הלקוח ופרטים חדשים בפורמט:\nשם קיים | שם חדש [טלפון] [אימייל] [כתובת] [הערות]\n\nדוגמה: ישראל ישראלי | ישראל כהן 050-9876543")
        .catch(err => console.error('Error sending message:', err.message));
    
    userState[chatId] = {
        action: 'awaiting_customer_update',
        timestamp: Date.now()
    };

  } else if (command === 'שליחות ללקוח') {
    console.log(`Executing 'שליחות ללקוח' for chat ID: ${chatId}`);
    db.all("SELECT name FROM customers ORDER BY name COLLATE NOCASE", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת הלקוחות.", customersMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
            return;
        }
        if (rows.length === 0) {
            bot.sendMessage(chatId, "רשימת הלקוחות ריקה. אנא הוסף לקוח קודם.", customersMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return;
        }
        const inlineKeyboard = rows.map(row => ([{ text: row.name, callback_data: `customer_delivery:${row.name}` }]));
        inlineKeyboard.push([{ text: "ביטול", callback_data: 'cancel_action' }]);
        bot.sendMessage(chatId, "לאיזה לקוח השליחות? בחר מהרשימה:", { reply_markup: { inline_keyboard: inlineKeyboard } })
            .catch(e => console.error('Error sending message:', e.message));
    });

  } else if (command === 'שליחות חדשה') {
    console.log(`Executing 'שליחות חדשה' for chat ID: ${chatId}`);
    db.all("SELECT name FROM contacts ORDER BY name COLLATE NOCASE", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת אנשי הקשר.", mainMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
            return;
        }
        if (rows.length === 0) {
            bot.sendMessage(chatId, "ספר הכתובות ריק. אנא הוסף איש קשר קודם עם הפקודה 'הוסף איש קשר [שם]', או בצע רישום רגיל והוא יתווסף אוטומטית.", mainMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return;
        }
        const inlineKeyboard = rows.map(row => ([{ text: row.name, callback_data: `new_delivery_recipient:${row.name}` }]));
        inlineKeyboard.push([{ text: "ביטול", callback_data: 'cancel_action' }]);
        bot.sendMessage(chatId, "למי השליחות? בחר מהרשימה:", { reply_markup: { inline_keyboard: inlineKeyboard } })
            .catch(e => console.error('Error sending message:', e.message));
    });

  } else if (command === 'הרשמה') {
    console.log(`Executing 'הרשמה' for chat ID: ${chatId}`);
    const query = "INSERT OR IGNORE INTO subscriptions (chat_id, type) VALUES (?, 'all')";
    db.run(query, [chatId], function(err) {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה בתהליך ההרשמה.", mainMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return console.error('Database error:', err.message);
        }
        const message = this.changes > 0 ? 
            "נרשמת בהצלחה לקבלת סיכומים אוטומטיים (יומי, שבועי, חודשי)." :
            "אתה כבר רשום לקבלת עדכונים.";
        bot.sendMessage(chatId, message, mainMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
    });

  } else if (command === 'ביטול הרשמה') {
    console.log(`Executing 'ביטול הרשמה' for chat ID: ${chatId}`);
    const query = "DELETE FROM subscriptions WHERE chat_id = ?";
    db.run(query, [chatId], function(err) {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה בביטול ההרשמה.", mainMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return console.error('Database error:', err.message);
        }
        const message = this.changes > 0 ? 
            "ההרשמה לקבלת סיכומים אוטומטיים בוטלה." :
            "לא היית רשום לקבלת עדכונים.";
        bot.sendMessage(chatId, message, mainMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
    });

  } else if (command === 'בדיקה') {
    console.log(`Executing 'בדיקה' for chat ID: ${chatId}`);
    const query = "SELECT id, recipient, item, amount, timestamp, destination FROM transactions ORDER BY id DESC LIMIT 50";
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("DB Error in 'בדיקה':", err.message);
            bot.sendMessage(chatId, "שגיאה בשליפת הנתונים.", mainMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return;
        }
        if (rows.length === 0) {
            bot.sendMessage(chatId, "מסד הנתונים ריק.", mainMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return;
        }
        let message = 'כל הרשומות במסד הנתונים (50 האחרונות):\n\n';
        rows.forEach(row => {
            const dt = new Date(row.timestamp);
            if (isNaN(dt.getTime())) {
                message += `#${row.id}: [תאריך שגוי] - ${row.recipient}, ${row.item}, ${row.amount}₪\n`;
                return;
            }
            // המרה לזמן ישראלי
            const israelTime = new Date(dt.toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}));
            const dateStr = israelTime.toLocaleDateString('he-IL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            const timeStr = israelTime.toLocaleTimeString('he-IL', {
                hour: '2-digit',
                minute: '2-digit'
            });

            let dest = row.destination ? `, יעד: ${row.destination}` : '';
            message += `#${row.id}: ${dateStr} ${timeStr} - ${row.recipient}, ${row.item}, ${row.amount}₪${dest}\n`;
        });
        
        // חלוקת הודעות ארוכות
        const maxLength = 4000;
        if (message.length > maxLength) {
            const parts = [];
            let currentPart = '';
            const lines = message.split('\n');
            
            for (const line of lines) {
                if (currentPart.length + line.length > maxLength) {
                    parts.push(currentPart);
                    currentPart = line + '\n';
                } else {
                    currentPart += line + '\n';
                }
            }
            if (currentPart) parts.push(currentPart);
            
            parts.forEach((part, index) => {
                setTimeout(() => {
                    const options = { parse_mode: 'Markdown' };
                    if (index === parts.length - 1) {
                        options.reply_markup = mainMenuKeyboard.reply_markup;
                    }
                    bot.sendMessage(chatId, part, options)
                        .catch(e => console.error('Error sending message:', e.message));
                }, index * 100);
            });
        } else {
            const summaryOptions = { ...mainMenuKeyboard, parse_mode: 'Markdown' };
            bot.sendMessage(chatId, message, summaryOptions)
                .catch(e => console.error('Error sending message:', e.message));
        }
    });
  
  } else {
    // --- CATCH-ALL for dynamic buttons and free-text entry ---

    // 1. Check for Month buttons
    const monthMatch = text.match(new RegExp(`(${hebrewMonths.join('|')}) (\\d{4})`));
    if (monthMatch) {
        const monthName = monthMatch[1];
        const year = parseInt(monthMatch[2], 10);
        const monthIndex = hebrewMonths.indexOf(monthName);

        if (monthIndex !== -1) {
            const startDate = new Date(year, monthIndex, 1, 0, 0, 0);
            const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59);
            generateSummary(chatId, `חודש ${monthName} ${year}`, startDate, endDate);
            return;
        }
    }

    // 2. Check for Week buttons
    const weekMatch = text.match(/שבוע (\d{1,2}\/\d{1,2}) - (\d{1,2}\/\d{1,2})/);
    if (weekMatch) {
        const today = new Date();
        const currentYear = today.getFullYear();
        
        const [startDay, startMonth] = weekMatch[1].split('/').map(Number);
        const [endDay, endMonth] = weekMatch[2].split('/').map(Number);

        // Handle year change for weeks spanning Dec-Jan
        const startYear = (today.getMonth() === 0 && startMonth === 12) ? currentYear - 1 : currentYear;
        const endYear = (today.getMonth() === 11 && endMonth === 1) ? currentYear + 1 : currentYear;

        const startDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0);
        const endDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);
        generateSummary(chatId, `שבוע ${weekMatch[1]} - ${weekMatch[2]}`, startDate, endDate);
        return;
    }

    // 3. Check for Contact buttons or free-text delivery
    db.all("SELECT name FROM contacts ORDER BY LENGTH(name) DESC", [], (err, contacts) => {
        if (err) {
            console.error("Error fetching contacts for free-text parsing:", err.message);
            bot.sendMessage(chatId, "אירעה שגיאה, נסה שוב.", mainMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return;
        }
        
        // Check for contact button press (רק אם זה לא פקודת "מצא")
        if (!text.startsWith('מצא ')) {
            const contactMatch = contacts.find(c => c.name.toLowerCase() === text.toLowerCase());
            if (contactMatch) {
                const farPast = new Date(0); 
                const now = new Date();
                generateSummary(chatId, `כללי`, farPast, now, contactMatch.name);
                return;
            }
        }

        // Check for free text delivery (existing logic)
        let matchedContact = null;
        for (const contact of contacts) {
            if (text.startsWith(contact.name)) {
                matchedContact = contact;
                break;
            }
        }

        if (matchedContact) {
            const recipient = matchedContact.name;
            const remainingText = text.substring(recipient.length).trim();
            const parts = remainingText.split(/\s+/);

            let amountIndex = -1;
            for (let i = 0; i < parts.length; i++) {
                if (isValidNumber(parts[i])) {
                    amountIndex = i;
                    break;
                }
            }

            if (amountIndex !== -1 && amountIndex > 0) {
                const item = parts.slice(0, amountIndex).join(' ');
                const amount = parseFloat(parts[amountIndex]);
                const destinationAndDate = parts.slice(amountIndex + 1).join(' ');
                
                let destination = '';
                let timestamp = null;

                const parsedDate = chrono.parseDate(destinationAndDate, new Date(), { forwardDate: false });

                if (parsedDate) {
                    timestamp = parsedDate;
                    const parsedInfo = chrono.parse(destinationAndDate, new Date(), { forwardDate: false });
                    if (parsedInfo.length > 0) {
                        const dateText = parsedInfo[0].text;
                        if (destinationAndDate.endsWith(dateText)) {
                            destination = destinationAndDate.substring(0, destinationAndDate.length - dateText.length).trim();
                        } else {
                             destination = destinationAndDate;
                        }
                    } else {
                       destination = destinationAndDate;
                    }
                } else {
                    destination = destinationAndDate;
                    timestamp = new Date();
                }
                
                if (!destination) {
                     bot.sendMessage(chatId, `לא זוהה יעד עבור ${item}. נסה שוב.`, mainMenuKeyboard)
                        .catch(e => console.error('Error sending message:', e.message));
                     return;
                }

                // הוספת הקשר למסד הנתונים אם אינו קיים
                db.run(`INSERT OR IGNORE INTO contacts (name) VALUES (?)`, [recipient], (err) => {
                    if (err) {
                        console.error('Error auto-adding contact:', err.message);
                    }
                });

                db.run(`INSERT INTO transactions (recipient, item, amount, destination, timestamp) VALUES (?, ?, ?, ?, ?)`, 
                    [recipient, item, amount, destination, timestamp.toISOString()], function(err) {
                    if (err) {
                        bot.sendMessage(chatId, "אירעה שגיאה בשמירת הנתונים.", mainMenuKeyboard)
                            .catch(e => console.error('Error sending message:', e.message));
                        return console.error('Database error:', err.message);
                    }
                    // המרה לזמן ישראלי
                    const israelTime = new Date(timestamp.toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}));
                    const dateStr = israelTime.toLocaleDateString('he-IL', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    const timeStr = israelTime.toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                    
                    let message = `✅ שליחות נרשמה בהצלחה!\n\n`;
                    message += `📝 מספר רישום: #${this.lastID}\n`;
                    message += `👤 נמען: ${recipient}\n`;
                    message += `📦 פריט: ${item}\n`;
                    message += `💰 סכום: ${amount}₪\n`;
                    message += `📍 יעד: ${destination}\n`;
                    message += `📅 תאריך: ${dateStr}\n`;
                    message += `🕐 שעה: ${timeStr}`;
                    
                    bot.sendMessage(chatId, message, mainMenuKeyboard)
                        .catch(e => console.error('Error sending message:', e.message));
                });

            } else {
                bot.sendMessage(chatId, "לא הבנתי את הפקודה. אם ניסית לרשום שליחות, ודא שהיא בפורמט: שם פריט סכום יעד", mainMenuKeyboard)
                    .catch(e => console.error('Error sending message:', e.message));
            }
        } else {
             bot.sendMessage(chatId, "לא הבנתי. כדי להתחיל, נסה 'התחלה' או 'שליחות חדשה'.", mainMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
        }
    });
  }
});

// --- משימות מתוזמנות (Cron Jobs) ---
const sendSummary = (chatId, period) => {
    let startDate, endDate;
    const today = new Date();
    
    switch (period) {
        case 'daily':
            endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, -1);
            startDate = new Date(endDate);
            startDate.setDate(endDate.getDate());
            startDate.setHours(0,0,0,0);
            generateSummary(chatId, 'יומי (אתמול)', startDate, endDate);
            break;
        case 'weekly':
            endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, -1);
            startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - 6);
            startDate.setHours(0,0,0,0);
            generateSummary(chatId, 'שבועי אחרון', startDate, endDate);
            break;
        case 'monthly':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1, 0, 0, 0);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
            generateSummary(chatId, 'חודשי (חודש קודם)', startDate, endDate);
            break;
        default:
            console.error('Unknown period:', period);
            return;
    }
};

const scheduleTasks = () => {
    console.log('Setting up scheduled tasks...');
    
    // קבלת מנויים פעם אחת בהתחלה
    db.all("SELECT chat_id FROM subscriptions", [], (err, rows) => {
        if (err) {
            console.error("Failed to get subscribers:", err.message);
            return;
        }
        
        const subscribers = rows.map(r => r.chat_id);
        console.log(`Found ${subscribers.length} subscribers for scheduled tasks.`);

        // רק אם יש מנויים, נגדיר את המשימות
        if (subscribers.length > 0) {
            // Daily summary at 00:00 for the previous day
            cron.schedule('0 0 * * *', () => {
                console.log('Running daily summary cron job...');
                subscribers.forEach(chatId => {
                    try {
                        sendSummary(chatId, 'daily');
                    } catch (error) {
                        console.error(`Error sending daily summary to ${chatId}:`, error.message);
                    }
                });
            });

            // Weekly summary at 00:00 on Monday for the past week
            cron.schedule('0 0 * * 1', () => {
                console.log('Running weekly summary cron job...');
                subscribers.forEach(chatId => {
                    try {
                        sendSummary(chatId, 'weekly');
                    } catch (error) {
                        console.error(`Error sending weekly summary to ${chatId}:`, error.message);
                    }
                });
            });

            // Monthly summary at 00:00 on the 1st of the month
            cron.schedule('0 0 1 * *', () => {
                console.log('Running monthly summary cron job...');
                subscribers.forEach(chatId => {
                    try {
                        sendSummary(chatId, 'monthly');
                    } catch (error) {
                        console.error(`Error sending monthly summary to ${chatId}:`, error.message);
                    }
                });
            });
        }
        
        console.log(`Scheduled tasks configured for ${subscribers.length} subscribers.`);
    });
};

console.log("Script execution finished. Bot is now polling for messages."); 

// --- פונקציות ניהול מלאי ---
function handleInventoryItemAddition(chatId, text) {
    const parts = text.split(/\s+/);
    
    if (parts.length < 2) {
        bot.sendMessage(chatId, "פורמט שגוי. יש לכלול לפחות: שם פריט וכמות.", inventoryMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }

    // Find the quantity (first number)
    let quantityIndex = -1;
    for (let i = 1; i < parts.length; i++) {
        if (isValidNumber(parts[i])) {
            quantityIndex = i;
            break;
        }
    }

    if (quantityIndex === -1) {
        bot.sendMessage(chatId, "לא נמצאה כמות תקינה.", inventoryMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }

    const itemName = parts.slice(0, quantityIndex).join(' ');
    const quantity = parseInt(parts[quantityIndex]);
    const location = parts.length > quantityIndex + 1 ? parts.slice(quantityIndex + 1).join(' ') : '';
    
    const now = new Date().toISOString();

    db.run(`INSERT INTO inventory (item_name, quantity, location, last_updated, created_at) 
            VALUES (?, ?, ?, ?, ?)`, 
        [itemName, quantity, location, now, now], function(err) {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה בהוספת הפריט למלאי.", inventoryMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
        } else {
            let message = `✅ הפריט נוסף בהצלחה למלאי!\n\n`;
            message += `📦 שם: ${itemName}\n`;
            message += `🔢 כמות: ${quantity}\n`;
            message += `� מיקום: ${location || 'לא צוין'}`;
            
            bot.sendMessage(chatId, message, inventoryMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
        }
        delete userState[chatId];
    });
}

function handleQuantityUpdate(chatId, text) {
    const parts = text.split(/\s+/);
    
    if (parts.length < 2) {
        bot.sendMessage(chatId, "פורמט שגוי. שלח: שם הפריט כמות חדשה", inventoryMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }

    let quantityIndex = -1;
    for (let i = 1; i < parts.length; i++) {
        if (isValidNumber(parts[i])) {
            quantityIndex = i;
            break;
        }
    }

    if (quantityIndex === -1) {
        bot.sendMessage(chatId, "לא נמצאה כמות תקינה.", inventoryMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }

    const itemName = parts.slice(0, quantityIndex).join(' ');
    const newQuantity = parseInt(parts[quantityIndex]);
    const now = new Date().toISOString();

    db.run(`UPDATE inventory SET quantity = ?, last_updated = ? WHERE item_name = ? COLLATE NOCASE`, 
        [newQuantity, now, itemName], function(err) {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה בעדכון הכמות.", inventoryMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
        } else if (this.changes === 0) {
            bot.sendMessage(chatId, `הפריט "${itemName}" לא נמצא במלאי.`, inventoryMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
        } else {
            bot.sendMessage(chatId, `✅ הכמות של "${itemName}" עודכנה ל-${newQuantity} יחידות.`, inventoryMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
        }
        delete userState[chatId];
    });
}

function handleInventorySearch(chatId, searchQuery) {
    const query = `SELECT * FROM inventory WHERE item_name LIKE ? OR location LIKE ? ORDER BY item_name`;
    const searchPattern = `%${searchQuery}%`;
    
    db.all(query, [searchPattern, searchPattern], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה בחיפוש.", inventoryMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
        } else if (rows.length === 0) {
            bot.sendMessage(chatId, `לא נמצאו פריטים התואמים לחיפוש "${searchQuery}".`, inventoryMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
        } else {
            let message = `🔍 תוצאות חיפוש עבור "${searchQuery}":\n\n`;
            
            rows.forEach(item => {
                message += `📦 ${item.item_name}\n`;
                message += `🔢 כמות: ${item.quantity}\n`;
                message += `� מיקום: ${item.location || 'לא צוין'}\n`;
                message += `\n`;
            });
            
            if (message.length > 4000) {
                const parts = [];
                let currentPart = '';
                const lines = message.split('\n');
                
                for (const line of lines) {
                    if (currentPart.length + line.length > 4000) {
                        parts.push(currentPart);
                        currentPart = line + '\n';
                    } else {
                        currentPart += line + '\n';
                    }
                }
                if (currentPart) parts.push(currentPart);
                
                parts.forEach((part, index) => {
                    setTimeout(() => {
                        const options = index === parts.length - 1 ? inventoryMenuKeyboard : {};
                        bot.sendMessage(chatId, part, options)
                            .catch(e => console.error('Error sending message:', e.message));
                    }, index * 100);
                });
            } else {
                bot.sendMessage(chatId, message, inventoryMenuKeyboard)
                    .catch(e => console.error('Error sending message:', e.message));
            }
        }
        delete userState[chatId];
    });
}

function displayInventory(chatId) {
    const query = `SELECT * FROM inventory ORDER BY location, item_name`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה בשליפת המלאי.", inventoryMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
            return;
        }
        
        if (rows.length === 0) {
            bot.sendMessage(chatId, "המלאי ריק.", inventoryMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return;
        }
        
        let message = '📦 רשימת מלאי מלאה:\n\n';
        let currentLocation = '';
        
        rows.forEach(item => {
            if (item.location !== currentLocation) {
                currentLocation = item.location || 'ללא מיקום';
                message += `� ${currentLocation}:\n`;
            }
            
            message += `▪️ ${item.item_name} - כמות: ${item.quantity}\n`;
        });
        
        if (message.length > 4000) {
            const parts = [];
            let currentPart = '';
            const lines = message.split('\n');
            
            for (const line of lines) {
                if (currentPart.length + line.length > 4000) {
                    parts.push(currentPart);
                    currentPart = line + '\n';
                } else {
                    currentPart += line + '\n';
                }
            }
            if (currentPart) parts.push(currentPart);
            
            parts.forEach((part, index) => {
                setTimeout(() => {
                    const options = index === parts.length - 1 ? inventoryMenuKeyboard : {};
                    bot.sendMessage(chatId, part, options)
                        .catch(e => console.error('Error sending message:', e.message));
                }, index * 100);
            });
        } else {
            bot.sendMessage(chatId, message, inventoryMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
        }
    });
}

function showInventoryForDeletion(chatId) {
    const query = `SELECT item_name FROM inventory ORDER BY item_name`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה בשליפת המלאי.", inventoryMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
            return;
        }
        
        if (rows.length === 0) {
            bot.sendMessage(chatId, "המלאי ריק, אין מה למחוק.", inventoryMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return;
        }
        
        const inlineKeyboard = rows.map(row => [{ text: `❌ ${row.item_name}`, callback_data: `delete_inventory:${row.item_name}` }]);
        inlineKeyboard.push([{ text: "ביטול", callback_data: 'cancel_action' }]);
        
        bot.sendMessage(chatId, "בחר פריט למחיקה מהמלאי:", { reply_markup: { inline_keyboard: inlineKeyboard } })
            .catch(e => console.error('Error sending message:', e.message));
    });
}

function generateInventoryReport(chatId) {
    const query = `SELECT 
        COUNT(*) as total_items,
        SUM(quantity) as total_quantity,
        location,
        COUNT(*) as items_in_location
        FROM inventory 
        GROUP BY location
        ORDER BY location`;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה ביצירת הדו״ח.", inventoryMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
            return;
        }
        
        if (rows.length === 0) {
            bot.sendMessage(chatId, "המלאי ריק, אין נתונים לדו״ח.", inventoryMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return;
        }
        
        let totalItems = 0;
        let totalQuantity = 0;
        
        let message = '📊 דו״ח מלאי מפורט:\n\n';
        
        rows.forEach(row => {
            const location = row.location || 'ללא מיקום';
            message += `� ${location}:\n`;
            message += `▪️ מספר פריטים: ${row.items_in_location}\n`;
            message += `▪️ כמות כוללת: ${row.total_quantity}\n\n`;
            
            totalItems += row.items_in_location;
            totalQuantity += row.total_quantity;
        });
        
        message += `📈 סיכום כללי:\n`;
        message += `🔢 סה״כ פריטים שונים: ${totalItems}\n`;
        message += `📦 סה״כ יחידות במלאי: ${totalQuantity}`;
        
        bot.sendMessage(chatId, message, inventoryMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
    });
}

function generateSummary(chatId, period, startDate, endDate, recipientName = null) {
    // וולידציה של פרמטרים
    if (!chatId || !startDate || !endDate) {
        console.error('Invalid parameters for generateSummary');
        return;
    }
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('Invalid date parameters for generateSummary');
        bot.sendMessage(chatId, "שגיאה בחישוב התאריכים.", mainMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        return;
    }
    
    let query = `SELECT id, recipient, item, amount, destination, timestamp FROM transactions WHERE timestamp >= ? AND timestamp <= ?`;
    const params = [startDate.toISOString(), endDate.toISOString()];

    if (recipientName) {
        query += ` AND recipient = ? COLLATE NOCASE`;
        params.push(recipientName);
    }
    query += ` ORDER BY timestamp DESC`;

    db.all(query, params, (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה בקבלת הנתונים.", mainMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return console.error('Database error:', err.message);
        }

        let totalAmount = 0;
        let summaryText = `*סיכום ${period}${recipientName ? ` עבור ${recipientName}` : ''}:*\n\n`;

        if (rows.length === 0) {
            summaryText += "לא נמצאו שליחויות בתקופה זו.";
        } else {
            rows.forEach(row => {
                totalAmount += row.amount;
                const date = new Date(row.timestamp);

                if (isNaN(date.getTime())) {
                    console.log(`[WARNING] Invalid date for transaction ID ${row.id}: "${row.timestamp}"`);
                    summaryText += `▫️ [תאריך שגוי] ${row.recipient}: ${row.item}, ${row.amount}₪\n`;
                    return;
                }

                // המרה לזמן ישראלי
                const israelTime = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}));
                const dateStr = israelTime.toLocaleDateString('he-IL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
                const timeStr = israelTime.toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                summaryText += `👤 *${row.recipient}* | 📦 ${row.item} | 💰 ${row.amount}₪ | 📍 ${row.destination || 'לא צוין'} | 📅 ${dateStr} ${timeStr}\n`;
            });
            summaryText += `\n*סה"כ: ${rows.length} שליחויות בסכום כולל של ${totalAmount.toFixed(2)}₪*`;
        }
        
        // חלוקת הודעות ארוכות
        const maxLength = 4000;
        if (summaryText.length > maxLength) {
            const parts = [];
            let currentPart = '';
            const lines = summaryText.split('\n');
            
            for (const line of lines) {
                if (currentPart.length + line.length > maxLength) {
                    parts.push(currentPart);
                    currentPart = line + '\n';
                } else {
                    currentPart += line + '\n';
                }
            }
            if (currentPart) parts.push(currentPart);
            
            parts.forEach((part, index) => {
                setTimeout(() => {
                    const options = { parse_mode: 'Markdown' };
                    if (index === parts.length - 1) {
                        options.reply_markup = mainMenuKeyboard.reply_markup;
                    }
                    bot.sendMessage(chatId, part, options)
                        .catch(e => console.error('Error sending message:', e.message));
                }, index * 100);
            });
        } else {
            const summaryOptions = { ...mainMenuKeyboard, parse_mode: 'Markdown' };
            bot.sendMessage(chatId, summaryText, summaryOptions)
                .catch(e => console.error('Error sending message:', e.message));
        }
    });
}

// --- סיום תקין של התוכנית ---
process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed.');
            }
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed.');
            }
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
}); 

// --- פונקציות ניהול אנשי קשר ---
function handleNewContactAddition(chatId, text) {
    const name = text.trim();
    
    // וולידציה של השם
    if (!name || name.length < 2) {
        bot.sendMessage(chatId, "השם קצר מדי. אנא הכנס שם תקין.", contactsMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }
    
    if (name.length > 100) {
        bot.sendMessage(chatId, "השם ארוך מדי. אנא הכנס שם קצר יותר.", contactsMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }
    
    // בדיקת תווים לא חוקיים
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(name)) {
        bot.sendMessage(chatId, "השם מכיל תווים לא חוקיים. אנא השתמש באותיות, מספרים ורווחים בלבד.", contactsMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }
    
    console.log(`Adding new contact '${name}' for chat ID: ${chatId}`);
    db.run(`INSERT INTO contacts (name) VALUES (?)`, [name], function(err) {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
                bot.sendMessage(chatId, `איש הקשר '${name}' כבר קיים בספר הכתובות.`, contactsMenuKeyboard)
                    .catch(e => console.error('Error sending message:', e.message));
            } else {
                bot.sendMessage(chatId, "אירעה שגיאה בהוספת איש הקשר.", contactsMenuKeyboard)
                    .catch(e => console.error('Error sending message:', e.message));
                console.error('Database error:', err.message);
            }
        } else {
            bot.sendMessage(chatId, `✅ איש הקשר '${name}' נוסף בהצלחה לספר הכתובות!`, contactsMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
        }
        delete userState[chatId];
    });
}

function handleContactSearch(chatId, searchQuery) {
    const query = `SELECT * FROM contacts WHERE name LIKE ? ORDER BY name COLLATE NOCASE`;
    const searchPattern = `%${searchQuery}%`;
    
    db.all(query, [searchPattern], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה בחיפוש.", contactsMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
        } else if (rows.length === 0) {
            bot.sendMessage(chatId, `לא נמצאו אנשי קשר התואמים לחיפוש "${searchQuery}".`, contactsMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
        } else {
            let message = `🔍 תוצאות חיפוש עבור "${searchQuery}":\n\n`;
            
            rows.forEach((contact, index) => {
                message += `${index + 1}. 👤 ${contact.name}\n`;
            });
            
            message += `\n📊 נמצאו ${rows.length} אנשי קשר`;
            
            bot.sendMessage(chatId, message, contactsMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
        }
        delete userState[chatId];
    });
}

function handleContactsImport(chatId, text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) {
        bot.sendMessage(chatId, "לא נמצאו שמות לייבוא.", contactsMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }
    
    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    let processed = 0;
    
    const processNext = () => {
        if (processed >= lines.length) {
            // סיום עיבוד
            let message = `📥 סיכום ייבוא אנשי קשר:\n\n`;
            message += `✅ נוספו: ${imported} אנשי קשר\n`;
            message += `⚠️ כפולים: ${duplicates} אנשי קשר\n`;
            message += `❌ שגיאות: ${errors} אנשי קשר\n`;
            message += `📊 סה"כ עובדו: ${processed} שמות`;
            
            bot.sendMessage(chatId, message, contactsMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            delete userState[chatId];
            return;
        }
        
        const name = lines[processed];
        processed++;
        
        // וולידציה בסיסית
        if (name.length < 2 || name.length > 100) {
            errors++;
            processNext();
            return;
        }
        
        db.run(`INSERT INTO contacts (name) VALUES (?)`, [name], function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    duplicates++;
                } else {
                    errors++;
                    console.error('Database error importing contact:', err.message);
                }
            } else {
                imported++;
            }
            processNext();
        });
    };
    
    processNext();
}

function displayAllContacts(chatId) {
    db.all("SELECT * FROM contacts ORDER BY name COLLATE NOCASE", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת אנשי הקשר.", contactsMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
            return;
        }
        
        if (rows.length === 0) {
            bot.sendMessage(chatId, "📝 ספר הכתובות ריק.\n\nניתן להוסיף אנשי קשר באמצעות:\n• כפתור 'הוסף איש קשר חדש'\n• ייבוא מרשימה\n• רישום שליחות (נוסף אוטומטית)", contactsMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return;
        }
        
        let message = `📞 ספר הכתובות (${rows.length} אנשי קשר):\n\n`;
        
        rows.forEach((contact, index) => {
            message += `${index + 1}. 👤 ${contact.name}\n`;
        });
        
        // חלוקת הודעות ארוכות
        const maxLength = 4000;
        if (message.length > maxLength) {
            const parts = [];
            let currentPart = '';
            const lines = message.split('\n');
            
            for (const line of lines) {
                if (currentPart.length + line.length > maxLength) {
                    parts.push(currentPart);
                    currentPart = line + '\n';
                } else {
                    currentPart += line + '\n';
                }
            }
            if (currentPart) parts.push(currentPart);
            
            parts.forEach((part, index) => {
                setTimeout(() => {
                    const options = index === parts.length - 1 ? contactsMenuKeyboard : {};
                    bot.sendMessage(chatId, part, options)
                        .catch(e => console.error('Error sending message:', e.message));
                }, index * 100);
            });
        } else {
            bot.sendMessage(chatId, message, contactsMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
        }
    });
}

function showContactsForDeletion(chatId) {
    db.all("SELECT name FROM contacts ORDER BY name COLLATE NOCASE", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת אנשי הקשר.", contactsMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
            return;
        }
        
        if (rows.length === 0) {
            bot.sendMessage(chatId, "ספר הכתובות ריק, אין את מי למחוק.", contactsMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return;
        }
        
        const inlineKeyboard = rows.map(row => [{ text: `❌ ${row.name}`, callback_data: `delete_contact:${row.name}` }]);
        inlineKeyboard.push([{ text: "ביטול", callback_data: 'cancel_action' }]);
        
        bot.sendMessage(chatId, "⚠️ בחר איש קשר למחיקה:", { reply_markup: { inline_keyboard: inlineKeyboard } })
            .catch(e => console.error('Error sending message:', e.message));
    });
}

function exportContacts(chatId) {
    db.all("SELECT * FROM contacts ORDER BY name COLLATE NOCASE", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת אנשי הקשר.", contactsMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
            return;
        }
        
        if (rows.length === 0) {
            bot.sendMessage(chatId, "ספר הכתובות ריק, אין מה לייצא.", contactsMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return;
        }
        
        let exportText = `📤 ייצוא אנשי קשר (${rows.length} אנשי קשר)\n`;
        exportText += `תאריך: ${new Date().toLocaleDateString('he-IL')}\n\n`;
        exportText += `רשימת אנשי הקשר:\n`;
        exportText += `${'='.repeat(30)}\n`;
        
        rows.forEach((contact, index) => {
            exportText += `${index + 1}. ${contact.name}\n`;
        });
        
        exportText += `${'='.repeat(30)}\n`;
        exportText += `סה"כ: ${rows.length} אנשי קשר`;
        
        // חלוקת הודעות ארוכות
        const maxLength = 4000;
        if (exportText.length > maxLength) {
            const parts = [];
            let currentPart = '';
            const lines = exportText.split('\n');
            
            for (const line of lines) {
                if (currentPart.length + line.length > maxLength) {
                    parts.push(currentPart);
                    currentPart = line + '\n';
                } else {
                    currentPart += line + '\n';
                }
            }
            if (currentPart) parts.push(currentPart);
            
            parts.forEach((part, index) => {
                setTimeout(() => {
                    const options = index === parts.length - 1 ? contactsMenuKeyboard : {};
                    bot.sendMessage(chatId, part, options)
                        .catch(e => console.error('Error sending message:', e.message));
                }, index * 100);
            });
        } else {
            bot.sendMessage(chatId, exportText, contactsMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
        }
    });
}

function handleNewContactDelivery(chatId, text) {
    const parts = text.split(/\s+/);
    
    if (parts.length < 4) {
        bot.sendMessage(chatId, "פורמט שגוי. יש לכלול לפחות: שם איש הקשר, פריט, סכום ויעד.\n\nדוגמה: דוד כהן שולחן 500 תל אביב", contactsMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }

    // Find the first number (amount)
    let amountIndex = -1;
    for (let i = 2; i < parts.length; i++) {
        if (isValidNumber(parts[i])) {
            amountIndex = i;
            break;
        }
    }

    if (amountIndex === -1) {
        bot.sendMessage(chatId, "לא נמצא סכום תקין. אנא ודא שהסכום הוא מספר.", contactsMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }

    // Extract components
    const recipient = parts.slice(0, 2).join(' '); // First two words as name
    const item = parts.slice(2, amountIndex).join(' ');
    const amount = parseFloat(parts[amountIndex]);
    const destination = parts.slice(amountIndex + 1).join(' ');

    // Validate components
    if (!recipient || recipient.length < 2) {
        bot.sendMessage(chatId, "שם איש הקשר קצר מדי.", contactsMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }

    if (!item) {
        bot.sendMessage(chatId, "לא צוין פריט.", contactsMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }

    if (!destination) {
        bot.sendMessage(chatId, "לא צוין יעד.", contactsMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }

    const timestamp = new Date();

    // First, add the contact to the database
    db.run(`INSERT OR IGNORE INTO contacts (name) VALUES (?)`, [recipient], function(contactErr) {
        if (contactErr) {
            console.error('Error adding contact:', contactErr.message);
        }

        // Then, add the transaction
        db.run(`INSERT INTO transactions (recipient, item, amount, destination, timestamp) VALUES (?, ?, ?, ?, ?)`, 
            [recipient, item, amount, destination, timestamp.toISOString()], function(transactionErr) {
            if (transactionErr) {
                bot.sendMessage(chatId, "אירעה שגיאה בשמירת הנתונים.", contactsMenuKeyboard)
                    .catch(e => console.error('Error sending message:', e.message));
                console.error('Database error:', transactionErr.message);
            } else {
                // המרה לזמן ישראלי
                const israelTime = new Date(timestamp.toLocaleString("en-US", {timeZone: "Asia/Jerusalem"}));
                const dateStr = israelTime.toLocaleDateString('he-IL', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                const timeStr = israelTime.toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                
                let message = `✅ שליחות נרשמה בהצלחה!\n\n`;
                message += `📝 מספר רישום: #${this.lastID}\n`;
                message += `👤 נמען: ${recipient}\n`;
                message += `📦 פריט: ${item}\n`;
                message += `💰 סכום: ${amount}₪\n`;
                message += `📍 יעד: ${destination}\n`;
                message += `📅 תאריך: ${dateStr}\n`;
                message += `🕐 שעה: ${timeStr}\n\n`;
                
                if (this.changes > 0) {
                    message += `📞 איש הקשר '${recipient}' נוסף לספר הכתובות!`;
                } else {
                    message += `📞 איש הקשר '${recipient}' כבר קיים בספר הכתובות.`;
                }
                
                bot.sendMessage(chatId, message, contactsMenuKeyboard)
                    .catch(e => console.error('Error sending message:', e.message));
            }
            delete userState[chatId];
        });
    });
}

// --- פונקציות ניהול לקוחות ---
function handleNewCustomerAddition(chatId, text) {
    const parts = text.split(/\s+/);
    
    if (parts.length < 1) {
        bot.sendMessage(chatId, "פורמט שגוי. יש לכלול לפחות שם לקוח.", customersMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }

    const name = parts[0];
    const phone = parts.length > 1 ? parts[1] : '';
    const email = parts.length > 2 ? parts[2] : '';
    const address = parts.length > 3 ? parts[3] : '';
    const notes = parts.length > 4 ? parts.slice(4).join(' ') : '';
    
    // וולידציה של השם
    if (name.length < 2) {
        bot.sendMessage(chatId, "השם קצר מדי. אנא הכנס שם תקין.", customersMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }
    
    if (name.length > 100) {
        bot.sendMessage(chatId, "השם ארוך מדי. אנא הכנס שם קצר יותר.", customersMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }
    
    const now = new Date().toISOString();
    
    console.log(`Adding new customer '${name}' for chat ID: ${chatId}`);
    db.run(`INSERT INTO customers (name, phone, email, address, notes, created_at, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [name, phone, email, address, notes, now, now], function(err) {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
                bot.sendMessage(chatId, `הלקוח '${name}' כבר קיים ברשימת הלקוחות.`, customersMenuKeyboard)
                    .catch(e => console.error('Error sending message:', e.message));
            } else {
                bot.sendMessage(chatId, "אירעה שגיאה בהוספת הלקוח.", customersMenuKeyboard)
                    .catch(e => console.error('Error sending message:', e.message));
                console.error('Database error:', err.message);
            }
        } else {
            let message = `✅ הלקוח נוסף בהצלחה!\n\n`;
            message += `👤 שם: ${name}\n`;
            message += `📞 טלפון: ${phone || 'לא צוין'}\n`;
            message += `📧 אימייל: ${email || 'לא צוין'}\n`;
            message += `🏠 כתובת: ${address || 'לא צוין'}\n`;
            message += `📝 הערות: ${notes || 'לא צוין'}`;
            
            bot.sendMessage(chatId, message, customersMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
        }
        delete userState[chatId];
    });
}

function handleCustomerSearch(chatId, searchQuery) {
    const query = `SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? ORDER BY name COLLATE NOCASE`;
    const searchPattern = `%${searchQuery}%`;
    
    db.all(query, [searchPattern, searchPattern, searchPattern], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה בחיפוש.", customersMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
        } else if (rows.length === 0) {
            bot.sendMessage(chatId, `לא נמצאו לקוחות התואמים לחיפוש "${searchQuery}".`, customersMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
        } else {
            let message = `🔍 תוצאות חיפוש עבור "${searchQuery}":\n\n`;
            
            rows.forEach((customer, index) => {
                message += `${index + 1}. 👤 ${customer.name}\n`;
                if (customer.phone) message += `📞 ${customer.phone}\n`;
                if (customer.email) message += `📧 ${customer.email}\n`;
                if (customer.address) message += `🏠 ${customer.address}\n`;
                if (customer.notes) message += `📝 ${customer.notes}\n`;
                message += `\n`;
            });
            
            message += `📊 נמצאו ${rows.length} לקוחות`;
            
            if (message.length > 4000) {
                const parts = [];
                let currentPart = '';
                const lines = message.split('\n');
                
                for (const line of lines) {
                    if (currentPart.length + line.length > 4000) {
                        parts.push(currentPart);
                        currentPart = line + '\n';
                    } else {
                        currentPart += line + '\n';
                    }
                }
                if (currentPart) parts.push(currentPart);
                
                parts.forEach((part, index) => {
                    setTimeout(() => {
                        const options = index === parts.length - 1 ? customersMenuKeyboard : {};
                        bot.sendMessage(chatId, part, options)
                            .catch(e => console.error('Error sending message:', e.message));
                    }, index * 100);
                });
            } else {
                bot.sendMessage(chatId, message, customersMenuKeyboard)
                    .catch(e => console.error('Error sending message:', e.message));
            }
        }
        delete userState[chatId];
    });
}

function handleCustomerUpdate(chatId, text) {
    if (!text.includes('|')) {
        bot.sendMessage(chatId, "פורמט שגוי. השתמש ב: שם קיים | פרטים חדשים", customersMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
        delete userState[chatId];
        return;
    }

    const [oldName, newDetails] = text.split('|').map(part => part.trim());
    const parts = newDetails.split(/\s+/);
    
    const newName = parts[0] || oldName;
    const phone = parts.length > 1 ? parts[1] : '';
    const email = parts.length > 2 ? parts[2] : '';
    const address = parts.length > 3 ? parts[3] : '';
    const notes = parts.length > 4 ? parts.slice(4).join(' ') : '';
    
    const now = new Date().toISOString();
    
    db.run(`UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ?, last_updated = ? WHERE name = ? COLLATE NOCASE`, 
        [newName, phone, email, address, notes, now, oldName], function(err) {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה בעדכון פרטי הלקוח.", customersMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
        } else if (this.changes === 0) {
            bot.sendMessage(chatId, `הלקוח "${oldName}" לא נמצא.`, customersMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
        } else {
            let message = `✅ פרטי הלקוח עודכנו בהצלחה!\n\n`;
            message += `👤 שם: ${newName}\n`;
            message += `📞 טלפון: ${phone || 'לא צוין'}\n`;
            message += `📧 אימייל: ${email || 'לא צוין'}\n`;
            message += `🏠 כתובת: ${address || 'לא צוין'}\n`;
            message += `📝 הערות: ${notes || 'לא צוין'}`;
            
            bot.sendMessage(chatId, message, customersMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
        }
        delete userState[chatId];
    });
}



function showCustomersForDeletion(chatId) {
    db.all("SELECT name FROM customers ORDER BY name COLLATE NOCASE", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת הלקוחות.", customersMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
            return;
        }
        
        if (rows.length === 0) {
            bot.sendMessage(chatId, "רשימת הלקוחות ריקה, אין את מי למחוק.", customersMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return;
        }
        
        const inlineKeyboard = rows.map(row => [{ text: `❌ ${row.name}`, callback_data: `delete_customer:${row.name}` }]);
        inlineKeyboard.push([{ text: "ביטול", callback_data: 'cancel_action' }]);
        
        bot.sendMessage(chatId, "⚠️ בחר לקוח למחיקה:", { reply_markup: { inline_keyboard: inlineKeyboard } })
            .catch(e => console.error('Error sending message:', e.message));
    });
}

 