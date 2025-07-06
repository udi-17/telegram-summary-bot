#!/bin/bash

echo "🤖 ברוכים הבאים לבוט הסיכומים!"
echo "================================"
echo "🚀 מפעיל את הבוט אוטומטית..."
echo ""

# בדיקה אם הבוט כבר רץ
if pm2 list | grep -q "telegram-bot"; then
    echo "✅ הבוט כבר רץ!"
    pm2 list
else
    echo "🔄 מתחיל את הבוט..."
    cd "$(dirname "$0")"
    pm2 start index.js --name "telegram-bot"
    echo "✅ הבוט הופעל בהצלחה!"
fi

echo ""
echo "📊 לצפיה בסטטוס: pm2 status"
echo "📜 לצפיה בלוגים: pm2 logs telegram-bot"
echo "🔄 להפעלה מחדש: pm2 restart telegram-bot"
echo "🛑 לעצירה: pm2 stop telegram-bot"
echo "================================"