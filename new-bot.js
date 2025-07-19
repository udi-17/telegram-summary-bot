require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const config = require('./bot-config');

// יצירת בוט Telegram חדש
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// הגדרות הבוט מקובץ התצורה
const WELCOME_IMAGE_URL = config.welcomeImage.url;
const TARGET_USER = config.targetUser;

// פונקציה ליצירת מקלדת inline עם כפתור הפניה
function createWelcomeKeyboard() {
    return {
        inline_keyboard: [
            [
                {
                    text: config.buttons.goToUser,
                    url: `https://t.me/${TARGET_USER.replace('@', '')}`
                }
            ],
            [
                {
                    text: config.buttons.contact,
                    callback_data: 'contact'
                },
                {
                    text: config.buttons.info,
                    callback_data: 'info'
                }
            ]
        ]
    };
}

// טיפול בהודעת /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'משתמש';
    
    console.log(`🚀 משתמש חדש התחבר: ${userName} (${chatId})`);
    
    // הודעת ברכה עם תמונה
    const welcomeText = `🎉 שלום ${userName}!

ברוכים הבאים לבוט החדש שלנו!

🌟 מה אנחנו מציעים:
• שירות מקצועי ואמין
• תמיכה 24/7
• ממשק ידידותי למשתמש

👆 לחץ על הכפתור למעלה כדי לעבור לחשבון המומלץ שלנו
או בחר באחת מהאפשרויות הנוספות להלן:`;

    try {
        // שליחת תמונה עם הודעת ברכה וכפתורים
        await bot.sendPhoto(chatId, WELCOME_IMAGE_URL, {
            caption: welcomeText,
            reply_markup: createWelcomeKeyboard()
        });
    } catch (error) {
        console.error('❌ שגיאה בשליחת תמונת הברכה:', error);
        // אם יש בעיה עם התמונה, שלח רק הודעה
        await bot.sendMessage(chatId, welcomeText, {
            reply_markup: createWelcomeKeyboard()
        });
    }
});

// טיפול בלחיצות על כפתורים
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    
    console.log(`🔘 נלחץ כפתור: ${data}`);
    
    // מענה לכפתור
    await bot.answerCallbackQuery(callbackQuery.id);
    
    switch (data) {
        case 'contact':
            await bot.sendMessage(chatId, `📞 יצירת קשר:

📧 אימייל: ${config.contact.email}
📱 טלפון: ${config.contact.phone}
🌐 אתר: ${config.contact.website}
📍 כתובת: ${config.contact.address}
💬 טלגרם: ${TARGET_USER}

נשמח לעמוד לשירותכם!`);
            break;
            
        case 'info':
            await bot.sendMessage(chatId, `ℹ️ מידע נוסף על הבוט:

🏢 שם: ${config.botInfo.name}
🤖 גרסה: ${config.botInfo.version}
📋 תיאור: ${config.botInfo.description}

✨ תכונות:
${config.botInfo.features.map(feature => `• ${feature}`).join('\n')}

🔗 לביקור בחשבון המומלץ: ${TARGET_USER}`);
            break;
    }
});

// טיפול בהודעות רגילות
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // דלג על הודעות פקודה
    if (text && text.startsWith('/')) {
        return;
    }
    
    console.log(`📨 הודעה מ-${msg.from.first_name}: ${text}`);
    
    // תגובה אוטומטית
    const randomResponse = config.autoResponses[Math.floor(Math.random() * config.autoResponses.length)];
    await bot.sendMessage(chatId, randomResponse);
});

// פקודת עזרה
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    
    const helpText = `🆘 עזרה - הוראות שימוש:

🔸 /start - הפעלת הבוט וקבלת מסך הברכה
🔸 /help - הצגת הודעת עזרה זו
🔸 /info - מידע כללי על הבוט

💡 טיפים:
• השתמש בכפתורים לניווט מהיר
• כל הודעה רגילה תקבל מענה אוטומטי
• לשירות מקצועי עבור ל-${TARGET_USER}

זקוק לעזרה נוספת? פנה אלינו דרך הכפתורים במסך הראשי!`;
    
    await bot.sendMessage(chatId, helpText);
});

// פקודת מידע
bot.onText(/\/info/, async (msg) => {
    const chatId = msg.chat.id;
    
    const infoText = `ℹ️ מידע על הבוט:

🏢 שם: ${config.botInfo.name}
📋 תיאור: ${config.botInfo.description}
🤖 גרסה: ${config.botInfo.version}
🛠️ טכנולוגיה: Node.js + Telegram Bot API

✨ תכונות מיוחדות:
${config.botInfo.features.map(feature => `• ${feature}`).join('\n')}

🔗 לשירות מלא: ${TARGET_USER}
📅 זמינות: 24/7`;
    
    await bot.sendMessage(chatId, infoText);
});

// טיפול בשגיאות
bot.on('polling_error', (error) => {
    console.error('❌ שגיאת polling:', error);
});

console.log('🤖 הבוט החדש פועל!');
console.log(`🎯 מפנה למשתמש: ${TARGET_USER}`);
console.log('⏳ ממתין להודעות...');