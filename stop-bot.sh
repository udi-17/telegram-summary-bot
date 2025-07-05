#!/bin/bash

echo "🛑 עוצר את בוט הטלגרם..."

# מציאת כל תהליכי הבוט ועצירתם
BOT_PIDS=$(ps aux | grep "node index.js" | grep -v grep | awk '{print $2}')

if [ -z "$BOT_PIDS" ]; then
    echo "❌ הבוט לא פועל כרגע"
else
    echo "🔍 נמצאו תהליכי בוט: $BOT_PIDS"
    kill $BOT_PIDS
    echo "✅ הבוט נעצר בהצלחה"
fi