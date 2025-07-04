const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const chrono = require('chrono-node');

// --- הגדרות ראשוניות ---
const token = '7268100196:AAFYa_ejke6SRkhLRlF-HodxIyLW5xrk02E';
const bot = new TelegramBot(token, { polling: true });

// --- הגדרת מסד הנתונים ---
const db = new sqlite3.Database('./data.db', (err) => {
  if (err) {
    console.error(err.message);
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
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
            chat_id INTEGER PRIMARY KEY,
            type TEXT NOT NULL
        )`);
        
        // טבלת מלאי חדשה
        db.run(`CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_name TEXT NOT NULL UNIQUE,
            quantity INTEGER NOT NULL DEFAULT 0,
            unit TEXT DEFAULT 'יחידה',
            min_quantity INTEGER DEFAULT 5,
            location TEXT,
            price REAL,
            last_updated TEXT NOT NULL
        )`);
        
        // טבלת תנועות מלאי
        db.run(`CREATE TABLE IF NOT EXISTS inventory_movements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_name TEXT NOT NULL,
            movement_type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            reason TEXT,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (product_name) REFERENCES inventory (product_name)
        )`);

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

// --- הגדרת מקלדת ראשית ---
const mainMenuKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: 'שליחות חדשה' }, { text: 'יומי' }],
            [{ text: 'שבועי' }, { text: 'חודשי' }],
            [{ text: 'אנשי קשר' }, { text: 'מלאי' }],
            [{ text: 'התחלה' }]
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

// --- תפריטי מלאי ---
const inventoryMenuKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: 'הצג מלאי' }, { text: 'הוסף מוצר' }],
            [{ text: 'עדכן כמות' }, { text: 'הוצא מהמלאי' }],
            [{ text: 'מחק מוצר' }, { text: 'מלאי נמוך' }],
            [{ text: 'תנועות מלאי' }, { text: 'חזור' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    }
};

const hebrewMonths = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

// --- טיפול בכפתורים (Callback Queries) ---
bot.on('callback_query', (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    if (data === 'cancel_action') {
        bot.editMessageText("הפעולה בוטלה.", { chat_id: chatId, message_id: msg.message_id });
        return;
    }

    if (data.startsWith('delete_contact:')) {
        const contactName = data.substring('delete_contact:'.length);

        db.run(`DELETE FROM contacts WHERE name = ?`, [contactName], function(err) {
            if (err) {
                bot.editMessageText("אירעה שגיאה במחיקת איש הקשר.", { chat_id: chatId, message_id: msg.message_id });
                console.error(err.message);
                return;
            }
            if (this.changes > 0) {
                bot.editMessageText(`'${contactName}' נמחק בהצלחה מספר הכתובות.`, { chat_id: chatId, message_id: msg.message_id });
            } else {
                bot.editMessageText(`'${contactName}' לא נמצא למחיקה.`, { chat_id: chatId, message_id: msg.message_id });
            }
        });
        return;
    }
    
    if (data.startsWith('new_delivery_recipient:')) {
        const recipientName = data.substring('new_delivery_recipient:'.length);
        bot.editMessageText(`נבחר: ${recipientName}.`, { chat_id: chatId, message_id: msg.message_id });
        bot.sendMessage(chatId, "עכשיו שלח את פרטי השליחות, בפורמט: \nפריט סכום יעד");
        
        userState[chatId] = {
            action: 'awaiting_delivery_details',
            recipient: recipientName
        };
        return;
    }
    
    // --- טיפול בפעולות מלאי ---
    if (data.startsWith('delete_product:')) {
        const productName = data.substring('delete_product:'.length);
        
        db.run(`DELETE FROM inventory WHERE product_name = ?`, [productName], function(err) {
            if (err) {
                bot.editMessageText("אירעה שגיאה במחיקת המוצר.", { chat_id: chatId, message_id: msg.message_id });
                console.error(err.message);
                return;
            }
            if (this.changes > 0) {
                // מחק גם את תנועות המלאי של המוצר
                db.run(`DELETE FROM inventory_movements WHERE product_name = ?`, [productName], (err) => {
                    if (err) console.error("Error deleting inventory movements:", err.message);
                });
                bot.editMessageText(`המוצר '${productName}' נמחק בהצלחה מהמלאי.`, { chat_id: chatId, message_id: msg.message_id });
            } else {
                bot.editMessageText(`המוצר '${productName}' לא נמצא למחיקה.`, { chat_id: chatId, message_id: msg.message_id });
            }
        });
        return;
    }
    
    if (data.startsWith('update_product:')) {
        const productName = data.substring('update_product:'.length);
        bot.editMessageText(`נבחר מוצר: ${productName}`, { chat_id: chatId, message_id: msg.message_id });
        bot.sendMessage(chatId, "שלח את הכמות החדשה (מספר חיובי להוספה, שלילי להפחתה):");
        
        userState[chatId] = {
            action: 'awaiting_quantity_update',
            productName: productName
        };
        return;
    }
    
    if (data.startsWith('remove_from_inventory:')) {
        const productName = data.substring('remove_from_inventory:'.length);
        bot.editMessageText(`נבחר מוצר: ${productName}`, { chat_id: chatId, message_id: msg.message_id });
        bot.sendMessage(chatId, "שלח את הכמות להוצאה מהמלאי ואת הסיבה:\nכמות סיבה\nלדוגמה: 5 נמכר ללקוח");
        
        userState[chatId] = {
            action: 'awaiting_inventory_removal',
            productName: productName
        };
        return;
    }
});

// --- טיפול בשגיאות ---
bot.on('polling_error', (error) => {
  console.log(`Polling error: ${error.code} - ${error.message}`);
  // כאן אפשר להוסיף לוגיקה לנסות להתחבר מחדש, וכו'
});

// --- מאזין הודעות ונתב פקודות ראשי ---
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  // בדיקה קריטית: ודא שההודעה היא טקסט לפני שממשיכים
  if (!msg.text) {
    console.log(`Received non-text message from chat ID ${chatId}. Ignoring.`);
    return;
  }
  
  // ניקוי תווים בלתי נראים (בעיקר מהקלדה קולית) לפני עיבוד
  const text = msg.text.replace(/[\u200B-\u200F\uFEFF\u202A-\u202E]/g, '').trim();
  
  console.log(`Received message from chat ID ${chatId}: "${text}"`);
  
  // --- טיפול במצב המשתמש (לשליחות חדשה) ---
  const state = userState[chatId];
  if (state && state.action === 'awaiting_delivery_details') {
    const parts = text.split(/\s+/);
    let amountIndex = -1;
    // Find the first valid number to be the amount
    for (let i = 0; i < parts.length; i++) {
        if (!isNaN(parseFloat(parts[i])) && isFinite(parts[i])) {
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

        db.run(`INSERT INTO transactions (recipient, item, amount, destination, timestamp) VALUES (?, ?, ?, ?, ?)`, [recipient, item, amount, destination, timestamp.toISOString()], function(err) {
            if (err) {
                bot.sendMessage(chatId, "אירעה שגיאה בשמירת הנתונים.", mainMenuKeyboard);
                delete userState[chatId];
                return console.error(err.message);
            }
            const dateStr = `${timestamp.getDate().toString().padStart(2, '0')}/${(timestamp.getMonth() + 1).toString().padStart(2, '0')}`;
            bot.sendMessage(chatId, `נשמר (מספר #${this.lastID}): שליחה ל-${recipient} של ${item} בסכום ${amount} ליעד ${destination} בתאריך ${dateStr}`, mainMenuKeyboard);
            delete userState[chatId];
        });
    } else {
        bot.sendMessage(chatId, "הפורמט לא נכון. אנא שלח בפורמט: פריט סכום יעד (לדוגמה: אקמול 50 רעננה)", mainMenuKeyboard);
    }
    return;
  }
  
  // --- טיפול במצבי מלאי ---
  if (state && state.action === 'awaiting_product_details') {
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
        bot.sendMessage(chatId, "פורמט לא נכון. שלח: שם_המוצר כמות [יחידה] [מינימום] [מיקום] [מחיר]", inventoryMenuKeyboard);
        return;
    }
    
    const productName = parts[0];
    const quantity = parseInt(parts[1]);
    const unit = parts[2] || 'יחידה';
    const minQuantity = parseInt(parts[3]) || 5;
    const location = parts[4] || null;
    const price = parseFloat(parts[5]) || null;
    
    if (isNaN(quantity) || quantity < 0) {
        bot.sendMessage(chatId, "הכמות חייבת להיות מספר חיובי.", inventoryMenuKeyboard);
        return;
    }
    
    const timestamp = new Date().toISOString();
    
    db.run(`INSERT INTO inventory (product_name, quantity, unit, min_quantity, location, price, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [productName, quantity, unit, minQuantity, location, price, timestamp], function(err) {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
                bot.sendMessage(chatId, `המוצר '${productName}' כבר קיים במלאי.`, inventoryMenuKeyboard);
            } else {
                bot.sendMessage(chatId, "אירעה שגיאה בהוספת המוצר.", inventoryMenuKeyboard);
                console.error(err.message);
            }
            delete userState[chatId];
            return;
        }
        
        // רשום תנועת מלאי
        db.run(`INSERT INTO inventory_movements (product_name, movement_type, quantity, reason, timestamp) VALUES (?, 'הוספה', ?, 'מוצר חדש', ?)`,
            [productName, quantity, timestamp], (err) => {
            if (err) console.error("Error recording inventory movement:", err.message);
        });
        
        bot.sendMessage(chatId, `המוצר '${productName}' נוסף בהצלחה עם כמות ${quantity} ${unit}.`, inventoryMenuKeyboard);
        delete userState[chatId];
    });
    return;
  }
  
  if (state && state.action === 'awaiting_quantity_update') {
    const quantityChange = parseInt(text);
    if (isNaN(quantityChange)) {
        bot.sendMessage(chatId, "אנא שלח מספר תקין.", inventoryMenuKeyboard);
        return;
    }
    
    const productName = state.productName;
    const timestamp = new Date().toISOString();
    
    db.get(`SELECT quantity FROM inventory WHERE product_name = ?`, [productName], (err, row) => {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה.", inventoryMenuKeyboard);
            delete userState[chatId];
            return;
        }
        
        if (!row) {
            bot.sendMessage(chatId, "המוצר לא נמצא.", inventoryMenuKeyboard);
            delete userState[chatId];
            return;
        }
        
        const newQuantity = row.quantity + quantityChange;
        if (newQuantity < 0) {
            bot.sendMessage(chatId, `לא ניתן להפחית ${Math.abs(quantityChange)} - יש במלאי רק ${row.quantity} יחידות.`, inventoryMenuKeyboard);
            delete userState[chatId];
            return;
        }
        
        db.run(`UPDATE inventory SET quantity = ?, last_updated = ? WHERE product_name = ?`, 
            [newQuantity, timestamp, productName], function(err) {
            if (err) {
                bot.sendMessage(chatId, "אירעה שגיאה בעדכון הכמות.", inventoryMenuKeyboard);
                delete userState[chatId];
                return;
            }
            
            // רשום תנועת מלאי
            const movementType = quantityChange > 0 ? 'הוספה' : 'הפחתה';
            const reason = quantityChange > 0 ? 'עדכון כמות' : 'עדכון כמות';
            db.run(`INSERT INTO inventory_movements (product_name, movement_type, quantity, reason, timestamp) VALUES (?, ?, ?, ?, ?)`,
                [productName, movementType, Math.abs(quantityChange), reason, timestamp], (err) => {
                if (err) console.error("Error recording inventory movement:", err.message);
            });
            
            bot.sendMessage(chatId, `הכמות עודכנה בהצלחה. ${productName}: ${newQuantity} יחידות`, inventoryMenuKeyboard);
            delete userState[chatId];
        });
    });
    return;
  }
  
  if (state && state.action === 'awaiting_inventory_removal') {
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
        bot.sendMessage(chatId, "פורמט לא נכון. שלח: כמות סיבה", inventoryMenuKeyboard);
        return;
    }
    
    const quantityToRemove = parseInt(parts[0]);
    const reason = parts.slice(1).join(' ');
    
    if (isNaN(quantityToRemove) || quantityToRemove <= 0) {
        bot.sendMessage(chatId, "הכמות חייבת להיות מספר חיובי.", inventoryMenuKeyboard);
        return;
    }
    
    const productName = state.productName;
    const timestamp = new Date().toISOString();
    
    db.get(`SELECT quantity FROM inventory WHERE product_name = ?`, [productName], (err, row) => {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה.", inventoryMenuKeyboard);
            delete userState[chatId];
            return;
        }
        
        if (!row) {
            bot.sendMessage(chatId, "המוצר לא נמצא.", inventoryMenuKeyboard);
            delete userState[chatId];
            return;
        }
        
        if (row.quantity < quantityToRemove) {
            bot.sendMessage(chatId, `לא ניתן להוציא ${quantityToRemove} - יש במלאי רק ${row.quantity} יחידות.`, inventoryMenuKeyboard);
            delete userState[chatId];
            return;
        }
        
        const newQuantity = row.quantity - quantityToRemove;
        
        db.run(`UPDATE inventory SET quantity = ?, last_updated = ? WHERE product_name = ?`, 
            [newQuantity, timestamp, productName], function(err) {
            if (err) {
                bot.sendMessage(chatId, "אירעה שגיאה בעדכון הכמות.", inventoryMenuKeyboard);
                delete userState[chatId];
                return;
            }
            
            // רשום תנועת מלאי
            db.run(`INSERT INTO inventory_movements (product_name, movement_type, quantity, reason, timestamp) VALUES (?, 'הוצאה', ?, ?, ?)`,
                [productName, quantityToRemove, reason, timestamp], (err) => {
                if (err) console.error("Error recording inventory movement:", err.message);
            });
            
            bot.sendMessage(chatId, `הוצאו ${quantityToRemove} יחידות מ-${productName}. נותרו: ${newQuantity} יחידות\nסיבה: ${reason}`, inventoryMenuKeyboard);
            delete userState[chatId];
        });
    });
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
    const response = "ברוך הבא לבוט הסיכומים והמלאי! \n\n" +
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
      "מלאי - תפריט ניהול מלאי\n" +
      "הצג מלאי - רשימת כל המוצרים\n" +
      "הוסף מוצר - הוספת מוצר חדש\n" +
      "עדכן כמות - עדכון כמות מוצר\n" +
      "הוצא מהמלאי - הוצאת מוצר מהמלאי\n" +
      "מלאי נמוך - מוצרים עם מלאי נמוך\n" +
      "תנועות מלאי - היסטוריית תנועות\n\n" +
      "סיכומים אוטומטיים:\n" +
      "הרשמה\nביטול הרשמה";
    bot.sendMessage(chatId, response, mainMenuKeyboard);

  // --- ניתוב לתפריטי משנה ---
  } else if (command === 'יומי') {
    // This now handles the direct command "יומי", not just the button.
    // We check if a name is added.
    const parts = text.split(/\s+/);
    if (parts.length > 1) {
        // This is a direct command like "יומי יוסי"
        const recipientName = parts.slice(1).join(' ');
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        generateSummary(chatId, 'יומי', startOfDay, endOfDay, recipientName);
    } else {
        // Just the "יומי" button was pressed, show the daily menu.
        bot.sendMessage(chatId, "בחר סיכום יומי:", dailyMenuKeyboard);
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
        bot.sendMessage(chatId, "בחר סיכום שבועי:", weeklySelectionKeyboard);
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
        bot.sendMessage(chatId, "בחר חודש לסיכום:", monthlySelectionKeyboard);
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
    bot.sendMessage(chatId, "כדי לקבל סיכום לתאריך מסוים, כתוב את הפקודה:\n`סיכום [התאריך]`\n\nלדוגמה: `סיכום אתמול בערב` או `סיכום 25/08/2024 יוסי`", { ...mainMenuKeyboard, parse_mode: 'Markdown' });
  
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
      // This case is now handled by the logic inside the `יומי` block,
      // but we keep it for backwards compatibility or other direct entries.
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
    const parsedResult = chrono.parse(content, new Date(), { forwardDate: false });

    if (!parsedResult || parsedResult.length === 0) {
        bot.sendMessage(chatId, "לא הצלחתי להבין את התאריך מהפקודה. נסה פורמט אחר, למשל 'סיכום אתמול' או 'סיכום 25/07/2024'.");
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
        bot.sendMessage(chatId, "יש לציין שם לחיפוש. למשל: מצא ישראל ישראלי");
        return;
    }
    console.log(`Executing 'מצא' for '${recipientName}' from chat ID: ${chatId}`);
    
    // Find all records from the beginning of time until now
    const farPast = new Date(0); 
    const now = new Date();
    
    generateSummary(chatId, `כללי`, farPast, now, recipientName);

  } else if (command === 'אנשי קשר') {
    console.log(`Executing 'אנשי קשר' for chat ID: ${chatId}`);
    db.all("SELECT name FROM contacts ORDER BY name COLLATE NOCASE", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת אנשי הקשר.", mainMenuKeyboard);
            return;
        }
        if (rows.length === 0) {
            bot.sendMessage(chatId, "ספר הכתובות ריק. ניתן להוסיף איש קשר עם הפקודה 'הוסף איש קשר [שם]', או פשוט לרשום שליחות והנמען יישמר אוטומטית.", mainMenuKeyboard);
            return;
        }
        const contactButtons = rows.map(row => [{ text: row.name }]);
        contactButtons.push([{ text: 'חזור' }]);
        const contactsKeyboard = { reply_markup: { keyboard: contactButtons, resize_keyboard: true, one_time_keyboard: true } };
        bot.sendMessage(chatId, "בחר איש קשר לקבלת סיכום מלא:", contactsKeyboard);
    });

  } else if (command.startsWith('הוסף איש קשר ')) {
    const name = command.substring('הוסף איש קשר '.length).trim();
    if (!name) {
        bot.sendMessage(chatId, "לא ציינת שם. נסה: הוסף איש קשר ישראל ישראלי", mainMenuKeyboard);
        return;
    }
    console.log(`Executing 'הוסף איש קשר' for '${name}' from chat ID: ${chatId}`);
    db.run(`INSERT INTO contacts (name) VALUES (?)`, [name], function(err) {
        if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
                bot.sendMessage(chatId, `איש הקשר '${name}' כבר קיים.`, mainMenuKeyboard);
            } else {
                bot.sendMessage(chatId, "אירעה שגיאה בהוספת איש הקשר.", mainMenuKeyboard);
                console.error(err.message);
            }
            return;
        }
        bot.sendMessage(chatId, `איש הקשר '${name}' נוסף בהצלחה.`, mainMenuKeyboard);
    });
    
  } else if (command === 'מחק איש קשר') {
    console.log(`Executing 'מחק איש קשר' for chat ID: ${chatId}`);
    db.all("SELECT name FROM contacts ORDER BY name COLLATE NOCASE", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת אנשי הקשר.", mainMenuKeyboard);
            return;
        }
        if (rows.length === 0) {
            bot.sendMessage(chatId, "ספר הכתובות ריק, אין את מי למחוק.", mainMenuKeyboard);
            return;
        }
        const inlineKeyboard = rows.map(row => [{ text: `❌ ${row.name}`, callback_data: `delete_contact:${row.name}` }]);
        inlineKeyboard.push([{ text: "ביטול", callback_data: 'cancel_action' }]);
        bot.sendMessage(chatId, "בחר איש קשר למחיקה:", { reply_markup: { inline_keyboard: inlineKeyboard } });
    });

  } else if (command === 'שליחות חדשה') {
    console.log(`Executing 'שליחות חדשה' for chat ID: ${chatId}`);
    db.all("SELECT name FROM contacts ORDER BY name COLLATE NOCASE", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת אנשי הקשר.", mainMenuKeyboard);
            return;
        }
        if (rows.length === 0) {
            bot.sendMessage(chatId, "ספר הכתובות ריק. אנא הוסף איש קשר קודם עם הפקודה 'הוסף איש קשר [שם]', או בצע רישום רגיל והוא יתווסף אוטומטית.", mainMenuKeyboard);
            return;
        }
        const inlineKeyboard = rows.map(row => ([{ text: row.name, callback_data: `new_delivery_recipient:${row.name}` }]));
        inlineKeyboard.push([{ text: "ביטול", callback_data: 'cancel_action' }]);
        bot.sendMessage(chatId, "למי השליחות? בחר מהרשימה:", { reply_markup: { inline_keyboard: inlineKeyboard } });
    });

  } else if (command === 'הרשמה') {
    console.log(`Executing 'הרשמה' for chat ID: ${chatId}`);
    const query = "INSERT OR IGNORE INTO subscriptions (chat_id, type) VALUES (?, 'all')";
    db.run(query, [chatId], function(err) {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה בתהליך ההרשמה.", mainMenuKeyboard);
            return console.error(err.message);
        }
        if (this.changes > 0) {
            bot.sendMessage(chatId, "נרשמת בהצלחה לקבלת סיכומים אוטומטיים (יומי, שבועי, חודשי).", mainMenuKeyboard);
        } else {
            bot.sendMessage(chatId, "אתה כבר רשום לקבלת עדכונים.", mainMenuKeyboard);
        }
    });

  } else if (command === 'ביטול הרשמה') {
    console.log(`Executing 'ביטול הרשמה' for chat ID: ${chatId}`);
    const query = "DELETE FROM subscriptions WHERE chat_id = ?";
    db.run(query, [chatId], function(err) {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה בביטול ההרשמה.", mainMenuKeyboard);
            return console.error(err.message);
        }
        if (this.changes > 0) {
            bot.sendMessage(chatId, "ההרשמה לקבלת סיכומים אוטומטיים בוטלה.", mainMenuKeyboard);
        } else {
            bot.sendMessage(chatId, "לא היית רשום לקבלת עדכונים.", mainMenuKeyboard);
        }
    });

  } else if (command === 'בדיקה') {
    console.log(`Executing 'בדיקה' for chat ID: ${chatId}`);
    const query = "SELECT id, recipient, item, amount, timestamp, destination FROM transactions ORDER BY id DESC";
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("DB Error in 'בדיקה':", err.message);
            bot.sendMessage(chatId, "שגיאה בשליפת הנתונים.", mainMenuKeyboard);
            return;
        }
        if (rows.length === 0) {
            bot.sendMessage(chatId, "מסד הנתונים ריק.", mainMenuKeyboard);
            return;
        }
        let message = 'כל הרשומות במסד הנתונים:\n\n';
        rows.forEach(row => {
            const dt = new Date(row.timestamp);
            const dateStr = `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getFullYear()}`;
            const timeStr = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;

            let dest = row.destination ? `, יעד: ${row.destination}` : '';
            message += `#${row.id}: ${dateStr} ${timeStr} - ${row.recipient}, ${row.item}, ${row.amount}${dest}\n`;
        });
        bot.sendMessage(chatId, message, mainMenuKeyboard);
    });
  
  // --- פקודות ניהול מלאי ---
  } else if (command === 'מלאי') {
    console.log(`Executing 'מלאי' for chat ID: ${chatId}`);
    bot.sendMessage(chatId, "בחר פעולה לניהול המלאי:", inventoryMenuKeyboard);
    
  } else if (command === 'הצג מלאי') {
    console.log(`Executing 'הצג מלאי' for chat ID: ${chatId}`);
    db.all("SELECT * FROM inventory ORDER BY product_name", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת נתוני המלאי.", inventoryMenuKeyboard);
            return;
        }
        if (rows.length === 0) {
            bot.sendMessage(chatId, "המלאי ריק. הוסף מוצרים חדשים.", inventoryMenuKeyboard);
            return;
        }
        
        let message = '*רשימת המלאי:*\n\n';
        rows.forEach(row => {
            const lastUpdated = new Date(row.last_updated);
            const dateStr = `${lastUpdated.getDate().toString().padStart(2, '0')}/${(lastUpdated.getMonth() + 1).toString().padStart(2, '0')}`;
            
            let status = row.quantity <= row.min_quantity ? '⚠️' : '✅';
            let locationStr = row.location ? ` 📍${row.location}` : '';
            let priceStr = row.price ? ` 💰${row.price}₪` : '';
            
            message += `${status} *${row.product_name}*\n`;
            message += `   📦 ${row.quantity} ${row.unit} (מינימום: ${row.min_quantity})${locationStr}${priceStr}\n`;
            message += `   📅 עודכן: ${dateStr}\n\n`;
        });
        
        bot.sendMessage(chatId, message, { ...inventoryMenuKeyboard, parse_mode: 'Markdown' });
    });
    
  } else if (command === 'הוסף מוצר') {
    console.log(`Executing 'הוסף מוצר' for chat ID: ${chatId}`);
    bot.sendMessage(chatId, "שלח פרטי המוצר החדש בפורמט:\nשם_המוצר כמות [יחידה] [מינימום] [מיקום] [מחיר]\n\nדוגמה: אקמול 50 קופסאות 10 מחסן_א 25.5", inventoryMenuKeyboard);
    userState[chatId] = { action: 'awaiting_product_details' };
    
  } else if (command === 'עדכן כמות') {
    console.log(`Executing 'עדכן כמות' for chat ID: ${chatId}`);
    db.all("SELECT product_name, quantity, unit FROM inventory ORDER BY product_name", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת נתוני המלאי.", inventoryMenuKeyboard);
            return;
        }
        if (rows.length === 0) {
            bot.sendMessage(chatId, "המלאי ריק. הוסף מוצרים חדשים.", inventoryMenuKeyboard);
            return;
        }
        
        const inlineKeyboard = rows.map(row => [{ 
            text: `${row.product_name} (${row.quantity} ${row.unit})`, 
            callback_data: `update_product:${row.product_name}` 
        }]);
        inlineKeyboard.push([{ text: "ביטול", callback_data: 'cancel_action' }]);
        
        bot.sendMessage(chatId, "בחר מוצר לעדכון כמות:", { reply_markup: { inline_keyboard: inlineKeyboard } });
    });
    
  } else if (command === 'הוצא מהמלאי') {
    console.log(`Executing 'הוצא מהמלאי' for chat ID: ${chatId}`);
    db.all("SELECT product_name, quantity, unit FROM inventory WHERE quantity > 0 ORDER BY product_name", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת נתוני המלאי.", inventoryMenuKeyboard);
            return;
        }
        if (rows.length === 0) {
            bot.sendMessage(chatId, "אין מוצרים עם מלאי זמין.", inventoryMenuKeyboard);
            return;
        }
        
        const inlineKeyboard = rows.map(row => [{ 
            text: `${row.product_name} (${row.quantity} ${row.unit})`, 
            callback_data: `remove_from_inventory:${row.product_name}` 
        }]);
        inlineKeyboard.push([{ text: "ביטול", callback_data: 'cancel_action' }]);
        
        bot.sendMessage(chatId, "בחר מוצר להוצאה מהמלאי:", { reply_markup: { inline_keyboard: inlineKeyboard } });
    });
    
  } else if (command === 'מחק מוצר') {
    console.log(`Executing 'מחק מוצר' for chat ID: ${chatId}`);
    db.all("SELECT product_name, quantity, unit FROM inventory ORDER BY product_name", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת נתוני המלאי.", inventoryMenuKeyboard);
            return;
        }
        if (rows.length === 0) {
            bot.sendMessage(chatId, "המלאי ריק, אין מוצרים למחיקה.", inventoryMenuKeyboard);
            return;
        }
        
        const inlineKeyboard = rows.map(row => [{ 
            text: `❌ ${row.product_name} (${row.quantity} ${row.unit})`, 
            callback_data: `delete_product:${row.product_name}` 
        }]);
        inlineKeyboard.push([{ text: "ביטול", callback_data: 'cancel_action' }]);
        
        bot.sendMessage(chatId, "בחר מוצר למחיקה:", { reply_markup: { inline_keyboard: inlineKeyboard } });
    });
    
  } else if (command === 'מלאי נמוך') {
    console.log(`Executing 'מלאי נמוך' for chat ID: ${chatId}`);
    db.all("SELECT * FROM inventory WHERE quantity <= min_quantity ORDER BY product_name", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת נתוני המלאי.", inventoryMenuKeyboard);
            return;
        }
        if (rows.length === 0) {
            bot.sendMessage(chatId, "🎉 כל המוצרים עם מלאי תקין!", inventoryMenuKeyboard);
            return;
        }
        
        let message = '*⚠️ מוצרים עם מלאי נמוך:*\n\n';
        rows.forEach(row => {
            let locationStr = row.location ? ` 📍${row.location}` : '';
            message += `🔴 *${row.product_name}*\n`;
            message += `   📦 ${row.quantity} ${row.unit} (מינימום: ${row.min_quantity})${locationStr}\n`;
            message += `   💡 חסרים: ${row.min_quantity - row.quantity + 5} ${row.unit}\n\n`;
        });
        
        bot.sendMessage(chatId, message, { ...inventoryMenuKeyboard, parse_mode: 'Markdown' });
    });
    
  } else if (command === 'תנועות מלאי') {
    console.log(`Executing 'תנועות מלאי' for chat ID: ${chatId}`);
    db.all("SELECT * FROM inventory_movements ORDER BY timestamp DESC LIMIT 20", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת תנועות המלאי.", inventoryMenuKeyboard);
            return;
        }
        if (rows.length === 0) {
            bot.sendMessage(chatId, "אין תנועות מלאי.", inventoryMenuKeyboard);
            return;
        }
        
        let message = '*📋 תנועות מלאי אחרונות:*\n\n';
        rows.forEach(row => {
            const date = new Date(row.timestamp);
            const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            
            let icon = row.movement_type === 'הוספה' ? '➕' : '➖';
            if (row.movement_type === 'הוצאה') icon = '📤';
            
            message += `${icon} *${row.product_name}*\n`;
            message += `   📊 ${row.movement_type}: ${row.quantity} יחידות\n`;
            message += `   📝 ${row.reason}\n`;
            message += `   📅 ${dateStr} ${timeStr}\n\n`;
        });
        
        bot.sendMessage(chatId, message, { ...inventoryMenuKeyboard, parse_mode: 'Markdown' });
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
            bot.sendMessage(chatId, "אירעה שגיאה, נסה שוב.", mainMenuKeyboard);
            return;
        }
        
        // Check for contact button press
        const contactMatch = contacts.find(c => c.name.toLowerCase() === text.toLowerCase());
        if (contactMatch) {
            const farPast = new Date(0); 
            const now = new Date();
            generateSummary(chatId, `כללי`, farPast, now, contactMatch.name);
            return;
        }

        // Check for free text delivery (existing logic)
        let matchedContact = null;
        for (const contact of contacts) {
            if (text.startsWith(contact.name)) {
                matchedContact = contact;
                break; // Found the longest possible match
            }
        }

        if (matchedContact) {
            const recipient = matchedContact.name;
            const remainingText = text.substring(recipient.length).trim();
            const parts = remainingText.split(/\s+/);

            let amountIndex = -1;
            for (let i = 0; i < parts.length; i++) {
                // Ensure it's a number and not part of a date like 19:00
                if (!isNaN(parseFloat(parts[i])) && isFinite(parts[i])) {
                    amountIndex = i;
                    break;
                }
            }

            if (amountIndex !== -1 && amountIndex > 0) { // Must have an item before the amount
                const item = parts.slice(0, amountIndex).join(' ');
                const amount = parseFloat(parts[amountIndex]);
                const destinationAndDate = parts.slice(amountIndex + 1).join(' ');
                
                let destination = '';
                let timestamp = null;

                const parsedDate = chrono.parseDate(destinationAndDate, new Date(), { forwardDate: false });

                if (parsedDate) {
                    timestamp = parsedDate;
                    // This is tricky: we assume the date is at the end. How to find the destination?
                    // We find what chrono parsed, and remove it from the string.
                    const parsedInfo = chrono.parse(destinationAndDate, new Date(), { forwardDate: false });
                    if (parsedInfo.length > 0) {
                        // To be safe, we remove the parsed text from the end of the string
                        const dateText = parsedInfo[0].text;
                        if (destinationAndDate.endsWith(dateText)) {
                            destination = destinationAndDate.substring(0, destinationAndDate.length - dateText.length).trim();
                        } else {
                             destination = destinationAndDate; // fallback
                        }
                    } else {
                       destination = destinationAndDate;
                    }
                } else {
                    destination = destinationAndDate;
                    timestamp = new Date();
                }
                
                if (!destination) {
                     bot.sendMessage(chatId, `לא זוהה יעד עבור ${item}. נסה שוב.`, mainMenuKeyboard);
                     return;
                }

                db.run(`INSERT INTO transactions (recipient, item, amount, destination, timestamp) VALUES (?, ?, ?, ?, ?)`, 
                    [recipient, item, amount, destination, timestamp.toISOString()], function(err) {
                    if (err) {
                        bot.sendMessage(chatId, "אירעה שגיאה בשמירת הנתונים.", mainMenuKeyboard);
                        return console.error(err.message);
                    }
                    const dateStr = `${timestamp.getDate().toString().padStart(2, '0')}/${(timestamp.getMonth() + 1).toString().padStart(2, '0')}`;
                    bot.sendMessage(chatId, `נשמר (מספר #${this.lastID}): שליחה ל-${recipient} של ${item} בסכום ${amount} ליעד ${destination} בתאריך ${dateStr}`, mainMenuKeyboard);
                });

            } else {
                // This might be a message not intended as a command, so we can ignore it.
                // Or send a help message if it looks like a failed command.
                 bot.sendMessage(chatId, "לא הבנתי את הפקודה. אם ניסית לרשום שליחות, ודא שהיא בפורמט: שם פריט סכום יעד", mainMenuKeyboard);
            }
        } else {
             bot.sendMessage(chatId, "לא הבנתי. כדי להתחיל, נסה 'התחלה' או 'שליחות חדשה'.", mainMenuKeyboard);
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
            endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, -1); // End of yesterday
            startDate = new Date(endDate);
            startDate.setDate(endDate.getDate()); // Start of yesterday
            startDate.setHours(0,0,0,0);
            generateSummary(chatId, 'יומי (אתמול)', startDate, endDate);
            break;
        case 'weekly':
            endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, -1); // End of yesterday
            startDate = new Date(endDate);
            startDate.setDate(endDate.getDate() - 6); // 7 days including start date
            startDate.setHours(0,0,0,0);
            generateSummary(chatId, 'שבועי אחרון', startDate, endDate);
            break;
        case 'monthly':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1, 0, 0, 0);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
            generateSummary(chatId, 'חודשי (חודש קודם)', startDate, endDate);
            break;
    }
};

const scheduleTasks = () => {
    db.all("SELECT chat_id FROM subscriptions", [], (err, rows) => {
        if (err) {
            console.error("Failed to get subscribers", err);
            return;
        }
        const subscribers = rows.map(r => r.chat_id);

        // Daily summary at 00:00 for the previous day
        cron.schedule('0 0 * * *', () => {
            console.log('Running daily summary cron job...');
            subscribers.forEach(chatId => sendSummary(chatId, 'daily'));
        });

        // Weekly summary at 00:00 on Monday for the past week
        cron.schedule('0 0 * * 1', () => {
             console.log('Running weekly summary cron job...');
            subscribers.forEach(chatId => sendSummary(chatId, 'weekly'));
        });

        // Monthly summary at 00:00 on the 1st of the month
        cron.schedule('0 0 1 * *', () => {
            console.log('Running monthly summary cron job...');
            subscribers.forEach(chatId => sendSummary(chatId, 'monthly'));
        });
        
        // Daily inventory check at 08:00
        cron.schedule('0 8 * * *', () => {
            console.log('Running daily inventory check...');
            subscribers.forEach(chatId => checkLowInventory(chatId));
        });
        
        console.log(`Scheduled tasks for ${subscribers.length} subscribers.`);
    });
};

// --- בדיקת מלאי נמוך ---
const checkLowInventory = (chatId) => {
    db.all("SELECT * FROM inventory WHERE quantity <= min_quantity ORDER BY product_name", [], (err, rows) => {
        if (err) {
            console.error("Error checking low inventory:", err.message);
            return;
        }
        if (rows.length === 0) {
            return; // No low inventory items
        }
        
        let message = '*🚨 התראת מלאי נמוך:*\n\n';
        rows.forEach(row => {
            let locationStr = row.location ? ` 📍${row.location}` : '';
            message += `🔴 *${row.product_name}*\n`;
            message += `   📦 ${row.quantity} ${row.unit} (מינימום: ${row.min_quantity})${locationStr}\n`;
            message += `   💡 מומלץ להזמין: ${row.min_quantity - row.quantity + 10} ${row.unit}\n\n`;
        });
        
        message += '_התראה אוטומטית - בדיקת מלאי יומית_';
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    });
};

console.log("Script execution finished. Bot is now polling for messages."); 

function generateSummary(chatId, period, startDate, endDate, recipientName = null) {
    let query = `SELECT id, recipient, item, amount, destination, timestamp FROM transactions WHERE timestamp >= ? AND timestamp <= ?`;
    const params = [startDate.toISOString(), endDate.toISOString()];

    if (recipientName) {
        query += ` AND recipient = ? COLLATE NOCASE`;
        params.push(recipientName);
    }
    query += ` ORDER BY timestamp DESC`;

    db.all(query, params, (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "אירעה שגיאה בקבלת הנתונים.", mainMenuKeyboard);
            return console.error(err.message);
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
                    return; // Skip this row
                }

                const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                // Using a more spaced-out and clear format
                summaryText += `👤 *${row.recipient}* | 📦 ${row.item} | 💰 ${row.amount}₪ | 📍 ${row.destination || 'לא צוין'} | 📅 ${dateStr} ${timeStr}\n`;
            });
            summaryText += `\n*סה"כ: ${rows.length} שליחויות בסכום כולל של ${totalAmount.toFixed(2)}₪*`;
        }
        
        const summaryOptions = { ...mainMenuKeyboard, parse_mode: 'Markdown' };
        bot.sendMessage(chatId, summaryText, summaryOptions);
    });
} 