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
            [{ text: 'אנשי קשר' }, { text: 'התחלה' }]
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
            const dateStr = `${timestamp.getDate().toString().padStart(2, '0')}/${(timestamp.getMonth() + 1).toString().padStart(2, '0')}`;
            bot.sendMessage(chatId, `נשמר (מספר #${this.lastID}): שליחה ל-${recipient} של ${item} בסכום ${amount} ליעד ${destination} בתאריך ${dateStr}`, mainMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            delete userState[chatId];
        });
    } else {
        bot.sendMessage(chatId, "הפורמט לא נכון. אנא שלח בפורמט: פריט סכום יעד (לדוגמה: אקמול 50 רעננה)", mainMenuKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
    }
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
    const response = "ברוך הבא לבוט הסיכומים! \n\n" +
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
    db.all("SELECT name FROM contacts ORDER BY name COLLATE NOCASE", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת אנשי הקשר.", mainMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
            return;
        }
        if (rows.length === 0) {
            bot.sendMessage(chatId, "ספר הכתובות ריק. ניתן להוסיף איש קשר עם הפקודה 'הוסף איש קשר [שם]', או פשוט לרשום שליחות והנמען יישמר אוטומטית.", mainMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return;
        }
        const contactButtons = rows.map(row => [{ text: row.name }]);
        contactButtons.push([{ text: 'חזור' }]);
        const contactsKeyboard = { reply_markup: { keyboard: contactButtons, resize_keyboard: true, one_time_keyboard: true } };
        bot.sendMessage(chatId, "בחר איש קשר לקבלת סיכום מלא:", contactsKeyboard)
            .catch(e => console.error('Error sending message:', e.message));
    });

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

  } else if (command === 'מחק איש קשר') {
    console.log(`Executing 'מחק איש קשר' for chat ID: ${chatId}`);
    db.all("SELECT name FROM contacts ORDER BY name COLLATE NOCASE", [], (err, rows) => {
        if (err) {
            bot.sendMessage(chatId, "שגיאה בשליפת אנשי הקשר.", mainMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            console.error('Database error:', err.message);
            return;
        }
        if (rows.length === 0) {
            bot.sendMessage(chatId, "ספר הכתובות ריק, אין את מי למחוק.", mainMenuKeyboard)
                .catch(e => console.error('Error sending message:', e.message));
            return;
        }
        const inlineKeyboard = rows.map(row => [{ text: `❌ ${row.name}`, callback_data: `delete_contact:${row.name}` }]);
        inlineKeyboard.push([{ text: "ביטול", callback_data: 'cancel_action' }]);
        bot.sendMessage(chatId, "בחר איש קשר למחיקה:", { reply_markup: { inline_keyboard: inlineKeyboard } })
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
            const dateStr = `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getFullYear()}`;
            const timeStr = `${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;

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
                    const dateStr = `${timestamp.getDate().toString().padStart(2, '0')}/${(timestamp.getMonth() + 1).toString().padStart(2, '0')}`;
                    bot.sendMessage(chatId, `נשמר (מספר #${this.lastID}): שליחה ל-${recipient} של ${item} בסכום ${amount} ליעד ${destination} בתאריך ${dateStr}`, mainMenuKeyboard)
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

                const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
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