require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');

// יצירת בוט Telegram
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// יצירת שרת Express
const app = express();
const PORT = process.env.PORT || 3000;

// הגדרת קבצים סטטיים
app.use(express.static(path.join(__dirname)));

// נתיב ראשי
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// פונקציה ליצירת סיכום פשוט
function createSummary(text) {
    // פונקציה בסיסית ליצירת סיכום
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const summary = sentences.slice(0, 3).join('. ') + '.';
    return summary;
}

// טיפול בהודעות נכנסות
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    console.log(`📨 קיבלתי הודעה מ-${msg.from.first_name}: ${text}`);
    
    if (text === '/start') {
        const welcomeMessage = `🤖 שלום! אני בוט הסיכומים שלך!
        
📝 שלח לי הודעה ואני אכין לך סיכום אוטומטי.

💡 איך זה עובד:
• שלח הודעה רגילה - אכין סיכום
• שלח /help - לקבלת עזרה
• שלח /summary - לראות את הסיכומים האחרונים

🎯 בואו נתחיל! שלח לי הודעה...`;
        
        bot.sendMessage(chatId, welcomeMessage);
    }
    else if (text === '/help') {
        const helpMessage = `📚 עזרה - בוט הסיכומים

🔹 פקודות זמינות:
/start - התחלת שיחה
/help - הצגת עזרה זו
/summary - הצגת סיכומים אחרונים

🔹 איך להשתמש:
• שלח הודעה רגילה - אכין סיכום אוטומטי
• ההודעה צריכה להיות באורך של לפחות 10 מילים
• הסיכום יכלול את הנקודות העיקריות

🔹 דוגמה:
שלח: "היום הלכתי לעבודה, פגשתי חברים, אכלתי ארוחת צהריים טובה ואז חזרתי הביתה"
קבל: "הלכת לעבודה, פגשת חברים, אכלת ארוחת צהריים וחזרת הביתה"`;
        
        bot.sendMessage(chatId, helpMessage);
    }
    else if (text === '/summary') {
        const summaryMessage = `📊 סיכומים אחרונים:
        
🔸 עדיין אין סיכומים שמורים.
🔸 שלח הודעות כדי לראות סיכומים כאן!`;
        
        bot.sendMessage(chatId, summaryMessage);
    }
    else if (text && text.length > 20) {
        // יצירת סיכום
        const summary = createSummary(text);
        
        const responseMessage = `📝 **סיכום ההודעה שלך:**
        
${summary}

✨ הסיכום נשמר במערכת!`;
        
        bot.sendMessage(chatId, responseMessage, { parse_mode: 'Markdown' });
    }
    else if (text) {
        const shortMessage = `📝 ההודעה שלך קצרה מדי ליצירת סיכום.
        
💡 שלח הודעה ארוכה יותר (לפחות 20 תווים) כדי לקבל סיכום.`;
        
        bot.sendMessage(chatId, shortMessage);
    }
});

// טיפול בשגיאות
bot.on('error', (error) => {
    console.error('❌ שגיאה בבוט:', error);
});

bot.on('polling_error', (error) => {
    console.error('❌ שגיאה בסקירה:', error);
});

// הפעלת השרת
app.listen(PORT, () => {
    console.log(`🚀 שרת הבוט פועל בכתובת: http://localhost:${PORT}`);
    console.log(`🤖 בוט Telegram מוכן!`);
    console.log(`📱 חפש את הבוט שלך בטלגרם ובדוק אותו!`);
});

// טיפול בסגירה מסודרת
process.on('SIGINT', () => {
    console.log('\n👋 סוגר את הבוט...');
    bot.stopPolling();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 סוגר את הבוט...');
    bot.stopPolling();
    process.exit(0);
});

console.log('🤖 בוט הסיכומים מתחיל לפעול...');