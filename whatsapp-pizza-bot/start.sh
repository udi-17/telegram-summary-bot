#!/bin/bash

echo "🍕 Starting WhatsApp Pizza Bot..."
echo "==================================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Create data directory if it doesn't exist
if [ ! -d "data" ]; then
    echo "📁 Creating data directory..."
    mkdir -p data
    echo ""
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "✏️  Please edit .env file with your configuration"
    echo ""
fi

echo "🚀 Starting bot..."
echo "📱 Scan the QR code with WhatsApp when it appears"
echo ""

# Start the bot
npm start