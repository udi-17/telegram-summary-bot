// welcome_bot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// ////////////////////////////////////////////////////////////
// Bot configuration
// ////////////////////////////////////////////////////////////
// The token for this bot should be stored in the .env file:
// NEW_BOT_TOKEN=123456:ABC-DEF...
//
// Additional optional environment variables:
// SPLASH_IMAGE_URL   – public URL to the image that will be shown on the splash screen
// TARGET_USERNAME    – username (without @) that the button will open in Telegram
//
// Example .env entries:
// SPLASH_IMAGE_URL=https://example.com/welcome.jpg
// TARGET_USERNAME=my_other_username
// ////////////////////////////////////////////////////////////

const token = process.env.NEW_BOT_TOKEN;
if (!token) {
    console.error('❌ NEW_BOT_TOKEN is missing from environment variables.');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Default values in case env vars are not provided
const splashImageUrl = process.env.SPLASH_IMAGE_URL || 'https://placehold.co/600x400?text=Welcome';
const targetUsername = process.env.TARGET_USERNAME || 'Telegram'; // Fallback to Telegram official

// ////////////////////////////////////////////////////////////
// Handlers
// ////////////////////////////////////////////////////////////

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    const caption = `👋 *ברוכים הבאים!*

אני בוט ברוכים הבאים. לחצו על הכפתור כדי לעבור לפרופיל הרצוי.`;

    const inlineKeyboard = {
        inline_keyboard: [
            [
                {
                    text: `מעבר אל @${targetUsername}`,
                    url: `https://t.me/${targetUsername}`
                }
            ]
        ]
    };

    bot.sendPhoto(chatId, splashImageUrl, {
        caption,
        parse_mode: 'Markdown',
        reply_markup: inlineKeyboard
    }).catch((err) => {
        console.error('❌ Failed to send splash message:', err);
    });
});

bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error);
});

console.log('🚀 Splash bot is up and running!');