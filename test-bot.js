const TelegramBot = require('node-telegram-bot-api');

// --- בדיקת טוקן ---
const token = '7777403969:AAGCHpsuGMC-D30aiTcbXyUmRdmmlg-gerw';

console.log('🔍 בודק טוקן:', token);
console.log('🔍 אורך טוקן:', token.length);

const bot = new TelegramBot(token, { polling: true });

console.log('🚀 מתחיל בוט...');

bot.on('polling_error', (error) => {
    console.log('❌ שגיאת polling:', error.message);
});

bot.on('error', (error) => {
    console.log('❌ שגיאה כללית:', error.message);
});

bot.getMe().then((botInfo) => {
    console.log('✅ פרטי הבוט:', botInfo);
    console.log('🎉 הבוט עובד מצוין!');
    process.exit(0);
}).catch((error) => {
    console.log('❌ שגיאה בקבלת פרטי בוט:', error.message);
    process.exit(1);
});

setTimeout(() => {
    console.log('⏰ זמן קצוב - עוצר בדיקה');
    process.exit(1);
}, 10000);