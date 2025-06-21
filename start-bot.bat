@echo off
cd "C:\Users\Lenovo\Desktop\תמונות\telegram-summary-bot"
:start
echo Starting bot...
node index.js
echo Bot crashed. Restarting in 5 seconds...
timeout /t 5
goto start 