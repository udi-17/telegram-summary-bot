#!/bin/bash
echo "🚀 מתחיל הפעלת הבוט..."
echo "🔧 מפעיל את הסביבה הווירטואלית..."
source venv/bin/activate
echo "✅ הבוט מתחיל עכשיו!"
echo "📱 לעצירת הבוט לחץ Ctrl+C"
echo "📋 הלוגים נשמרים בקובץ bot.log"
echo "-----------------------------------"
python3 telegram_bot.py