const TelegramBot = require('node-telegram-bot-api');

const token = '7688500141:AAHqfWSYxf-z2pWULlWf1e4vHtsxN_au7do';

console.log('🚀 בוט פשוט לבדיקה');
console.log('📱 טוקן:', token);

const bot = new TelegramBot(token, { polling: true });

console.log('✅ בוט יצר בהצלחה');

bot.on('polling_error', (error) => {
    console.log('❌ שגיאת polling:', error.message);
});

bot.on('error', (error) => {
    console.log('❌ שגיאה כללית:', error.message);
});

bot.on('message', (msg) => {
    console.log('✅ הודעה התקבלה:', msg.text);
    bot.sendMessage(msg.chat.id, 'שלום! הבוט עובד מצוין! 🎉');
});

console.log('⏰ הבוט רץ - נסה לשלוח הודעה...');

// אל תסגור - תן לו לרוץ
process.on('SIGINT', () => {
    console.log('🔚 בוט נעצר');
    process.exit(0);
});