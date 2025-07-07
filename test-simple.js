const TelegramBot = require('node-telegram-bot-api');

const token = '7777403969:AAGCHpsuGMC-D30aiTcbXyUmRdmmlg-gerw';

console.log('🚀 מתחיל בדיקת טוקן פשוטה...');
console.log('📱 טוקן:', token);

const bot = new TelegramBot(token, { 
    polling: {
        interval: 2000,
        autoStart: true,
        params: {
            timeout: 10
        }
    }
});

bot.on('polling_error', (error) => {
    console.log('❌ שגיאת polling:', error.code, error.message);
});

bot.on('error', (error) => {
    console.log('❌ שגיאה כללית:', error.message);
});

bot.on('message', (msg) => {
    console.log('✅ הודעה התקבלה!', msg.text);
    bot.sendMessage(msg.chat.id, '🎉 הבוט עובד מצוין!');
});

console.log('⏰ הבוט יעבד 30 שניות...');

setTimeout(() => {
    console.log('🔚 סיום בדיקה');
    process.exit(0);
}, 30000);