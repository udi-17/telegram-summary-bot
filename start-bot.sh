#!/bin/bash

# Start the Telegram Summary Bot
echo "Starting Telegram Summary Bot..."

# Function to handle interruption
trap 'echo -e "\nStopping bot..."; exit 0' INT TERM

# Main loop to restart the bot if it crashes
while true; do
    echo "[$(date)] Starting bot..."
    node index.js
    
    # Check exit code
    if [ $? -eq 0 ]; then
        echo "[$(date)] Bot stopped normally."
        break
    else
        echo "[$(date)] Bot crashed. Restarting in 5 seconds..."
        sleep 5
    fi
done