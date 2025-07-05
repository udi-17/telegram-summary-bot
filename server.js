const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// Route for the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`🛍️ אתר המכירות פועל בכתובת: http://localhost:${PORT}`);
    console.log(`✨ האתר מוכן לשימוש!`);
    console.log(`📱 פתחו את הדפדפן והיכנסו לכתובת לעיל`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 סוגר את השרת...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 סוגר את השרת...');
    process.exit(0);
});